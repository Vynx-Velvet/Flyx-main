/**
 * SSRF-safe outbound fetch (Node runtime only).
 *
 * Every server-side fetch of a caller- or upstream-influenced URL goes
 * through here: only http(s), the hostname must resolve exclusively to
 * public addresses, redirects are followed manually with the same check on
 * every hop, and bodies can be read with a hard byte cap.
 *
 * DNS rebinding: assertPublicUrl's lookup is only a pre-check. The address
 * actually connected to is re-validated at connect time by guardedLookup,
 * which safeFetch installs through a dedicated undici dispatcher (and which
 * the node http(s) / relaxed-fetch paths pass as their `lookup`). Hosts that
 * are IP literals skip DNS entirely, so assertPublicUrl stays mandatory.
 */

import dns from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import { Agent } from "undici";

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

export class BodyTooLargeError extends Error {
  constructor(limit: number) {
    super(`Response body exceeds ${limit} bytes`);
    this.name = "BodyTooLargeError";
  }
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

function inV4(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const BLOCKED_V4 = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
];

/** True for loopback, private, link-local, CGNAT, multicast and reserved addresses. */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return BLOCKED_V4.some((c) => inV4(ip, c));
  if (version === 6) {
    const lower = ip.toLowerCase();
    // IPv4-mapped / -compatible (::ffff:a.b.c.d)
    const mapped = lower.match(/^(?:::ffff:|::)(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    if (lower === "::" || lower === "::1") return true;
    const first = parseInt(lower.split(":")[0] || "0", 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    if (lower.startsWith("64:ff9b:")) return true; // NAT64 can reach v4 private
    if (lower.startsWith("2001:db8:")) return true;
    return false;
  }
  return true; // not an IP at all — treat as unsafe
}

/**
 * Throw BlockedUrlError unless `raw` is an http(s) URL whose host resolves
 * only to public addresses. Returns the parsed URL.
 */
export async function assertPublicUrl(raw: string | URL): Promise<URL> {
  let url: URL;
  try {
    url = new URL(String(raw));
  } catch {
    throw new BlockedUrlError("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError(`Blocked scheme ${url.protocol}`);
  }
  if (url.username || url.password) throw new BlockedUrlError("Credentials in URL are not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host) throw new BlockedUrlError("Missing host");
  const lowerHost = host.toLowerCase();
  if (lowerHost === "localhost" || lowerHost.endsWith(".localhost") || lowerHost.endsWith(".local")) {
    throw new BlockedUrlError("Blocked host");
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new BlockedUrlError("Blocked private address");
    return url;
  }
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new BlockedUrlError("DNS lookup failed");
  }
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) {
    throw new BlockedUrlError("Host resolves to a private address");
  }
  return url;
}

type LookupAddress = { address: string; family: number };

/**
 * Drop-in `lookup` for net/tls/http(s)/undici connect options. Resolves every
 * address for the host and fails with BlockedUrlError if ANY of them is
 * private, so the socket can only ever be opened to a validated address (a
 * rebinding DNS server can't swap in 127.0.0.1 after the pre-check).
 */
export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  const opts: dns.LookupOptions = typeof options === "object" && options ? options : {};
  const cb = callback as (err: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void;
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateAddress(host)) return cb(new BlockedUrlError("Blocked private address"));
    const family = isIP(host);
    return opts.all ? cb(null, [{ address: host, family }]) : cb(null, host, family);
  }
  dns.lookup(host, { ...opts, all: true }, (err, addrs) => {
    if (err) return cb(err);
    if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) {
      return cb(new BlockedUrlError(`${host} resolves to a private address`));
    }
    if (opts.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  });
};

/** undici dispatcher whose sockets connect only to guardedLookup-validated addresses. */
export const safeDispatcher = new Agent({ connect: { lookup: guardedLookup } });

export interface SafeFetchOptions {
  /** Max redirects to follow (each hop is re-validated). Default 5. */
  maxRedirects?: number;
  /** Extra per-hop host check (e.g. an allowlist). Throw to reject. */
  checkUrl?: (url: URL) => void;
}

/**
 * fetch() with SSRF protection on the initial URL and every redirect hop.
 * The caller's `redirect` option is ignored (always manual internally).
 */
export async function safeFetch(
  input: string | URL,
  init: RequestInit = {},
  opts: SafeFetchOptions = {},
): Promise<Response> {
  const maxRedirects = opts.maxRedirects ?? 5;
  let current = String(input);
  for (let hop = 0; ; hop++) {
    const url = await assertPublicUrl(current);
    opts.checkUrl?.(url);
    const res = await fetch(url, {
      ...init,
      redirect: "manual",
      // @ts-expect-error — undici dispatcher is supported by Node's fetch
      dispatcher: safeDispatcher,
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      if (hop >= maxRedirects) throw new BlockedUrlError("Too many redirects");
      current = new URL(res.headers.get("location")!, url).toString();
      try {
        await res.body?.cancel();
      } catch {
        /* ignore */
      }
      continue;
    }
    return res;
  }
}

/** Read a response body into memory, aborting once it exceeds `maxBytes`. */
export async function readBodyLimited(res: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }
    throw new BodyTooLargeError(maxBytes);
  }
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      throw new BodyTooLargeError(maxBytes);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

/** readBodyLimited + UTF-8 decode. */
export async function readTextLimited(res: Response, maxBytes: number): Promise<string> {
  return new TextDecoder().decode(await readBodyLimited(res, maxBytes));
}
