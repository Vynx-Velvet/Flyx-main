/**
 * Jikan client — routes through /api/anime/jikan (server cache + retries).
 * Client still queues requests so we don't stampede our own API.
 */

const PROXY = "/api/anime/jikan";
const CACHE_TTL_MS = 10 * 60 * 1000;
const MIN_GAP_MS = 120; // proxy handles Jikan rate limit; keep mild client spacing

export interface AnimeCard {
  mal_id: number;
  title: string;
  title_english?: string | null;
  image: string;
  score?: number | null;
  year?: number | null;
  type?: string | null;
  episodes?: number | null;
  status?: string | null;
  synopsis?: string | null;
}

export interface JikanRelationEntry {
  mal_id: number;
  type?: string;
  name?: string;
  title?: string;
  url?: string;
  images?: {
    jpg?: { image_url?: string; large_image_url?: string };
    webp?: { image_url?: string; large_image_url?: string };
  };
}

export interface JikanRelationGroup {
  relation: string;
  entry: JikanRelationEntry[];
}

export interface RelatedGroup {
  relation: string;
  items: AnimeCard[];
}

export interface JikanAnime {
  mal_id: number;
  title: string;
  title_english?: string | null;
  title_japanese?: string | null;
  synopsis?: string | null;
  score?: number | null;
  scored_by?: number | null;
  rank?: number | null;
  popularity?: number | null;
  members?: number | null;
  favorites?: number | null;
  year?: number | null;
  season?: string | null;
  type?: string | null;
  source?: string | null;
  episodes?: number | null;
  duration?: string | null;
  status?: string | null;
  rating?: string | null;
  aired?: { string?: string; from?: string; to?: string };
  studios?: Array<{ mal_id: number; name: string }>;
  producers?: Array<{ mal_id: number; name: string }>;
  licensors?: Array<{ mal_id: number; name: string }>;
  genres?: Array<{ mal_id: number; name: string }>;
  themes?: Array<{ mal_id: number; name: string }>;
  demographics?: Array<{ mal_id: number; name: string }>;
  images?: {
    jpg?: { image_url?: string; large_image_url?: string };
    webp?: { image_url?: string; large_image_url?: string };
  };
  trailer?: {
    youtube_id?: string | null;
    url?: string | null;
    embed_url?: string | null;
  };
  background?: string | null;
  /** Franchise links from /full (or AniList fallback) */
  relations?: JikanRelationGroup[];
  theme?: {
    openings?: string[];
    endings?: string[];
  };
}

export interface JikanEpisode {
  mal_id: number;
  title: string;
  title_japanese?: string | null;
  title_romanji?: string | null;
  aired?: string | null;
  filler?: boolean;
  recap?: boolean;
  score?: number | null;
}

export interface JikanCharacter {
  character: {
    mal_id: number;
    name: string;
    images?: { jpg?: { image_url?: string } };
  };
  role: string;
  voice_actors?: Array<{
    person: {
      mal_id: number;
      name: string;
      images?: { jpg?: { image_url?: string } };
    };
    language: string;
  }>;
}

export const GENRES = [
  { id: 1, name: "Action" },
  { id: 2, name: "Adventure" },
  { id: 4, name: "Comedy" },
  { id: 8, name: "Drama" },
  { id: 10, name: "Fantasy" },
  { id: 14, name: "Horror" },
  { id: 7, name: "Mystery" },
  { id: 22, name: "Romance" },
  { id: 24, name: "Sci-Fi" },
  { id: 36, name: "Slice of Life" },
  { id: 30, name: "Sports" },
  { id: 37, name: "Supernatural" },
  { id: 41, name: "Suspense" },
] as const;

// ─── Cache + queue ─────────────────────────────────────────────────────────

type CacheEntry = { data: unknown; expires: number };

const memCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

let lastRequestAt = 0;
let queue: Promise<void> = Promise.resolve();

function getCached<T>(key: string): T | null {
  const hit = memCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    memCache.delete(key);
    return null;
  }
  return hit.data as T;
}

