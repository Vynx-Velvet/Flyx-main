/**
 * Unified stream proxy URL builder.
 *
 * Replaces 4 duplicated implementations from Flyx 2.0:
 * - `VideoPlayer.applyStreamProxy()` (116-211, 12+ hardcoded CDN patterns)
 * - `VideoPlayerWrapper.maybeProxyUrl()` (4 places)
 * - API route inline proxy logic (107-176)
 * - `MobileVideoPlayer` implicit proxy logic
 *
 * @module proxy
 */

import type { StreamSource } from "../types/provider";

/**
 * Configuration for the stream proxy.
 */
export interface ProxyConfig {
  /** Base URL of the stream proxy endpoint. */
  streamProxyUrl: string;
  /** Base URL of the TV proxy endpoint. */
  tvProxyUrl?: string;
  /** Base URL of the anime proxy endpoint. */
  animeProxyUrl?: string;
  /** CDN domain patterns that can be accessed directly (no proxy needed). */
  bypassDirectPatterns?: string[];
}

/**
 * Builds proxied URLs for stream sources.
 *
 * Instead of hardcoding CDN domain patterns across 4+ files,
 * this class provides a single `apply()` method that all consumers use.
 *
 * @example
 * ```ts
 * const proxy = new StreamProxy({
 *   streamProxyUrl: "/api/stream-proxy",
 *   bypassDirectPatterns: ["localhost", "192.168."],
 * });
 *
 * const proxiedUrl = proxy.apply(source, "vidsrc");
 * ```
 */
export class StreamProxy {
  constructor(private readonly config: ProxyConfig) {}

  /**
   * Apply stream proxying to a source URL.
   *
   * **Rules:**
   * 1. If the source explicitly opts out (`requiresSegmentProxy === false`), skip proxying.
   * 2. If the URL matches a bypass pattern, return it as-is.
   * 3. If the URL is already proxied (contains the proxy base URL), return as-is.
   * 4. Otherwise, wrap through the stream proxy endpoint.
   *
   * @param source - The stream source to proxy.
   * @param provider - The provider name (for proxy routing).
   * @returns The proxied URL (or original if proxying is unnecessary).
   */
  apply(source: StreamSource, provider: string): string {
    // Explicit opt-out
    if (source.requiresSegmentProxy === false) {
      return source.url;
    }

    // Already proxied
    if (this.isAlreadyProxied(source.url)) {
      return source.url;
    }

    // Bypass for known direct-access patterns
    if (this.shouldBypass(source.url)) {
      return source.url;
    }

    return this.buildProxyUrl(source, provider);
  }

  /**
   * Check if a URL is already going through the proxy.
   */
  isAlreadyProxied(url: string): boolean {
    const proxyHosts = [this.config.streamProxyUrl];
    if (this.config.tvProxyUrl) proxyHosts.push(this.config.tvProxyUrl);
    if (this.config.animeProxyUrl) proxyHosts.push(this.config.animeProxyUrl);

    return proxyHosts.some((host) => url.includes(host));
  }

  /**
   * Check if a URL matches a bypass pattern (local/dev URLs, known direct CDNs).
   */
  shouldBypass(url: string): boolean {
    if (!this.config.bypassDirectPatterns?.length) return false;
    return this.config.bypassDirectPatterns.some((pattern) => url.includes(pattern));
  }

  /**
   * Build the proxied URL with all relevant headers encoded.
   */
  private buildProxyUrl(source: StreamSource, provider: string): string {
    const params = new URLSearchParams();
    params.set("url", this.fullyDecode(source.url));
    params.set("provider", provider);

    if (source.referer) {
      params.set("referer", source.referer);
    }
    if (source.origin) {
      params.set("origin", source.origin);
    }
    if (source.userAgent) {
      params.set("ua", source.userAgent);
    }

    return `${this.config.streamProxyUrl}?${params.toString()}`;
  }

  /**
   * Fully decode a URL that may be double/triple-encoded.
   *
   * Some providers encode their CDN URLs multiple times to obscure them.
   * This iteratively decodes until the URL stabilises.
   */
  private fullyDecode(url: string): string {
    let decoded = url;
    let previous = "";
    while (decoded !== previous) {
      previous = decoded;
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        break; // Invalid encoding sequence — stop
      }
    }
    return decoded;
  }
}
