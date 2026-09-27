/**
 * Signed proxy URLs (Node runtime only).
 *
 * The media proxies (/api/stream/proxy, /api/livetv/*, /api/subtitles/proxy)
 * must not be usable as an open relay by strangers, but some legitimate
 * consumers carry no session cookie: VLC and ffmpeg fetch playlists and
 * segments on their own, and HLS playlists rewritten by the proxy point back
 * at the proxy. Those URLs are minted server-side and carry an HMAC `sig`
 * (+ `exp`) instead. Browser requests from the app carry the flyx_token
 * cookie and are authorized by session.
 *
 * sig = base64url(HMAC-SHA256(JWT_SECRET, pathname + "?" + canonical query))
 * where the canonical query is every param except `sig`, sorted by key.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/get-session";

/** Default lifetime of a signed URL. Long enough for a multi-hour download. */
export const DEFAULT_SIGNED_TTL_SECONDS = 24 * 60 * 60;

function getKey(): string | null {
  const secret = process.env.JWT_SECRET;
  return secret && secret.length >= 16 ? `flyx-proxy-sign:${secret}` : null;
}

function canonical(pathname: string, params: URLSearchParams): string {
  const entries = [...params.entries()]
    .filter(([k]) => k !== "sig")
    .sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : av > bv ? 1 : 0) : a < b ? -1 : 1));
  const q = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return `${pathname}?${q}`;
}

function hmac(key: string, data: string): string {
  return createHmac("sha256", key).update(data).digest("base64url");
}

/**
 * Sign a proxy URL. Accepts an absolute URL or a root-relative path
 * ("/api/stream/proxy?url=…") and returns the same form with `exp` and
 * `sig` appended. If no JWT_SECRET is configured the URL is returned
 * unsigned (the proxy will then only accept session-authenticated requests).
 */
export function signProxyUrl(url: string, ttlSeconds = DEFAULT_SIGNED_TTL_SECONDS): string {
  const key = getKey();
  if (!key) return url;
  const relative = url.startsWith("/");
  const u = new URL(url, "http://flyx.invalid");
  u.searchParams.delete("sig");
  u.searchParams.set("exp", String(Math.floor(Date.now() / 1000) + ttlSeconds));
  u.searchParams.set("sig", hmac(key, canonical(u.pathname, u.searchParams)));
  return relative ? `${u.pathname}${u.search}` : u.toString();
}

/** True if the request URL carries a valid, unexpired signature. */
export function hasValidSignature(requestUrl: string | URL): boolean {
  const key = getKey();
  if (!key) return false;
  const u = new URL(String(requestUrl));
  const sig = u.searchParams.get("sig");
  const exp = Number(u.searchParams.get("exp"));
  if (!sig || !Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const expected = Buffer.from(hmac(key, canonical(u.pathname, u.searchParams)));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** How a proxy request was authorized (null = not at all). */
export type ProxyAuthorization = "signature" | "session" | null;

/**
 * Authorize a proxy request: a valid signature (VLC / ffmpeg / Chromecast /
 * proxy-rewritten playlist entries) or a logged-in session (browser
 * playback). The signature is checked first: only signature-authorized
 * responses may carry CORS headers (see media-proxy.ts applySignedCors).
 */
export async function proxyAuthorization(request: NextRequest): Promise<ProxyAuthorization> {
  if (hasValidSignature(request.url)) return "signature";
  return (await getSession()) !== null ? "session" : null;
}

/** proxyAuthorization as a boolean. */
export async function isProxyRequestAuthorized(request: NextRequest): Promise<boolean> {
  return (await proxyAuthorization(request)) !== null;
}
