/**
 * LAN addresses of this server (Node runtime only).
 *
 * Used by /api/network (the "open Flyx on another device" hint) and by the
 * cast hand-off: a Chromecast fetches the stream itself, so it needs an
 * absolute URL on an address it can reach — never 127.0.0.1 / localhost.
 */

import os from "node:os";
import { isIP } from "node:net";
import type { NextRequest } from "next/server";
import { requestOrigin } from "@/lib/request-origin";

export interface NetworkAddress {
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

export function serverPort(): number {
  return Number(process.env.PORT || 3891);
}

/** Non-internal IPv4 addresses, best LAN candidate first (flagged `recommended`). */
export function lanAddresses(): NetworkAddress[] {
  const port = serverPort();
  const candidates: Array<NetworkAddress & { score: number }> = [];
  for (const [interfaceName, addresses] of Object.entries(os.networkInterfaces())) {
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
    (first, second) => second.score - first.score || first.interface.localeCompare(second.interface),
  );
  return candidates.map(({ score: _score, ...candidate }, index) => ({
    ...candidate,
    recommended: index === 0,
  }));
}

/** True when the server listens on every interface (LAN sharing on). */
export function isLanSharingOn(): boolean {
  const bound = (process.env.HOSTNAME || "").trim();
  return bound === "0.0.0.0" || bound === "::";
}

function isLoopbackOrUnroutable(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0" || h === "::" || h === "::1") return true;
  return isIP(h) === 4 && h.startsWith("127.");
}

/**
 * Origin a device on the LAN (Chromecast) can fetch this server at, or null
 * when there is none — i.e. the server is bound to 127.0.0.1 only.
 *
 * Preference: a configured NEXT_PUBLIC_APP_URL; else the address the viewer
 * reached us at when that is a routable IP or DNS name (mDNS ".local" and
 * bare machine names are skipped — Cast devices don't resolve them); else,
 * with LAN sharing on, the best LAN interface address.
 */
export function castOrigin(request: NextRequest): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      const u = new URL(configured);
      if (!isLoopbackOrUnroutable(u.hostname)) return u.origin;
    } catch {
      /* ignore malformed */
    }
  }

  try {
    const u = new URL(requestOrigin(request));
    const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    const routableName = host.includes(".") && !host.endsWith(".local") && !isIP(host);
    if (!isLoopbackOrUnroutable(host) && (isIP(host) || routableName)) return u.origin;
  } catch {
    /* fall through */
  }

  if (!isLanSharingOn()) return null;
  return lanAddresses()[0]?.url ?? null;
}
