import type { ParsedStremioId } from "./types";

interface TmdbFindResponse {
  movie_results?: { id?: number }[];
  tv_results?: { id?: number }[];
}

interface CacheEntry {
  id: number | null;
  expiresAt: number;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const idCache = new Map<string, CacheEntry>();

export class TmdbLookupError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "TmdbLookupError";
  }
}

/** Translate a Cinemeta IMDb ID to the TMDB ID required by Flyx providers. */
export async function findTmdbId(
  parsed: ParsedStremioId,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<number | null> {
  if (!apiKey.trim()) {
    throw new TmdbLookupError("TMDB_API_KEY is not configured");
  }

  const cacheKey = `${parsed.mediaType}:${parsed.imdbId}`;
  const cached = idCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.id;

  const endpoint = new URL(
    `https://api.themoviedb.org/3/find/${encodeURIComponent(parsed.imdbId)}`,
  );
  endpoint.searchParams.set("api_key", apiKey);
  endpoint.searchParams.set("external_source", "imdb_id");

  const response = await fetchImpl(endpoint, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new TmdbLookupError(`TMDB lookup failed with HTTP ${response.status}`, response.status);
  }

  const payload = (await response.json()) as TmdbFindResponse;
  const result =
    parsed.mediaType === "movie" ? payload.movie_results?.[0] : payload.tv_results?.[0];
  const id = typeof result?.id === "number" && Number.isSafeInteger(result.id) ? result.id : null;

  if (idCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = idCache.keys().next().value as string | undefined;
    if (oldestKey) idCache.delete(oldestKey);
  }
  idCache.set(cacheKey, { id, expiresAt: Date.now() + CACHE_TTL_MS });

  return id;
}

export function clearTmdbCache(): void {
  idCache.clear();
}
