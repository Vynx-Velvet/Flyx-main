/**
 * Live TV Segment Proxy
 *
 * Serves one media segment to the player as MPEG-TS. DLHD now disguises
 * segments as images (PNG/WebP) or marker-prefixed blobs on a public CDN;
 * lib/livetv/segment-cache fetches, unwraps, de-duplicates and caches them,
 * and the playlist proxy pre-warms the newest ones — so most requests that
 * land here are answered from memory.
 *
 * Query params:
 *   url     — upstream segment URL (already percent-decoded by searchParams;
 *             never decode again, signed CDN URLs contain "%2B")
 *   origin  — player origin to send as Referer/Origin (optional)
 *   cookie  — session cookies captured during extraction (optional)
 *
 * Requires a session or a valid signature (the playlist proxy signs every
 * segment URI it writes); signature-authorized responses carry CORS
 * (applySignedCors). Upstream hops are SSRF-checked in segment-cache.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSegment } from "@/lib/livetv/segment-cache";
import { proxyAuthorization } from "@/lib/security/proxy-sign";
import { PROXY_SECURITY_HEADERS, applySignedCors, proxyJsonError, proxyUnauthorized, signedPreflight } from "@/lib/media-proxy";

export const runtime = 'nodejs';
export const maxDuration = 30;

const DEFAULT_PLAYER_ORIGIN = "https://daddyliveplayer.st";

export async function GET(request: NextRequest) {
  const via = await proxyAuthorization(request);
  if (!via) return proxyUnauthorized();
  return applySignedCors(await handleGet(request), via);
}

export function OPTIONS(request: NextRequest) {
  return signedPreflight(request);
}

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url || !/^https?:\/\//i.test(url)) {
    return proxyJsonError({ error: 'Missing or invalid url parameter' }, 400);
  }

  const origin = searchParams.get("origin") || searchParams.get("referer") || DEFAULT_PLAYER_ORIGIN;
  const cookie = searchParams.get("cookie") || undefined;

  const startedAt = Date.now();
  let ts: Uint8Array;
  try {
    ts = await getSegment(url, { referer: origin, origin, cookie });
  } catch (err) {
    const status = (err as { status?: number }).status;
    const message = (err as Error).message;
    console.error(`[Segment] ${message} for ${url.substring(0, 80)}`);
    if (status && status >= 400 && status < 600) {
      return proxyJsonError({ error: `Upstream error: ${status}` }, status);
    }
    return proxyJsonError({ error: 'Segment fetch failed' }, 502);
  }

  const elapsed = Date.now() - startedAt;
  if (elapsed > 50) {
    console.log(`[Segment] ${elapsed}ms ${Math.round(ts.byteLength / 1024)}KB ${url.substring(0, 80)}`);
  }

  // Fresh ArrayBuffer-backed copy: the cached view may share a larger store.
  const body = new Uint8Array(new ArrayBuffer(ts.byteLength));
  body.set(ts);
  return new NextResponse(body, {
    status: 200,
    headers: {
      ...PROXY_SECURITY_HEADERS,
      'Content-Type': 'video/mp2t',
      'Cache-Control': 'private, max-age=300',
      'Content-Length': ts.byteLength.toString(),
    },
  });
}
