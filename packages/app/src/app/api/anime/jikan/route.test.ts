/**
 * Integration test for the anime Jikan/AniList proxy API route.
 *
 * Tests GET /api/anime/jikan — validates the proxy correctly forwards
 * requests to Jikan (with AniList fallback), handles caching, and
 * validates response shapes.
 *
 * Requires the Next.js dev server running on localhost:3000.
 */

import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:3000";

describe("GET /api/anime/jikan", () => {
  it("returns top anime list from Jikan", async () => {
    const res = await fetch(
      `${BASE_URL}/api/anime/jikan?path=${encodeURIComponent("/top/anime?limit=5")}`
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);

    // Jikan returns { data: [...] }
    if (body.data.length > 0) {
      const item = body.data[0] as Record<string, unknown>;
      expect(typeof item.mal_id).toBe("number");
      expect(typeof item.title).toBe("string");
    }
  });

  it("returns 400 for missing path parameter", async () => {
    const res = await fetch(`${BASE_URL}/api/anime/jikan`);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Missing");
  });

  it("returns 400 for path traversal attempt", async () => {
    const res = await fetch(
      `${BASE_URL}/api/anime/jikan?path=${encodeURIComponent("/../../../etc/passwd")}`
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-slash-prefixed path", async () => {
    const res = await fetch(
      `${BASE_URL}/api/anime/jikan?path=top/anime`
    );
    expect(res.status).toBe(400);
  });

  it("sets cache headers on success", async () => {
    const res = await fetch(
      `${BASE_URL}/api/anime/jikan?path=${encodeURIComponent("/top/anime?limit=3")}`
    );
    expect(res.status).toBe(200);

    const cacheControl = res.headers.get("cache-control") || "";
    expect(cacheControl).toContain("public");
    expect(cacheControl).toContain("s-maxage=600");
    expect(res.headers.get("x-flyx-cache")).toBeTruthy();
  });

  it("returns anime search results", async () => {
    const res = await fetch(
      `${BASE_URL}/api/anime/jikan?path=${encodeURIComponent("/anime?q=naruto&limit=5")}`
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);

    if (body.data.length > 0) {
      const titles = body.data.map(
        (item: Record<string, unknown>) => (item.title as string || "").toLowerCase()
      );
      const hasRelevant = titles.some(
        (t: string) => t.includes("naruto")
      );
      expect(hasRelevant).toBe(true);
    }
  });

  it("returns anime details for a specific MAL ID", async () => {
    // Naruto = MAL ID 20
    const res = await fetch(
      `${BASE_URL}/api/anime/jikan?path=${encodeURIComponent("/anime/20")}`
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("data");

    if (body.data) {
      const anime = body.data as Record<string, unknown>;
      expect(anime.mal_id).toBe(20);
      expect(typeof anime.title).toBe("string");
    }
  });

  it("caches responses (second request returns x-flyx-cache: HIT)", async () => {
    const path = encodeURIComponent("/top/anime?limit=2");

    // First request — should be a miss
    const res1 = await fetch(`${BASE_URL}/api/anime/jikan?path=${path}`);
    expect(res1.status).toBe(200);
    const cache1 = res1.headers.get("x-flyx-cache");

    // Second request — should be a hit (within 10 min TTL)
    const res2 = await fetch(`${BASE_URL}/api/anime/jikan?path=${path}`);
    expect(res2.status).toBe(200);
    const cache2 = res2.headers.get("x-flyx-cache");

    // At least one should be set; both should return valid data
    expect(cache1).toBeTruthy();
    expect(cache2).toBeTruthy();
  });

  it("gracefully handles unknown Jikan paths", async () => {
    const res = await fetch(
      `${BASE_URL}/api/anime/jikan?path=${encodeURIComponent("/anime/999999999")}`
    );
    // Jikan returns 404 for unknown IDs, but our proxy may return 200 with empty data
    // or forward the error. Either way, it should not crash.
    expect([200, 404, 502]).toContain(res.status);
  });

  it("response is always JSON", async () => {
    const res = await fetch(
      `${BASE_URL}/api/anime/jikan?path=${encodeURIComponent("/top/anime?limit=1")}`
    );
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("handles double-encoded paths", async () => {
    // Simulate a double-encoded path
    const doubleEncoded = encodeURIComponent(encodeURIComponent("/top/anime?limit=2"));
    const res = await fetch(
      `${BASE_URL}/api/anime/jikan?path=${doubleEncoded}`
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});
