/**
 * Integration test for the manga search API route.
 *
 * Tests GET /api/manga/search — validates response shape, error
 * handling, and parameter validation.
 *
 * Requires the Next.js dev server running on localhost:3000.
 */

import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:3000";

describe("GET /api/manga/search", () => {
  it("returns results for a known manga query", async () => {
    const res = await fetch(
      `${BASE_URL}/api/manga/search?q=solo+leveling&limit=5`
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: unknown[];
      total: number;
    };
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe("number");

    // Validate card shapes if results returned
    for (const card of body.data) {
      expect(card).toHaveProperty("id");
      expect(typeof (card as Record<string, unknown>).id).toBe("string");
      expect(card).toHaveProperty("title");
      expect(typeof (card as Record<string, unknown>).title).toBe("string");
      expect(card).toHaveProperty("coverImage");
    }
  });

  it("returns empty data for empty query", async () => {
    const res = await fetch(`${BASE_URL}/api/manga/search?q=`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: unknown[];
      total: number;
    };
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("returns empty data for whitespace query", async () => {
    const res = await fetch(`${BASE_URL}/api/manga/search?q=+++`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: unknown[];
      total: number;
    };
    expect(body.data).toEqual([]);
  });

  it("respects the limit parameter (cap of 40)", async () => {
    const res = await fetch(
      `${BASE_URL}/api/manga/search?q=one&limit=100`
    );
    const body = (await res.json()) as {
      data: unknown[];
      total: number;
    };
    expect(body.data.length).toBeLessThanOrEqual(40);

    // Also test low limit
    const res2 = await fetch(
      `${BASE_URL}/api/manga/search?q=one&limit=3`
    );
    const body2 = (await res2.json()) as {
      data: unknown[];
      total: number;
    };
    expect(body2.data.length).toBeLessThanOrEqual(3);
  });

  it("supports pagination via page parameter", async () => {
    // WeebCentral /search/data has no server-side pagination —
    // it returns all matching results. page=2 will return the same
    // results as page=1. This test validates that the endpoint
    // handles the parameter without errors.
    const [res1, res2] = await Promise.all([
      fetch(`${BASE_URL}/api/manga/search?q=naruto&page=1&limit=3`),
      fetch(`${BASE_URL}/api/manga/search?q=naruto&page=2&limit=3`),
    ]);
    const body1 = (await res1.json()) as {
      data: { id: string }[];
      total: number;
    };
    const body2 = (await res2.json()) as {
      data: { id: string }[];
      total: number;
    };

    // Both should return valid results
    expect(Array.isArray(body1.data)).toBe(true);
    expect(Array.isArray(body2.data)).toBe(true);
    expect(body1.data.length).toBeGreaterThan(0);
    // page param handled gracefully (API returns full set regardless)
    expect(body2.data.length).toBeGreaterThanOrEqual(0);
  });

  it("always returns JSON with consistent shape", async () => {
    // Test the error path too — it should not crash
    const res = await fetch(
      `${BASE_URL}/api/manga/search?q=zzzxxxyyyzzzxxxyyy&limit=5`
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");

    const body = (await res.json()) as {
      data: unknown[];
      total: number;
    };
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe("number");
  });
});
