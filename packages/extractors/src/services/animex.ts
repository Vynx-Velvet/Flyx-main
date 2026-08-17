/**
 * AnimeX Extractor — animex.one full API.
 *
 * Reverse-engineered 2026-08-05, reworked 2026-08-17:
 *
 * Infrastructure:
 *   graphql.animex.one/graphql  — GraphQL (search, anime metadata)
 *   pp.animex.one/rest/api/*    — REST (episodes, servers, sources)
 *   *.aniwatchtv.site/uwu/{token} — HLS decode-and-proxy (DEPRECATED, see below)
 *
 * Flow:
 *   1. GraphQL searchAnime → find anime by title
 *   2. GraphQL anime(anilistId) → get internal id + metadata
 *   3. REST /episodes?id={internalId} → episode list
 *   4. REST /servers?id={internalId}&epNum={N} → available providers
 *   5. REST /sources?id={internalId}&epNum={N}&type=sub&providerId=uwu → stream URLs
 *   6. Serve raw URLs through our own /api/stream/proxy with the API's
 *      per-provider Referer/Origin headers attached
 *
 * Auth: NONE — bare browser UA, no cookies, no tokens needed.
 *
 * 2026-08-17 change: aniwatchtv.site (the yi() /uwu/ proxy AND the hawk/bd
 * media hosts the old PROVIDER_REWRITES pointed at) is now behind a
 * Cloudflare bot challenge that blocks every server-side fetch (403
 * "Attention Required" for plain curl/Node regardless of headers). The
 * API's raw source hosts (vivibebe.site, playeng.animeapps.top,
 * hls.anidb.app, *.workers.dev) answer plain fetches fine, so we no longer
 * wrap URLs through yi() — we pass the raw URLs through, attach the
 * Referer/Origin headers the /sources response provides, and mark every
 * source `requiresSegmentProxy: true` so our local proxy forwards those
 * headers (browsers cannot set Referer on cross-origin fetches).
 *
 * Providers currently Cloudflare-challenged for server-side fetch:
 *   yuki  → cdn.watching.onl
 *   sora  → hls.krussdomi.com
 * They are skipped at extraction time (BLOCKED_PROVIDERS) — re-test if
 * upstream unblocks them.
 */

import type { StreamSource, SubtitleTrack } from "@flyx/core";

// ── Constants ────────────────────────────────────────────────────────────────

const GQL = "https://graphql.animex.one/graphql";
const REST = "https://pp.animex.one/rest/api";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const PREFIX = "[AnimeX]";

// Providers whose CDNs answer a Cloudflare bot challenge to plain fetch
// (verified 2026-08-17). Sources from these would always fail at playback,
// so they are filtered out instead of burning the player's failure budget.
const BLOCKED_PROVIDERS = new Set(["yuki", "sora"]);

export interface ExtractionResult {
  sources: StreamSource[];
  subtitles: SubtitleTrack[];
}

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function gqlQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": UA,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(`GraphQL: ${json.errors[0].message}`);
  return json.data as T;
}

async function restGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const url = `${REST}${path}?${qs}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`REST HTTP ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}

// ── Search ───────────────────────────────────────────────────────────────────

interface AnimeXSearchResult {
  id: string;         // internal id: "slug-abcde"
  anilistId: number;
  malId: number;
  titleEnglish?: string;
  titleRomaji?: string;
  format: string;
  status: string;
  episodeCount: number;
  coverImage: string;
  bannerImage: string;
}

const SEARCH_QUERY = `
query($query: String!, $limit: Int) {
  searchAnime(query: $query, limit: $limit) {
    items {
      id anilistId malId
      titleEnglish titleRomaji
      format status episodeCount
      coverImage bannerImage
    }
  }
}`;

const ANIME_QUERY = `
query($malId: Int) {
  anime(malId: $malId) {
    id anilistId malId
    titleEnglish titleRomaji
    format status episodeCount
    coverImage bannerImage
    subCount dubCount
  }
}`;

export async function searchAnime(query: string, limit = 20): Promise<AnimeXSearchResult[]> {
  if (!query.trim()) return [];

  console.log(`${PREFIX} Searching: "${query}"`);

  try {
    const data = await gqlQuery<{ searchAnime: { items: AnimeXSearchResult[] } }>(
      SEARCH_QUERY,
      { query: query.trim(), limit },
    );
    const results = data.searchAnime?.items || [];
    console.log(`${PREFIX} Search: ${results.length} results`);
    return results;
  } catch (err) {
    console.warn(`${PREFIX} search failed:`, (err as Error).message);
    return [];
  }
}

// ── Anime Info ───────────────────────────────────────────────────────────────

interface AnimeXInfo {
  id: string;  // internal id for REST API
  anilistId: number;
  malId: number;
  titleEnglish?: string;
  titleRomaji?: string;
  format: string;
  status: string;
  episodeCount: number;
  subCount: number;
  dubCount: number;
  coverImage: string;
  bannerImage: string;
}

