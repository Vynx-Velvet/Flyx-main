/**
 * M3U8 Playlist Proxy
 *
 * Recursively proxies HLS playlists from the CDN with proper Referer/Origin
 * headers. Rewrites ALL URLs (absolute + relative) to route through this
 * proxy (for .m3u8 playlists) or the segment proxy (for .ts/.m4s/.mp4).
 *
 * The CDN (phantemlis.top) checks Referer/Origin and may use anti-bot
 * protection (Cloudflare etc.) that blocks Node.js TLS fingerprints.
 * We try multiple strategies:
 *   1. Python curl_cffi service (Chrome TLS impersonation) — best
 *   2. Direct fetch with Referer/Origin headers (retry x2)
 *   3. Direct fetch without Referer (some CDNs prefer anonymous)
 *   4. Direct fetch with CDN origin as referer
 *   5. Native https.get (different TLS stack than undici)
 *
 * Security: session-or-signature auth (VLC opens the signed playlist URL
 * minted by /api/livetv/stream); every upstream hop is checked with
 * assertPublicUrl; bodies are size-capped; every URI written into the
 * rewritten playlist is signed so cookie-less players can follow it.
 */

import { NextRequest, NextResponse } from "next/server";
import { get as httpsGet } from "https";
import { get as httpGet } from "http";
import { needsRelaxedTLS } from "@flyx/core/utils";
import { prefetchSegments, safeRelaxedFetch } from "@/lib/livetv/segment-cache";
import { proxyAuthorization, signProxyUrl } from "@/lib/security/proxy-sign";
import { BlockedUrlError, assertPublicUrl, guardedLookup, readTextLimited } from "@/lib/security/safe-fetch";
import {
  PROXY_SECURITY_HEADERS,
  applySignedCors,
  proxyJsonError,
  proxyUnauthorized,
  rewriteHlsPlaylist,
  signedPreflight,
} from "@/lib/media-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0";
// Opt-in only (see dlhd.ts) — a default localhost port cost a full timeout
// per request whenever something else owned it.
const SERVICE_URL = (process.env.DLHD_SERVICE_URL || "").trim() || null;

/** Live playlists are tiny; anything bigger is not a playlist. */
const MAX_PLAYLIST_BYTES = 4 * 1024 * 1024;

/** Tags whose URI="…" names another playlist (not a segment/key). */
const PLAYLIST_URI_TAGS = new Set(["EXT-X-MEDIA", "EXT-X-I-FRAME-STREAM-INF", "EXT-X-RENDITION-REPORT"]);

function isPlaylist(line: string): boolean {
  return line.trim().includes(".m3u8");
}

/**
 * Fetch via native Node.js https.get — different TLS fingerprint than undici/fetch.
 * Handles redirects (max 5). Returns full response body as string or null.
 */
function nativeGet(url: string, referer: string, cookies?: string, timeoutMs = 10000): Promise<string | null> {
  return new Promise((resolve) => {
    const u = new URL(url);
    const get = u.protocol === "https:" ? httpsGet : httpGet;
    const headers: Record<string, string> = {
      "User-Agent": UA,
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate",
      "Cache-Control": "no-cache",
    };
    if (referer) {
      headers.Referer = referer;
      headers.Origin = referer;
    }
    if (cookies) {
      headers.Cookie = cookies;
    }

    let redirects = 0;
    const MAX_REDIRECTS = 5;

    function doRequest(target: string | URL) {
      const relaxed = needsRelaxedTLS(typeof target === "string" ? target : target.href);
      const opts = {
        headers,
        rejectUnauthorized: !relaxed,
        // Re-validate the address actually connected to (DNS rebinding).
        lookup: guardedLookup,
      };

      const req = get(target, opts, (res) => {
        // Handle redirects
        if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0) && res.headers.location) {
          if (++redirects > MAX_REDIRECTS) { resolve(null); return; }
          let redirectUrl: URL;
          try {
            redirectUrl = new URL(res.headers.location, target instanceof URL ? target : new URL(target));
          } catch {
            res.resume();
            resolve(null);
            return;
          }
          // Update referer for redirect
          headers.Referer = target.toString();
          res.resume(); // drain
          // Every hop must resolve to a public address (no LAN/loopback).
          assertPublicUrl(redirectUrl).then(
            () => doRequest(redirectUrl),
            () => resolve(null),
          );
          return;
        }

        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_PLAYLIST_BYTES) {
            req.destroy();
            resolve(null);
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf-8");
          resolve(text);
        });
        res.on("error", () => { resolve(null); });
      });

      req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null); });
      req.on("error", () => { resolve(null); });
      req.end();
    }

    assertPublicUrl(u).then(
      () => doRequest(url),
      () => resolve(null),
    );
  });
}

