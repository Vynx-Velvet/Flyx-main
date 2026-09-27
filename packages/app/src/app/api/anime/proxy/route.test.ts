/**
 * Integration test for the anime proxy API route.
 *
 * Tests GET /api/anime/proxy — this endpoint is disabled
 * (returns 410 Gone). AnimeX backend handles streaming directly.
 *
 * Live test: needs a running Flyx server (FLYX_TEST_BASE_URL, default
 * http://127.0.0.1:3000) and FLYX_TEST_USER / FLYX_TEST_PASSWORD. Skipped when
 * no server is up unless FLYX_TEST_REQUIRE_LIVE=1. See src/test/live-server.ts.
 */

import { describe, it, expect } from "vitest";
import { anonFetch, liveFetch, liveSuiteEnabled } from "@/test/live-server";

const serverUp = await liveSuiteEnabled();

describe.skipIf(!serverUp)("GET /api/anime/proxy", () => {
  it("returns 410 Gone with a helpful message", async () => {
    const res = await liveFetch(
      `/api/anime/proxy?path=/watch/some-show&showId=abc123`
    );
    expect(res.status).toBe(410);

    const body = await res.json();
    expect(body.error).toContain("no longer needed");
    expect(body.hint).toContain("/api/anime/stream");
  });

  it("returns 410 even without parameters", async () => {
    const res = await liveFetch(`/api/anime/proxy`);
    expect(res.status).toBe(410);

    const body = await res.json();
    expect(body.error).toContain("no longer needed");
  });

  it("returns 410 for anonymous callers too (never proxies anything)", async () => {
    const res = await anonFetch(
      `/api/anime/proxy?url=${encodeURIComponent("http://169.254.169.254/latest/meta-data/")}`
    );
    expect(res.status).toBe(410);
  });

  it("response is always JSON", async () => {
    const res = await liveFetch(`/api/anime/proxy`);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