export async function getAnimeInfo(malId: number): Promise<AnimeXInfo | null> {
  try {
    const data = await gqlQuery<{ anime: AnimeXInfo }>(ANIME_QUERY, { malId });
    return data.anime || null;
  } catch (err) {
    console.warn(`${PREFIX} getAnimeInfo failed:`, (err as Error).message);
    return null;
  }
}

// ── Episodes ─────────────────────────────────────────────────────────────────

interface AnimeXEpisode {
  number: number;
  title?: string;
  img?: string;
  isFiller?: boolean;
  hasSub?: boolean;
  hasDub?: boolean;
  description?: string;
  airDateUtc?: string;
}

export async function getEpisodes(internalId: string): Promise<AnimeXEpisode[]> {
  console.log(`${PREFIX} Getting episodes for ${internalId}`);

  try {
    const data = await restGet<AnimeXEpisode[]>("/episodes", { id: internalId });
    console.log(`${PREFIX} Found ${data.length} episodes`);
    return data;
  } catch (err) {
    console.warn(`${PREFIX} getEpisodes failed:`, (err as Error).message);
    return [];
  }
}

// ── Servers ──────────────────────────────────────────────────────────────────

interface AnimeXServer {
  id: string;
  default: boolean;
  tip?: string;
}

interface AnimeXServersResult {
  subProviders: AnimeXServer[];
  dubProviders: AnimeXServer[];
}

export async function getServers(
  internalId: string,
  epNum: number,
): Promise<AnimeXServersResult | null> {
  try {
    return await restGet<AnimeXServersResult>("/servers", {
      id: internalId,
      epNum: String(epNum),
    });
  } catch (err) {
    console.warn(`${PREFIX} getServers failed:`, (err as Error).message);
    return null;
  }
}

// ── Sources ──────────────────────────────────────────────────────────────────

interface AnimeXSource {
  url: string;
  quality: string;
  type: string; // "video/mpegurl" = HLS
}

interface AnimeXTrack {
  id: string;
  url: string;
  lang: string;
  label: string;
  kind: string;
  default: boolean;
}

interface AnimeXSourcesResult {
  sources: AnimeXSource[];
  tracks: AnimeXTrack[] | null;
  headers?: { Referer?: string; Origin?: string };
  audio?: unknown;
  chapters?: unknown;
}

async function getSources(
  internalId: string,
  epNum: number,
  type: "sub" | "dub",
  providerId: string,
): Promise<AnimeXSourcesResult | null> {
  try {
    return await restGet<AnimeXSourcesResult>("/sources", {
      id: internalId,
      epNum: String(epNum),
      type,
      providerId,
    });
  } catch (err) {
    console.warn(`${PREFIX} getSources(${providerId}/${type}) failed:`, (err as Error).message);
    return null;
  }
}

// ── Source URL processing ────────────────────────────────────────────────────

interface TransformedSource {
  url: string;
  referer?: string;
  origin?: string;
}

/**
 * Prepare a raw source URL for playback through our stream proxy.
 *
 * The API returns the CDN URL plus the Referer/Origin headers that CDN
 * requires. Browsers cannot set Referer on cross-origin fetches, so both
 * are attached to the StreamSource and forwarded by /api/stream/proxy.
 */
function transformSourceUrl(
  rawUrl: string,
  providerId: string,
  headers?: { Referer?: string; Origin?: string },
): TransformedSource {
  let url = rawUrl;

  // Shiro: XOR-137 decode — only when the last path segment is actually a
  // hex-encoded URL. Most shows now serve plain URLs through shiro, and
  // decoding a plain segment (e.g. "master.m3u8") produces garbage.
  if (providerId === "shiro") {
    const last = rawUrl.split("/").pop() || "";
    if (last.length >= 8 && last.length % 2 === 0 && /^[0-9a-f]+$/i.test(last)) {
      try {
        const decoded = last
          .match(/.{2}/g)
          ?.map((h) => String.fromCharCode(parseInt(h, 16) ^ 137))
          .join("") || "";
        if (decoded.startsWith("http")) {
          url = `${decoded}&origin=https://kem.clvd.xyz/`;
        }
      } catch {
        // fall through to passthrough
      }
    }
  }

  return {
    url,
    referer: headers?.Referer,
    origin: headers?.Origin,
  };
}

// ── Main Extractor ───────────────────────────────────────────────────────────

/**
 * Extract stream sources for an anime episode.
 *
 * @param _tmdbId   (unused by AnimeX)
 * @param malId     MAL ID — used to resolve via GraphQL
 * @param season    Season number (unused — anime uses absolute episode)
 * @param episode   Episode number
 * @param title     Anime title for search fallback when malId is unavailable
 */
