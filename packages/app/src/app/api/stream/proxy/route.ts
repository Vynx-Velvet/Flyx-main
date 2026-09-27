/**
 * GET /api/stream/proxy
 *
 * Stream proxy for HLS + MP4 content behind CDNs that require Referer/Origin headers.
 *
 * Query params:
 *   url     - The CDN URL to fetch (required)
 *   referer - The Referer header to send to the CDN (required)
 *   origin  - Optional Origin header to send to the CDN
 *
 * Supports Range requests for MP4 video seeking.
 *
 * VidSrc support: When a URL looks like a VidSrc stream CDN path
 * (contains /pl/{base64}/master.m3u8 or /pl/{base64}/...m3u8), the proxy
 * auto-fetches IP-bound tokens from {origin}/generate.php and appends them.
 * Tokens are cached per-host (bounded) for the lifetime of the server process.
 *
 * Security: callers must hold a session (browser playback — same-origin,
 * carries the flyx_token cookie) or a server-minted signature (VLC, ffmpeg,
 * and every URI this proxy writes into a rewritten playlist). Every
 * upstream hop goes through safeFetch (no private/loopback targets, each
 * redirect re-validated), the output Content-Type is allowlisted to media
 * types. CORS (ACAO: *) is emitted only for signature-authorized requests
 * (Chromecast receiver), never for cookie-authorized ones.
 */

import { NextRequest, NextResponse } from "next/server";
import { getTokenUrl } from "@flyx/extractors/services";
import { proxyAuthorization, signProxyUrl } from "@/lib/security/proxy-sign";
import { BlockedUrlError, BodyTooLargeError, readTextLimited, safeFetch } from "@/lib/security/safe-fetch";
import {
  BoundedCache,
  PROXY_SECURITY_HEADERS,
  applySignedCors,
  guardStream,
  looksLikeM3u8,
  peekStream,
  proxyJsonError,
  proxyUnauthorized,
  rewriteHlsPlaylist,
  safeMediaContentType,
  signedPreflight,
} from "@/lib/media-proxy";

export const runtime = "nodejs";
export const maxDuration = 30;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Upstream must send headers within this window. */
const HEADERS_TIMEOUT_MS = 15_000;
/** Playlists are small: the whole fetch (headers + body) must finish in this. */
const PLAYLIST_TOTAL_TIMEOUT_MS = 20_000;
/** Pass-through bodies: fail when upstream goes silent this long mid-body… */
const STREAM_IDLE_TIMEOUT_MS = 30_000;
/** …or the transfer outlives this (a paused <video> applies backpressure, not idle). */
const STREAM_TOTAL_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const MAX_PLAYLIST_BYTES = 4 * 1024 * 1024;
const MAX_CACHED_SEGMENT_BYTES = 50 * 1024 * 1024;
const PEEK_BYTES = 1024;

// ── Segment cache ────────────────────────────────────────────────

/**
 * aniwatchtv's /uwu/ CDNs throttle bursty segment pulls (a couple of fresh
 * segments per window, then the next request stalls until the browser's
 * loader times out into a fatal media error). Caching served segments in
 * memory means retries and reloads hit cache instead of the CDN — and LAN
 * viewers share the same bytes. MP4 (Range) responses are never cached.
 * Bounded by count and total bytes (LRU).
 */
const segmentCache = new BoundedCache<{ buf: Uint8Array; ct: string; status: number }>({
  maxEntries: 300,
  maxBytes: 256 * 1024 * 1024,
  ttlMs: 20 * 60 * 1000,
  sizeOf: (v) => v.buf.byteLength,
});

// ── VidSrc token cache ───────────────────────────────────────

/** Cache of IP-bound tokens keyed by CDN origin (e.g. "https://comityofcognomen.site"). */
const tokenCache = new BoundedCache<{ token: string; expiresAt: number }>({
  maxEntries: 64,
  ttlMs: 60 * 60 * 1000,
});

/**
 * Detect if a URL is from a VidSrc stream CDN based on path pattern.
 * VidSrc stream URLs look like: https://{host}/pl/{base64}/master.m3u8
 * Only the path is inspected — a query string can't trigger token fetches.
 */
