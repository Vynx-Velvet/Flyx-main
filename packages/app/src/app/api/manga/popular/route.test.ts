/**
 * Integration test for the manga popular/browse API route.
 *
 * Tests GET /api/manga/popular — validates all browse types
 * (popular, latest, action, romance, fantasy) and parameter validation.
 *
 * Requires the Next.js dev server running on localhost:3000.
 */

import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:3000";

describe("GET /api/manga/popular", () => {
  it("returns manga cards for default type (popular)", async () => {
    const res = await fetch(`${BASE_URL}/api/manga/popular?limit=10`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: unknown[];
      total: number;
    };
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.total).toBe(body.data.length);

    for (const card of body.data) {
      const c = card as Record<string, unknown>;
      expect(typeof c.id).toBe("string");
      expect((c.id as string).length).toBeGreaterThan(0);
      expect(typeof c.title).toBe("string");
      expect(typeof c.coverImage).toBe("string");
    }
  });

  it("supports type=latest", async () => {
    const res = await fetch(`${BASE_URL}/api/manga/popular?limit=10&type=latest`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: unknown[];
      total: number;
    };
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("supports type=action", async () => {
    const res = await fetch(`${BASE_URL}/api/manga/popular?limit=10&type=action`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: unknown[];
      total: number;
    };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("supports type=romance", async () => {
    const res = await fetch(
      `${BASE_URL}/api/manga/popular?limit=10&type=romance`
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: unknown[];
      total: number;
    };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("supports type=fantasy", async () => {
    const res = await fetch(
      `${BASE_URL}/api/manga/popular?limit=10&type=fantasy`
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: unknown[];
      total: number;
    };
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("respects the limit parameter (cap of 40)", async () => {
    const res = await fetch(`${BASE_URL}/api/manga/popular?limit=100`);
    const body = (await res.json()) as {
      data: unknown[];
      total: number;
    };
    expect(body.data.length).toBeLessThanOrEqual(40);

    // Also test low limit
    const res2 = await fetch(`${BASE_URL}/api/manga/popular?limit=3`);
    const body2 = (await res2.json()) as {
      data: unknown[];
      total: number;
    };
    expect(body2.data.length).toBeLessThanOrEqual(3);
  });

  it("returns unique IDs (deduplicated results)", async () => {
    const res = await fetch(`${BASE_URL}/api/manga/popular?limit=20`);
    const body = (await res.json()) as {
      data: { id: string }[];
    };

    if (body.data.length >= 2) {
      const ids = body.data.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });

  it("different types return different results", async () => {
    const [popular, romance] = await Promise.all([
      fetch(`${BASE_URL}/api/manga/popular?limit=10`).then((r) => r.json()),
      fetch(`${BASE_URL}/api/manga/popular?limit=10&type=romance`).then(
        (r) => r.json()
      ),
    ]);

    const popIds = new Set(
      ((popular as { data: { id: string }[] }).data || []).map((c) => c.id)
    );
    const romanceIds = (
      (romance as { data: { id: string }[] }).data || []
    ).map((c) => c.id);

    // Categories shouldn't be 100% identical
    if (romanceIds.length > 0) {
      const distinctRomance = romanceIds.filter((id) => !popIds.has(id));
      const overlapRatio = 1 - distinctRomance.length / romanceIds.length;
      // Allow some overlap (popular titles appear in multiple categories)
      expect(overlapRatio).toBeLessThan(0.9);
    }
  });
});
