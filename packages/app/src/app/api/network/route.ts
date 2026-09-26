import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface NetworkAddress {
  url: string;
  address: string;
  interface: string;
  recommended: boolean;
}

const VIRTUAL_INTERFACE =
  /virtual|vmware|vbox|hyper-v|docker|wsl|loopback|tailscale|zerotier|vpn|bluetooth/i;
const PHYSICAL_INTERFACE = /wi-?fi|wireless|wlan|ethernet|local area connection/i;

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some(Number.isNaN)) return false;
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function addressScore(address: string, interfaceName: string): number {
  let score = isPrivateIpv4(address) ? 20 : 0;
  if (PHYSICAL_INTERFACE.test(interfaceName)) score += 12;
  if (VIRTUAL_INTERFACE.test(interfaceName)) score -= 30;
  if (address.startsWith("169.254.")) score -= 50;
  return score;
}

export async function GET() {
  try {
    const os = await import("node:os");
    const interfaces = os.networkInterfaces();
    const port = Number(process.env.PORT || 3891);
    const candidates: Array<NetworkAddress & { score: number }> = [];

    for (const [interfaceName, addresses] of Object.entries(interfaces)) {
      if (!addresses) continue;
      for (const address of addresses) {
        if (address.family !== "IPv4" || address.internal) continue;
        candidates.push({
          url: `http://${address.address}:${port}`,
          address: address.address,
          interface: interfaceName,
          recommended: false,
          score: addressScore(address.address, interfaceName),
        });
      }
    }

    candidates.sort(
      (first, second) =>
        second.score - first.score || first.interface.localeCompare(second.interface),
    );

    const urls: NetworkAddress[] = candidates.map(({ score: _score, ...candidate }, index) => ({
      ...candidate,
      recommended: index === 0,
    }));

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
