/**
 * GET  /api/settings/downloads — current download folder + default
 * POST /api/settings/downloads — set (or clear, to reset) the download folder
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { getSetting, setSetting } from "@/lib/db";
import { defaultDownloadDir, getDownloadDir } from "@/lib/downloads/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  return NextResponse.json({
    dir: getDownloadDir(),
    custom: getSetting("download_dir") || null,
    defaultDir: defaultDownloadDir(),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: { dir?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const dir = (body?.dir || "").trim();
  if (dir) {
    setSetting("download_dir", dir);
  } else {
    setSetting("download_dir", "");
  }
  return NextResponse.json({ ok: true, dir: getDownloadDir() });
}
