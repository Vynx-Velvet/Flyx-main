/**
 * GET /api/subtitles/search
 *
 * Search for subtitles via OpenSubtitles.com.
 * Returns SubtitleTrack[] — each with a proxied download URL.
 *
 * Query params:
 *   tmdbId   — TMDB movie/show ID
 *   type     — "movie" or "tv"
 *   season   — Season number (TV only)
 *   episode  — Episode number (TV only)
 *   langs    — Comma-separated language codes (default: en,es,fr,de,pt)
 */

import { NextRequest, NextResponse } from "next/server";
import { extractOpenSubtitles } from "@flyx/extractors/services";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tmdbId = searchParams.get("tmdbId")
    ? parseInt(searchParams.get("tmdbId")!)
    : null;
  const type = (searchParams.get("type") ?? "movie") as "movie" | "tv";
  const season = searchParams.get("season")
    ? parseInt(searchParams.get("season")!)
    : undefined;
  const episode = searchParams.get("episode")
    ? parseInt(searchParams.get("episode")!)
    : undefined;
  const langs = searchParams.get("langs") ?? undefined;

  if (!tmdbId) {
    return NextResponse.json({ error: "tmdbId is required" }, { status: 400 });
  }

  try {
    const result = await extractOpenSubtitles(tmdbId, type, season, episode, langs);
    return NextResponse.json({ subtitles: result.subtitles, error: result.error ?? null });
  } catch (err) {
    console.error("[subtitles/search]", err);
    return NextResponse.json({ error: "Failed to fetch subtitles" }, { status: 500 });
  }
}
