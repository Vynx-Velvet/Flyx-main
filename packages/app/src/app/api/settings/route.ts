/**
 * GET /api/settings  — read all app settings (public subset)
 * PATCH /api/settings — update a setting (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting, getAllSettings } from "@/lib/db";
import { getSession } from "@/lib/auth/get-session";

export async function GET() {
  const settings = getAllSettings();
  // Include host key from env so the admin can share it
  if (process.env.HOST_KEY) {
    settings.host_key = process.env.HOST_KEY;
  }
  return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: "key and value are required" }, { status: 400 });
    }

    setSetting(key, String(value));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
