/**
 * WeebCentral manga client — browser-side data layer for the manga reader.
 *
 * Routes all requests through /api/manga/* proxy endpoints with
 * in-memory caching, request deduplication, and client-side rate limiting.
 * Mirrors the pattern established by jikan-client.ts.
 */

import type { MangaCard, MangaData, MangaPageData } from "@flyx/core";

// ── Config ──────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min
const MIN_GAP_MS = 120; // mild client spacing

// ── Cache + Queue ───────────────────────────────────────────────────────────

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
  if (memCache.size > 150) {
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

async function mangaFetch<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T | null> {
  const key = path.startsWith("/") ? path : `/${path}`;

  const cached = getCached<T>(key);
  if (cached != null) return cached;

  const existing = inflight.get(key);
  if (existing) return existing as Promise<T | null>;

  const promise = enqueue(async () => {
    const again = getCached<T>(key);
    if (again != null) return again;

    try {
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
      const url = `${origin}/api/manga${key}`;
      const res = await fetch(url, {
        signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const json = await res.json().catch(() => ({ data: null }));
      const data = (json?.data ?? null) as T;
      setCache(key, data);
      return data;
    } catch {
      if (signal?.aborted) return null;
      return null;
    }
  }).finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

// ── Genre/Category Constants ────────────────────────────────────────────────

export const MANGA_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "popular", label: "Most Popular" },
  { id: "latest", label: "Latest Updates" },
  { id: "ongoing", label: "Ongoing" },
  { id: "completed", label: "Completed" },
] as const;

export type MangaCategoryId = (typeof MANGA_CATEGORIES)[number]["id"];

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Search manga by title.
 */
export async function searchManga(
  query: string,
  page = 1,
  limit = 20,
  signal?: AbortSignal,
): Promise<MangaCard[]> {
  if (!query.trim()) return [];
  const data = await mangaFetch<MangaCard[]>(
    `/search?q=${encodeURIComponent(query.trim())}&page=${page}&limit=${limit}`,
    signal,
  );
  return data ?? [];
}

/**
 * Get full manga details including chapter list.
 */
export async function getMangaDetails(
  mangaId: string,
  signal?: AbortSignal,
): Promise<MangaData | null> {
  if (!mangaId) return null;
  return mangaFetch<MangaData>(
    `/details?id=${encodeURIComponent(mangaId)}`,
    signal,
  );
}

/**
 * Get all page images for a manga chapter.
 */
export async function getChapterPages(
  mangaId: string,
  chapterNumber: number,
  mangaTitle?: string,
  signal?: AbortSignal,
): Promise<MangaPageData[]> {
  if (!mangaId || !chapterNumber) return [];
  const titleParam = mangaTitle ? `&title=${encodeURIComponent(mangaTitle)}` : "";
  const data = await mangaFetch<MangaPageData[]>(
    `/pages?mangaId=${encodeURIComponent(mangaId)}&chapter=${chapterNumber}${titleParam}`,
    signal,
  );
  return data ?? [];
}

/**
 * Get popular/trending manga.
 */
export async function getPopularManga(
  limit = 20,
  signal?: AbortSignal,
): Promise<MangaCard[]> {
  const data = await mangaFetch<MangaCard[]>(
    `/popular?limit=${limit}&type=popular`,
    signal,
  );
  return data ?? [];
}

/**
 * Get latest updated manga.
 */
export async function getLatestManga(
  limit = 20,
  signal?: AbortSignal,
): Promise<MangaCard[]> {
  const data = await mangaFetch<MangaCard[]>(
    `/popular?limit=${limit}&type=latest`,
    signal,
  );
  return data ?? [];
}

/**
 * Get action manga.
 */
export async function getActionManga(
  limit = 20,
  signal?: AbortSignal,
): Promise<MangaCard[]> {
  const data = await mangaFetch<MangaCard[]>(
    `/popular?limit=${limit}&type=action`,
    signal,
  );
  return data ?? [];
}

/**
 * Get romance manga.
 */
export async function getRomanceManga(
  limit = 20,
  signal?: AbortSignal,
): Promise<MangaCard[]> {
  const data = await mangaFetch<MangaCard[]>(
    `/popular?limit=${limit}&type=romance`,
    signal,
  );
  return data ?? [];
}

/**
 * Get fantasy/isekai manga.
 */
export async function getFantasyManga(
  limit = 20,
  signal?: AbortSignal,
): Promise<MangaCard[]> {
  const data = await mangaFetch<MangaCard[]>(
    `/popular?limit=${limit}&type=fantasy`,
    signal,
  );
  return data ?? [];
}
