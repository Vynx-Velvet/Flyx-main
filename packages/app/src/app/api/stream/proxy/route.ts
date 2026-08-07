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
 * Tokens are cached per-host for the lifetime of the server process.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ── VidSrc token cache ───────────────────────────────────────

/** Cache of IP-bound tokens keyed by CDN origin (e.g. "https://comityofcognomen.site"). */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Detect if a URL is from a VidSrc stream CDN based on path pattern.
 * VidSrc stream URLs look like: https://{host}/pl/{base64}/master.m3u8
 */
function isVidSrcCdn(url: string): boolean {
  return /\/pl\/[A-Za-z0-9+/=._-]{40,}\//.test(url);
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

  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 6000);
    const r = await fetch(`${origin}/generate.php`, {
      headers: {
        "User-Agent": UA,
        Referer: "https://cloudorchestranova.com/",
        Origin: "https://cloudorchestranova.com",
      },
      signal: c.signal,
    });
    clearTimeout(t);

    if (!r.ok) {
      console.warn(`[proxy] VidSrc token fetch failed: HTTP ${r.status} from ${origin}/generate.php`);
      return "";
    }

    const text = await r.text();
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
      console.log(`[proxy] VidSrc token cached for ${origin} (TTL: ${Math.round(ttl / 1000)}s)`);
    }

    return token;
  } catch {
    console.warn(`[proxy] VidSrc token fetch error from ${origin}`);
    return "";
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const referer = searchParams.get("referer");
  const origin = searchParams.get("origin") || undefined;

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    let decodedUrl = decodeURIComponent(url);
    const urlSuggestsHls = decodedUrl.includes(".m3u8");

    // ── VidSrc: auto-fetch IP-bound token for stream CDN hosts ──
    let vidToken = "";
    if (isVidSrcCdn(decodedUrl)) {
      try {
        const hostOrigin = new URL(decodedUrl).origin;
        vidToken = await getVidSrcToken(hostOrigin);
        if (vidToken) {
          decodedUrl += (decodedUrl.includes("?") ? "&" : "?") + "token=" + vidToken;
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

    const upstream = await fetch(decodedUrl, {
      headers: upstreamHeaders,
    });

    if (!upstream.ok) {
      // If upstream returns an error status, pass it through
      // Don't proxy 404s etc. — let the caller know
      if (upstream.status === 404 || upstream.status === 403) {
        return NextResponse.json(
          { error: `Upstream ${upstream.status}`, url: decodedUrl.substring(0, 120) },
          { status: upstream.status },
        );
      }
      return NextResponse.json(
        { error: `Upstream ${upstream.status}` },
        { status: upstream.status },
      );
    }

    // ── Determine if this is an M3U8 playlist ──────────────────
    // The URL may not contain .m3u8 (e.g. uwu proxy tokens), but the
    // response can still be an HLS playlist. Check Content-Type and
    // peek at body to detect it. Without this, M3U8 playlists from
    // token-based proxies get streamed as raw text, and relative paths
    // like /uwu/... resolve against localhost → 404.
    const contentType = upstream.headers.get("content-type") ?? "";
    const looksLikeHls =
      urlSuggestsHls ||
      contentType.includes("mpegurl") ||
      contentType.includes("x-mpegurl") ||
      contentType.includes("vnd.apple");

    let bodyText: string | null = null;

    if (!looksLikeHls) {
      // Peek at body to check if it starts with #EXTM3U
      // Only clone if we need to check — avoids double-reading MP4 bodies
      const cloned = upstream.clone();
      bodyText = await cloned.text();
      if (bodyText.trim().startsWith("#EXTM3U")) {
        // It's an M3U8 playlist — fall through to rewriting
      } else {
        bodyText = null; // not M3U8, stream below
      }
    }

    // ── Route: Non-M3U8 content (MP4, TS segments, etc.) ──────
    const isM3u8 = looksLikeHls || (bodyText && bodyText.trim().startsWith("#EXTM3U"));

    if (!isM3u8) {
      const contentLength = upstream.headers.get("content-length");
      const contentRange = upstream.headers.get("content-range");
      const ct = contentType || "video/mp4";

      const responseHeaders: Record<string, string> = {
        "Content-Type": ct,
        "Access-Control-Allow-Origin": "*",
        "Accept-Ranges": "bytes",
      };

      // If we already read the body as text (M3U8 check), return it
      if (bodyText !== null) {
        if (contentLength) responseHeaders["Content-Length"] = contentLength;
        return new NextResponse(bodyText, {
          status: upstream.status,
          headers: responseHeaders,
        });
      }

      if (contentRange) {
        responseHeaders["Content-Range"] = contentRange;
        if (contentLength) responseHeaders["Content-Length"] = contentLength;
        return new NextResponse(upstream.body, {
          status: 206,
          headers: responseHeaders,
        });
      }

      if (contentLength) {
        responseHeaders["Content-Length"] = contentLength;
      }

      return new NextResponse(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    }

    // ── Route: M3U8 playlist — rewrite all URLs to proxy ──────
    const text = bodyText ?? (await upstream.text());

    const proxyParams = new URLSearchParams();
    if (referer) proxyParams.set("referer", referer);
    if (origin) proxyParams.set("origin", origin);
    proxyParams.set("url", ""); // placeholder, appended per-line
    const proxyBase = `/api/stream/proxy?${proxyParams.toString()}`;

    // Build absolute base from the decoded URL for resolving relative paths
    const urlObj = new URL(decodedUrl);
    const pathBase = urlObj.origin + urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf("/") + 1);

    const rewritten = text
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // Rewrite #EXT-X-KEY URI
        if (trimmed.startsWith("#EXT-X-KEY") && trimmed.includes('URI="')) {
          return trimmed.replace(/URI="([^"]+)"/, (_m, uri: string) => {
            const absolute = uri.startsWith("http")
              ? uri
              : new URL(uri, pathBase).href;
            return `URI="${proxyBase}${encodeURIComponent(absolute)}"`;
          });
        }

        // Rewrite #EXT-X-MAP URI (fMP4 init segments)
        if (trimmed.startsWith("#EXT-X-MAP") && trimmed.includes('URI="')) {
          return trimmed.replace(/URI="([^"]+)"/, (_m, uri: string) => {
            const absolute = uri.startsWith("http")
              ? uri
              : new URL(uri, pathBase).href;
            return `URI="${proxyBase}${encodeURIComponent(absolute)}"`;
          });
        }

        // Skip other tags
        if (trimmed.startsWith("#")) return line;

        // URL line — rewrite through proxy
        if (trimmed.startsWith("http")) {
          return `${proxyBase}${encodeURIComponent(trimmed)}`;
        }

        const absolute = new URL(trimmed, pathBase).href;
        return `${proxyBase}${encodeURIComponent(absolute)}`;
      })
      .join("\n");

    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Range, Content-Type",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Distinguish TLS/cert errors from general network failures
    const isTLSError = /TLS|SSL|EPROTO|CERT|UNABLE_TO_VERIFY|certificate|ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(msg);
    console.error(`[proxy] Upstream fetch failed: ${msg.substring(0, 200)}`);
    return NextResponse.json(
      { error: isTLSError ? "Upstream TLS/connection error" : "Upstream unreachable" },
      { status: 502 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
    },
  });
}
