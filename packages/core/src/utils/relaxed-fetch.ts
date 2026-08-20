/**
 * TLS-relaxed fetch wrapper for CDNs that reject Node.js TLS fingerprints.
 *
 * Many pirate streaming CDNs use Cloudflare or other reverse proxies that
 * block Node.js's undici TLS handshake with ERR_SSL_WRONG_VERSION_NUMBER.
 * Browsers handle these sites fine because they use different TLS stacks.
 *
 * This module provides a fetch() wrapper with relaxed TLS verification.
 * Use ONLY for known problematic hosts — not for general-purpose fetching.
 */

import { Agent } from "undici";

/** Domains known to reject Node.js TLS fingerprints or have broken TLS. */
const RELAXED_HOSTS = new Set([
  // DLHD / DaddyLive — Cloudflare blocks Node.js TLS
  "dlhd.st",
  "dlhd.pk",
  "dlhd.sx",
  "daddylive.mp",
  "hamis.romponalis.st",
  // Video CDNs used by DLHD — may block Node.js TLS or have self-signed certs.
  // DLHD currently rotates the CDN subdomain (xameleon.phantemlis.top today,
  // could be any-<base> tomorrow). The match against RELAXED_HOSTS uses a
  // suffix check below, so listing the base domain covers every subdomain.
  "phantemlis.top",
  "epaly.fun",
  "xameleon.xyz",
  "xameleoncdn.xyz",
]);

/**
 * Returns true if `hostname` is itself a relaxed host, or a subdomain of one.
 * DLHD rotates CDN subdomains (xameleon.phantemlis.top, <other>.phantemlis.top,
 * …), so suffix matching prevents the relaxed-fetch path from silently falling
 * back to vanilla fetch the moment a new subdomain shows up.
 */
function isRelaxedHost(hostname: string): boolean {
  if (RELAXED_HOSTS.has(hostname)) return true;
  for (const base of RELAXED_HOSTS) {
    if (hostname.endsWith("." + base)) return true;
  }
  return false;
}

/** Shared agent with relaxed TLS — reused across all relaxed fetches. */
let _agent: Agent | null = null;

function getAgent(): Agent {
  if (!_agent) {
    _agent = new Agent({
      connect: {
        rejectUnauthorized: false,
      },
    });
  }
  return _agent;
}

/**
 * Wraps fetch() with TLS relaxation for known problematic hosts.
 * For all other hosts, delegates to the standard global fetch().
 */
export async function relaxedFetch(
  url: string,
  init?: RequestInit & { timeout?: number },
): Promise<Response> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return fetch(url, init as RequestInit);
  }

  if (!isRelaxedHost(hostname)) {
    return fetch(url, init as RequestInit);
  }

  const dispatcher = getAgent();

  let signal = init?.signal ?? undefined;
  if (init?.timeout && !signal) {
    const c = new AbortController();
    setTimeout(() => c.abort(), init.timeout);
    signal = c.signal;
  }

  return fetch(url, {
    ...(init as RequestInit),
    // @ts-expect-error — undici dispatcher is supported at Node.js runtime
    dispatcher,
    signal,
  });
}

/**
 * Check if a URL's host is known to need TLS relaxation.
 * Matches the exact host *or* any subdomain of a relaxed base.
 */
export function needsRelaxedTLS(url: string): boolean {
  try {
    return isRelaxedHost(new URL(url).hostname);
  } catch {
    return false;
  }
}
