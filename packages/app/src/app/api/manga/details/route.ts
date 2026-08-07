/**
 * Manga details proxy — routes through the WeebCentral extractor.
 *
 * GET /api/manga/details?id=abc123
 */

import { NextRequest, NextResponse } from "next/server";
import { getMangaDetailsWithChapters } from "@flyx/extractors/services";

const CACHE_TTL_SECONDS = 600; // 10 min
const mem = new Map<string, { body: unknown; exp: number }>();

function getCached(key: string) {
  const hit = mem.get(key);
  if (!hit) return null;
  if (Date.now() > hit.exp) { mem.delete(key); return null; }
  return hit.body;
}

function setCache(key: string, body: unknown) {
  mem.set(key, { body, exp: Date.now() + CACHE_TTL_SECONDS * 1000 });
  if (mem.size > 80) { const k = mem.keys().next().value; if (k) mem.delete(k); }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";

  if (!id) {
    return NextResponse.json({ data: null, error: "Missing manga id" }, { status: 400 });
  }

  const cacheKey = `details:${id}`;
  const cached = getCached(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const data = await getMangaDetailsWithChapters(id);
    const body = { data };
    setCache(cacheKey, body);
    return NextResponse.json(body);
  } catch (err) {
    console.error("[api/manga/details]", (err as Error).message);
    return NextResponse.json({ data: null, error: (err as Error).message });
  }
}
