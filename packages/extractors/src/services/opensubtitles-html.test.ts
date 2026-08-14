/**
 * Live probe for the OpenSubtitles site scraper — SKIPPED unless
 * FLYX_PROBE=1 is set (it hits the live site, solves the Anubis
 * proof-of-work challenge, and downloads a real subtitle zip —
 * never run in CI).
 *
 *   FLYX_PROBE=1 npx vitest run opensubtitles-html.test.ts
 */

import { describe, it, expect } from "vitest";
import { searchOpenSubtitles, fetchOpenSubtitlesZip } from "./opensubtitles-html";

const PROBE_TIMEOUT = 60_000;

// Interstellar — subtitles exist in every common language
const IMDB_ID = "tt0816692";
const LANGS = ["eng", "pol"];

describe.skipIf(process.env.FLYX_PROBE !== "1")(
  "OpenSubtitles scraper (live probe)",
  () => {
    it(
      "searches tt0816692 and returns eng + pol rows",
      async () => {
        const result = await searchOpenSubtitles({
          imdbId: IMDB_ID,
          languages: LANGS,
        });
        expect(result.error).toBeUndefined();
        expect(result.rows.length).toBeGreaterThan(0);

        const langs = new Set(result.rows.map((r) => r.langCode));
        console.log(
          `[probe] search rows: ${result.rows.length}, langs: ${[...langs].join(",")}`,
        );
        for (const r of result.rows) {
          expect(r.subId).toMatch(/^\d+$/);
          expect(r.langCode.length).toBeGreaterThanOrEqual(2);
        }
        expect(langs.has("eng")).toBe(true);
        expect(langs.has("pol")).toBe(true);
      },
      PROBE_TIMEOUT,
    );

    it(
      "downloads a real subtitle zip from the CDN",
      async () => {
        // Same params as the search test → session + search cache warm
        const search = await searchOpenSubtitles({
          imdbId: IMDB_ID,
          languages: LANGS,
        });
        expect(search.error).toBeUndefined();
        const eng = search.rows.find((r) => r.langCode === "eng");
        expect(eng).toBeDefined();

        const zip = await fetchOpenSubtitlesZip(eng!.subId);
        console.log(
          `[probe] zip: ${zip.data.length} bytes (${zip.fileName.slice(0, 60)})`,
        );
        expect(zip.data.length).toBeGreaterThan(100);
      },
      PROBE_TIMEOUT,
    );
  },
);