/**
 * Try to fetch a URL through the Python curl_cffi service.
 * curl_cffi impersonates Chrome's TLS fingerprint, bypassing
 * Cloudflare/bot-detection that blocks Node.js fetch().
 */
async function fetchViaService(
  url: string,
  referer: string,
  timeoutMs = 3000,
): Promise<{ ok: boolean; status: number; text: string } | null> {
  if (!SERVICE_URL) return null;
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeoutMs);
    const r = await fetch(
      `${SERVICE_URL}/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`,
      { signal: c.signal },
    );
    clearTimeout(t);
    if (!r.ok) return null;
    const text = await readTextLimited(r, MAX_PLAYLIST_BYTES);
    return { ok: true, status: 200, text };
  } catch {
    return null;
  }
}

/**
 * Fetch a URL with retries across different strategies.
 * Returns the response text if successful, null if all strategies fail.
 */
async function fetchPlaylist(
  url: string,
  origin: string,
  cookies?: string,
): Promise<{ text: string; strategy: string } | null> {
  const cdnOrigin = origin || new URL(url).origin;
  const baseHeaders: Record<string, string> = { "User-Agent": UA, Referer: cdnOrigin, Origin: cdnOrigin, Accept: "*/*" };
  if (cookies) baseHeaders["Cookie"] = cookies;

  // Strategy 1: Python curl_cffi service (Chrome TLS, best chance)
  console.log(`[Playlist] Strategy 1: Python service for ${url.substring(0, 60)}...`);
  const svcResult = await fetchViaService(url, cdnOrigin);
  if (svcResult?.text.trim().startsWith("#EXTM3U")) {
    console.log(`[Playlist] ✓ Python service succeeded`);
    return { text: svcResult.text, strategy: "python-service" };
  }
  if (svcResult) {
    const preview = svcResult.text.trim().substring(0, 80);
    console.warn(`[Playlist] ✗ Python service returned non-M3U8: "${preview}"`);
  } else {
    console.warn(`[Playlist] ✗ Python service unavailable`);
  }

  // Strategy 2: Relaxed-TLS fetch with Referer/Origin + Cookies (if available)
  // relaxedFetch uses undici Agent with rejectUnauthorized:false to bypass
  // TLS fingerprint blocking on Cloudflare-backed pirate CDNs.
  console.log(`[Playlist] Strategy 2: Relaxed-TLS fetch with ${cookies ? "cookies + " : ""}Referer/Origin`);
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500));
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 12000);
      const r = await safeRelaxedFetch(url, {
        headers: baseHeaders,
        signal: c.signal,
      });
      clearTimeout(t);

      if (r.ok) {
        const text = await readTextLimited(r, MAX_PLAYLIST_BYTES);
        if (text.trim().startsWith("#EXTM3U")) {
          console.log(`[Playlist] ✓ Relaxed-TLS fetch succeeded (attempt ${attempt + 1})`);
          return { text, strategy: `relaxed-fetch${cookies ? "+cookies" : ""}` };
        }
        const preview = text.trim().substring(0, 80);
        console.warn(`[Playlist] ✗ Relaxed-TLS fetch returned non-M3U8: "${preview}"`);
        // Don't retry if CDN returned HTML — it'll just block again
        if (preview.includes("<html") || preview.includes("<!DOCTYPE")) break;
      } else {
        console.warn(`[Playlist] ✗ Relaxed-TLS fetch HTTP ${r.status} (attempt ${attempt + 1})`);
        // A definitive 404 means the channel has no live playlist right now
        // (event channels only exist while the event runs) — don't burn
        // 20+ seconds on the other strategies.
        if (r.status === 404) return { text: "", strategy: "offline" };
      }
    } catch (err) {
      console.warn(`[Playlist] ✗ Relaxed-TLS fetch error (attempt ${attempt + 1}): ${(err as Error).message}`);
    }
  }

  // Strategy 3: No Referer/Origin (some CDNs prefer anonymous requests)
  console.log(`[Playlist] Strategy 3: Relaxed-TLS fetch without Referer`);
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 12000);
    const noRefHeaders: Record<string, string> = { "User-Agent": UA, Accept: "*/*" };
    if (cookies) noRefHeaders["Cookie"] = cookies;
    const r = await safeRelaxedFetch(url, {
      headers: noRefHeaders,
      signal: c.signal,
    });
    clearTimeout(t);

    if (r.ok) {
      const text = await readTextLimited(r, MAX_PLAYLIST_BYTES);
      if (text.trim().startsWith("#EXTM3U")) {
        console.log(`[Playlist] ✓ No-referer relaxed fetch succeeded`);
        return { text, strategy: "no-referer" };
      }
    }
  } catch (err) {
    console.warn(`[Playlist] ✗ No-referer relaxed fetch error: ${(err as Error).message}`);
  }

  // Strategy 4: Try with base URL origin (not the DLHD referer)
  try {
    const baseOrigin = new URL(url).origin;
    if (baseOrigin !== cdnOrigin) {
      console.log(`[Playlist] Strategy 4: Relaxed-TLS fetch with CDN origin "${baseOrigin}"`);
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 12000);
      const cdnHeaders: Record<string, string> = { "User-Agent": UA, Referer: baseOrigin, Origin: baseOrigin, Accept: "*/*" };
      if (cookies) cdnHeaders["Cookie"] = cookies;
      const r = await safeRelaxedFetch(url, {
        headers: cdnHeaders,
        signal: c.signal,
      });
      clearTimeout(t);

      if (r.ok) {
        const text = await readTextLimited(r, MAX_PLAYLIST_BYTES);
        if (text.trim().startsWith("#EXTM3U")) {
          console.log(`[Playlist] ✓ CDN-origin relaxed fetch succeeded`);
          return { text, strategy: "cdn-origin" };
        }
      }
    }
  } catch (err) {
    console.warn(`[Playlist] ✗ CDN-origin relaxed fetch error: ${(err as Error).message}`);
  }

  // Strategy 5: Native https.get (different TLS stack than undici/fetch)
  console.log(`[Playlist] Strategy 5: Native https.get${cookies ? " +cookies" : ""}`);
  try {
    const text = await nativeGet(url, cdnOrigin, cookies || undefined);
    if (text?.trim().startsWith("#EXTM3U")) {
      console.log(`[Playlist] ✓ Native https.get succeeded`);
      return { text, strategy: "native-https" };
    }
    if (text) {
      const preview = text.trim().substring(0, 80);
      console.warn(`[Playlist] ✗ Native https returned non-M3U8: "${preview}"`);
    }
  } catch (err) {
    console.warn(`[Playlist] ✗ Native https error: ${(err as Error).message}`);
  }

  return null;
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
  const m3u8Url = searchParams.get("url");
  const origin = searchParams.get("origin") || "";
  const cookie = searchParams.get("cookie") || "";

  if (!m3u8Url) {
    return proxyJsonError({ error: "Missing url parameter" }, 400);
  }

  // searchParams already percent-decodes once; decoding again would corrupt
  // signed CDN URLs ("%2B" in a signature → "+"). Use the values as-is.
  const decodedUrl = m3u8Url;
  const decodedOrigin = origin;
  const decodedCookie = cookie;
  if (!/^https?:\/\//i.test(decodedUrl)) {
    return proxyJsonError({ error: "Invalid playlist URL" }, 400);
  }
  try {
    await assertPublicUrl(decodedUrl);
  } catch {
    return proxyJsonError({ error: "Playlist URL not allowed" }, 403);
  }

  // Build cookie query suffix for sub-playlist and segment URLs. The DLHD
  // CDN wants the session cookies captured at extraction time; they only
  // come from /api/livetv/stream (inside a signed URL) and are never logged.
  const cookieParam = decodedCookie
    ? `&cookie=${encodeURIComponent(decodedCookie)}`
    : "";

  try {
    // Cache-bust like the upstream player does for manifests/levels so a
    // live playlist is never served stale by an intermediate cache.
    let bustedUrl = decodedUrl;
    if (decodedUrl.includes(".m3u8")) {
      try {
        const u = new URL(decodedUrl);
        u.searchParams.delete("_");
        u.searchParams.set("_", String(Date.now()));
        bustedUrl = u.href;
      } catch {
        /* leave as-is */
      }
    }
    const result = await fetchPlaylist(bustedUrl, decodedOrigin, decodedCookie || undefined);

    if (result?.strategy === "offline") {
      console.warn(`[Playlist] Channel offline (404) for ${decodedUrl.substring(0, 80)}`);
      return proxyJsonError(
        {
          error: "Channel is offline right now",
          detail: "This channel has no live stream at the moment. Event channels only go live while the event is on.",
        },
        404,
      );
    }

    if (!result) {
      console.error(
        `[Playlist] All strategies failed for ${decodedUrl.substring(0, 80)}`,
      );
      return proxyJsonError(
        {
          error: "CDN unreachable — all fetch strategies failed",
          detail: "The video CDN is blocking requests. The stream token may have expired or the CDN may be down.",
        },
        502,
      );
    }

    let playlist = result.text;
    console.log(`[Playlist] Got M3U8 via ${result.strategy} (${playlist.length} bytes)`);

    // The DLHD player strips PROGRAM-DATE-TIME before handing the playlist
    // to hls.js — the upstream timestamps are bogus and make hls.js compute
    // wrong live-edge positions. Mirror that.
    playlist = playlist.replace(/^#EXT-X-PROGRAM-DATE-TIME:.*\r?\n/gm, "");

    const playlistProxyBase = "/api/livetv/playlist";
    const segmentProxyBase = "/api/livetv/segment";
    const upstreamSegments: string[] = [];

    const proxied = (base: string, resolved: string) =>
      signProxyUrl(
        `${base}?url=${encodeURIComponent(resolved)}&origin=${encodeURIComponent(decodedOrigin)}${cookieParam}`,
      );

    // Every URI (bare lines and any tag's URI="…") goes back through our
    // proxies, signed; non-http(s) URIs are dropped by rewriteHlsPlaylist.
    playlist = rewriteHlsPlaylist(playlist, decodedUrl, (resolved, ctx) => {
      if (ctx.kind === "tag") {
        return proxied(PLAYLIST_URI_TAGS.has(ctx.tag) ? playlistProxyBase : segmentProxyBase, resolved);
      }
      if (isPlaylist(resolved)) return proxied(playlistProxyBase, resolved);
      // Media segment (any non-playlist URL line — DLHD's are image URLs)
      upstreamSegments.push(resolved);
      return proxied(segmentProxyBase, resolved);
    });

    // Pre-warm the segments hls.js will ask for first: the newest ones at
    // the live edge. They are ~2 MB images that must be fully downloaded and
    // unwrapped before playback can start, so fetching them now (in
    // parallel) instead of when the player asks (serially) is most of the
    // difference between a 1 s and a 5 s first frame.
    if (upstreamSegments.length) {
      prefetchSegments(upstreamSegments.slice(-6), {
        referer: decodedOrigin || undefined,
        origin: decodedOrigin || undefined,
        cookie: decodedCookie || undefined,
      });
    }

    return new NextResponse(playlist, {
      status: 200,
      headers: {
        ...PROXY_SECURITY_HEADERS,
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof BlockedUrlError) {
      return proxyJsonError({ error: "Upstream URL not allowed" }, 403);
    }
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    console.error(`[Playlist] ${isTimeout ? "Timed out" : "Error"}:`, isTimeout ? decodedUrl.substring(0, 80) : error);
    return proxyJsonError(
      { error: isTimeout ? "CDN request timed out" : "Playlist proxy error" },
      isTimeout ? 504 : 500,
    );
  }
}
