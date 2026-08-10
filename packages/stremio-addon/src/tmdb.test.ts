import { afterEach, describe, expect, it, vi } from "vitest";
import { clearTmdbCache, findTmdbId } from "./tmdb";

afterEach(() => clearTmdbCache());

describe("findTmdbId", () => {
  it("selects movie results for movie IDs", async () => {
    const mockFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ movie_results: [{ id: 603 }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ) as unknown as typeof fetch;

    await expect(
      findTmdbId({ imdbId: "tt0133093", mediaType: "movie" }, "test-key", mockFetch),
    ).resolves.toBe(603);
  });

  it("selects TV results for series IDs", async () => {
    const mockFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ tv_results: [{ id: 1399 }] }), {
          status: 200,
        }),
    ) as unknown as typeof fetch;

    await expect(
      findTmdbId(
        { imdbId: "tt0944947", mediaType: "tv", season: 1, episode: 1 },
        "test-key",
        mockFetch,
      ),
    ).resolves.toBe(1399);
  });

  it("surfaces rejected API keys", async () => {
    const mockFetch = vi.fn(
      async () => new Response("Unauthorized", { status: 401 }),
    ) as unknown as typeof fetch;
    await expect(
      findTmdbId({ imdbId: "tt0133093", mediaType: "movie" }, "bad-key", mockFetch),
    ).rejects.toHaveProperty("status", 401);
  });
});