function setCache(key: string, data: unknown) {
  memCache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
  if (memCache.size > 120) {
    const first = memCache.keys().next().value;
    if (first) memCache.delete(first);
  }
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < MIN_GAP_MS) await wait(MIN_GAP_MS - elapsed);
    lastRequestAt = Date.now();
    return fn();
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function mapCard(raw: any): AnimeCard | null {
  const mal_id = Number(raw?.mal_id);
  if (!mal_id || Number.isNaN(mal_id)) return null;
  // Relation entries use `name`; list/full entries use `title`
  const title =
    raw.title ?? raw.name ?? raw.title_english ?? raw.title_romaji ?? "Unknown";
  return {
    mal_id,
    title,
    title_english: raw.title_english ?? null,
    image:
      raw.images?.webp?.large_image_url ||
      raw.images?.jpg?.large_image_url ||
      raw.images?.webp?.image_url ||
      raw.images?.jpg?.image_url ||
      "",
    score: raw.score ?? raw.averageScore ?? null,
    year:
      raw.year ??
      raw.seasonYear ??
      (raw.aired?.from ? Number(String(raw.aired.from).slice(0, 4)) : null),
    type: raw.type ?? raw.format ?? null,
    episodes: raw.episodes ?? null,
    status: raw.status ?? null,
    synopsis: raw.synopsis ?? null,
  };
}

/** Franchise groups from a /full anime payload (Jikan or AniList-shaped) */
export function extractRelations(anime: JikanAnime | null | undefined): RelatedGroup[] {
  if (!anime?.relations?.length) return [];
  const groups: RelatedGroup[] = [];
  for (const g of anime.relations) {
    const items = dedupeCards(
      (g.entry || [])
        .filter((e) => {
          const t = (e.type || "anime").toLowerCase();
          return t === "anime" || t === "";
        })
        .map((e) => mapCard(e))
        .filter(Boolean) as AnimeCard[],
    );
    if (items.length === 0) continue;
    // Skip self-links
    const filtered = items.filter((i) => i.mal_id !== anime.mal_id);
    if (filtered.length === 0) continue;
    groups.push({ relation: g.relation || "Related", items: filtered });
  }
  return groups;
}

/** Fill missing posters for relation stubs via /anime/{id} */
export async function hydrateAnimeCards(
  cards: AnimeCard[],
  signal?: AbortSignal,
  limit = 14,
): Promise<AnimeCard[]> {
  const need = cards.filter((c) => !c.image).slice(0, limit);
  if (need.length === 0) return cards;

  const hydrated = new Map<number, AnimeCard>();
  await Promise.all(
    need.map(async (c) => {
      try {
        const data = await jikanFetch(`/anime/${c.mal_id}`, signal);
        const mapped = mapCard(data?.data);
        if (mapped) hydrated.set(c.mal_id, mapped);
      } catch {
        /* keep stub */
      }
    }),
  );

  return cards.map((c) => {
    const h = hydrated.get(c.mal_id);
    if (!h) return c;
    return {
      ...c,
      ...h,
      // Prefer already-known title if hydrate is thin
      title: h.title || c.title,
    };
  });
}

/** Drop duplicate mal_ids while preserving order */
function dedupeCards(items: AnimeCard[]): AnimeCard[] {
  const seen = new Set<number>();
  const out: AnimeCard[] = [];
  for (const item of items) {
    if (seen.has(item.mal_id)) continue;
    seen.add(item.mal_id);
    out.push(item);
  }
  return out;
}

