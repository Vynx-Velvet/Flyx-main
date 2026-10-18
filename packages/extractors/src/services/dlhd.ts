/**
 * DLHD / DaddyLive extractor — pure-HTTP extraction of live M3U8 URLs.
 *
 * Architecture (Oct 2026):
 *   1. Every channel lives at https://edge.<host>/premium{id}/index.m3u8 on one
 *      shared edge, and the edge only serves a playlist with a short-lived
 *      per-channel token (see "Playlist tokens" below). Once the edge is known
 *      a channel resolves with one token request + one playlist request.
 *   2. Otherwise: GET {front}/stream/stream-{id}.php → player iframe →
 *      `const SRC = "…m3u8"` in the player page.
 *   3. If the front domain is unreachable (it bans IPs that scrape it hard),
 *      the player page is fetched directly on the known player hosts.
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
/**
 * Player hosts seen so far (newest first). Tried directly, with
 * /premiumtv/daddy.php?id={id}, when the front domain can't be reached. The
 * host the front actually embeds is remembered and tried first.
 */
const PLAYER_HOSTS = ["https://dembed.st", "https://daddyliveplayer.st"];
/**
 * The edge every channel was on when this was written. Lets a fresh server
 * resolve channels without scraping anything; replaced by whatever edge a
 * real resolution reports.
 */
