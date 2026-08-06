/**
 * Anime data proxy: Jikan first, AniList fallback.
 * Prefer 200 + { data } so progressive UI never hard-fails with 502.
 *
 * GET /api/anime/jikan?path=/top/anime?limit=16&filter=bypopularity
 */

import { NextRequest, NextResponse } from "next/server";
import { anilistFromJikanPath } from "@/lib/anime/anilist-server";

const JIKAN_BASE = "https://api.jikan.moe/v4";
const CACHE_TTL_SECONDS = 600;

const mem = new Map<string, { body: unknown; exp: number }>();

function getMem(key: string) {
  const hit = mem.get(key);
  if (!hit) return null;
  if (Date.now() > hit.exp) {
    mem.delete(key);
    return null;
  }
  return hit.body;
}

function setMem(key: string, body: unknown) {
  mem.set(key, { body, exp: Date.now() + CACHE_TTL_SECONDS * 1000 });
  if (mem.size > 100) {
    const k = mem.keys().next().value;
    if (k) mem.delete(k);
  }
}

function ok(body: unknown, cache: string) {
  return NextResponse.json(body, {
    status: 200,
    headers: {
      "Cache-Control": `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=3600`,
      "X-Flyx-Cache": cache,
    },
  });
}

/** Normalize path query param + any leaked sibling params into one Jikan path */
function resolvePath(request: NextRequest): string | null {
  let path = request.nextUrl.searchParams.get("path");
  if (!path) return null;

  try {
    // Handle double-encoding
    if (/%[0-9A-Fa-f]{2}/.test(path)) {
      path = decodeURIComponent(path);
    }
  } catch {
    /* keep */
  }

  if (!path.startsWith("/")) return null;
  if (path.includes("..")) return null;

  // If client sent unencoded `?path=/top/anime&limit=16`, re-attach extras
  const extras = new URLSearchParams();
  request.nextUrl.searchParams.forEach((value, key) => {
    if (key !== "path") extras.set(key, value);
  });

  if ([...extras.keys()].length > 0) {
    try {
      const u = new URL(path, "https://jikan.local");
      for (const [k, v] of extras.entries()) {
        if (!u.searchParams.has(k)) u.searchParams.set(k, v);
      }
      path = u.pathname + u.search;
    } catch {
      /* keep original path */
    }
  }

  return path;
}

async function fetchJikan(pathWithQuery: string): Promise<unknown | null> {
  const url = `${JIKAN_BASE}${pathWithQuery}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Flyx/3.0 (anime-proxy)",
      },
      cache: "no-store",
    });
    clearTimeout(timer);

    if (res.status === 429) return { __rateLimited: true };
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const path = resolvePath(request);
  if (!path) {
    return NextResponse.json(
      { error: "Missing or invalid path", data: [] },
      { status: 400 },
    );
  }

  const cached = getMem(path);
  if (cached) return ok(cached, "HIT");

  // 1) Jikan (quick, 2 attempts)
  for (let attempt = 0; attempt < 2; attempt++) {
    const data = await fetchJikan(path);
    if (data && !(data as { __rateLimited?: boolean }).__rateLimited) {
      setMem(path, data);
      return ok(data, "JIKAN");
    }
    if ((data as { __rateLimited?: boolean } | null)?.__rateLimited) {
      await new Promise((r) => setTimeout(r, 500 + attempt * 400));
      continue;
    }
    break;
  }

  // 2) AniList fallback (reliable)
  try {
    const fallback = await anilistFromJikanPath(path);
    const hasData =
      fallback &&
      (fallback as { data?: unknown }).data != null &&
      (Array.isArray((fallback as { data: unknown }).data)
        ? ((fallback as { data: unknown[] }).data.length > 0)
        : true);
    if (hasData) {
      setMem(path, fallback);
      return ok(fallback, "ANILIST");
    }
    // AniList returned empty/error — DON'T cache, it may be a transient outage.
    // Return the empty result but let the next request retry.
    if (fallback) {
      console.warn("[anime proxy] AniList returned empty — not caching");
      return ok(fallback, "ANILIST-EMPTY");
    }
  } catch (e) {
    console.warn("[anime proxy] AniList fallback failed", e);
  }

  // 3) Soft empty — never 502 for catalog UI. Don't cache so retries work.
  return ok(
    { data: [], error: "Upstream unavailable", source: "empty" },
    "EMPTY",
  );
}
