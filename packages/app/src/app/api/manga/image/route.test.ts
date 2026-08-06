/**
 * Integration test for the manga image proxy API route.
 *
 * Tests GET /api/manga/image — validates image proxying, error
 * handling, and parameter validation.
 *
 * Requires the Next.js dev server running on localhost:3000.
 */

import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:3000";

// Use a known image URL from the planeptune CDN
const KNOWN_IMAGE =
  "https://hot.planeptune.us/manga/solo-leveling/0001-001.png";

describe("GET /api/manga/image", () => {
  it("returns an image for a valid planeptune URL", async () => {
    const url = `${BASE_URL}/api/manga/image?url=${encodeURIComponent(KNOWN_IMAGE)}`;
    const res = await fetch(url);

    // 200 on success, 502 if the CDN is down (acceptable)
    expect([200, 502]).toContain(res.status);

    if (res.status === 200) {
      const contentType = res.headers.get("content-type") || "";
      expect(contentType).toMatch(/^image\//);
      expect(res.headers.get("cache-control")).toContain("public");

      // Body should be non-empty binary
      const buffer = await res.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
    }
  });

  it("returns 400 when url parameter is missing", async () => {
    const res = await fetch(`${BASE_URL}/api/manga/image`);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Missing");
  });

  it("returns 400 for an invalid URL", async () => {
    const res = await fetch(
      `${BASE_URL}/api/manga/image?url=not-a-valid-url!!!`
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Invalid");
  });

  it("returns 403 for a non-allowed host", async () => {
    const res = await fetch(
      `${BASE_URL}/api/manga/image?url=${encodeURIComponent("https://evil.com/malware.jpg")}`
    );
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toContain("Invalid image source");
  });

  it("returns correct cache headers on success", async () => {
    const url = `${BASE_URL}/api/manga/image?url=${encodeURIComponent(KNOWN_IMAGE)}`;
    const res = await fetch(url);

    if (res.status === 200) {
      expect(res.headers.get("cache-control")).toContain("max-age=86400");
      expect(res.headers.get("cache-control")).toContain("immutable");
    }
  });
});
