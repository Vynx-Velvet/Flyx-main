import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { networkInterfaces } = await import("node:os");
    const nets = networkInterfaces();
    const port = Number(process.env.PORT || 3891);
    const urls: { url: string; address: string }[] = [];

    for (const [, interfaces] of Object.entries(nets)) {
      if (!interfaces) continue;
      for (const iface of interfaces) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (iface.family === "IPv4" && !iface.internal) {
          urls.push({
            url: `http://${iface.address}:${port}`,
            address: iface.address,
          });
        }
      }
    }

    const base = {
      desktop: process.env.FLYX_DESKTOP === "true",
      hostname: process.env.HOSTNAME || null,
      // Node runtime sees setup/save's in-memory env mutation immediately —
      // the client-side SetupGate uses this to pin the master to the wizard
      // until first-run setup completes (the edge middleware can't).
      setupComplete: process.env.SETUP_COMPLETE === "true",
    };

    if (urls.length === 0) {
      return NextResponse.json({ url: null, reason: "no-lan-ip", urls: [], ...base });
    }

    // `url`/`ip` keep the first address for backwards compatibility
    // (components/help/NetworkStatus.tsx consumes these fields).
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
    });
  }
}
