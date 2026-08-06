/**
 * Manga image proxy — fetches page/cover images server-side.
 *
 * GET /api/manga/image?url=...&referer=...
 *
 * The planeptune.us CDN serves images without requiring a Referer header,
 * but we still proxy through the server for consistency and caching.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = [
  "hot.planeptune.us",
  "weebcentral.com",
  "cdn.weebcentral.com",
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const referer = searchParams.get("referer") || "";

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Validate host
  let validHost = false;
  try {
    const host = new URL(url).hostname;
    validHost = ALLOWED_HOSTS.some(h => host === h || host.endsWith("." + h));
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (!validHost) {
    return NextResponse.json({ error: "Invalid image source" }, { status: 403 });
  }

  try {
    const headers: Record<string, string> = {
      "User-Agent": UA,
      Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
    };
    if (referer) {
      headers.Referer = referer;
    }

    const res = await fetch(url, {
      headers,
      redirect: "follow",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status}` },
        { status: 502 },
      );
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const body = await res.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        "CDN-Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    console.warn(`[manga/image] Failed: ${(err as Error).message}`);
    return NextResponse.json(
      { error: `Failed to fetch image: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