function isVidSrcCdn(url: string): boolean {
  try {
    return /\/pl\/[A-Za-z0-9+/=._-]{40,}\//.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/**
 * Parse a /generate.php response into a token string.
 * The endpoint returns either a plain-text token or a JSON object
 * with a `token` / `data` / `string` / `result` field.
 */
function parseToken(text: string): string {
  if (!text) return "";
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      const j = JSON.parse(t);
      if (typeof j === "string") return j;
      if (j && typeof j === "object") return j.token || j.data || j.string || j.result || "";
    } catch { /* not valid JSON */ }
  }
  return t;
}

/**
 * Fetch a fresh IP-bound token from a VidSrc stream host.
 * Cached per-host; tokens expire based on JWT `exp` claim when parseable.
 */
async function getVidSrcToken(origin: string): Promise<string> {
  const cached = tokenCache.get(origin);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  // Build list of token endpoints to try, best first:
  //   1. Registered token URL from VidSrc API (gen_token_url) — most reliable
  //   2. CDN origin /generate.php (legacy — often TLS-blocked)
  const registeredUrl = getTokenUrl(origin);
  const endpoints = new Set<string>();
  if (registeredUrl) endpoints.add(registeredUrl);
  endpoints.add(`${origin}/generate.php`);

  for (const endpoint of endpoints) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 6000);
      let text: string;
      let status: number;
      try {
        const r = await safeFetch(endpoint, {
          headers: {
            "User-Agent": UA,
            Referer: "https://cloudorchestranova.com/",
            Origin: "https://cloudorchestranova.com",
          },
          signal: c.signal,
        });
        status = r.status;
        text = r.ok ? await readTextLimited(r, 16 * 1024) : "";
        if (!r.ok) await r.body?.cancel().catch(() => {});
      } finally {
        clearTimeout(t);
      }

      if (status < 200 || status >= 300) {
        console.warn(`[proxy] VidSrc token fetch failed: HTTP ${status} from ${endpoint}`);
        continue; // try next endpoint
      }

      const token = parseToken(text);

      if (token) {
        // Try to extract expiration from JWT
        let ttl = 55 * 60 * 1000; // default 55 min
        try {
          if (token.startsWith("eyJ")) {
            const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString());
            if (payload.exp) ttl = Math.min(ttl, (payload.exp * 1000) - Date.now() - 30000);
          }
        } catch { /* not JWT or can't parse */ }

        tokenCache.set(origin, { token, expiresAt: Date.now() + ttl });
        console.log(`[proxy] VidSrc token cached for ${origin} via ${new URL(endpoint).hostname} (TTL: ${Math.round(ttl / 1000)}s)`);
        return token;
      }
    } catch {
      // endpoint failed — try next one
    }
  }

  console.warn(`[proxy] All VidSrc token endpoints failed for ${origin}`);
  return "";
}

/** Response headers shared by every successful proxy response. */
function mediaHeaders(extra: Record<string, string>): Record<string, string> {
  return { ...PROXY_SECURITY_HEADERS, ...extra };
}

export async function GET(request: NextRequest) {
  const via = await proxyAuthorization(request);
  if (!via) return proxyUnauthorized();
  return applySignedCors(await handleGet(request), via);
}

export function OPTIONS(request: NextRequest) {
  return signedPreflight(request);
}

