/**
 * AnimeX Extractor — animex.one full API.
 *
 * Reverse-engineered 2026-08-05:
 *
 * Infrastructure:
 *   graphql.animex.one/graphql  — GraphQL (search, anime metadata)
 *   pp.animex.one/rest/api/*    — REST (episodes, servers, sources)
 *   *.aniwatchtv.site/uwu/{token} — HLS decode-and-proxy
 *
 * Flow:
 *   1. GraphQL searchAnime → find anime by title
 *   2. GraphQL anime(anilistId) → get internal id + metadata
 *   3. REST /episodes?id={internalId} → episode list
 *   4. REST /servers?id={internalId}&epNum={N} → available providers
 *   5. REST /sources?id={internalId}&epNum={N}&type=sub&providerId=uwu → stream URLs
 *   6. Wrap source URLs through yi() proxy for CORS/referer bypass
 *
 * Auth: NONE — bare browser UA, no cookies, no tokens needed.
 * All endpoints verified live.
 */

import type { StreamSource, SubtitleTrack } from "@flyx/core";

// ── Constants ────────────────────────────────────────────────────────────────

const GQL = "https://graphql.animex.one/graphql";
const REST = "https://pp.animex.one/rest/api";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const PREFIX = "[AnimeX]";

// HLS proxy hosts (round-robin)
const PROXY_HOSTS = ["cx", "nsx", "pro", "rl2", "rrl"];
let proxyHostIdx = 0;

// XOR key for yi() token encoding
const YI_KEY = "10b06cdc1ca48c9fb0b94af97cc040cf";

// Provider ID → referer mapping (hardcoded in animex.one client bundle)
const PROVIDER_REFERERS: Record<string, string> = {
  uwu: "https://kwik.cx/",
  kiwi: "https://anidb.app/",
  yuki: "https://megaplay.buzz",
  sora: "https://krussdomi.com",
  miku: "https://allanime.uns.bio",
};

// Source URL rewrites for non-proxy providers
const PROVIDER_REWRITES: Record<string, { from: string; to: string }> = {
  beep: { from: "playeng.animeapps.top/r2/", to: "https://bd.aniwatchtv.site/media/" },
  mimi: { from: "vivibebe.site/public/stream/", to: "https://hawk.aniwatchtv.site/media/" },
  mochi: { from: "tools.fast4speed.rsvp", to: "https://mp4.24stream.xyz/storage" },
};

// Providers that go through yi() → aniwatchtv.site/uwu proxy
const YI_PROVIDERS = new Set(Object.keys(PROVIDER_REFERERS));

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

// ── yi() — XOR token wrapper (replicates animex.one client function) ──────────

/**
 * Build the XOR token that the HLS proxy uses to decode the target URL + referer.
 * KEY = "10b06cdc1ca48c9fb0b94af97cc040cf"
 * token = base64url(XOR(url + "\0" + referer, repeating KEY bytes))
 */
function xorEncode(text: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key);
  const textBytes = new TextEncoder().encode(text);
  const out = new Uint8Array(textBytes.length);
  for (let i = 0; i < textBytes.length; i++) {
    out[i] = textBytes[i]! ^ keyBytes[i % keyBytes.length]!;
  }
  // base64url: standard base64 → replace +/ with -_, strip padding
  return btoa(String.fromCharCode(...out))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Wrap a source URL through the aniwatchtv.site HLS proxy.
 *
 * Returns the full uwu URL containing the host so our stream proxy can
 * dynamically extract the host when rewriting relative /uwu/ segment paths.
 *
 * The uwu proxy at {host}.aniwatchtv.site XOR-decodes the token to get the
 * original CDN URL + referer, fetches the content, and returns an M3U8.
 * Segment references in that M3U8 are relative paths like /uwu/{hash}
 * which must be resolved against the same {host}.aniwatchtv.site origin.
 */
function yi(sourceUrl: string, referer: string): string {
  const payload = sourceUrl + "\0" + referer;
  const token = xorEncode(payload, YI_KEY);
  const host = PROXY_HOSTS[proxyHostIdx % PROXY_HOSTS.length]!;
  proxyHostIdx++;
  return `https://${host}.aniwatchtv.site/uwu/${token}`;
}

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

// ── Search ───────────────────────────────────────────────────────────────────

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

/**
 * Apply provider-specific URL transformation to a raw source URL.
 * Replicates the client-side `dg()` function from animex.one's bundle.
 */
function transformSourceUrl(rawUrl: string, providerId: string, _headers?: { Referer?: string; Origin?: string }): string {
  // Providers that go through yi() proxy
  if (providerId in PROVIDER_REFERERS) {
    const referer = PROVIDER_REFERERS[providerId]!;
    return yi(rawUrl, referer);
  }

  // Direct URL rewrites
  const rewrite = PROVIDER_REWRITES[providerId];
  if (rewrite && rawUrl.includes(rewrite.from)) {
    return rawUrl.replace(rewrite.from, rewrite.to);
  }

  // Shiro: XOR-137 decode
  if (providerId === "shiro") {
    try {
      const hexStr = rawUrl.split("/").pop() || "";
      const decoded = hexStr
        .match(/.{2}/g)
        ?.map((h) => String.fromCharCode(parseInt(h, 16) ^ 137))
        .join("") || rawUrl;
      return `${decoded}&origin=https://kem.clvd.xyz/`;
    } catch {
      // fall through to passthrough
    }
  }

  // Passthrough (vee, neko, or unknown)
  return rawUrl;
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

    // Try preferred providers first: uwu (default), then kiwi, yuki, sora
    const priorityProviders = ["uwu", "kiwi", "yuki", "sora", "miku", "beep", "mimi", "mochi", "vee", "neko", "shiro"];

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

      // Sort: priority providers first, then rest
      const sorted = [...providerList].sort((a, b) => {
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

            const finalUrl = transformSourceUrl(src.url, provider.id, result.headers);
            if (seenUrls.has(finalUrl)) continue;
            seenUrls.add(finalUrl);

            const isYiProvider = YI_PROVIDERS.has(provider.id);
            const langLabel = audioType === "dub" ? "Dub" : "Sub";
            // Use API's type field ("video/mpegurl" = HLS), fall back to URL check.
            // yi()-wrapped URLs don't contain .m3u8, so we must check src.type.
            const isHls = src.type === "video/mpegurl" || finalUrl.includes(".m3u8");

            // yi() providers (uwu, kiwi, yuki, sora, miku) return HLS URLs
            // whose M3U8 contains relative /uwu/{hash} segment paths.
            // These MUST go through our /api/stream/proxy so the proxy can
            // rewrite the relative paths to https://{host}.aniwatchtv.site/uwu/{hash}
            // using the host extracted from the source URL.
            allSources.push({
              url: finalUrl,
              quality: src.quality || "Auto",
              type: isHls ? "hls" : "mp4",
              title: `AnimeX ${provider.id} ${src.quality || "Auto"} · ${langLabel}`,
              language: audioType,
              requiresSegmentProxy: isYiProvider,
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
