/**
 * Integration test for the manga details API route.
 *
 * Tests GET /api/manga/details — validates response shape, error
 * handling, and parameter validation.
 *
 * Live test: needs a running Flyx server (FLYX_TEST_BASE_URL, default
 * http://127.0.0.1:3000) and FLYX_TEST_USER / FLYX_TEST_PASSWORD. Skipped when
 * no server is up unless FLYX_TEST_REQUIRE_LIVE=1. See src/test/live-server.ts.
 */

import { describe, it, expect } from "vitest";
import { liveFetch, liveSuiteEnabled } from "@/test/live-server";

const serverUp = await liveSuiteEnabled();

// We'll discover a real manga ID at test time via search
let knownMangaId: string | null = null;

async function getMangaId(): Promise<string> {
  if (knownMangaId) return knownMangaId;

  const res = await liveFetch(
    `/api/manga/search?q=solo+leveling&limit=1`
  );
  const body = (await res.json()) as { data: { id: string }[] };
  if (body.data.length > 0 && body.data[0]?.id) {
    knownMangaId = body.data[0].id;
    return knownMangaId;
  }

  const res2 = await liveFetch(
    `/api/manga/search?q=one+piece&limit=1`
  );
  const body2 = (await res2.json()) as { data: { id: string }[] };
  if (body2.data.length > 0 && body2.data[0]?.id) {
    knownMangaId = body2.data[0].id;
    return knownMangaId;
  }

  throw new Error("Could not discover a valid manga ID from search");
}

describe.skipIf(!serverUp)("GET /api/manga/details", () => {
  it("returns manga details for a valid ID", async () => {
    const mangaId = await getMangaId();
    const res = await liveFetch(
      `/api/manga/details?id=${encodeURIComponent(mangaId)}`
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: Record<string, unknown> | null;
    };
    expect(body.data).not.toBeNull();

    const data = body.data!;
    expect(typeof data.id).toBe("string");
    expect(data.id).toBe(mangaId);
    expect(typeof data.title).toBe("string");
    expect((data.title as string).length).toBeGreaterThan(0);
    expect(typeof data.coverImage).toBe("string");
    expect(typeof data.description).toBe("string");
    expect(Array.isArray(data.chapters)).toBe(true);
    expect(typeof data.totalChapters).toBe("number");
    expect((data.totalChapters as number)).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(data.genres)).toBe(true);
    expect(Array.isArray(data.altTitles)).toBe(true);
  });

  it("returns 400 for missing id", async () => {
    const res = await liveFetch(`/api/manga/details?id=`);
    expect(res.status).toBe(400);

    const body = (await res.json()) as {
      data: null;
      error: string;
    };
    expect(body.data).toBeNull();
    expect(body.error).toContain("Missing");
  });

  it("returns null data for invalid manga ID", async () => {
    const res = await liveFetch(
      `/api/manga/details?id=definitely-not-a-valid-manga-id-99999`
    );
    // Should return 200 with null data (graceful handling)
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: unknown;
    };
    expect(body.data).toBeNull();
  });

  it("chapters array has valid chapter objects", async () => {
    const mangaId = await getMangaId();
    const res = await liveFetch(
      `/api/manga/details?id=${encodeURIComponent(mangaId)}`
    );
    const body = (await res.json()) as {
      data: {
        chapters: { id: string; number: number; pageCount: number }[];
      };
    };

    if (body.data && body.data.chapters.length > 0) {
      for (const ch of body.data.chapters) {
        expect(typeof ch.id).toBe("string");
        expect(ch.id.length).toBeGreaterThan(0);
        expect(typeof ch.number).toBe("number");
        expect(ch.number).toBeGreaterThanOrEqual(0);
        expect(typeof ch.pageCount).toBe("number");
      }
    }
  });

  it("chapters are sorted by chapter number", async () => {
    const mangaId = await getMangaId();
    const res = await liveFetch(
      `/api/manga/details?id=${encodeURIComponent(mangaId)}`
    );
    const body = (await res.json()) as {
      data: { chapters: { number: number }[] } | null;
    };

    if (body.data && body.data.chapters.length >= 2) {
      const numbers = body.data.chapters.map((ch) => ch.number);
      for (let i = 1; i < numbers.length; i++) {
        expect(numbers[i]!).toBeGreaterThan(numbers[i - 1]!);
      }
    }
  });
});