async function handleGet(request: NextRequest): Promise<NextResponse> {

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const referer = searchParams.get("referer");
  const origin = searchParams.get("origin") || undefined;

  if (!url) {
    return proxyJsonError({ error: "Missing url parameter" }, 400);
  }

  try {
    // searchParams.get() has already percent-decoded the value once, and
    // every producer encodes the upstream URL exactly once. Decoding again
    // would corrupt upstream URLs that legitimately contain %2B/%25/%26.
    let decodedUrl = url;
    const urlSuggestsHls = decodedUrl.includes(".m3u8");

    // ── VidSrc: auto-fetch IP-bound token for stream CDN hosts ──
    let vidToken = "";
    if (isVidSrcCdn(decodedUrl)) {
      try {
        const hostOrigin = new URL(decodedUrl).origin;
        vidToken = await getVidSrcToken(hostOrigin);
        if (vidToken) {
          decodedUrl += (decodedUrl.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(vidToken);
        }
      } catch { /* URL parse failed — continue without token */ }
    }

    // Forward client Range header for MP4 seeking.
    // If no Range is present, request the first 2MB so the CDN responds
    // instantly (265ms for Range vs 13s for full-file GET).
    const clientRange = request.headers.get("range");
    const upstreamHeaders: Record<string, string> = {
      "User-Agent": UA,
      Accept: "*/*",
    };
    if (referer) upstreamHeaders["Referer"] = referer;
    if (origin) upstreamHeaders["Origin"] = origin;
    if (clientRange) {
      upstreamHeaders["Range"] = clientRange;
    } else if (!urlSuggestsHls) {
      // Initial MP4 request — ask for just the start so we get a fast 206
      upstreamHeaders["Range"] = "bytes=0-2097152"; // first 2MB
    }

    // Serve cached segments WITHOUT touching the upstream CDN at all —
    // throttled hosts punish every bursty request, so a hit here is the
    // cheapest possible response. Only plain-200 non-M3U8 bodies are ever
    // cached, so a hit is always a segment.
    if (!clientRange) {
      const cached = segmentCache.get(decodedUrl);
      if (cached) {
        console.log(
          `[proxy] CACHE ${Math.round(cached.buf.byteLength / 1024)}KB ${decodedUrl.substring(0, 110)}`,
        );
        return new NextResponse(new Uint8Array(cached.buf), {
          status: cached.status,
          headers: mediaHeaders({
            "Content-Type": cached.ct,
            "Content-Length": String(cached.buf.byteLength),
            "Accept-Ranges": "bytes",
          }),
        });
      }
    }

    // Upstream has no timeout of its own — a throttled CDN accepts the
    // connection and then goes silent, which would otherwise hang the
    // request until the browser's own loader timeout (~10s) fatal-errors
    // the stream. Aborting early turns the hang into a retryable failure.
    // The header timer is replaced (not just cleared) once headers arrive:
    // playlists get a total deadline, bodies an idle/overall guard.
    const startedAt = Date.now();
    const ctrl = new AbortController();
    let timer = setTimeout(() => ctrl.abort(), HEADERS_TIMEOUT_MS);
    let upstream: Response;
    try {
      upstream = await safeFetch(decodedUrl, {
        headers: upstreamHeaders,
        signal: ctrl.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
    clearTimeout(timer);

    // Per-request trace (status/duration/url) — lands in the desktop
    // server log so CDN throttling is visible instead of silent.
    console.log(
      `[proxy] ${upstream.status} ${Date.now() - startedAt}ms ${decodedUrl.substring(0, 110)}`,
    );

    if (!upstream.ok) {
      await upstream.body?.cancel().catch(() => {});
      // If upstream returns an error status, pass it through
      // Don't proxy 404s etc. — let the caller know
      if (upstream.status === 404 || upstream.status === 403) {
        return proxyJsonError(
          { error: `Upstream ${upstream.status}`, url: decodedUrl.substring(0, 120) },
          upstream.status,
        );
      }
      return proxyJsonError({ error: `Upstream ${upstream.status}` }, upstream.status);
    }

    // ── Determine if this is an M3U8 playlist ──────────────────
    // The URL may not contain .m3u8 (e.g. uwu proxy tokens), but the
    // response can still be an HLS playlist. Peek at the first bytes
    // (never the whole body — MP4s stream straight through) to detect it.
    // Without this, M3U8 playlists from token-based proxies get streamed
    // as raw text, and relative paths like /uwu/... resolve against
    // localhost → 404.
    const contentType = upstream.headers.get("content-type") ?? "";
    let body: ReadableStream<Uint8Array> | null = upstream.body;
    let isM3u8 = false;
    if (body) {
      const peeked = await peekStream(body, PEEK_BYTES);
      body = peeked.stream;
      isM3u8 = looksLikeM3u8(new TextDecoder().decode(peeked.head));
    }

    // ── Route: Non-M3U8 content (MP4, TS segments, etc.) ──────
    if (!isM3u8) {
      const contentLength = upstream.headers.get("content-length");
      const contentRange = upstream.headers.get("content-range");
      const ct = safeMediaContentType(contentType || "video/mp4");

      const responseHeaders: Record<string, string> = mediaHeaders({
        "Content-Type": ct,
        "Accept-Ranges": "bytes",
      });

      if (!body) {
        return new NextResponse(null, { status: upstream.status, headers: responseHeaders });
      }

      const guarded = guardStream(body, {
        idleMs: STREAM_IDLE_TIMEOUT_MS,
        totalMs: STREAM_TOTAL_TIMEOUT_MS,
      });

      if (contentRange) {
        responseHeaders["Content-Range"] = contentRange;
        if (contentLength) responseHeaders["Content-Length"] = contentLength;
        return new NextResponse(guarded, {
          status: 206,
          headers: responseHeaders,
        });
      }

      // Plain 200 body (HLS segments): buffer it (up to a cap) so
      // retries/reloads can be served from memory instead of hitting the
      // throttled CDN again. Anything larger streams straight through.
      const declared = Number(contentLength);
      if (
        !clientRange &&
        upstream.status === 200 &&
        !(Number.isFinite(declared) && declared > MAX_CACHED_SEGMENT_BYTES)
      ) {
        const peeked = await peekStream(guarded, MAX_CACHED_SEGMENT_BYTES + 1);
        if (peeked.head.byteLength <= MAX_CACHED_SEGMENT_BYTES) {
          const buf = peeked.head;
          segmentCache.set(decodedUrl, { buf, ct, status: upstream.status });
          return new NextResponse(new Uint8Array(buf), {
            status: upstream.status,
            headers: {
              ...responseHeaders,
              "Content-Length": String(buf.byteLength),
            },
          });
        }
        // Too big to cache — replay what we read, then the rest.
        if (contentLength) responseHeaders["Content-Length"] = contentLength;
        return new NextResponse(peeked.stream, {
          status: upstream.status,
          headers: responseHeaders,
        });
      }

      if (contentLength) {
        responseHeaders["Content-Length"] = contentLength;
      }

      return new NextResponse(guarded, {
        status: upstream.status,
        headers: responseHeaders,
      });
    }

    // ── Route: M3U8 playlist — rewrite all URLs to proxy ──────
    timer = setTimeout(() => ctrl.abort(), PLAYLIST_TOTAL_TIMEOUT_MS);
    let text: string;
    try {
      text = await readTextLimited(new Response(body), MAX_PLAYLIST_BYTES);
    } finally {
      clearTimeout(timer);
    }

    const rewritten = rewriteHlsPlaylist(text, decodedUrl, (absolute) => {
      const proxyParams = new URLSearchParams();
      if (referer) proxyParams.set("referer", referer);
      if (origin) proxyParams.set("origin", origin);
      proxyParams.set("url", absolute);
      return signProxyUrl(`/api/stream/proxy?${proxyParams.toString()}`);
    });

    return new NextResponse(rewritten, {
      status: 200,
      headers: mediaHeaders({
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-cache",
      }),
    });
  } catch (err) {
    if (err instanceof BlockedUrlError) {
      console.warn(`[proxy] Blocked upstream: ${err.message}`);
      return proxyJsonError({ error: "Upstream URL not allowed" }, 403);
    }
    if (err instanceof BodyTooLargeError) {
      return proxyJsonError({ error: "Upstream playlist too large" }, 502);
    }
    const msg = err instanceof Error ? err.message : String(err);
    // Distinguish TLS/cert errors from general network failures
    const isTLSError = /TLS|SSL|EPROTO|CERT|UNABLE_TO_VERIFY|certificate|ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(msg);
    console.error(`[proxy] Upstream fetch failed: ${msg.substring(0, 200)}`);
    return proxyJsonError(
      { error: isTLSError ? "Upstream TLS/connection error" : "Upstream unreachable" },
      502,
    );
  }
}
