/**
 * DLHD / DaddyLive extractor — pure-HTTP extraction of live M3U8 URLs.
 *
 * Architecture (2026):
 *   1. GET /stream/stream-{id}.php → extract iframe source URL
 *   2. GET source URL → extract base64-encoded M3U8 from Clappr player config
 *   3. Base64 decode → M3U8 master playlist
 *
 * Falls back to the Python curl_cffi extractor if Node.js fetch is blocked
 * (dlhd.st uses Cloudflare which may reject Node.js TLS fingerprints).
 */

import type { StreamSource, SubtitleTrack } from "@flyx/core";
import { relaxedFetch } from "@flyx/core/utils";

const DLHD_BASE = "https://dlhd.st";
const UA =
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0";

// ── Python microservice client ────────────────────────────────────────────────

const SERVICE_URL = process.env.DLHD_SERVICE_URL ?? "http://127.0.0.1:9876";

async function extractViaService(
  channelId: string,
): Promise<{ m3u8: string; quality: string } | null> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 8000);
    const r = await fetch(`${SERVICE_URL}/stream/${channelId}`, {
      signal: c.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const data = await r.json();
    if (data.success && data.m3u8) {
      return { m3u8: data.m3u8, quality: data.quality ?? "720p" };
    }
    return null;
  } catch {
    return null;
  }
}

// ── HTTP ────────────────────────────────────────────────────────────────────

interface FetchResult {
  html: string;
  /** Combined Set-Cookie headers from the response (semicolon-joined). */
  cookies: string;
}

async function fetchHTML(
  url: string,
  referer: string,
  timeoutMs = 10000,
): Promise<FetchResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeoutMs + attempt * 3000);
    try {
      const r = await relaxedFetch(url, {
        headers: {
          "User-Agent": UA,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          Referer: referer,
        },
        signal: c.signal,
        redirect: "follow",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);

      // Capture Set-Cookie headers — the CDN requires these session cookies
      // to validate M3U8 tokens. Node.js fetch() discards them by default.
      const setCookieHeaders = r.headers.getSetCookie?.() ?? [];
      const cookies = setCookieHeaders
        .map((c) => c.split(";")[0]) // extract just "key=value" from each
        .join("; ");

      const html = await r.text();
      return { html, cookies };
    } catch (e) {
      if (attempt === 1) throw e;
      await new Promise((r) => setTimeout(r, 500));
    } finally {
      clearTimeout(t);
    }
  }
  throw new Error("unreachable");
}

// ── M3U8 extraction ─────────────────────────────────────────────────────────

/**
 * Extract the base64-encoded M3U8 URL from a Clappr player source page.
 *
 * The M3U8 is embedded in the JS as:
 *   source:window.atob('aHR0cHM6Ly94YW1lbGVvbi4u...')
 */
function extractM3U8FromSource(html: string): string | null {
  // Pattern: source:window.atob('BASE64') or source: atob('BASE64')
  const matches = html.match(
    /source\s*:\s*(?:window\.)?atob\s*\(\s*['"]([^'"]{20,})['"]\s*\)/,
  );
  if (matches?.[1]) {
    try {
      const url = Buffer.from(matches[1], "base64").toString("utf-8");
      if (url.startsWith("http") && url.includes(".m3u8")) return url;
    } catch { /* fall through */ }
  }

  // Broader: any window.atob('...') that decodes to an .m3u8 URL
  for (const m of html.matchAll(
    /(?:window\.)?atob\s*\(\s*['"]([^'"]{20,})['"]\s*\)/g,
  )) {
    try {
      const decoded = Buffer.from(m[1]!, "base64").toString("utf-8");
      if (decoded.startsWith("http") && decoded.includes(".m3u8"))
        return decoded;
    } catch { /* continue */ }
  }

  return null;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface ExtractionResult {
  sources: StreamSource[];
  subtitles: SubtitleTrack[];
  /** Cookies captured during extraction — needed by the CDN to validate M3U8 tokens. */
  cookies?: string;
}

function buildResult(
  m3u8Url: string,
  quality: string,
  chId: string,
  cookies?: string,
): ExtractionResult {
  return {
    sources: [{
      url: m3u8Url,
      quality,
      type: "hls" as const,
      title: `DLHD ${chId}`,
      referer: "https://hamis.romponalis.st",
      origin: "https://hamis.romponalis.st",
      requiresSegmentProxy: true,
    }],
    subtitles: [],
    cookies,
  };
}

export async function extractDLHD(
  channelId: string,
): Promise<ExtractionResult> {
  if (!channelId) return { sources: [], subtitles: [] };

  // Primary: Python microservice (warm session, sub-second)
  const svcResult = await extractViaService(channelId);
  if (svcResult?.m3u8) return buildResult(svcResult.m3u8, svcResult.quality, channelId);

  // Fallback: Node.js direct.
  // Must visit the main stream page first to get session cookies — the CDN
  // validates these against the M3U8 token. The Python service maintains a
  // cookie jar across requests; Node.js fetch() discards cookies by default
  // so we collect them manually.
  try {
    let allCookies = "";

    // Step 1: Visit the main DLHD stream page to capture session cookies.
    // These cookies are required by the CDN to validate the M3U8 token.
    const streamUrl = `${DLHD_BASE}/stream/stream-${channelId}.php`;
    const streamResult = await fetchHTML(streamUrl, `${DLHD_BASE}/watch.php?id=${channelId}`, 10000);
    if (streamResult.cookies) {
      allCookies = streamResult.cookies;
      console.log(`[DLHD] Got cookies from stream page: ${allCookies.substring(0, 60)}...`);
    }

    // Step 2: Extract iframe URL from stream page, then fetch it for the M3U8 URL
    const iframeMatch = streamResult.html.match(/iframe\s+src="([^"]+)"/i)
      ?? streamResult.html.match(/iframe\s+src='([^']+)'/i);

    let m3u8Url: string | null = null;

    if (iframeMatch?.[1]) {
      // Fetch the iframe source page (Clappr player)
      const iframeResult = await fetchHTML(iframeMatch[1], streamUrl, 10000);
      if (iframeResult.cookies) {
        // Merge cookies: the iframe page may set additional session cookies
        allCookies = allCookies
          ? `${allCookies}; ${iframeResult.cookies}`
          : iframeResult.cookies;
      }
      m3u8Url = extractM3U8FromSource(iframeResult.html);
    }

    // Also try extracting from the stream page itself (backup)
    if (!m3u8Url) {
      m3u8Url = extractM3U8FromSource(streamResult.html);
    }

    // Step 3: If both failed, try the direct daddy5.php shortcut
    if (!m3u8Url) {
      const daddyUrl = `https://hamis.romponalis.st/premiumtv/daddy5.php?id=${channelId}`;
      const daddyResult = await fetchHTML(daddyUrl, streamUrl, 8000);
      if (daddyResult.cookies) {
        allCookies = allCookies
          ? `${allCookies}; ${daddyResult.cookies}`
          : daddyResult.cookies;
      }
      m3u8Url = extractM3U8FromSource(daddyResult.html);
    }

    if (m3u8Url) {
      console.log(`[DLHD] Extracted M3U8 URL (cookies: ${allCookies ? allCookies.substring(0, 50) + "..." : "none"})`);
      return buildResult(m3u8Url, "Auto", channelId, allCookies || undefined);
    }
    console.warn(`[DLHD] Could not extract M3U8 URL from any source`);
    return { sources: [], subtitles: [] };
  } catch (e) {
    throw new Error(`DLHD extract failed: ${(e as Error).message}`);
  }
}
