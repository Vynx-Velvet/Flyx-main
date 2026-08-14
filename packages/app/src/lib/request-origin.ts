import type { NextRequest } from "next/server";

/**
 * The origin the client actually used to reach us.
 *
 * Next's standalone server builds request URLs from HOSTNAME (0.0.0.0 when
 * LAN sharing is on) instead of the Host header, so `new URL(request.url)`
 * would redirect LAN clients to a non-routable http://0.0.0.0:3891 address.
 * Use the Host header (+ forwarded proto for https deployments) instead.
 */
export function requestOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured;

  const host = request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") || "http";
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}
