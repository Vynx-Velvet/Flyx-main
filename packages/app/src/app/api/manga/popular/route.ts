/**
 * Popular manga proxy — routes through the WeebCentral extractor.
 *
 * GET /api/manga/popular?limit=20
 */

import { NextRequest, NextResponse } from "next/server";
import { getPopularManga, getLatestManga, getActionManga, getRomanceManga, getFantasyManga } from "@flyx/extractors/services";

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
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 40);
  const type = searchParams.get("type") || "popular"; // "popular" or "latest"

  const cacheKey = `browse:${type}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    let results;
    switch (type) {
      case "latest": results = await getLatestManga(limit); break;
      case "action": results = await getActionManga(limit); break;
      case "romance": results = await getRomanceManga(limit); break;
      case "fantasy": results = await getFantasyManga(limit); break;
      default: results = await getPopularManga(limit); break;
    }
    const body = { data: results, total: results.length };
    setCache(cacheKey, body);
    return NextResponse.json(body);
  } catch (err) {
    console.error("[api/manga/popular]", (err as Error).message);
    return NextResponse.json({ data: [], total: 0, error: (err as Error).message });
  }
}
