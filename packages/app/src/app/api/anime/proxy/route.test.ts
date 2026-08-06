/**
 * Integration test for the anime proxy API route.
 *
 * Tests GET /api/anime/proxy — this endpoint is disabled
 * (returns 410 Gone). AnimeX backend handles streaming directly.
 *
 * Requires the Next.js dev server running on localhost:3000.
 */

import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:3000";

describe("GET /api/anime/proxy", () => {
  it("returns 410 Gone with a helpful message", async () => {
    const res = await fetch(
      `${BASE_URL}/api/anime/proxy?path=/watch/some-show&showId=abc123`
    );
    expect(res.status).toBe(410);

    const body = await res.json();
    expect(body.error).toContain("no longer needed");
    expect(body.hint).toContain("/api/anime/stream");
  });

  it("returns 410 even without parameters", async () => {
    const res = await fetch(`${BASE_URL}/api/anime/proxy`);
    expect(res.status).toBe(410);

    const body = await res.json();
    expect(body.error).toContain("no longer needed");
  });

  it("response is always JSON", async () => {
    const res = await fetch(`${BASE_URL}/api/anime/proxy`);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
