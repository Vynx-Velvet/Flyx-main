/**
 * Unified cache manager for Flyx 3.0.
 *
 * Replaces the 4 separate caching systems in Flyx 2.0:
 * - `lib/utils/cache.ts` (MemoryCache + LocalStorageCache + CacheManager)
 * - `lib/utils/swr-cache.ts` (SWRCache with TTL)
 * - `lib/utils/stream-retry.ts` (StreamRetryManager with retry cache)
 * - `lib/utils/cf-fetch.ts` (RPI config caching)
 *
 * Features:
 * - In-memory storage with TTL-based expiry
 * - Stale-while-revalidate pattern (serve stale, refresh in background)
 * - Namespace support for grouped invalidation
 * - LRU eviction when max size is reached
 * - Optional persistent storage adapter
 *
 * @module cache
 */

/**
 * Configuration for a cache namespace or entry.
 */
export interface CacheConfig {
  /** Time-to-live in milliseconds. */
  ttl: number;
  /** Stale-while-revalidate window in milliseconds (default: 0 = disabled). */
  staleWhileRevalidate?: number;
  /** Namespace for grouped operations and invalidation. */
  namespace?: string;
  /** Maximum number of entries in this namespace (default: unlimited). */
  maxSize?: number;
}

interface CacheEntry<T = unknown> {
  data: T;
  /** Absolute timestamp when the entry expires (Date.now() + ttl). */
  expires: number;
  /** Absolute timestamp when the entry is no longer fresh but still usable (Date.now() + ttl + staleWhileRevalidate). */
  staleUntil: number;
  /** Namespace this entry belongs to. */
  namespace: string;
}

/**
 * Optional interface for persistent storage backends.
 *
 * Implement this to back the cache with localStorage, KV, Redis, etc.
 */
export interface CacheStorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/**
 * Unified cache with TTL, stale-while-revalidate, and namespace support.
 *
 * @example
 * ```ts
 * const cache = new UnifiedCache();
 *
 * // Simple get-or-fetch
 * const data = await cache.get("key", () => fetchData(), { ttl: 60_000 });
 *
 * // With stale-while-revalidate
 * const data = await cache.get("key", () => fetchData(), {
 *   ttl: 5 * 60_000,
 *   staleWhileRevalidate: 60_000,
 *   namespace: "api",
 * });
 *
 * // Invalidate all entries in a namespace
 * cache.invalidate("api");
 * ```
 */
export class UnifiedCache {
  private readonly memory = new Map<string, CacheEntry>();
  private readonly pendingRevalidations = new Set<string>();
  private readonly namespaceSizes = new Map<string, number>();
  /** In-flight fetches — deduplicates concurrent requests for the same key. */
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(private readonly storage?: CacheStorageAdapter) {}

  /**
   * Get a cached value, or fetch and cache it if missing or expired.
   *
   * **Stale-while-revalidate behaviour:**
   * - If the entry is fresh (now < expires): returns immediately.
   * - If the entry is stale but within the revalidation window
   *   (expires <= now < staleUntil): returns stale data immediately
   *   AND triggers a background revalidation.
   * - If the entry is fully expired (now >= staleUntil): fetches fresh
   *   data, caches it, and returns it.
   *
   * @param key - Cache key.
   * @param fetcher - Function to call when a cache miss occurs.
   * @param config - TTL and namespace configuration.
   * @returns The cached or freshly fetched data.
   */
  async get<T>(
    key: string,
    fetcher?: () => Promise<T>,
    config?: CacheConfig,
  ): Promise<T | null> {
    const ns = config?.namespace ?? "__default__";
    const fullKey = `${ns}:${key}`;
    const entry = this.memory.get(fullKey);
    const now = Date.now();

    // Fresh hit
    if (entry && now < entry.expires) {
      console.log(`[Cache] HIT for ${fullKey}`);
      return entry.data as T;
    }

    // Stale-but-usable hit — return stale, revalidate in background
    if (entry && now < entry.staleUntil) {
      if (fetcher && !this.pendingRevalidations.has(fullKey)) {
        this.revalidateInBackground(fullKey, fetcher, config!);
      }
      return entry.data as T;
    }

    // Miss or fully expired
    if (!fetcher) {
      return null;
    }

    return this.fetchAndCache<T>(fullKey, fetcher, config!);
  }

