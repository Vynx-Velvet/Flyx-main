/**
 * SWR Cache
 * Simple cache implementation for SWR pattern.
 * Ported from Flyx 2.0.
 */

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SWRCache {
  private readonly cache = new Map<string, CacheEntry>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    return this.getCached(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.clear();
      return;
    }

    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: { ttl?: number; staleTime?: number },
  ): Promise<T> {
    const cached = this.getCached<T>(key);

    if (cached) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, options?.ttl);
    return data;
  }
}

export const swrCache = new SWRCache();
