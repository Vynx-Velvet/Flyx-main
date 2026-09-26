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
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSegment } from "@/lib/livetv/segment-cache";

export const runtime = 'nodejs';
export const maxDuration = 30;

const DEFAULT_PLAYER_ORIGIN = "https://daddyliveplayer.st";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'Missing or invalid url parameter' }, { status: 400 });
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
      return NextResponse.json({ error: `Upstream error: ${status}` }, { status });
    }
    return NextResponse.json({ error: 'Segment fetch failed' }, { status: 502 });
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
      'Content-Type': 'video/mp2t',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'Content-Length': ts.byteLength.toString(),
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
    },
  });
}
