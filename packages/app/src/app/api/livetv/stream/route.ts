import { NextRequest, NextResponse } from "next/server";
import { extractDLHD } from "@flyx/extractors/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channel") || "";

  if (!channelId) {
    return NextResponse.json({ success: false, error: "Missing channel parameter" }, { status: 400 });
  }

  try {
    const result = await extractDLHD(channelId);

    const debugInfo: string[] = [];
    debugInfo.push(`sources: ${result.sources?.length ?? 0}`);
    if (result.sources?.[0]) debugInfo.push(`url: ${result.sources[0].url.slice(0, 100)}`);

    if (result.sources?.length > 0) {
      const source = result.sources[0];
      const rawUrl = source.url!;
      const cdnOrigin = source.origin || source.referer || "";

      // Route through playlist proxy so the browser doesn't hit the CDN directly.
      // The CDN checks Referer and will 403 on browser-originated requests.
      const proxiedUrl = `/api/livetv/playlist?url=${encodeURIComponent(rawUrl)}&origin=${encodeURIComponent(cdnOrigin)}`;

      return NextResponse.json({
        success: true,
        streamUrl: proxiedUrl,
        provider: "dlhd", channelId,
        quality: source.quality || "Auto",
        title: source.title,
        headers: { referer: cdnOrigin, origin: cdnOrigin, userAgent: source.userAgent },
      });
    }

    return NextResponse.json(
      { success: false, error: `No stream found for "${channelId}"`, debug: debugInfo },
      { status: 404 },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Extraction failed" },
      { status: 500 },
    );
  }
}
