/**
 * Search page — anime search regression.
 *
 * Anime search used to call /api/content/anime-search, a route that no
 * longer exists, so every "Anime" search 404'd. It now goes through the
 * cached Jikan proxy (/api/anime/jikan?path=/anime&q=…).
 */
import { test, expect } from "@playwright/test";

test.describe("Search — anime", () => {
  test("returns results via the Jikan proxy and links to the anime page", async ({ page }) => {
    const deadRouteHits: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/content/anime-search")) deadRouteHits.push(req.url());
    });

    const searchResponse = page.waitForResponse(
      (res) => res.url().includes("/api/anime/jikan") && res.url().includes("path=%2Fanime"),
      { timeout: 30_000 },
    );
    await page.goto("/search?q=naruto&type=anime");

    const res = await searchResponse;
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    // A result card for the query renders, and opens the anime details route.
    const card = page.getByRole("button", { name: /^View .*naruto/i }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.click();
    await page.waitForURL(/\/anime\/\d+/, { timeout: 20_000 });

    expect(deadRouteHits).toEqual([]);
  });
});
