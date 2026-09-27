import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { lanAddresses, serverPort } from "@/lib/lan-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Exposes LAN addresses and the computer name — signed-in users only.
export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const os = await import("node:os");
    const port = serverPort();
    const urls = lanAddresses();

    const base = {
      desktop: process.env.FLYX_DESKTOP === "true",
      hostname: process.env.HOSTNAME || null,
      computerName: process.env.COMPUTERNAME || os.hostname() || null,
      setupComplete: process.env.SETUP_COMPLETE === "true",
    };

    if (urls.length === 0) {
      return NextResponse.json({ url: null, reason: "no-lan-ip", urls: [], ...base });
    }

    return NextResponse.json({
      url: urls[0].url,
      ip: urls[0].address,
      port,
      urls,
      ...base,
    });
  } catch {
    return NextResponse.json({
      url: null,
      reason: "unsupported",
      urls: [],
      desktop: false,
      hostname: null,
      computerName: null,
    });
  }
}
