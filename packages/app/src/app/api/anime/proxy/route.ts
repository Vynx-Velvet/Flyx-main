/**
 * GET /api/anime/proxy
 *
 * Anime video proxy — REMOVED.
 *
 * AnimeX backend (cx.aniwatchtv.site) handles streaming directly.
 * No proxy needed — no auth, no referrer requirements.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      error: "Anime proxy is no longer needed",
      hint: "AnimeX backend serves streams directly — no CORS or referrer restrictions. Use /api/anime/stream for extraction.",
    },
    { status: 410 },
  );
}