  /**
   * Set a value in the cache.
   *
   * @param key - Cache key.
   * @param data - Value to cache.
   * @param config - TTL and namespace configuration.
   */
  set<T>(key: string, data: T, config: CacheConfig): void {
    const ns = config.namespace ?? "__default__";
    const fullKey = `${ns}:${key}`;
    const ttl = config.ttl;
    const swr = config.staleWhileRevalidate ?? 0;
    const now = Date.now();

    // Check max size and evict oldest if needed
    const maxSize = config.maxSize;
    if (maxSize !== undefined) {
      const currentSize = this.namespaceSizes.get(ns) ?? 0;
      if (currentSize >= maxSize) {
        this.evictOldest(ns);
      }
    }

    this.memory.set(fullKey, {
      data,
      expires: now + ttl,
      staleUntil: now + ttl + swr,
      namespace: ns,
    });

    // Track namespace size
    this.namespaceSizes.set(ns, (this.namespaceSizes.get(ns) ?? 0) + 1);

    // Persist to storage adapter if available
    if (this.storage) {
      this.storage.set(fullKey, JSON.stringify(data)).catch(() => {
        // Storage failures are non-fatal
      });
    }
  }

  /**
   * Invalidate a specific key or an entire namespace.
   *
   * @param namespaceOrKey - A namespace name to clear all entries,
   *   or a specific cache key within the default namespace.
   */
  invalidate(namespaceOrKey?: string): void {
    if (!namespaceOrKey) {
      // Clear everything
      this.memory.clear();
      this.namespaceSizes.clear();
      this.pendingRevalidations.clear();
      return;
    }

    // Check if this is a namespace (has entries tracked)
    if (this.namespaceSizes.has(namespaceOrKey)) {
      // Invalidate entire namespace
      const prefix = `${namespaceOrKey}:`;
      for (const key of this.memory.keys()) {
        if (key.startsWith(prefix)) {
          this.memory.delete(key);
        }
      }
      this.namespaceSizes.delete(namespaceOrKey);
    } else {
      // Treat as specific key in default namespace
      const fullKey = `__default__:${namespaceOrKey}`;
      this.memory.delete(fullKey);
    }
  }

  /**
   * Check if a key exists and is fresh.
   */
  has(key: string, namespace?: string): boolean {
    const ns = namespace ?? "__default__";
    const fullKey = `${ns}:${key}`;
    const entry = this.memory.get(fullKey);
    return entry !== undefined && Date.now() < entry.expires;
  }

  /**
   * Get the number of cached entries.
   */
  get size(): number {
    return this.memory.size;
  }

  /**
   * Remove all entries. Equivalent to `invalidate()`.
   */
  clear(): void {
    this.invalidate();
  }

  /** Fetch fresh data and cache it. Deduplicates concurrent requests. */
  private async fetchAndCache<T>(
    fullKey: string,
    fetcher: () => Promise<T>,
    config: CacheConfig,
  ): Promise<T> {
    // Deduplicate in-flight requests — if a fetch for this key is already
    // running, wait for it instead of starting a duplicate.
    const existing = this.inFlight.get(fullKey);
    if (existing) {
      console.log(`[Cache] DEDUP hit for ${fullKey}`);
      return existing as Promise<T>;
    }

    const promise = (async () => {
      try {
        const data = await fetcher();
        // fullKey format is "namespace:rest_of_key" — strip only the namespace prefix
        const keyWithoutNs = fullKey.includes(":")
          ? fullKey.slice(fullKey.indexOf(":") + 1)
          : fullKey;
        this.set(keyWithoutNs, data, config);
        return data;
      } finally {
        this.inFlight.delete(fullKey);
      }
    })();

    this.inFlight.set(fullKey, promise);
    return promise;
  }

  /** Revalidate in the background without blocking the caller. */
  private revalidateInBackground<T>(
    fullKey: string,
    fetcher: () => Promise<T>,
    config: CacheConfig,
  ): void {
    this.pendingRevalidations.add(fullKey);
    this.fetchAndCache(fullKey, fetcher, config)
      .catch(() => {
        // If revalidation fails, the stale data is still usable
      })
      .finally(() => {
        this.pendingRevalidations.delete(fullKey);
      });
  }

  /** Evict the oldest entry in a namespace (simple LRU via Map insertion order). */
  private evictOldest(namespace: string): void {
    const prefix = `${namespace}:`;
    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) {
        this.memory.delete(key);
        const size = this.namespaceSizes.get(namespace) ?? 0;
        if (size > 0) {
          this.namespaceSizes.set(namespace, size - 1);
        }
        return; // Only evict one
      }
    }
  }
}

/**
 * Singleton cache instance for use across the application.
 *
 * Import this for the standard in-memory cache.
 * For persistent storage, create a new `UnifiedCache` with a storage adapter.
 */
export const cache = new UnifiedCache();
