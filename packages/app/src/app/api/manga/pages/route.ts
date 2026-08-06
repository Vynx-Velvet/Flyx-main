/**
 * Manga chapter pages proxy.
 *
 * GET /api/manga/pages?mangaId=abc123&chapter=1&title=Solo+Leveling
 *
 * Uses the WeebCentral extractor with planeptune.us CDN for page images.
 */

import { NextRequest, NextResponse } from "next/server";
import { getChapterPages } from "@flyx/extractors/services";

const CACHE_TTL_SECONDS = 3600;
const mem = new Map<string, { body: unknown; exp: number }>();

function getCached(key: string) {
  const hit = mem.get(key);
  if (!hit) return null;
  if (Date.now() > hit.exp) { mem.delete(key); return null; }
  return hit.body;
}

function setCache(key: string, body: unknown) {
  mem.set(key, { body, exp: Date.now() + CACHE_TTL_SECONDS * 1000 });
  if (mem.size > 100) { const k = mem.keys().next().value; if (k) mem.delete(k); }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mangaId = searchParams.get("mangaId") || "";
  const chapter = parseInt(searchParams.get("chapter") || "0", 10);
  const title = searchParams.get("title") || "";

  if ((!mangaId && !title) || !chapter) {
    return NextResponse.json({ data: [], error: "Missing mangaId/title or chapter" }, { status: 400 });
  }

  const cacheKey = `pages:${mangaId || title}:${chapter}`;
  const cached = getCached(cacheKey);
  if (cached) return NextResponse.json(cached);

  if (!mangaId) {
    return NextResponse.json({ data: [], error: "Missing mangaId" }, { status: 400 });
  }

  try {
    const pages = await getChapterPages(mangaId, chapter, title || undefined);
    const body = { data: pages, total: pages.length, source: "weebcentral" };
    setCache(cacheKey, body);
    return NextResponse.json(body);
  } catch (err) {
    console.error("[api/manga/pages]", (err as Error).message);
    return NextResponse.json({ data: [], total: 0, error: (err as Error).message });
  }
}
