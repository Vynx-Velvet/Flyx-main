/**
 * Integration test for the anime stream extraction API route.
 *
 * Tests GET /api/anime/stream — validates extraction pipeline,
 * response shapes, error handling, and parameter validation.
 *
 * Uses real MAL IDs against the extraction pipeline (AnimeX provider).
 * Tests are tolerant of API rate limiting and downtime.
 *
 * Each test that hits the API uses a 120s timeout.
 *
 * Live test: needs a running Flyx server (FLYX_TEST_BASE_URL, default
 * http://127.0.0.1:3000) and FLYX_TEST_USER / FLYX_TEST_PASSWORD. Skipped when
 * no server is up unless FLYX_TEST_REQUIRE_LIVE=1. See src/test/live-server.ts.
 */

import { describe, it, expect } from "vitest";
import { liveFetch, liveSuiteEnabled } from "@/test/live-server";

const serverUp = await liveSuiteEnabled();

// Well-known MAL IDs
const KNOWN_MAL_IDS = {
  onePunchMan: 30276,
  attackOnTitan: 16498,
};

describe.skipIf(!serverUp)("GET /api/anime/stream", () => {
  // ── Parameter validation (fast — no API calls) ────────────────────

  it("returns 400 when malId is missing", async () => {
    const res = await liveFetch(`/api/anime/stream`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 for invalid malId", async () => {
    const res = await liveFetch(`/api/anime/stream?malId=abc`);
    expect(res.status).toBe(400);
  });
});

// ── Live extraction tests (require dev server + API access) ──────────

describe.skipIf(!serverUp)("GET /api/anime/stream (live)", () => {
  it(
    "returns sources for a known anime with provider=animex",
    async () => {
      const res = await liveFetch(
        `/api/anime/stream?malId=${KNOWN_MAL_IDS.onePunchMan}&episode=1&provider=animex`,
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.sources?.length).toBeGreaterThan(0);
      expect(body.provider).toBe("animex");

      // Validate source structure
      for (const source of body.sources) {
        expect(source.url).toBeTruthy();
        expect(typeof source.url).toBe("string");
        expect(source.url.startsWith("http")).toBe(true);
      }
    },
    120_000,
  );
});
