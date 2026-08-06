import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnifiedCache } from "./cache";

describe("UnifiedCache", () => {
  let cache: UnifiedCache;

  beforeEach(() => {
    cache = new UnifiedCache();
  });

  describe("get and set", () => {
    it("returns null when no cached value and no fetcher", async () => {
      const result = await cache.get("missing", undefined, { ttl: 1000 });
      expect(result).toBeNull();
    });

    it("fetches and caches on miss", async () => {
      const fetcher = vi.fn().mockResolvedValue("fresh-data");
      const result = await cache.get("key", fetcher, { ttl: 60_000 });

      expect(result).toBe("fresh-data");
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Second call should be cached
      const result2 = await cache.get("key", fetcher, { ttl: 60_000 });
      expect(result2).toBe("fresh-data");
      expect(fetcher).toHaveBeenCalledTimes(1); // Not called again
    });

    it("returns stale data while revalidating", async () => {
      const cache = new UnifiedCache();

      // Prime the cache with staleWhileRevalidate
      await cache.get(
        "swr-key",
        () => Promise.resolve("initial"),
        { ttl: 10, staleWhileRevalidate: 60_000 }, // TTL of 10ms
      );

      // Wait for TTL to expire but within SWR window
      await new Promise((r) => setTimeout(r, 20));

      const fetcher = vi.fn().mockResolvedValue("updated");
      const result = await cache.get("swr-key", fetcher, {
        ttl: 10,
        staleWhileRevalidate: 60_000,
      });

      // Returns stale data immediately
      expect(result).toBe("initial");
    });

    it("re-fetches when fully expired", async () => {
      const cache = new UnifiedCache();

      await cache.get(
        "exp-key",
        () => Promise.resolve("old"),
        { ttl: 10, staleWhileRevalidate: 0 },
      );

      // Wait for full expiry
      await new Promise((r) => setTimeout(r, 20));

      const fetcher = vi.fn().mockResolvedValue("new");
      const result = await cache.get("exp-key", fetcher, { ttl: 60_000 });

      expect(result).toBe("new");
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe("invalidation", () => {
    it("invalidates a specific namespace", async () => {
      await cache.get("k1", () => Promise.resolve("v1"), { ttl: 60_000, namespace: "ns1" });
      await cache.get("k2", () => Promise.resolve("v2"), { ttl: 60_000, namespace: "ns2" });

      cache.invalidate("ns1");

      // ns1 should be gone, ns2 should remain
      expect(cache.has("k1", "ns1")).toBe(false);
      expect(cache.has("k2", "ns2")).toBe(true);
    });

    it("invalidates everything with no argument", async () => {
      await cache.get("k1", () => Promise.resolve("v1"), { ttl: 60_000 });
      await cache.get("k2", () => Promise.resolve("v2"), { ttl: 60_000 });

      cache.invalidate();

      expect(cache.has("k1")).toBe(false);
      expect(cache.has("k2")).toBe(false);
      expect(cache.size).toBe(0);
    });

    it("invalidates a specific key in default namespace", async () => {
      await cache.get("k1", () => Promise.resolve("v1"), { ttl: 60_000 });
      await cache.get("k2", () => Promise.resolve("v2"), { ttl: 60_000 });

      cache.invalidate("k1");

      expect(cache.has("k1")).toBe(false);
      expect(cache.has("k2")).toBe(true);
    });
  });

  describe("has", () => {
    it("returns true for fresh entries", async () => {
      await cache.get("key", () => Promise.resolve("val"), { ttl: 60_000 });
      expect(cache.has("key")).toBe(true);
    });

    it("returns false for missing entries", () => {
      expect(cache.has("nonexistent")).toBe(false);
    });
  });

  describe("size", () => {
    it("tracks the number of entries", async () => {
      expect(cache.size).toBe(0);
      await cache.get("a", () => Promise.resolve(1), { ttl: 60_000 });
      expect(cache.size).toBe(1);
      await cache.get("b", () => Promise.resolve(2), { ttl: 60_000 });
      expect(cache.size).toBe(2);
    });
  });

  describe("clear", () => {
    it("removes all entries", async () => {
      await cache.get("a", () => Promise.resolve(1), { ttl: 60_000 });
      await cache.get("b", () => Promise.resolve(2), { ttl: 60_000 });
      cache.clear();
      expect(cache.size).toBe(0);
    });
  });
});
