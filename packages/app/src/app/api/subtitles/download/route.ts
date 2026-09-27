/**
 * GET /api/subtitles/download?subId=13953087
 *
 * Downloads a subtitle zip from the opensubtitles.org CDN (via the shared
 * scraping session in @flyx/extractors), extracts the first .srt/.vtt,
 * converts SRT → VTT, and serves it to the browser's native <track>.
 * Converted VTTs are cached in memory for 24h so each sub is fetched from
 * the CDN at most once per day (anonymous download limits).
 *
 * Public route, untrusted archive: the zip download is size-capped while
 * streaming, and only the chosen subtitle entry is inflated, with its own
 * output cap (see extract-subtitle.ts). The outbound URL is fixed-host
 * (numeric subId only), so it cannot be pointed elsewhere.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  fetchOpenSubtitlesZip,
  AnubisBlockedError,
  OSDownloadError,
} from "@flyx/extractors/services";
import {
  convertSRTtoVTT,
  decodeSubtitleText,
  normalizeVTT,
} from "@/lib/subtitles/srt";
import { extractSubtitleFromZip, SubtitleArchiveError } from "./extract-subtitle";

export const runtime = "nodejs";

const VTT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const VTT_CACHE_MAX = 150;
/** Largest subtitle zip we download (real ones are tens of KB). */
const MAX_ZIP_BYTES = 20 * 1024 * 1024;

/** LRU-ish VTT cache keyed by subId. */
const vttCache = new Map<string, { vtt: string; at: number }>();

function vttCacheGet(subId: string): string | null {
  const hit = vttCache.get(subId);
  if (!hit) return null;
  if (Date.now() - hit.at > VTT_CACHE_TTL_MS) {
    vttCache.delete(subId);
    return null;
  }
  vttCache.delete(subId);
  vttCache.set(subId, hit);
  return hit.vtt;
}

function vttCacheSet(subId: string, vtt: string): void {
  vttCache.set(subId, { vtt, at: Date.now() });
  while (vttCache.size > VTT_CACHE_MAX) {
    const oldest = vttCache.keys().next().value;
    if (oldest === undefined) break;
    vttCache.delete(oldest);
  }
}

function vttResponse(vtt: string): NextResponse {
  return new NextResponse(vtt, {
    status: 200,
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: NextRequest) {
  const subId = request.nextUrl.searchParams.get("subId") ?? "";
  if (!/^\d{1,12}$/.test(subId)) {
    return NextResponse.json({ error: "subId is required" }, { status: 400 });
  }

  const cached = vttCacheGet(subId);
  if (cached) {
    console.log(`[subtitles/download] cache hit ${subId}`);
    return vttResponse(cached);
  }

  try {
    const zip = await fetchOpenSubtitlesZip(subId, MAX_ZIP_BYTES);

    // Native <track> renders .srt/.vtt only — .ass/.sub/.idx are unsupported.
    let pick: string;
    let bytes: Uint8Array;
    try {
      ({ name: pick, bytes } = extractSubtitleFromZip(zip.data));
    } catch (err) {
      if (err instanceof SubtitleArchiveError) {
        console.log(`[subtitles/download] ${subId}: ${err.message}`);
        return NextResponse.json({ error: err.code }, { status: 422 });
      }
      throw err;
    }

    const text = decodeSubtitleText(bytes);
    const vtt = normalizeVTT(
      /\.srt$/i.test(pick) ? convertSRTtoVTT(text) : text,
    );
    vttCacheSet(subId, vtt);
    console.log(
      `[subtitles/download] ${subId} → ${pick} (${Math.round(bytes.byteLength / 1024)}KB → ${Math.round(vtt.length / 1024)}KB vtt)`,
    );
    return vttResponse(vtt);
  } catch (err) {
    if (err instanceof AnubisBlockedError) {
      console.warn(`[subtitles/download] blocked by anti-bot for ${subId}`);
      return NextResponse.json({ error: "blocked" }, { status: 503 });
    }
    if (err instanceof OSDownloadError) {
      if (err.status === 413) {
        return NextResponse.json({ error: "too_large" }, { status: 422 });
      }
      if (err.status === 404) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      if (err.status === 403 || err.status === 429) {
        console.warn(`[subtitles/download] rate-limited (HTTP ${err.status}) for ${subId}`);
        return NextResponse.json({ error: "rate_limited" }, { status: 429 });
      }
      console.warn(`[subtitles/download] upstream HTTP ${err.status} for ${subId}`);
      return NextResponse.json({ error: "failed" }, { status: 502 });
    }
    console.error("[subtitles/download]", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
