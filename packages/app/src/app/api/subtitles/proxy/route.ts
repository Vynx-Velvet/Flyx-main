/**
 * GET /api/subtitles/proxy
 *
 * Proxies subtitle file downloads from OpenSubtitles CDN URLs.
 * Converts SRT → VTT on the fly for browser compatibility.
 * Shields the user's IP from the download server.
 *
 * Query params:
 *   url — The encoded subtitle file URL to proxy
 */

import { NextRequest, NextResponse } from "next/server";
import { convertSRTtoVTT, normalizeVTT } from "@/lib/subtitles/srt";

const UA = "Flyx/3.0 (https://github.com/Vynx-Velvet/Flyx-main)";

/** Cache proxied subtitles for 1 hour (in-memory). */
const cache = new Map<string, { data: string; contentType: string; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url param is required" }, { status: 400 });
  }

  // Check cache
  const cached = cache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return new NextResponse(cached.data, {
      headers: { "Content-Type": cached.contentType, "Cache-Control": "public, max-age=3600" },
    });
  }

  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) {
      return NextResponse.json({ error: `Upstream HTTP ${res.status}` }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    let body = await res.text();

    // Convert SRT to VTT if needed
    const isSRT =
      contentType.includes("text/plain") ||
      contentType.includes("application/x-subrip") ||
      url.endsWith(".srt") ||
      body.includes(" --> ") && body.includes("\n\n");

    body = isSRT ? convertSRTtoVTT(body) : body;
    body = normalizeVTT(body);

    // Cache it
    cache.set(url, { data: body, contentType: "text/vtt", ts: Date.now() });

    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[subtitles/proxy]", err);
    return NextResponse.json({ error: "Failed to proxy subtitle" }, { status: 500 });
  }
}
