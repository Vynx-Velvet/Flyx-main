/**
 * Live TV Stream API
 *
 * Resolves a channel ID into an HLS playlist URL via the DLHD extractor.
 * The returned `streamUrl` points at /api/livetv/playlist (not the raw CDN
 * M3U8) so the browser never has to set a Referer/Origin that would be
 * rejected by the upstream CDN.
 *
 * Query params:
 *   channel  (required) — numeric DLHD channel ID
 *   provider (optional) — provider key, currently only "dlhd" is wired
 *   backend  (optional) — upstream CDN backend ID (see /api/livetv/backends);
 *                          only "primary" exists today but the param is
 *                          round-tripped so the server is ready for rotation.
 */

import { NextRequest, NextResponse } from "next/server";
import { extractDLHD } from "@flyx/extractors/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channel") || "";
  const provider = searchParams.get("provider") || "dlhd";
  const backend = searchParams.get("backend") || "primary";

  if (!channelId) {
    return NextResponse.json(
      { success: false, error: "Missing channel parameter" },
      { status: 400 },
    );
  }

  // Provider dispatch — only DLHD is wired today, but the branch is in
  // place so future live-TV providers can plug in without touching the UI.
  if (provider !== "dlhd") {
    return NextResponse.json(
      { success: false, error: `Unsupported provider "${provider}"` },
      { status: 400 },
    );
  }

  try {
    const result = await extractDLHD(channelId);

    if (!result.sources || result.sources.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No stream found for "${channelId}" — channel may be offline or geo-blocked.`,
        },
        { status: 404 },
      );
    }

    const source = result.sources[0];
    const rawUrl = source.url;
    if (!rawUrl) {
      return NextResponse.json(
        { success: false, error: "Extractor returned source without URL" },
        { status: 502 },
      );
    }

    // The CDN checks Referer and 403s browser-originated requests, so we
    // route through /api/livetv/playlist and pass the upstream origin + any
    // captured session cookies. Cookies are required by the CDN when the
    // Python microservice fallback is in use.
    const cdnOrigin = source.origin || source.referer || "";
    const cookies = result.cookies || "";

    let proxiedUrl = `/api/livetv/playlist?url=${encodeURIComponent(rawUrl)}&origin=${encodeURIComponent(cdnOrigin)}`;
    if (cookies) {
      proxiedUrl += `&cookie=${encodeURIComponent(cookies)}`;
    }

    return NextResponse.json({
      success: true,
      streamUrl: proxiedUrl,
      provider,
      backend,
      channelId,
      quality: source.quality || "Auto",
      title: source.title,
      headers: {
        referer: cdnOrigin,
        origin: cdnOrigin,
        userAgent: source.userAgent,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Extraction failed",
      },
      { status: 500 },
    );
  }
}