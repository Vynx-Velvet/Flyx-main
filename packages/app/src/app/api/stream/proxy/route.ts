/**
 * GET /api/stream/proxy
 *
 * Stream proxy for HLS + MP4 content behind CDNs that require Referer/Origin headers.
 *
 * Query params:
 *   url     - The CDN URL to fetch (required)
 *   referer - The Referer header to send to the CDN (required)
 *   origin  - Optional Origin header to send to the CDN
 *
 * Supports Range requests for MP4 video seeking.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const referer = searchParams.get("referer");
  const origin = searchParams.get("origin");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const decodedUrl = decodeURIComponent(url);
    const isM3u8 = decodedUrl.includes(".m3u8");

    // Forward client Range header for MP4 seeking.
    // If no Range is present, request the first 2MB so the CDN responds
    // instantly (265ms for Range vs 13s for full-file GET).
    const clientRange = request.headers.get("range");
    const upstreamHeaders: Record<string, string> = {
      "User-Agent": UA,
      Accept: "*/*",
    };
    if (referer) upstreamHeaders["Referer"] = referer;
    if (origin) upstreamHeaders["Origin"] = origin;
    if (clientRange) {
      upstreamHeaders["Range"] = clientRange;
    } else if (!isM3u8) {
      // Initial MP4 request — ask for just the start so we get a fast 206
      upstreamHeaders["Range"] = "bytes=0-2097152"; // first 2MB
    }

    const upstream = await fetch(decodedUrl, {
      headers: upstreamHeaders,
    });

    if (!upstream.ok) {
      // If upstream returns an error status, pass it through
      // Don't proxy 404s etc. — let the caller know
      if (upstream.status === 404 || upstream.status === 403) {
        return NextResponse.json(
          { error: `Upstream ${upstream.status}`, url: decodedUrl.substring(0, 120) },
          { status: upstream.status },
        );
      }
      return NextResponse.json(
        { error: `Upstream ${upstream.status}` },
        { status: upstream.status },
      );
    }

    // ── Non-M3U8 content (MP4, TS segments, etc.) ──────────────
    if (!isM3u8) {
      const contentLength = upstream.headers.get("content-length");
      const contentType = upstream.headers.get("content-type") ?? "video/mp4";
      const contentRange = upstream.headers.get("content-range");

      const responseHeaders: Record<string, string> = {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Accept-Ranges": "bytes",
      };

      if (contentRange) {
        // Partial content — stream through (do NOT buffer entire body first).
        // Buffering with arrayBuffer() added multi-second delay on every
        // Range chunk and was a major cause of 20–30s anime start times.
        responseHeaders["Content-Range"] = contentRange;
        if (contentLength) {
          responseHeaders["Content-Length"] = contentLength;
        }
        return new NextResponse(upstream.body, {
          status: 206,
          headers: responseHeaders,
        });
      }

      if (contentLength) {
        responseHeaders["Content-Length"] = contentLength;
      }

      // Stream the response body to avoid buffering large files
      return new NextResponse(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    }

    // ── M3U8 playlists: rewrite relative URLs to proxy ─────────
    let text = await upstream.text();
    const proxyParams = new URLSearchParams();
    if (referer) proxyParams.set("referer", referer);
    if (origin) proxyParams.set("origin", origin);
    proxyParams.set("url", ""); // placeholder, appended per-line
    const proxyBase = `/api/stream/proxy?${proxyParams.toString()}`;

    // Build absolute base from the decoded URL
    const urlObj = new URL(decodedUrl);
    const pathBase = urlObj.origin + urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf("/") + 1);

    const rewritten = text
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // Rewrite #EXT-X-KEY URI
        if (trimmed.startsWith("#EXT-X-KEY") && trimmed.includes('URI="')) {
          return trimmed.replace(/URI="([^"]+)"/, (_m, uri: string) => {
            const absolute = uri.startsWith("http")
              ? uri
              : new URL(uri, pathBase).href;
            return `URI="${proxyBase}${encodeURIComponent(absolute)}"`;
          });
        }

        // Rewrite #EXT-X-MAP URI (fMP4 init segments)
        if (trimmed.startsWith("#EXT-X-MAP") && trimmed.includes('URI="')) {
          return trimmed.replace(/URI="([^"]+)"/, (_m, uri: string) => {
            const absolute = uri.startsWith("http")
              ? uri
              : new URL(uri, pathBase).href;
            return `URI="${proxyBase}${encodeURIComponent(absolute)}"`;
          });
        }

        // Skip other tags
        if (trimmed.startsWith("#")) return line;

        // URL line — rewrite through proxy
        if (trimmed.startsWith("http")) {
          return `${proxyBase}${encodeURIComponent(trimmed)}`;
        }

        const absolute = new URL(trimmed, pathBase).href;
        return `${proxyBase}${encodeURIComponent(absolute)}`;
      })
      .join("\n");

    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Range, Content-Type",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Proxy error" },
      { status: 502 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
    },
  });
}
