import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { networkInterfaces } = await import("node:os");
    const nets = networkInterfaces();
    let lanIp: string | null = null;

    for (const [, interfaces] of Object.entries(nets)) {
      if (!interfaces) continue;
      for (const iface of interfaces) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (iface.family === "IPv4" && !iface.internal) {
          lanIp = iface.address;
          break;
        }
      }
      if (lanIp) break;
    }

    if (!lanIp) {
      return NextResponse.json({ url: null, reason: "no-lan-ip" });
    }

    const port = Number(process.env.PORT || 3891);
    return NextResponse.json({ ip: lanIp, port, url: `http://${lanIp}:${port}` });
  } catch {
    return NextResponse.json({ url: null, reason: "unsupported" });
  }
}
