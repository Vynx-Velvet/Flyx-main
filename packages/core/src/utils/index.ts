/**
 * @flyx/core/utils
 *
 * Shared utility functions for Flyx 3.0.
 */

export { UnifiedCache, cache } from "./cache";
export type { CacheConfig, CacheStorageAdapter } from "./cache";

export { fetchWithRetry, retryWithBackoff, DEFAULT_RETRY_CONFIG } from "./retry";

export { StreamProxy } from "./proxy";
export type { ProxyConfig } from "./proxy";

export { rewriteM3U8, proxySegmentUrl } from "./m3u8";
export type { M3U8RewriteConfig } from "./m3u8";

export { debounce, throttle } from "./debounce";

export { relaxedFetch, needsRelaxedTLS } from "./relaxed-fetch";
