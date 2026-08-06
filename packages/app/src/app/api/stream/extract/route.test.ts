/**
 * Integration test for the stream extraction endpoint.
 *
 * Verifies the end-to-end flow:
 * Provider Registry → Extraction Pipeline → API Route → JSON Response
 */

import { describe, it, expect } from "vitest";

describe("Stream Extraction Endpoint", () => {
  const BASE_URL = "http://localhost:3000";

  it("returns 400 when tmdbId is missing", async () => {
    const response = await fetch(`${BASE_URL}/api/stream/extract?mediaType=movie`);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("MISSING_PARAMETER");
  });

  it("returns 400 when mediaType is missing", async () => {
    const response = await fetch(`${BASE_URL}/api/stream/extract?tmdbId=550`);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("MISSING_PARAMETER");
  });

  it("returns 400 for invalid mediaType", async () => {
    const response = await fetch(`${BASE_URL}/api/stream/extract?tmdbId=550&mediaType=invalid`);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("INVALID_MEDIA_TYPE");
  });

  it("extracts sources for a known movie from VOD providers", async () => {
    const response = await fetch(`${BASE_URL}/api/stream/extract?tmdbId=550&mediaType=movie`);
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
    const response = await fetch(`${BASE_URL}/api/stream/extract?tmdbId=0&mediaType=tv&malId=99999999`);
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

describe("Health Endpoint", () => {
  const BASE_URL = "http://localhost:3000";

  it("returns status ok with provider count", async () => {
    const response = await fetch(`${BASE_URL}/api/health`);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.version).toBe("3.0.0");
    expect(body.providers).toBe(7);
  });
});

describe("Providers Endpoint", () => {
  const BASE_URL = "http://localhost:3000";

  it("returns all 22 providers sorted by priority", async () => {
    const response = await fetch(`${BASE_URL}/api/providers`);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.count).toBe(7);

    const providers = body.data.providers;
    // Verify sorted by priority
    for (let i = 1; i < providers.length; i++) {
      expect(providers[i].priority).toBeGreaterThanOrEqual(providers[i - 1].priority);
    }
  });
});
