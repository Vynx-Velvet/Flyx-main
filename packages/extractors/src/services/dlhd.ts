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
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

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

async function fetchHTML(
  url: string,
  referer: string,
  timeoutMs = 10000,
): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeoutMs + attempt * 3000);
    try {
      const r = await fetch(url, {
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
      return await r.text();
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

/**
 * Extract P2P configuration from the source page (optional).
 */
function extractP2PConfig(html: string): Record<string, string> | null {
  const match = html.match(/const\s+p2pConfig\s*=\s*(\{[^}]+\})\s*;/s);
  if (!match?.[1]) return null;
  try {
    const cfg: Record<string, string> = {};
    for (const [, k, v] of match[1].matchAll(/(\w+)\s*:\s*"([^"]+)"/g)) {
      if (k && v) cfg[k] = v;
    }
    return cfg;
  } catch {
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface ExtractionResult {
  sources: StreamSource[];
  subtitles: SubtitleTrack[];
}

function buildResult(m3u8Url: string, quality: string, chId: string): ExtractionResult {
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
  };
}

export async function extractDLHD(
  channelId: string,
): Promise<ExtractionResult> {
  if (!channelId) return { sources: [], subtitles: [] };

  // Primary: Python microservice (warm session, sub-second)
  const svcResult = await extractViaService(channelId);
  if (svcResult?.m3u8) return buildResult(svcResult.m3u8, svcResult.quality, channelId);

  // Fallback: Node.js direct — skip the 624KB stream page, use predictable iframe URL
  try {
    const sourceUrl = `https://hamis.romponalis.st/premiumtv/daddy5.php?id=${channelId}`;
    const sourceHtml = await fetchHTML(sourceUrl, `${DLHD_BASE}/stream/stream-${channelId}.php`, 8000);
    let m3u8Url = extractM3U8FromSource(sourceHtml);

    if (!m3u8Url) {
      // Predictable URL failed — fall back to full stream page flow
      const streamUrl = `${DLHD_BASE}/stream/stream-${channelId}.php`;
      const streamHtml = await fetchHTML(streamUrl, `${DLHD_BASE}/watch.php?id=${channelId}`, 8000);
      const iframeMatch = streamHtml.match(/iframe\s+src="([^"]+)"/i)
        ?? streamHtml.match(/iframe\s+src='([^']+)'/i);
      if (iframeMatch?.[1]) {
        const altSourceHtml = await fetchHTML(iframeMatch[1], streamUrl, 8000);
        m3u8Url = extractM3U8FromSource(altSourceHtml)
          ?? extractM3U8FromSource(streamHtml);
      }
    }

    if (m3u8Url) return buildResult(m3u8Url, "Auto", channelId);
    return { sources: [], subtitles: [] };
  } catch (e) {
    throw new Error(`DLHD extract failed: ${(e as Error).message}`);
  }
}
