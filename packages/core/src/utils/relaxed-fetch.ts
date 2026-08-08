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
  // Video CDNs used by DLHD — may block Node.js TLS or have self-signed certs
  "phantemlis.top",
  "epaly.fun",
  "xameleon.xyz",
  "xameleoncdn.xyz",
]);

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

  if (!RELAXED_HOSTS.has(hostname)) {
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
 */
export function needsRelaxedTLS(url: string): boolean {
  try {
    return RELAXED_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}
