/**
 * M3U8 Playlist Proxy
 *
 * Recursively proxies HLS playlists from the CDN with proper Referer/Origin
 * headers. Rewrites ALL URLs (absolute + relative) to route through this
 * proxy (for .m3u8 playlists) or the segment proxy (for .ts/.m4s/.mp4).
 *
 * The CDN (phantemlis.top) checks Referer and will 403 on direct browser
 * requests, so everything must flow through the server.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveRelative(
  relative: string,
  baseUrl: string,
): string {
  // If already absolute, return as-is
  if (relative.startsWith("http://") || relative.startsWith("https://")) {
    return relative;
  }
  const base = new URL(baseUrl);
  // Resolve relative to the directory containing the playlist
  const dir = base.pathname.substring(0, base.pathname.lastIndexOf("/") + 1);
  return `${base.origin}${dir}${relative}`;
}

function isMediaSegment(line: string): boolean {
  const t = line.trim();
  return (
    t.includes(".ts") ||
    t.includes(".m4s") ||
    t.includes(".mp4") ||
    t.includes(".vtt") ||
    t.includes(".aac") ||
    t.includes(".ac3") ||
    t.includes(".eac3") ||
    t.includes(".mp3")
  );
}

function isPlaylist(line: string): boolean {
  return line.trim().includes(".m3u8");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const m3u8Url = searchParams.get("url");
  const origin = searchParams.get("origin") || "";

  if (!m3u8Url) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 },
    );
  }

  const decodedUrl = decodeURIComponent(m3u8Url);
  const decodedOrigin = decodeURIComponent(origin);

  try {
    const response = await fetch(decodedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0",
        Referer: decodedOrigin || new URL(decodedUrl).origin,
        Origin: decodedOrigin || new URL(decodedUrl).origin,
        Accept: "*/*",
      },
    });

    if (!response.ok) {
      console.error(
        `[Playlist] Upstream error: ${response.status} for ${decodedUrl.substring(0, 80)}`,
      );
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status },
      );
    }

    let playlist = await response.text();

    // Validate it's actually an M3U8 playlist
    if (!playlist.trim().startsWith("#EXTM3U")) {
      console.error(
        `[Playlist] Invalid response from CDN: "${playlist.trim().substring(0, 50)}"`,
      );
      return NextResponse.json(
        { error: "CDN returned non-playlist response", detail: playlist.trim().substring(0, 100) },
        { status: 502 },
      );
    }
    const playlistProxyBase = "/api/livetv/playlist";
    const segmentProxyBase = "/api/livetv/segment";

    playlist = playlist
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();

        // Rewrite #EXT-X-KEY URI
        if (trimmed.startsWith("#EXT-X-KEY") && trimmed.includes('URI="')) {
          return trimmed.replace(
            /URI="([^"]+)"/,
            (_m, uri: string) => {
              const resolved = resolveRelative(uri, decodedUrl);
              return `URI="${segmentProxyBase}?url=${encodeURIComponent(resolved)}&origin=${encodeURIComponent(decodedOrigin)}"`;
            },
          );
        }

        // Rewrite #EXT-X-MAP URI (fMP4 init segments)
        if (trimmed.startsWith("#EXT-X-MAP") && trimmed.includes('URI="')) {
          return trimmed.replace(
            /URI="([^"]+)"/,
            (_m, uri: string) => {
              const resolved = resolveRelative(uri, decodedUrl);
              return `URI="${segmentProxyBase}?url=${encodeURIComponent(resolved)}&origin=${encodeURIComponent(decodedOrigin)}"`;
            },
          );
        }

        // Skip comments and tags
        if (trimmed.startsWith("#") || trimmed === "") {
          return line;
        }

        // This is a URL line - resolve to absolute and proxy
        const resolved = resolveRelative(trimmed, decodedUrl);

        if (isPlaylist(resolved)) {
          // Sub-playlist → use playlist proxy
          return `${playlistProxyBase}?url=${encodeURIComponent(resolved)}&origin=${encodeURIComponent(decodedOrigin)}`;
        }

        if (isMediaSegment(resolved)) {
          // Media segment → use segment proxy
          return `${segmentProxyBase}?url=${encodeURIComponent(resolved)}&origin=${encodeURIComponent(decodedOrigin)}`;
        }

        // Unknown URL type — proxy through segment proxy as fallback
        return `${segmentProxyBase}?url=${encodeURIComponent(resolved)}&origin=${encodeURIComponent(decodedOrigin)}`;
      })
      .join("\n");

    return new NextResponse(playlist, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[Playlist] Error:", error);
    return NextResponse.json(
      { error: "Playlist proxy error" },
      { status: 500 },
    );
  }
}
