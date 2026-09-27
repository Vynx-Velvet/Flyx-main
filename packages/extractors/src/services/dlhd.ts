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

/**
 * Entry domains, tried in order. dlhd.st currently 301s to dlstreams.st and
 * on to dlive.sx; relaxedFetch follows redirects, and the final URL is what
 * we use as Referer for the player page so the chain keeps working when the
 * front domain rotates again.
 */
const DLHD_BASES = ["https://dlhd.st", "https://dlive.sx", "https://dlstreams.st", "https://dlhd.pk"];
const DLHD_BASE = DLHD_BASES[0]!;
/** Player hosts seen so far (newest first). Only used for the daddy5.php shortcut. */
const PLAYER_HOSTS = ["https://daddyliveplayer.st", "https://hamis.romponalis.st"];
const UA =
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0";

// ── Python microservice client ────────────────────────────────────────────────

// Opt-in only. The old default (127.0.0.1:9876) meant every resolve first
// waited on a port that, if anything else happened to own it, swallowed
// the full 8 s timeout before the real extraction even started.
const SERVICE_URL = (process.env.DLHD_SERVICE_URL || "").trim() || null;

async function extractViaService(
  channelId: string,
): Promise<{ m3u8: string; quality: string } | null> {
  if (!SERVICE_URL) return null;
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
  /** Final URL after redirects (the front domain rotates: dlhd.st → dlive.sx …). */
  url: string;
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
      return { html, cookies, url: r.url || url };
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
  // 2026-09 player: the URL is a plain constant —
  //   const SRC = "https://edge.<host>/premium51/index.m3u8";
  const plain = html.match(/\b(?:const|let|var)\s+SRC\s*=\s*['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/);
  if (plain?.[1]) return plain[1];

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

  // Last resort: any quoted absolute .m3u8 URL in the page.
  const any = html.match(/['"](https?:\/\/[^'"\s]+\.m3u8[^'"\s]*)['"]/);
  if (any?.[1]) return any[1];

  return null;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface ExtractionResult {
  sources: StreamSource[];
  subtitles: SubtitleTrack[];
  /** Cookies captured during extraction — needed by the CDN to validate M3U8 tokens. */
  cookies?: string;
  /** The stream page embeds a third-party player we have no extractor for (host). */
  unsupportedEmbed?: string;
  /** Why there are no sources, for the API/UI ("offline", "unsupported", "unreachable"). */
  reason?: string;
}

function buildResult(
  m3u8Url: string,
  quality: string,
  chId: string,
  cookies?: string,
  playerOrigin: string = PLAYER_HOSTS[0]!,
): ExtractionResult {
  return {
    sources: [{
      url: m3u8Url,
      quality,
      type: "hls" as const,
      title: `DLHD ${chId}`,
      // The edge CDN's CORS/Referer policy is keyed to the player host that
      // embedded the stream — pass along whichever one we actually saw.
      referer: playerOrigin,
      origin: playerOrigin,
      requiresSegmentProxy: true,
    }],
    subtitles: [],
    cookies,
  };
}

function originOf(url: string, fallback: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return fallback;
  }
}

// ── Resolution cache + edge shortcut ────────────────────────────────────────
//
// The playlist URL for a channel is static and token-less
// (https://edge.<host>/premium{id}/index.m3u8), so re-opening a channel
// should not re-scrape three pages. We remember each channel's result for a
// while, and remember the edge host + player origin so *other* channels can
// be probed directly with one small request before falling back to scraping.

const RESOLVE_TTL_MS = 10 * 60 * 1000;
/** Upper bound on remembered channels (DLHD lists well under 1,000). */
const RESOLVE_CACHE_MAX = 500;
const resolveCache = new Map<string, { result: ExtractionResult; at: number }>();

/** DLHD channel ids are short decimal numbers ("51", "303", "1234"). */
const CHANNEL_ID_RE = /^\d{1,6}$/;

/** True when `channelId` is a well-formed DLHD channel id. */
export function isValidDLHDChannelId(channelId: string): boolean {
  return CHANNEL_ID_RE.test(channelId);
}

function cacheResolution(channelId: string, result: ExtractionResult): void {
  // Map iteration order is insertion order: re-insert to mark as most recent,
  // then evict expired entries and the oldest beyond the cap.
  resolveCache.delete(channelId);
  resolveCache.set(channelId, { result, at: Date.now() });
  const now = Date.now();
  for (const [key, entry] of resolveCache) {
    if (resolveCache.size <= RESOLVE_CACHE_MAX && now - entry.at < RESOLVE_TTL_MS) break;
    resolveCache.delete(key);
  }
}
let lastEdge: { origin: string; playerOrigin: string; at: number } | null = null;

async function probeEdge(channelId: string): Promise<ExtractionResult | null> {
  if (!lastEdge || Date.now() - lastEdge.at > 6 * 60 * 60 * 1000) return null;
  const url = `${lastEdge.origin}/premium${channelId}/index.m3u8`;
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 4000);
    const r = await relaxedFetch(`${url}?_=${Date.now()}`, {
      headers: { "User-Agent": UA, Referer: `${lastEdge.playerOrigin}/`, Origin: lastEdge.playerOrigin, Accept: "*/*" },
      signal: c.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const text = await r.text();
    if (!text.trim().startsWith("#EXTM3U")) return null;
    console.log(`[DLHD] Edge shortcut hit for ${channelId} (${lastEdge.origin})`);
    return buildResult(url, "Auto", channelId, undefined, lastEdge.playerOrigin);
  } catch {
    return null;
  }
}

/**
 * Fast availability probe for the Live TV page: one GET against the known
 * edge host. "online" / "offline" when the edge is known (every channel we
 * have seen lives on the same edge, so a 404 there means off air), null
 * when we have not learned an edge yet (caller falls back to a full resolve).
 */
export async function probeDLHDEdge(channelId: string): Promise<"online" | "offline" | null> {
  if (!isValidDLHDChannelId(channelId)) return null;
  if (!lastEdge || Date.now() - lastEdge.at > 6 * 60 * 60 * 1000) return null;
  const url = `${lastEdge.origin}/premium${channelId}/index.m3u8?_=${Date.now()}`;
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 4000);
    const r = await relaxedFetch(url, {
      headers: { "User-Agent": UA, Referer: `${lastEdge.playerOrigin}/`, Origin: lastEdge.playerOrigin, Accept: "*/*" },
      signal: c.signal,
    });
    clearTimeout(t);
    if (r.status === 404 || r.status === 410) return "offline";
    if (!r.ok) return null;
    const text = await r.text();
    return text.trim().startsWith("#EXTM3U") ? "online" : "offline";
  } catch {
    return null;
  }
}

function rememberEdge(result: ExtractionResult) {
  const src = result.sources[0];
  if (!src) return;
  try {
    lastEdge = { origin: new URL(src.url).origin, playerOrigin: src.origin || PLAYER_HOSTS[0]!, at: Date.now() };
  } catch { /* ignore */ }
}

export async function extractDLHD(
  channelId: string,
): Promise<ExtractionResult> {
  // Reject anything that is not a DLHD channel id before it reaches a URL
  // or the resolution cache.
  if (!isValidDLHDChannelId(channelId)) return { sources: [], subtitles: [] };

  const cached = resolveCache.get(channelId);
  if (cached && Date.now() - cached.at < RESOLVE_TTL_MS) return cached.result;
  if (cached) resolveCache.delete(channelId);

  const result = await extractDLHDUncached(channelId);
  if (result.sources.length) {
    cacheResolution(channelId, result);
    rememberEdge(result);
  }
  return result;
}

/** Drop a channel's cached resolution (e.g. after its playlist 404s). */
export function forgetDLHDChannel(channelId: string): void {
  resolveCache.delete(channelId);
}

async function extractDLHDUncached(
  channelId: string,
): Promise<ExtractionResult> {
  // Fastest: the known edge host answers directly for this channel.
  const edge = await probeEdge(channelId);
  if (edge) return edge;

  // Optional Python microservice (only when DLHD_SERVICE_URL is set).
  const svcResult = await extractViaService(channelId);
  if (svcResult?.m3u8) return buildResult(svcResult.m3u8, svcResult.quality, channelId);

  // Fallback: Node.js direct.
  // Must visit the main stream page first to get session cookies — the CDN
  // validates these against the M3U8 token. The Python service maintains a
  // cookie jar across requests; Node.js fetch() discards cookies by default
  // so we collect them manually.
  try {
    let allCookies = "";
    const mergeCookies = (c: string) => {
      if (c) allCookies = allCookies ? `${allCookies}; ${c}` : c;
    };

    // Step 1: Visit the stream page (first entry domain that answers) to
    // capture session cookies and learn the *final* domain after redirects.
    let streamResult: FetchResult | null = null;
    let streamUrl = "";
    let lastErr: unknown = null;
    for (const base of DLHD_BASES) {
      const candidate = `${base}/stream/stream-${channelId}.php`;
      try {
        streamResult = await fetchHTML(candidate, `${base}/watch.php?id=${channelId}`, 10000);
        streamUrl = streamResult.url || candidate;
        break;
      } catch (e) {
        lastErr = e;
        console.warn(`[DLHD] ${base} unreachable: ${(e as Error).message}`);
      }
    }
    if (!streamResult) throw lastErr ?? new Error("all DLHD entry domains failed");
    mergeCookies(streamResult.cookies);
    if (streamUrl !== `${DLHD_BASE}/stream/stream-${channelId}.php`) {
      console.log(`[DLHD] Stream page resolved to ${originOf(streamUrl, DLHD_BASE)}`);
    }

    // Step 2: Extract the player iframe URL, fetch it for the M3U8 URL.
    const iframeMatch = streamResult.html.match(/iframe\s+src="([^"]+)"/i)
      ?? streamResult.html.match(/iframe\s+src='([^']+)'/i);

    let m3u8Url: string | null = null;
    let playerOrigin = PLAYER_HOSTS[0]!;
    let sawDaddyPlayer = false;

    if (iframeMatch?.[1]) {
      const iframeUrl = iframeMatch[1].startsWith("http")
        ? iframeMatch[1]
        : new URL(iframeMatch[1], streamUrl).href;
      // Some event slots embed other providers' players (wikisport, embedsports…)
      // instead of the DLHD player. We have no extractor for those — say so
      // instead of falling back to the old host's dead addresses.
      const iframeHost = originOf(iframeUrl, "");
      const isDaddyPlayer =
        /daddyliveplayer|premiumtv\/daddy|romponalis/i.test(iframeUrl) ||
        PLAYER_HOSTS.some((h) => iframeHost === h) ||
        iframeHost === originOf(streamUrl, "");
      if (!isDaddyPlayer && iframeHost) {
        console.warn(`[DLHD] Channel ${channelId} embeds an unsupported player: ${iframeHost}`);
        return { sources: [], subtitles: [], unsupportedEmbed: iframeHost, reason: "unsupported" };
      }
      sawDaddyPlayer = true;
      try {
        // Referer must be the page we were actually served from (post-redirect).
        const iframeResult = await fetchHTML(iframeUrl, streamUrl, 10000);
        mergeCookies(iframeResult.cookies);
        m3u8Url = extractM3U8FromSource(iframeResult.html);
        playerOrigin = originOf(iframeResult.url || iframeUrl, playerOrigin);
      } catch (e) {
        console.warn(`[DLHD] Player page failed: ${(e as Error).message}`);
      }
    }

    // Also try extracting from the stream page itself (backup)
    if (!m3u8Url) {
      m3u8Url = extractM3U8FromSource(streamResult.html);
    }

    // The current player answered but has no stream for this slot: the
    // channel is off air. The old host's daddy5 fallback only ever returns
    // stale, dead CDN addresses for these — don't hand those to the player.
    if (!m3u8Url && sawDaddyPlayer) {
      console.warn(`[DLHD] Channel ${channelId}: player has no stream (off air)`);
      return { sources: [], subtitles: [], reason: "offline" };
    }

    // Step 3: Direct daddy5.php shortcut on known player hosts. A 403 here
    // must not abort the whole extraction (the old host now rejects it).
    if (!m3u8Url) {
      for (const host of PLAYER_HOSTS) {
        try {
          const daddyResult = await fetchHTML(`${host}/premiumtv/daddy5.php?id=${channelId}`, streamUrl, 8000);
          mergeCookies(daddyResult.cookies);
          m3u8Url = extractM3U8FromSource(daddyResult.html);
          if (m3u8Url) {
            playerOrigin = originOf(daddyResult.url || host, host);
            break;
          }
        } catch (e) {
          console.warn(`[DLHD] daddy5 on ${host} failed: ${(e as Error).message}`);
        }
      }
    }

    if (m3u8Url) {
      console.log(`[DLHD] Extracted M3U8 URL via ${playerOrigin} (cookies: ${allCookies ? allCookies.substring(0, 50) + "..." : "none"})`);
      return buildResult(m3u8Url, "Auto", channelId, allCookies || undefined, playerOrigin);
    }
    console.warn(`[DLHD] Could not extract M3U8 URL from any source`);
    return { sources: [], subtitles: [] };
  } catch (e) {
    // DLHD backend may be geo-blocked, temporarily down, or blocking
    // this IP. Return empty sources rather than crashing — the UI
    // can handle "no sources available" gracefully.
    const msg = (e as Error).message;
    console.warn(`[DLHD] Extraction failed: ${msg}`);
    return { sources: [], subtitles: [] };
  }
}
