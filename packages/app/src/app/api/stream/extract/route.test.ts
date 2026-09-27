/**
 * Integration test for the stream extraction endpoint.
 *
 * Verifies the end-to-end flow:
 * Provider Registry → Extraction Pipeline → API Route → JSON Response
 *
 * Live test: needs a running Flyx server (FLYX_TEST_BASE_URL, default
 * http://127.0.0.1:3000) and FLYX_TEST_USER / FLYX_TEST_PASSWORD. Skipped when
 * no server is up unless FLYX_TEST_REQUIRE_LIVE=1. See src/test/live-server.ts.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { liveFetch, liveSuiteEnabled } from "@/test/live-server";

const serverUp = await liveSuiteEnabled();

// Registered in packages/providers/src/providers/index.ts
const REGISTERED_PROVIDERS = 7;
// /api/health reports the version baked from packages/app/package.json at build time.
const APP_VERSION = (
  JSON.parse(readFileSync(path.resolve(__dirname, "../../../../../package.json"), "utf8")) as {
    version: string;
  }
).version;

describe.skipIf(!serverUp)("Stream Extraction Endpoint", () => {
  it("returns 400 when tmdbId is missing", async () => {
    const response = await liveFetch(`/api/stream/extract?mediaType=movie`);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("MISSING_PARAMETER");
  });

  it("returns 400 when mediaType is missing", async () => {
    const response = await liveFetch(`/api/stream/extract?tmdbId=550`);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("MISSING_PARAMETER");
  });

  it("returns 400 for invalid mediaType", async () => {
    const response = await liveFetch(`/api/stream/extract?tmdbId=550&mediaType=invalid`);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("INVALID_MEDIA_TYPE");
  });

  it("extracts sources for a known movie from VOD providers", async () => {
    const response = await liveFetch(`/api/stream/extract?tmdbId=550&mediaType=movie`);
    const body = await response.json();

    // Videasy provider returns real sources for Fight Club (TMDB 550).
    // If all providers fail (API downtime), the response still has proper shape.
    if (body.success) {
      expect(body.sources.length).toBeGreaterThan(0);
      expect(body.provider).toBeTruthy();
    } else {
      expect(body.code).toBe("ALL_PROVIDERS_FAILED");
      expect(body.details.attempts).toBeDefined();
    }
  });

  it("tries anime providers when malId is present", async () => {
    // Use a definitely-fake MAL ID to ensure provider failure path
    const response = await liveFetch(`/api/stream/extract?tmdbId=0&mediaType=tv&malId=99999999`);
    const body = await response.json();

    // The anime provider may succeed or fail depending on the ID,
    // but the response should be well-formed either way
    expect(body).toHaveProperty("success");
    if (!body.success) {
      expect(body.code).toBe("ALL_PROVIDERS_FAILED");
      const providers = body.details.attempts.map((a: { provider: string }) => a.provider);
      expect(providers).toContain("animex");
    }
  });
});

describe.skipIf(!serverUp)("Health Endpoint", () => {
  it("returns status ok with provider count", async () => {
    const response = await liveFetch(`/api/health`);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.version).toBe(APP_VERSION);
    expect(body.providers).toBe(REGISTERED_PROVIDERS);
    // The boot-check nonce is never echoed without the matching header.
    expect(body.bootOk).toBeUndefined();
  });
});

describe.skipIf(!serverUp)("Providers Endpoint", () => {
  it("returns all registered providers sorted by priority", async () => {
    const response = await liveFetch(`/api/providers`);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.count).toBe(REGISTERED_PROVIDERS);

    const providers = body.data.providers;
    // Verify sorted by priority
    for (let i = 1; i < providers.length; i++) {
      expect(providers[i].priority).toBeGreaterThanOrEqual(providers[i - 1].priority);
    }
  });
});
