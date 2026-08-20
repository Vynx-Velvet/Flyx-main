/**
 * Live TV Backends API
 *
 * Returns the list of upstream CDN backends available for live TV channel
 * playback. The browser UI uses this to populate the "Switch Server" menu;
 * the chosen backend ID is forwarded to /api/livetv/stream and ultimately
 * picked up by /api/livetv/playlist when fetching the M3U8.
 *
 * Today only the primary DLHD CDN is exposed; once we wire rotation across
 * multiple CDN mirrors, additional backends will be returned here.
 *
 * NOTE: We intentionally do *not* return raw upstream CDN hostnames to the
 * client — they are written into the player's M3U8 URL as `origin=` server
 * side. Returning them client-side would leak the obfuscation layer.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BackendInfo {
  id: string;
  isPrimary: boolean;
  label: string;
  status?: "online" | "offline" | "timeout" | "unknown";
}

const BACKENDS: BackendInfo[] = [
  {
    id: "primary",
    isPrimary: true,
    label: "Primary (DLHD)",
    status: "online",
  },
];

export async function GET() {
  return NextResponse.json(
    { success: true, backends: BACKENDS },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    },
  );
}