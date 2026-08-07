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
 */

import { NextRequest, NextResponse } from "next/server";
import { get as httpsGet } from "https";
import { get as httpGet } from "http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0";
const SERVICE_URL = process.env.DLHD_SERVICE_URL ?? "http://127.0.0.1:9876";

function resolveRelative(
  relative: string,
  baseUrl: string,
): string {
  if (relative.startsWith("http://") || relative.startsWith("https://")) {
    return relative;
  }
  const base = new URL(baseUrl);
  const dir = base.pathname.substring(0, base.pathname.lastIndexOf("/") + 1);
  return `${base.origin}${dir}${relative}`;
}

function isMediaSegment(line: string): boolean {
  const t = line.trim();
  return (
    t.includes(".ts") ||
    t.includes(".m4s") ||
    t.includes(".mp4") ||
    t.includes(".vtt") ||
    t.includes(".aac") ||
    t.includes(".ac3") ||
    t.includes(".eac3") ||
    t.includes(".mp3")
  );
}

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
      const opts = {
        headers,
        rejectUnauthorized: true,
      };

      const req = get(target, opts, (res) => {
        // Handle redirects
        if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0) && res.headers.location) {
          if (++redirects > MAX_REDIRECTS) { resolve(null); return; }
          const redirectUrl = new URL(res.headers.location, target instanceof URL ? target : new URL(target));
          // Update referer for redirect
          headers.Referer = target.toString();
          res.resume(); // drain
          doRequest(redirectUrl);
          return;
        }

        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
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

    doRequest(url);
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
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeoutMs);
    const r = await fetch(
      `${SERVICE_URL}/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`,
      { signal: c.signal },
    );
    clearTimeout(t);
    if (!r.ok) return null;
    const text = await r.text();
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
  const baseHeaders = cookies
    ? { "User-Agent": UA, Referer: cdnOrigin, Origin: cdnOrigin, Accept: "*/*", Cookie: cookies }
    : { "User-Agent": UA, Referer: cdnOrigin, Origin: cdnOrigin, Accept: "*/*" };

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

  // Strategy 2: Direct fetch with Referer/Origin + Cookies (if available)
  console.log(`[Playlist] Strategy 2: Direct fetch with ${cookies ? "cookies + " : ""}Referer/Origin`);
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500));
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 12000);
      const r = await fetch(url, {
        headers: baseHeaders,
        signal: c.signal,
      });
      clearTimeout(t);

      if (r.ok) {
        const text = await r.text();
        if (text.trim().startsWith("#EXTM3U")) {
          console.log(`[Playlist] ✓ Direct fetch succeeded (attempt ${attempt + 1})`);
          return { text, strategy: `direct-fetch${cookies ? "+cookies" : ""}` };
        }
        const preview = text.trim().substring(0, 80);
        console.warn(`[Playlist] ✗ Direct fetch returned non-M3U8: "${preview}"`);
        // Don't retry if CDN returned HTML — it'll just block again
        if (preview.includes("<html") || preview.includes("<!DOCTYPE")) break;
      } else {
        console.warn(`[Playlist] ✗ Direct fetch HTTP ${r.status} (attempt ${attempt + 1})`);
      }
    } catch (err) {
      console.warn(`[Playlist] ✗ Direct fetch error (attempt ${attempt + 1}): ${(err as Error).message}`);
    }
  }

  // Strategy 3: No Referer/Origin (some CDNs prefer anonymous requests)
  console.log(`[Playlist] Strategy 3: Direct fetch without Referer`);
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 12000);
    const noRefHeaders: Record<string, string> = { "User-Agent": UA, Accept: "*/*" };
    if (cookies) noRefHeaders["Cookie"] = cookies;
    const r = await fetch(url, {
      headers: noRefHeaders,
      signal: c.signal,
    });
    clearTimeout(t);

    if (r.ok) {
      const text = await r.text();
      if (text.trim().startsWith("#EXTM3U")) {
        console.log(`[Playlist] ✓ No-referer fetch succeeded`);
        return { text, strategy: "no-referer" };
      }
    }
  } catch (err) {
    console.warn(`[Playlist] ✗ No-referer fetch error: ${(err as Error).message}`);
  }

  // Strategy 4: Try with base URL origin (not the DLHD referer)
  try {
    const baseOrigin = new URL(url).origin;
    if (baseOrigin !== cdnOrigin) {
      console.log(`[Playlist] Strategy 4: Fetch with CDN origin "${baseOrigin}"`);
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 12000);
      const cdnHeaders: Record<string, string> = { "User-Agent": UA, Referer: baseOrigin, Origin: baseOrigin, Accept: "*/*" };
      if (cookies) cdnHeaders["Cookie"] = cookies;
      const r = await fetch(url, {
        headers: cdnHeaders,
        signal: c.signal,
      });
      clearTimeout(t);

      if (r.ok) {
        const text = await r.text();
        if (text.trim().startsWith("#EXTM3U")) {
          console.log(`[Playlist] ✓ CDN-origin fetch succeeded`);
          return { text, strategy: "cdn-origin" };
        }
      }
    }
  } catch (err) {
    console.warn(`[Playlist] ✗ CDN-origin fetch error: ${(err as Error).message}`);
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
  const { searchParams } = new URL(request.url);
  const m3u8Url = searchParams.get("url");
  const origin = searchParams.get("origin") || "";
  const cookie = searchParams.get("cookie") || "";

  if (!m3u8Url) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 },
    );
  }

  let decodedUrl: string;
  let decodedOrigin: string;
  let decodedCookie: string;
  try {
    decodedUrl = decodeURIComponent(m3u8Url);
    decodedOrigin = decodeURIComponent(origin);
    decodedCookie = cookie ? decodeURIComponent(cookie) : "";
  } catch {
    return NextResponse.json(
      { error: "Invalid URL encoding" },
      { status: 400 },
    );
  }

  // Build cookie query suffix for sub-playlist and segment URLs
  const cookieParam = decodedCookie
    ? `&cookie=${encodeURIComponent(decodedCookie)}`
    : "";

  try {
    const result = await fetchPlaylist(decodedUrl, decodedOrigin, decodedCookie || undefined);

    if (!result) {
      console.error(
        `[Playlist] All strategies failed for ${decodedUrl.substring(0, 80)}`,
      );
      return NextResponse.json(
        {
          error: "CDN unreachable — all fetch strategies failed",
          detail: "The video CDN is blocking requests. The stream token may have expired or the CDN may be down.",
        },
        { status: 502 },
      );
    }

    let playlist = result.text;
    console.log(`[Playlist] Got M3U8 via ${result.strategy} (${playlist.length} bytes)`);

    const playlistProxyBase = "/api/livetv/playlist";
    const segmentProxyBase = "/api/livetv/segment";

    playlist = playlist
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();

        // Rewrite #EXT-X-KEY URI
        if (trimmed.startsWith("#EXT-X-KEY") && trimmed.includes('URI="')) {
          return trimmed.replace(
            /URI="([^"]+)"/,
            (_m, uri: string) => {
              const resolved = resolveRelative(uri, decodedUrl);
              return `URI="${segmentProxyBase}?url=${encodeURIComponent(resolved)}&origin=${encodeURIComponent(decodedOrigin)}${cookieParam}"`;
            },
          );
        }

        // Rewrite #EXT-X-MAP URI (fMP4 init segments)
        if (trimmed.startsWith("#EXT-X-MAP") && trimmed.includes('URI="')) {
          return trimmed.replace(
            /URI="([^"]+)"/,
            (_m, uri: string) => {
              const resolved = resolveRelative(uri, decodedUrl);
              return `URI="${segmentProxyBase}?url=${encodeURIComponent(resolved)}&origin=${encodeURIComponent(decodedOrigin)}${cookieParam}"`;
            },
          );
        }

        // Skip comments and tags
        if (trimmed.startsWith("#") || trimmed === "") {
          return line;
        }

        // This is a URL line - resolve to absolute and proxy
        const resolved = resolveRelative(trimmed, decodedUrl);

        if (isPlaylist(resolved)) {
          return `${playlistProxyBase}?url=${encodeURIComponent(resolved)}&origin=${encodeURIComponent(decodedOrigin)}${cookieParam}`;
        }

        if (isMediaSegment(resolved)) {
          return `${segmentProxyBase}?url=${encodeURIComponent(resolved)}&origin=${encodeURIComponent(decodedOrigin)}${cookieParam}`;
        }

        return `${segmentProxyBase}?url=${encodeURIComponent(resolved)}&origin=${encodeURIComponent(decodedOrigin)}${cookieParam}`;
      })
      .join("\n");

    return new NextResponse(playlist, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    console.error(`[Playlist] ${isTimeout ? "Timed out" : "Error"}:`, isTimeout ? decodedUrl.substring(0, 80) : error);
    return NextResponse.json(
      { error: isTimeout ? "CDN request timed out" : "Playlist proxy error" },
      { status: isTimeout ? 504 : 500 },
    );
  }
}