const DEFAULT_EDGE = { origin: "https://edge.cowedd4855ws.sbs", playerOrigin: "https://dembed.st" };
/** Front domain fetches fail fast; a dead front is skipped for a while. */
const FRONT_TIMEOUT_MS = 7000;
const FRONT_COOLDOWN_MS = 5 * 60 * 1000;
const PLAYER_TIMEOUT_MS = 8000;
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
  attempts = 2,
): Promise<FetchResult> {
  for (let attempt = 0; attempt < attempts; attempt++) {
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
      if (attempt === attempts - 1) throw e;
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
      // The edge CDN's CORS/Referer policy (and its token endpoint) is keyed
      // to the player host that embedded the stream — pass along whichever
      // one we actually saw.
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

// ── Playlist tokens ─────────────────────────────────────────────────────────
//
// Since Oct 2026 the edge answers a bare playlist request with 403 "token
// required". The player mints a token per channel from
// `{edge}/api/playlist-token?slug=premium{id}` (the edge checks that
// Origin/Referer is the player host) and appends `t=<token>` to every
// playlist load. A token is valid ~120 s, works for that one channel only and
// is bound to the caller's IP — our server both mints and fetches, so that
// holds. Like the player, we reuse a token until 90% of its lifetime and renew
// it in the background past half.

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const TOKEN_TIMEOUT_MS = 5000;
/**
 * A channel nobody is watching answers its first playlist request only once
 * the edge has started publishing it — several seconds (the player allows
 * 30 s). A short timeout here made cold channels look unreachable.
 */
const EDGE_PLAYLIST_TIMEOUT_MS = 15000;
const TOKEN_CACHE_MAX = 500;
const tokenCache = new Map<string, { value: string; renewAt: number; validUntil: number }>();
const tokenFlight = new Map<string, Promise<string | null>>();

/** "premium51" for an edge channel playlist (https://edge.x/premium51/index.m3u8), else null. */
export function dlhdChannelSlug(playlistUrl: string): string | null {
  try {
    const m = new URL(playlistUrl).pathname.match(/^\/(premium\d{1,6})\/[^/]+\.m3u8$/);
    return m ? m[1]! : null;
  } catch {
    return null;
  }
}

function mintToken(
  key: string,
  edge: string,
  slug: string,
  playerOrigin: string,
  fetchImpl: FetchLike,
): Promise<string | null> {
  const flight = (async () => {
    try {
      const r = await fetchImpl(`${edge}/api/playlist-token?slug=${encodeURIComponent(slug)}`, {
        headers: { "User-Agent": UA, Accept: "application/json", Referer: `${playerOrigin}/`, Origin: playerOrigin },
        signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
      });
      if (!r.ok) {
        console.warn(`[DLHD] Playlist token refused for ${slug} (HTTP ${r.status})`);
        return null;
      }
      const body = (await r.json()) as { token?: unknown; ttl?: unknown };
      const token = typeof body.token === "string" ? body.token : "";
      if (!token || token.length > 512) return null;
      const ttl = Math.max(20, Number(body.ttl) || 120);
      const now = Date.now();
      tokenCache.delete(key);
      tokenCache.set(key, { value: token, renewAt: now + ttl * 500, validUntil: now + ttl * 900 });
      for (const [k, entry] of tokenCache) {
        if (tokenCache.size <= TOKEN_CACHE_MAX && now < entry.validUntil) break;
        tokenCache.delete(k);
      }
      return token;
    } catch (e) {
      console.warn(`[DLHD] Playlist token request failed for ${slug}: ${(e as Error).message}`);
      return null;
    } finally {
      tokenFlight.delete(key);
    }
  })();
  tokenFlight.set(key, flight);
  return flight;
}

/**
 * A playlist token for a DLHD edge channel playlist, or null when `playlistUrl`
 * is not one or the edge refused. `force` discards a cached token (after the
 * edge rejected it). `fetchImpl` lets the proxy route use its SSRF-guarded
 * fetch.
 */
export async function getDLHDPlaylistToken(
  playlistUrl: string,
  playerOrigin?: string,
  opts: { fetchImpl?: FetchLike; force?: boolean } = {},
): Promise<string | null> {
  const slug = dlhdChannelSlug(playlistUrl);
  if (!slug) return null;
  const edge = new URL(playlistUrl).origin;
  // The token endpoint wants the player host, never the edge itself.
  const player =
    playerOrigin && playerOrigin !== edge ? playerOrigin : lastEdge?.playerOrigin || DEFAULT_EDGE.playerOrigin;
  const fetchImpl = opts.fetchImpl ?? relaxedFetch;
  const key = `${edge}|${slug}`;
  const now = Date.now();
  if (opts.force) {
    tokenCache.delete(key);
  } else {
    const hit = tokenCache.get(key);
    if (hit && now < hit.validUntil) {
      if (now >= hit.renewAt && !tokenFlight.has(key)) void mintToken(key, edge, slug, player, fetchImpl);
      return hit.value;
    }
  }
  return tokenFlight.get(key) ?? mintToken(key, edge, slug, player, fetchImpl);
}

/** `playlistUrl` with `t=<token>` set when it is a DLHD edge channel playlist; unchanged otherwise. */
export async function withDLHDPlaylistToken(
  playlistUrl: string,
  playerOrigin?: string,
  opts: { fetchImpl?: FetchLike; force?: boolean } = {},
): Promise<string> {
  const token = await getDLHDPlaylistToken(playlistUrl, playerOrigin, opts);
  if (!token) return playlistUrl;
  const u = new URL(playlistUrl);
  u.searchParams.set("t", token);
  return u.href;
}

// ── Resolution cache + edge shortcut ────────────────────────────────────────
//
// Every channel's playlist sits on the same edge at a fixed path, so
// re-opening a channel should not re-scrape anything. We remember each
// channel's result for a while, and remember the edge host + player origin so
// *other* channels can be checked directly with a token + playlist request
// before falling back to scraping.

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

let lastEdge: { origin: string; playerOrigin: string } | null = null;
/** Player host the front embedded most recently (tried first when the front is down). */
let lastPlayerOrigin: string | null = null;
/** Front domain we were last served from (Referer for direct player fetches). */
let lastFrontOrigin = "https://dlive.sx";
/** While in the future, the front domain is treated as unreachable and skipped. */
let frontDownUntil = 0;

function currentEdge(): { origin: string; playerOrigin: string } {
  return lastEdge ?? DEFAULT_EDGE;
}

/**
 * One tokenized GET of a channel's playlist on `edge`: "online" / "offline"
 * (404 — off air or not a channel), or null when the edge could not answer
 * (unreachable, token refused) and the caller should resolve another way.
 */
async function edgePlaylistStatus(
  channelId: string,
  edge: { origin: string; playerOrigin: string },
): Promise<"online" | "offline" | null> {
  const url = `${edge.origin}/premium${channelId}/index.m3u8`;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await getDLHDPlaylistToken(url, edge.playerOrigin, { force: attempt > 0 });
      if (!token) return null;
      const r = await relaxedFetch(`${url}?t=${encodeURIComponent(token)}&_=${Date.now()}`, {
        headers: { "User-Agent": UA, Referer: `${edge.playerOrigin}/`, Origin: edge.playerOrigin, Accept: "*/*" },
        signal: AbortSignal.timeout(EDGE_PLAYLIST_TIMEOUT_MS),
      });
      // A rejected token (expired, or our address changed) is replaced once.
      if (r.status === 403 && attempt === 0) {
        await r.body?.cancel().catch(() => undefined);
        continue;
      }
      if (r.status === 404 || r.status === 410) return "offline";
      if (!r.ok) return null;
      const text = await r.text();
      return text.trim().startsWith("#EXTM3U") ? "online" : "offline";
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fast availability probe for the Live TV page: one token + playlist request
 * against the known edge. "online" / "offline" when the edge answered (every
 * channel lives on the same edge, so a 404 there means off air), null when it
 * could not (caller falls back to a full resolve).
 */
export async function probeDLHDEdge(channelId: string): Promise<"online" | "offline" | null> {
  if (!isValidDLHDChannelId(channelId)) return null;
  return edgePlaylistStatus(channelId, currentEdge());
}

function rememberEdge(result: ExtractionResult) {
  const src = result.sources[0];
  if (!src || !dlhdChannelSlug(src.url)) return;
  try {
    lastEdge = { origin: new URL(src.url).origin, playerOrigin: src.origin || PLAYER_HOSTS[0]! };
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
  // Fastest, and touches neither the front nor the player host: the known
  // edge answers directly for this channel.
  const edge = currentEdge();
  const quick = await edgePlaylistStatus(channelId, edge);
  if (quick === "online") {
    console.log(`[DLHD] Edge shortcut hit for ${channelId} (${edge.origin})`);
    return buildResult(`${edge.origin}/premium${channelId}/index.m3u8`, "Auto", channelId, undefined, edge.playerOrigin);
  }

  // Optional Python microservice (only when DLHD_SERVICE_URL is set).
  const svcResult = await extractViaService(channelId);
  if (svcResult?.m3u8) return buildResult(svcResult.m3u8, svcResult.quality, channelId);

  // The front page is authoritative (it also shows when a slot embeds a
  // third-party player), but it bans IPs that scrape it hard — fail fast and
  // stay off it for a while once it stops answering.
  const scraped = await extractViaFront(channelId);
  if (scraped) {
    // The player just points back at the playlist the edge already 404'd.
    if (quick === "offline" && scraped.sources[0]?.url === `${edge.origin}/premium${channelId}/index.m3u8`) {
      return { sources: [], subtitles: [], reason: "offline" };
    }
    return scraped;
  }

  // Front unreachable. If the edge already said 404, that's the answer.
  if (quick === "offline") return { sources: [], subtitles: [], reason: "offline" };

  // Edge unknown or not answering: ask the player hosts directly.
  const direct = await extractViaPlayer(channelId);
  if (direct) return direct;

  console.warn(`[DLHD] Channel ${channelId}: front, player hosts and edge all unreachable`);
  return { sources: [], subtitles: [], reason: "unreachable" };
}

/**
 * Resolve through the front domain's stream page. Returns null when the front
 * (or the player it embeds) could not be reached, so the caller can try the
 * player hosts directly.
 */
async function extractViaFront(channelId: string): Promise<ExtractionResult | null> {
  if (Date.now() < frontDownUntil) return null;

  // Step 1: the stream page on the first entry domain that answers. Its
  // final URL (after redirects) is the Referer the player page expects.
  // Session cookies are kept in case the CDN validates them again.
  let allCookies = "";
  const mergeCookies = (c: string) => {
    if (c) allCookies = allCookies ? `${allCookies}; ${c}` : c;
  };

  let streamResult: FetchResult | null = null;
  let streamUrl = "";
  for (const base of DLHD_BASES) {
    const candidate = `${base}/stream/stream-${channelId}.php`;
    try {
      streamResult = await fetchHTML(candidate, `${base}/watch.php?id=${channelId}`, FRONT_TIMEOUT_MS, 1);
      streamUrl = streamResult.url || candidate;
      break;
    } catch (e) {
      console.warn(`[DLHD] ${base} unreachable: ${(e as Error).message}`);
    }
  }
  if (!streamResult) {
    frontDownUntil = Date.now() + FRONT_COOLDOWN_MS;
    console.warn(
      `[DLHD] Front domains unreachable — using the edge and player hosts directly for the next ${FRONT_COOLDOWN_MS / 60000} min`,
    );
    return null;
  }
  mergeCookies(streamResult.cookies);
  lastFrontOrigin = originOf(streamUrl, lastFrontOrigin);
  if (streamUrl !== `${DLHD_BASE}/stream/stream-${channelId}.php`) {
    console.log(`[DLHD] Stream page resolved to ${originOf(streamUrl, DLHD_BASE)}`);
  }

  // Step 2: the player iframe, and the M3U8 URL in the player page.
  const iframeMatch = streamResult.html.match(/iframe\s+src="([^"]+)"/i)
    ?? streamResult.html.match(/iframe\s+src='([^']+)'/i);

  let m3u8Url: string | null = null;
  let playerOrigin = lastPlayerOrigin ?? PLAYER_HOSTS[0]!;

  if (iframeMatch?.[1]) {
    let iframeUrl: string;
    try {
      iframeUrl = new URL(iframeMatch[1], streamUrl).href;
    } catch {
      return null;
    }
    // Some event slots embed other providers' players (wikisport, embedsports…)
    // instead of the DLHD player. We have no extractor for those — say so.
    const iframeHost = originOf(iframeUrl, "");
    const isDaddyPlayer =
      /daddyliveplayer|premiumtv\/daddy|romponalis/i.test(iframeUrl) ||
      PLAYER_HOSTS.some((h) => iframeHost === h) ||
      iframeHost === originOf(streamUrl, "");
    if (!isDaddyPlayer && iframeHost) {
      console.warn(`[DLHD] Channel ${channelId} embeds an unsupported player: ${iframeHost}`);
      return { sources: [], subtitles: [], unsupportedEmbed: iframeHost, reason: "unsupported" };
    }
    if (iframeHost && iframeHost !== originOf(streamUrl, "")) lastPlayerOrigin = iframeHost;
    try {
      // Referer must be the page we were actually served from (post-redirect).
      const iframeResult = await fetchHTML(iframeUrl, streamUrl, PLAYER_TIMEOUT_MS, 1);
      mergeCookies(iframeResult.cookies);
      m3u8Url = extractM3U8FromSource(iframeResult.html);
      playerOrigin = originOf(iframeResult.url || iframeUrl, playerOrigin);
    } catch (e) {
      // Not "off air": we couldn't load the player. Let the caller try the
      // player hosts directly.
      console.warn(`[DLHD] Player page failed: ${(e as Error).message}`);
      return null;
    }
    // The player answered but has no stream for this slot: off air.
    if (!m3u8Url) {
      console.warn(`[DLHD] Channel ${channelId}: player has no stream (off air)`);
      return { sources: [], subtitles: [], reason: "offline" };
    }
  } else {
    // Backup: an M3U8 URL in the stream page itself.
    m3u8Url = extractM3U8FromSource(streamResult.html);
    if (!m3u8Url) return null;
  }

  console.log(`[DLHD] Extracted M3U8 URL via ${playerOrigin} (cookies: ${allCookies ? allCookies.substring(0, 50) + "..." : "none"})`);
  return buildResult(m3u8Url, "Auto", channelId, allCookies || undefined, playerOrigin);
}

/**
 * Resolve on the player hosts directly (/premiumtv/daddy.php?id=…) — used
 * when the front domain can't be reached. The player page names the edge and
 * channel itself, so this also discovers a rotated edge.
 */
async function extractViaPlayer(channelId: string): Promise<ExtractionResult | null> {
  const hosts = [
    ...new Set([lastPlayerOrigin, lastEdge?.playerOrigin, ...PLAYER_HOSTS].filter((h): h is string => !!h)),
  ];
  for (const host of hosts) {
    try {
      const page = await fetchHTML(`${host}/premiumtv/daddy.php?id=${channelId}`, `${lastFrontOrigin}/`, PLAYER_TIMEOUT_MS, 1);
      const m3u8Url = extractM3U8FromSource(page.html);
      if (!m3u8Url) continue;
      const playerOrigin = originOf(page.url, host);
      lastPlayerOrigin = playerOrigin;
      console.log(`[DLHD] Resolved ${channelId} on the player host ${playerOrigin}`);
      return buildResult(m3u8Url, "Auto", channelId, page.cookies || undefined, playerOrigin);
    } catch (e) {
      console.warn(`[DLHD] Player host ${host} failed: ${(e as Error).message}`);
    }
  }
  return null;
}

/** Test hook: forget every learned host, token and cached resolution. */
export function resetDLHDStateForTests(): void {
  resolveCache.clear();
  tokenCache.clear();
  tokenFlight.clear();
  lastEdge = null;
  lastPlayerOrigin = null;
  lastFrontOrigin = "https://dlive.sx";
  frontDownUntil = 0;
}
