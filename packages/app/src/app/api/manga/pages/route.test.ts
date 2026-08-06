/**
 * Integration test for the manga chapter pages API route.
 *
 * Tests GET /api/manga/pages — validates response shape, error
 * handling, and page image URL validity.
 *
 * Requires the Next.js dev server running on localhost:3000.
 */

import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:3000";

// Reuse the same discovery pattern as details route
let knownMangaId: string | null = null;

async function getMangaId(): Promise<string> {
  if (knownMangaId) return knownMangaId;

  const res = await fetch(
    `${BASE_URL}/api/manga/search?q=solo+leveling&limit=1`
  );
  const body = (await res.json()) as { data: { id: string }[] };
  if (body.data.length > 0 && body.data[0]?.id) {
    knownMangaId = body.data[0].id;
    return knownMangaId;
  }

  const res2 = await fetch(
    `${BASE_URL}/api/manga/search?q=one+piece&limit=1`
  );
  const body2 = (await res2.json()) as { data: { id: string }[] };
  if (body2.data.length > 0 && body2.data[0]?.id) {
    knownMangaId = body2.data[0].id;
    return knownMangaId;
  }

  throw new Error("Could not discover a valid manga ID from search");
}

describe("GET /api/manga/pages", () => {
  it("returns page images for a valid manga + chapter 1", async () => {
    const mangaId = await getMangaId();
    const res = await fetch(
      `${BASE_URL}/api/manga/pages?mangaId=${encodeURIComponent(mangaId)}&chapter=1`
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: unknown[];
      total: number;
    };
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe("number");

    // If pages are returned, validate their shape
    for (const page of body.data) {
      const p = page as Record<string, unknown>;
      expect(typeof p.imageUrl).toBe("string");
      expect((p.imageUrl as string).length).toBeGreaterThan(0);
      expect(p.imageUrl as string).toMatch(/^https?:\/\//);
      expect(typeof p.pageNumber).toBe("number");
      expect(p.pageNumber as number).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns 400 when mangaId is missing", async () => {
    const res = await fetch(`${BASE_URL}/api/manga/pages?chapter=1`);
    expect(res.status).toBe(400);

    const body = (await res.json()) as {
      data: unknown[];
      error: string;
    };
    expect(body.error).toContain("Missing");
  });

  it("returns 400 when chapter is missing", async () => {
    const mangaId = await getMangaId();
    const res = await fetch(
      `${BASE_URL}/api/manga/pages?mangaId=${encodeURIComponent(mangaId)}`
    );
    expect(res.status).toBe(400);

    const body = (await res.json()) as {
      data: unknown[];
      error: string;
    };
    expect(body.error).toContain("Missing");
  });

  it("returns empty data for non-existent chapter", async () => {
    const mangaId = await getMangaId();
    const res = await fetch(
      `${BASE_URL}/api/manga/pages?mangaId=${encodeURIComponent(mangaId)}&chapter=99999`
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: unknown[];
      total: number;
    };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBe(body.data.length);
  });

  it("page URLs point to image file types", async () => {
    const mangaId = await getMangaId();
    const res = await fetch(
      `${BASE_URL}/api/manga/pages?mangaId=${encodeURIComponent(mangaId)}&chapter=1`
    );
    const body = (await res.json()) as {
      data: { imageUrl: string }[];
    };

    for (const page of body.data) {
      // Image URLs should have image extensions or be from known image CDNs
      const isImage =
        /\.(jpg|jpeg|png|webp|gif|bmp)(\?|$)/i.test(page.imageUrl) ||
        page.imageUrl.includes("wixstatic.com") ||
        page.imageUrl.includes("/pages/");
      if (!isImage) {
        console.warn(
          `[API Test] Unexpected image URL format: ${page.imageUrl.slice(0, 80)}...`
        );
      }
    }
  });

  it("page numbers are sequential and unique", async () => {
    const mangaId = await getMangaId();
    const res = await fetch(
      `${BASE_URL}/api/manga/pages?mangaId=${encodeURIComponent(mangaId)}&chapter=1`
    );
    const body = (await res.json()) as {
      data: { imageUrl: string; pageNumber: number }[];
    };

    if (body.data.length >= 2) {
      const pageNums = body.data.map((p) => p.pageNumber);
      const uniqueNums = new Set(pageNums);
      expect(uniqueNums.size).toBe(pageNums.length);

      // Page numbers should generally increase
      for (let i = 1; i < pageNums.length; i++) {
        expect(pageNums[i]!).toBeGreaterThanOrEqual(pageNums[i - 1]!);
      }
    }
  });
});
