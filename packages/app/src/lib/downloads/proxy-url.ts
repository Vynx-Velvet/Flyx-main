/**
 * Local stream-proxy URLs for server-side consumers (ffmpeg, variant lookup).
 *
 * The media proxy requires a session cookie or a signature; ffmpeg and our
 * own server-side fetches carry no cookie, so every URL minted here is
 * signed (lib/security/proxy-sign). Downloads can run for hours, so the
 * signature outlives the default TTL.
 */

import type { StreamSource } from "@flyx/core";
import { signProxyUrl } from "@/lib/security/proxy-sign";

/** Signed-URL lifetime for downloads (a multi-hour remux must not expire mid-job). */
export const DOWNLOAD_SIGN_TTL_SECONDS = 48 * 60 * 60;

function localPort(): string {
  const port = String(process.env.PORT || "3891");
  return /^\d{1,5}$/.test(port) ? port : "3891";
}

/** Origin of this server as seen from the same machine. */
export function localOrigin(): string {
  return `http://127.0.0.1:${localPort()}`;
}

/** Signed `http://127.0.0.1:<port>/api/stream/proxy?url=…` for a source. */
export function buildLocalProxyUrl(
  source: Pick<StreamSource, "url" | "referer" | "origin">,
  ttlSeconds = DOWNLOAD_SIGN_TTL_SECONDS,
): string {
  const params = new URLSearchParams();
  params.set("url", source.url);
  if (source.referer) params.set("referer", source.referer);
  if (source.origin) params.set("origin", source.origin);
  return signProxyUrl(`${localOrigin()}/api/stream/proxy?${params.toString()}`, ttlSeconds);
}

/** True when `url` points at this server's stream proxy (the only ffmpeg input we allow). */
export function isLocalProxyUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "http:" &&
      u.hostname === "127.0.0.1" &&
      u.port === localPort() &&
      u.pathname === "/api/stream/proxy" &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
}
