/**
 * Integration test for the manga image proxy API route.
 *
 * Tests GET /api/manga/image — validates image proxying, error
 * handling, and parameter validation.
 *
 * Security contract: the proxy requires a logged-in session (or a signed
 * URL) — anonymous requests get 401 — and only fetches allowlisted manga
 * CDN hosts (anything else → 403). Successful responses are cached
 * privately (per-user), never publicly.
 *
 * Live test: needs a running Flyx server (FLYX_TEST_BASE_URL, default
 * http://127.0.0.1:3000) and FLYX_TEST_USER / FLYX_TEST_PASSWORD. Skipped when
 * no server is up unless FLYX_TEST_REQUIRE_LIVE=1. See src/test/live-server.ts.
 */

import { describe, it, expect } from "vitest";
import { anonFetch, liveFetch, liveSuiteEnabled } from "@/test/live-server";

const serverUp = await liveSuiteEnabled();

// Use a known image URL from the planeptune CDN
const KNOWN_IMAGE =
  "https://hot.planeptune.us/manga/solo-leveling/0001-001.png";

describe.skipIf(!serverUp)("GET /api/manga/image", () => {
  it("returns an image for a valid planeptune URL", async () => {
    const url = `/api/manga/image?url=${encodeURIComponent(KNOWN_IMAGE)}`;
    const res = await liveFetch(url);

    // 200 on success, 502 if the CDN is down (acceptable)
    expect([200, 502]).toContain(res.status);

    if (res.status === 200) {
      const contentType = res.headers.get("content-type") || "";
      expect(contentType).toMatch(/^image\//);
      // Session-gated content → private cache only.
      expect(res.headers.get("cache-control")).toContain("private");
      expect(res.headers.get("cache-control")).not.toContain("public");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");

      // Body should be non-empty binary
      const buffer = await res.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
    }
  });

  it("returns 400 when url parameter is missing", async () => {
    const res = await liveFetch(`/api/manga/image`);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Missing");
  });

  it("returns 400 for an invalid URL", async () => {
    const res = await liveFetch(
      `/api/manga/image?url=not-a-valid-url!!!`
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Invalid");
  });

  it("returns 403 for a non-allowed host", async () => {
    const res = await liveFetch(
      `/api/manga/image?url=${encodeURIComponent("https://evil.com/malware.jpg")}`
    );
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toContain("Invalid image source");
  });

  it("rejects a lookalike host that only contains an allowed domain", async () => {
    const res = await liveFetch(
      `/api/manga/image?url=${encodeURIComponent("https://planeptune.us.evil.com/x.png")}`
    );
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toContain("Invalid image source");
  });

  it("returns 401 without a session, even for an allowlisted image", async () => {
    const res = await anonFetch(
      `/api/manga/image?url=${encodeURIComponent(KNOWN_IMAGE)}`
    );
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 without a session before any URL validation", async () => {
    const res = await anonFetch(
      `/api/manga/image?url=${encodeURIComponent("https://evil.com/malware.jpg")}`
    );
    expect(res.status).toBe(401);
  });

  it("rejects a forged signature instead of treating it as authorized", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const res = await anonFetch(
      `/api/manga/image?url=${encodeURIComponent(KNOWN_IMAGE)}&exp=${exp}&sig=forged`
    );
    expect(res.status).toBe(401);
  });

  it("returns correct cache headers on success", async () => {
    const url = `/api/manga/image?url=${encodeURIComponent(KNOWN_IMAGE)}`;
    const res = await liveFetch(url);

    if (res.status === 200) {
      expect(res.headers.get("cache-control")).toContain("max-age=86400");
      expect(res.headers.get("cache-control")).toContain("immutable");
    }
  });
});
