/**
 * GET /api/subtitles/proxy
 *
 * Proxies subtitle file downloads from OpenSubtitles CDN URLs.
 * Converts SRT → VTT on the fly for browser compatibility.
 * Shields the user's IP from the download server.
 *
 * Query params:
 *   url — The encoded subtitle file URL to proxy
 *
 * Security: session-or-signature auth, OpenSubtitles hosts only (checked on
 * every redirect hop, SSRF-safe), 2 MB body cap, bounded LRU cache.
 */

import { NextRequest, NextResponse } from "next/server";
import { convertSRTtoVTT, normalizeVTT } from "@/lib/subtitles/srt";
import { proxyAuthorization } from "@/lib/security/proxy-sign";
import { BlockedUrlError, BodyTooLargeError, readTextLimited, safeFetch } from "@/lib/security/safe-fetch";
import { BoundedCache, PROXY_SECURITY_HEADERS, applySignedCors, proxyJsonError, proxyUnauthorized, signedPreflight } from "@/lib/media-proxy";

export const runtime = "nodejs";

const UA = "Flyx/3.0 (https://github.com/Vynx-Velvet/Flyx-main)";

/** Subtitle hosts this proxy may fetch from (and their subdomains). */
const ALLOWED_HOSTS = ["opensubtitles.com", "opensubtitles.org"];
const MAX_SUBTITLE_BYTES = 2 * 1024 * 1024;

function checkHost(url: URL): void {
  const host = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    throw new BlockedUrlError("Subtitle host not allowed");
  }
}

/** Cache proxied subtitles for 1 hour (in-memory, LRU-bounded). */
const cache = new BoundedCache<string>({
  maxEntries: 200,
  maxBytes: 64 * 1024 * 1024,
  ttlMs: 60 * 60 * 1000,
  sizeOf: (v) => v.length * 2,
});

function vttResponse(body: string): NextResponse {
  return new NextResponse(body, {
    headers: {
      ...PROXY_SECURITY_HEADERS,
      "Content-Type": "text/vtt; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function GET(request: NextRequest) {
  const via = await proxyAuthorization(request);
  if (!via) return proxyUnauthorized();
  return applySignedCors(await handleGet(request), via);
}

export function OPTIONS(request: NextRequest) {
  return signedPreflight(request);
}

async function handleGet(request: NextRequest): Promise<NextResponse> {

  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return proxyJsonError({ error: "url param is required" }, 400);
  }

  // Check cache
  const cached = cache.get(url);
  if (cached !== undefined) return vttResponse(cached);

  try {
    const res = await safeFetch(
      url,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) },
      { checkUrl: checkHost },
    );
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return proxyJsonError({ error: `Upstream HTTP ${res.status}` }, 502);
    }

    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    let body = await readTextLimited(res, MAX_SUBTITLE_BYTES);

    // Convert SRT to VTT if needed
    const isSRT =
      contentType.includes("text/plain") ||
      contentType.includes("application/x-subrip") ||
      url.endsWith(".srt") ||
      body.includes(" --> ") && body.includes("\n\n");

    body = isSRT ? convertSRTtoVTT(body) : body;
    body = normalizeVTT(body);

    cache.set(url, body);
    return vttResponse(body);
  } catch (err) {
    if (err instanceof BlockedUrlError) {
      return proxyJsonError({ error: "Subtitle URL not allowed" }, 403);
    }
    if (err instanceof BodyTooLargeError) {
      return proxyJsonError({ error: "Subtitle file too large" }, 502);
    }
    console.error("[subtitles/proxy]", err);
    return proxyJsonError({ error: "Failed to proxy subtitle" }, 500);
  }
}
