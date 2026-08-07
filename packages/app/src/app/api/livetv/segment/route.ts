/**
 * Live TV Segment Proxy
 *
 * Proxies video segments (.ts/.m4s) from DLHD CDN.
 * The CDN blocks direct browser requests and may use anti-bot
 * protection that detects Node.js TLS fingerprints.
 *
 * Strategy order:
 *   1. Python curl_cffi service (Chrome TLS impersonation) — best
 *   2. RPI proxy (if configured)
 *   3. Direct Node.js fetch with browser headers
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const UA =
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0";
const SERVICE_URL = process.env.DLHD_SERVICE_URL ?? "http://127.0.0.1:9876";
const RPI_PROXY_URL = process.env.RPI_PROXY_URL;
const RPI_PROXY_KEY = process.env.RPI_PROXY_KEY;

/**
 * Fetch a segment through the Python curl_cffi service.
 * Fast path — no retries, tight timeout (segments are time-sensitive).
 */
async function fetchSegmentViaService(
  url: string,
  referer: string,
  timeoutMs = 8000,
): Promise<{ ok: boolean; status: number; arrayBuffer: () => Promise<ArrayBuffer> } | null> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeoutMs);
    const r = await fetch(
      `${SERVICE_URL}/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`,
      { signal: c.signal },
    );
    clearTimeout(t);
    if (!r.ok) return null;
    // Return the Response-like object for consistent API
    return {
      ok: true,
      status: 200,
      arrayBuffer: () => r.arrayBuffer(),
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'Missing URL parameter' },
        { status: 400 },
      );
    }

    const decodedUrl = decodeURIComponent(url);
    const origin = searchParams.get("origin")
      ? decodeURIComponent(searchParams.get("origin")!)
      : searchParams.get("referer")
        ? decodeURIComponent(searchParams.get("referer")!)
        : undefined;

    const cdnOrigin =
      origin
      || (decodedUrl.includes("phantemlis.top")
        ? "https://hamis.romponalis.st"
        : "https://epaly.fun");

    const cookie = searchParams.get("cookie")
      ? decodeURIComponent(searchParams.get("cookie")!)
      : "";

    // Build fetch headers — include cookies if captured during extraction
    const fetchHeaders: Record<string, string> = {
      "User-Agent": UA,
      Referer: cdnOrigin,
      Origin: cdnOrigin,
      Accept: "*/*",
    };
    if (cookie) fetchHeaders["Cookie"] = cookie;

    let arrayBuffer: ArrayBuffer | null = null;

    // Strategy 1: Python curl_cffi service (Chrome TLS — best for anti-bot CDNs)
    const svcResult = await fetchSegmentViaService(decodedUrl, cdnOrigin);
    if (svcResult) {
      try {
        arrayBuffer = await svcResult.arrayBuffer();
      } catch {
        console.warn(`[Segment] Python service fetch body failed, falling back`);
      }
    }

    // Strategy 2: RPI proxy (if configured)
    if (!arrayBuffer && RPI_PROXY_URL && RPI_PROXY_KEY) {
      try {
        const proxyUrl = `${RPI_PROXY_URL}/proxy?url=${encodeURIComponent(decodedUrl)}`;
        const response = await fetch(proxyUrl, {
          headers: { "X-API-Key": RPI_PROXY_KEY },
          cache: "no-store",
        });
        if (response.ok) {
          arrayBuffer = await response.arrayBuffer();
        }
      } catch {
        // fall through
      }
    }

    // Strategy 3: Direct fetch with browser headers + cookies
    if (!arrayBuffer) {
      try {
        const response = await fetch(decodedUrl, { headers: fetchHeaders });

        if (!response.ok) {
          console.error(
            `[Segment] Upstream error: ${response.status} for ${decodedUrl.substring(0, 80)}`,
          );
          return NextResponse.json(
            { error: `Upstream error: ${response.status}` },
            { status: response.status },
          );
        }

        arrayBuffer = await response.arrayBuffer();
      } catch (err) {
        console.error(`[Segment] Fetch error: ${(err as Error).message}`);
        return NextResponse.json(
          { error: 'Segment fetch failed' },
          { status: 502 },
        );
      }
    }

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return NextResponse.json(
        { error: 'Empty segment' },
        { status: 502 },
      );
    }

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp2t',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'Content-Length': arrayBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('[LiveTV Segment] Error:', error);
    return NextResponse.json(
      { error: 'Segment proxy error' },
      { status: 500 },
    );
  }
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
