/**
 * Watch player — automatic fail-over must resume, not restart.
 *
 * Regression: after the player's retries were exhausted (native HLS: error →
 * same-source retry → error again; hls.js: two recoverMediaError() attempts
 * → give up), the fail-over loaded the next source from 0:00. The failed
 * source had already been torn down (currentTime reset to 0) and hls.js's
 * give-up `resumeAt` was dropped.
 *
 * Simulates a stream outage mid-playback by aborting every stream request
 * until the fail-over starts, then checks where the next source resumes.
 * Needs live providers (like the manga specs need live upstreams).
 */
import { test, expect, type Page } from "@playwright/test";

const SEEK_TO = 600; // 10:00 into Fight Club (tmdb 550)

async function videoState(page: Page) {
  return page.evaluate(() => {
    const v = document.querySelector("video");
    return v ? { t: v.currentTime, paused: v.paused } : null;
  });
}

test("fail-over after exhausted retries resumes at the previous position", async ({ page, baseURL }) => {
  test.setTimeout(300_000);
  let failoverStarted = false;
  page.on("console", (m) => {
    if (/Playback failure #1|\[player-recovery\].*give/i.test(m.text())) failoverStarted = true;
  });

  await page.goto("/watch?tmdbId=550&mediaType=movie");
  await expect.poll(async () => (await videoState(page))?.t ?? 0, { timeout: 120_000 }).toBeGreaterThan(1);

  await page.evaluate((t) => { document.querySelector("video")!.currentTime = t; }, SEEK_TO);
  await expect.poll(async () => (await videoState(page))?.t ?? 0, { timeout: 60_000 }).toBeGreaterThan(SEEK_TO + 3);
  const before = (await videoState(page))!.t;

  // Outage: every stream request (proxied or direct CDN) fails.
  const origin = new URL(baseURL!).origin;
  await page.route("**/*", (route) => {
    const req = route.request();
    const url = req.url();
    const isStream =
      url.includes("/api/stream/proxy") ||
      (!url.startsWith(origin) && ["media", "xhr", "fetch"].includes(req.resourceType()));
    return isStream ? route.abort("connectionreset") : route.continue();
  });
  await expect.poll(() => failoverStarted, { timeout: 120_000 }).toBe(true);
  await page.unrouteAll({ behavior: "ignoreErrors" });

  // The next source must pick up where the dead one stopped — not at 0:00.
  await expect
    .poll(async () => {
      const s = await videoState(page);
      return s && !s.paused ? s.t : 0;
    }, { timeout: 90_000 })
    .toBeGreaterThan(before - 15);
});