export async function extractAnimeX(
  _tmdbId: number,
  malId?: number,
  season?: number,
  episode?: number,
  title?: string,
): Promise<ExtractionResult> {
  try {
    const epNum = episode ?? season ?? 1;

    console.log(`${PREFIX} Extracting ${title || `MAL ${malId}`} episode ${epNum}`);

    // Step 1: Resolve internal id
    let internalId: string | null = null;
    let displayTitle = title || "";

    // Try by MAL ID first (most reliable)
    if (malId) {
      const info = await getAnimeInfo(malId);
      if (info) {
        internalId = info.id;
        displayTitle = info.titleEnglish || info.titleRomaji || displayTitle;
        console.log(`${PREFIX} Resolved via MAL ${malId} → "${displayTitle}" (${internalId})`);
      }
    }

    // Fallback: search by title
    if (!internalId && title) {
      const results = await searchAnime(title, 5);
      if (results.length > 0) {
        // Find best match
        const match = malId
          ? results.find((r) => r.malId === malId)
          : results[0];
        if (match) {
          internalId = match.id;
          displayTitle = match.titleEnglish || match.titleRomaji || title;
          console.log(`${PREFIX} Resolved via search → "${displayTitle}" (${internalId})`);
        }
      }
    }

    if (!internalId) {
      console.warn(`${PREFIX} Could not resolve internal id`);
      return { sources: [], subtitles: [] };
    }

    // Step 2: Get available servers
    const servers = await getServers(internalId, epNum);
    if (!servers || (!servers.subProviders.length && !servers.dubProviders.length)) {
      console.warn(`${PREFIX} No providers available for ${internalId} ep ${epNum}`);
      return { sources: [], subtitles: [] };
    }

    // Step 3: Collect sources from BOTH sub and dub providers.
    // Previously we only tried dub if ALL sub providers failed (early break),
    // which made dub sources unreachable. Now we collect from both so the
    // Sub/Dub toggle in the player has sources to filter from each category.
    const allSources: StreamSource[] = [];
    const allTracks: SubtitleTrack[] = [];
    const seenUrls = new Set<string>();

    // Try preferred providers first. Blocked (Cloudflare-challenged)
    // providers are filtered out entirely — their sources can only fail.
    const priorityProviders = ["uwu", "kiwi", "miku", "beep", "mimi", "mochi", "vee", "neko", "shiro"];

    for (const audioType of (["sub", "dub"] as const)) {
      const providerList = audioType === "sub" ? servers.subProviders : servers.dubProviders;
      if (!providerList.length) {
        console.log(`${PREFIX} No ${audioType} providers available`);
        continue;
      }

      // Small stagger between sub→dub loops to avoid rate-limit bursts
      if (audioType === "dub" && allSources.length > 0) {
        await new Promise((r) => setTimeout(r, 300));
      }

      console.log(`${PREFIX} Trying ${audioType} providers: ${providerList.map((p) => p.id).join(", ")}`);

      // Sort: priority providers first, then rest; drop Cloudflare-blocked ones
      const sorted = [...providerList]
        .filter((p) => !BLOCKED_PROVIDERS.has(p.id))
        .sort((a, b) => {
          const ai = priorityProviders.indexOf(a.id);
          const bi = priorityProviders.indexOf(b.id);
          if (ai === -1 && bi === -1) return 0;
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        });

      for (const provider of sorted.slice(0, 2)) {
        // Only fetch from first 2 providers per audio type
        // (kept low to avoid AnimeX API rate limits — 429/403)
        try {
          const result = await getSources(internalId, epNum, audioType, provider.id);
          if (!result?.sources?.length) continue;

          for (const src of result.sources) {
            if (!src.url) continue;

            const transformed = transformSourceUrl(src.url, provider.id, result.headers);
            const finalUrl = transformed.url;
            if (seenUrls.has(finalUrl)) continue;
            seenUrls.add(finalUrl);

            const langLabel = audioType === "dub" ? "Dub" : "Sub";
            // Use API's type field ("video/mpegurl" = HLS), fall back to URL check.
            const isHls = src.type === "video/mpegurl" || finalUrl.includes(".m3u8");

            // All sources go through our /api/stream/proxy: it forwards the
            // per-provider Referer/Origin headers (browsers can't set
            // Referer themselves) and sidesteps missing CORS on raw hosts.
            // The proxy also rewrites relative segment paths in M3U8 bodies.
            allSources.push({
              url: finalUrl,
              quality: src.quality || "Auto",
              type: isHls ? "hls" : "mp4",
              title: `AnimeX ${provider.id} ${src.quality || "Auto"} · ${langLabel}`,
              language: audioType,
              requiresSegmentProxy: true,
              referer: transformed.referer,
              origin: transformed.origin,
            });
          }

          // Collect subtitle tracks (only from first working provider)
          if (!allTracks.length && result.tracks?.length) {
            for (const track of result.tracks) {
              if (!track.url) continue;
              allTracks.push({
                url: track.url,
                label: track.label || track.lang || "Unknown",
                language: track.lang || "en",
              });
            }
          }
        } catch (err) {
          console.warn(`${PREFIX} Provider ${provider.id}/${audioType}: ${(err as Error).message}`);
        }
      }
    }

    console.log(`${PREFIX} Got ${allSources.length} sources for ep ${epNum}`);
    return { sources: allSources, subtitles: allTracks };
  } catch (err) {
    console.error(`${PREFIX} Failed:`, (err as Error).message);
    return { sources: [], subtitles: [] };
  }
}
