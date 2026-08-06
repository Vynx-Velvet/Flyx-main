/**
 * Server-only TMDB client — call upstream directly (never self-HTTP to /api/tmdb).
 */

const TMDB_BASE = "https://api.themoviedb.org/3";

export async function tmdbFetch<T = any>(
  path: string,
  init?: { revalidate?: number },
): Promise<T | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.error("[tmdb-server] TMDB_API_KEY is not configured");
    return null;
  }

  try {
    const clean = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${TMDB_BASE}${clean}`);
    if (!url.searchParams.has("language")) {
      url.searchParams.set("language", "en-US");
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey.startsWith("eyJ")) {
      headers.Authorization = `Bearer ${apiKey}`;
    } else {
      url.searchParams.set("api_key", apiKey);
    }

    const res = await fetch(url.toString(), {
      headers,
      next: { revalidate: init?.revalidate ?? 300 },
    });

    if (!res.ok) {
      console.error(`[tmdb-server] ${res.status} for ${clean}`);
      return null;
    }

    return (await res.json()) as T;
  } catch (e) {
    console.error("[tmdb-server] fetch failed", e);
    return null;
  }
}

export function tmdbPoster(
  path: string | null | undefined,
  size: "w185" | "w342" | "w500" | "w780" = "w342",
): string | undefined {
  if (!path || path === "null" || path === "undefined") return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  // Ensure leading slash
  const p = path.startsWith("/") ? path : `/${path}`;
  return `https://image.tmdb.org/t/p/${size}${p}`;
}

export function tmdbBackdrop(
  path: string | null | undefined,
  size: "w780" | "w1280" | "original" = "w1280",
): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