async function jikanFetch(
  path: string,
  signal?: AbortSignal,
): Promise<any | null> {
  const key = path.startsWith("/") ? path : `/${path}`;

  const cached = getCached<any>(key);
  if (cached != null) return cached;

  const existing = inflight.get(key);
  if (existing) return existing as Promise<any | null>;

  const promise = enqueue(async () => {
    const again = getCached<any>(key);
    if (again != null) return again;

    try {
      // Browser: same-origin proxy. Server (metadata/SSR): absolute app URL.
      let origin = "";
      if (typeof window === "undefined") {
        if (process.env.NEXT_PUBLIC_APP_URL) {
          origin = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
        } else if (process.env.VERCEL_URL) {
          origin = `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
        } else {
          origin = "http://localhost:3000";
        }
      }
      const proxyUrl = `${origin}${PROXY}?path=${encodeURIComponent(key)}`;
      const res = await fetch(proxyUrl, {
        signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({ data: [] }));
      // Accept any JSON body with data; proxy returns 200 even on empty fallback
      const body = data && typeof data === "object" ? data : { data: [] };
      setCache(key, body);
      return body;
    } catch {
      if (signal?.aborted) return null;
      return { data: [] };
    }
  }).finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

export async function jikanList(
  endpoint: string,
  signal?: AbortSignal,
): Promise<AnimeCard[]> {
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const data = await jikanFetch(path, signal);
  if (!data?.data || !Array.isArray(data.data)) return [];
  return dedupeCards(
    data.data.map(mapCard).filter(Boolean) as AnimeCard[],
  );
}

export async function jikanSearch(
  query: string,
  signal?: AbortSignal,
): Promise<AnimeCard[]> {
  if (!query.trim()) return [];
  const data = await jikanFetch(
    `/anime?q=${encodeURIComponent(query.trim())}&limit=20&sfw=true`,
    signal,
  );
  if (!data?.data || !Array.isArray(data.data)) return [];
  return dedupeCards(
    data.data.map(mapCard).filter(Boolean) as AnimeCard[],
  );
}

export async function jikanFull(
  malId: number,
  signal?: AbortSignal,
): Promise<JikanAnime | null> {
  if (!malId) return null;
  const data = await jikanFetch(`/anime/${malId}/full`, signal);
  return (data?.data as JikanAnime) ?? null;
}

export async function jikanEpisodes(
  malId: number,
  signal?: AbortSignal,
  maxPages = 1,
): Promise<JikanEpisode[]> {
  if (!malId) return [];
  const all: JikanEpisode[] = [];
  const pages = Math.min(Math.max(maxPages, 1), 3);

  for (let page = 1; page <= pages; page++) {
    const data = await jikanFetch(
      `/anime/${malId}/episodes?page=${page}`,
      signal,
    );
    if (!data?.data?.length) break;
    all.push(...data.data);
    if (!data.pagination?.has_next_page) break;
  }
  return all;
}

export async function jikanCharacters(
  malId: number,
  signal?: AbortSignal,
): Promise<JikanCharacter[]> {
  if (!malId) return [];
  const data = await jikanFetch(`/anime/${malId}/characters`, signal);
  if (!data?.data || !Array.isArray(data.data)) return [];
  // Dedupe by character id
  const seen = new Set<number>();
  return (data.data as JikanCharacter[]).filter((c) => {
    const id = c.character?.mal_id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export async function jikanRecommendations(
  malId: number,
  signal?: AbortSignal,
): Promise<AnimeCard[]> {
  if (!malId) return [];
  const data = await jikanFetch(`/anime/${malId}/recommendations`, signal);
  if (!data?.data || !Array.isArray(data.data)) return [];
  return dedupeCards(
    data.data
      .map((r: any) => {
        // Jikan: { entry: {...}, votes }; AniList fallback may nest mapMedia
        if (r?.entry) return r.entry;
        if (r?.mal_id) return r;
        return null;
      })
      .filter(Boolean)
      .map(mapCard)
      .filter(Boolean) as AnimeCard[],
  ).slice(0, 18);
}

/**
 * Related tab payload: franchise relations (from full) + community recs.
 * Hydrates relation stubs that lack posters.
 */
export async function jikanRelatedContent(
  malId: number,
  anime: JikanAnime | null,
  signal?: AbortSignal,
): Promise<{ relations: RelatedGroup[]; recommendations: AnimeCard[] }> {
  let relations = extractRelations(anime);

  // Hydrate stubs missing images (Jikan relations often only have name + id)
  const stubs = relations.flatMap((g) => g.items);
  if (stubs.some((s) => !s.image)) {
    const filled = await hydrateAnimeCards(stubs, signal, 16);
    const byId = new Map(filled.map((c) => [c.mal_id, c]));
    relations = relations.map((g) => ({
      ...g,
      items: g.items
        .map((i) => byId.get(i.mal_id) || i)
        .filter((i) => i.mal_id !== malId),
    })).filter((g) => g.items.length > 0);
  }

  const recommendations = await jikanRecommendations(malId, signal);
  // Drop recs that already appear in franchise relations
  const relatedIds = new Set(
    relations.flatMap((g) => g.items.map((i) => i.mal_id)),
  );
  const recs = recommendations.filter((r) => r.mal_id !== malId && !relatedIds.has(r.mal_id));

  return { relations, recommendations: recs };
}

export function jikanPrefetch(endpoint: string) {
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (getCached(path)) return;
  void jikanFetch(path);
}

export async function fetchAnimeById(malId: number) {
  return jikanFetch(`/anime/${malId}`);
}

export async function searchAnime(query: string) {
  return jikanFetch(`/anime?q=${encodeURIComponent(query)}&limit=20`);
}
