/**
 * VidSrc token URL registry.
 *
 * VidSrc stream CDNs require IP-bound tokens appended to segment URLs.
 * The data.vidsrcme.ru API returns `gen_token_url` — the endpoint that
 * issues tokens valid for the specific CDN hosts in the response.
 *
 * This registry maps CDN origins → token URLs so /api/stream/proxy can
 * fetch tokens from the correct endpoint instead of guessing
 * `${cdnOrigin}/generate.php` (which fails — those CDN hosts block
 * non-browser TLS or don't expose that path).
 *
 * Thread safety: single-process Next.js server — no locking needed.
 */

/** CDN origin → token URL (e.g. "https://opalescentoblivion.space" → "https://...") */
const tokenUrlByOrigin = new Map<string, string>();

/** TTL per entry (millis since epoch). Entries auto-expire. */
const expiryByOrigin = new Map<string, number>();

/** Default TTL: 30 minutes (tokens themselves last ~55 min) */
const DEFAULT_TTL_MS = 30 * 60 * 1000;

/**
 * Register a token URL for one or more CDN origins.
 * Called by the VidSrc extractor after it gets gen_token_url from the API.
 */
export function registerTokenUrls(
  origins: string[],
  tokenUrl: string,
  ttlMs = DEFAULT_TTL_MS,
): void {
  const expiresAt = Date.now() + ttlMs;
  for (const origin of origins) {
    tokenUrlByOrigin.set(origin, tokenUrl);
    expiryByOrigin.set(origin, expiresAt);
  }
}

/**
 * Look up the registered token URL for a CDN origin.
 * Returns undefined if no entry exists or it has expired.
 */
export function getTokenUrl(origin: string): string | undefined {
  const expiresAt = expiryByOrigin.get(origin);
  if (expiresAt && Date.now() > expiresAt) {
    tokenUrlByOrigin.delete(origin);
    expiryByOrigin.delete(origin);
    return undefined;
  }
  return tokenUrlByOrigin.get(origin);
}

/**
 * Clear all entries (for testing).
 */
export function clearTokenRegistry(): void {
  tokenUrlByOrigin.clear();
  expiryByOrigin.clear();
}
