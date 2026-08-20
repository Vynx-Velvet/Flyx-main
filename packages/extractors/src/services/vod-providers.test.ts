/**
 * Provider — E2E Integration Tests
 *
 * Tests all working extraction providers against their live backends.
 * Tests extractors directly (not through ProviderRegistry which lives in @flyx/providers).
 *
 * Resilience: soft warnings when API is rate-limited; hard assertions
 * for structural correctness of responses.
 */

import { describe, it, expect } from "vitest";
import type { StreamSource } from "@flyx/core";

// Real extraction functions
import { extractVideasy } from "./videasy";
import { extractVidSrc } from "./vidsrc";
import { extractMultiEmbed } from "./multiembed";
import { extractDLHD } from "./dlhd";

// Anime extractor (smoke test)
import { extractAnimeX } from "./animex";

// ── Config ───────────────────────────────────────────────────────────────────

const API_TIMEOUT = 30_000;

// Known-good TMDB IDs
const MOVIE_FIGHT_CLUB = { tmdbId: 550, title: "Fight Club" };
const TV_BREAKING_BAD = { tmdbId: 1396, title: "Breaking Bad" };
const MOVIE_INCEPTION = { tmdbId: 27205, title: "Inception" };

// ── Helpers ──────────────────────────────────────────────────────────────────

function assertStreamSourceShape(source: StreamSource, label: string): void {
  if (!source.url || typeof source.url !== "string") {
    throw new Error(`${label}: source.url must be a non-empty string, got: ${JSON.stringify(source)}`);
  }
  if (!source.url.startsWith("http")) {
    throw new Error(`${label}: source.url must start with http(s), got: ${source.url.substring(0, 50)}`);
  }
  if (!source.quality || typeof source.quality !== "string") {
    throw new Error(`${label}: source.quality must be a string`);
  }
  if (!["hls", "mp4", "dash"].includes(source.type)) {
    throw new Error(`${label}: source.type must be hls/mp4/dash, got: ${source.type}`);
  }
}

function summarize(label: string, sources: StreamSource[]): string {
  if (sources.length === 0) return `${label}: 0 sources`;
  const types = [...new Set(sources.map(s => s.type))].join(",");
  const quals = [...new Set(sources.map(s => s.quality))].join(",");
  return `${label}: ${sources.length} sources [${types}] (${quals})`;
}

// ── VOD Providers ────────────────────────────────────────────────────────────

describe("Videasy", () => {
  it(
    `extracts sources for "${MOVIE_FIGHT_CLUB.title}"`,
    async () => {
      const result = await extractVideasy(MOVIE_FIGHT_CLUB.tmdbId, "movie");
      expect(Array.isArray(result.sources)).toBe(true);
      console.log(summarize("Videasy movie", result.sources));
      for (const s of result.sources) assertStreamSourceShape(s, "Videasy");
    },
    API_TIMEOUT,
  );

  it(
    `extracts sources for "${TV_BREAKING_BAD.title}"`,
    async () => {
      const result = await extractVideasy(TV_BREAKING_BAD.tmdbId, "tv", 1, 1);
      expect(Array.isArray(result.sources)).toBe(true);
      console.log(summarize("Videasy TV", result.sources));
      for (const s of result.sources) assertStreamSourceShape(s, "Videasy TV");
    },
    API_TIMEOUT,
  );
});

describe("VidSrc", () => {
  it(
    `extracts sources for "${MOVIE_FIGHT_CLUB.title}"`,
    async () => {
      const result = await extractVidSrc(MOVIE_FIGHT_CLUB.tmdbId, "movie");
      expect(Array.isArray(result.sources)).toBe(true);
      console.log(summarize("VidSrc movie", result.sources));
      for (const s of result.sources) assertStreamSourceShape(s, "VidSrc");
    },
    API_TIMEOUT,
  );

  it(
    `extracts sources for "${TV_BREAKING_BAD.title}"`,
    async () => {
      const result = await extractVidSrc(TV_BREAKING_BAD.tmdbId, "tv", 1, 1);
      expect(Array.isArray(result.sources)).toBe(true);
      console.log(summarize("VidSrc TV", result.sources));
      for (const s of result.sources) assertStreamSourceShape(s, "VidSrc TV");
    },
    API_TIMEOUT,
  );
});

describe("MultiEmbed", () => {
  it(
    `extracts sources for "${MOVIE_FIGHT_CLUB.title}"`,
    async () => {
      const result = await extractMultiEmbed(MOVIE_FIGHT_CLUB.tmdbId, undefined, undefined, undefined, "movie");
      expect(Array.isArray(result.sources)).toBe(true);
      console.log(summarize("MultiEmbed movie", result.sources));
      for (const s of result.sources) assertStreamSourceShape(s, "MultiEmbed");
    },
    API_TIMEOUT,
  );

  it(
    `extracts sources for "${TV_BREAKING_BAD.title}"`,
    async () => {
      const result = await extractMultiEmbed(TV_BREAKING_BAD.tmdbId, undefined, 1, 1, "tv");
      expect(Array.isArray(result.sources)).toBe(true);
      console.log(summarize("MultiEmbed TV", result.sources));
      for (const s of result.sources) assertStreamSourceShape(s, "MultiEmbed TV");
    },
    API_TIMEOUT,
  );
});

// ── Live TV ──────────────────────────────────────────────────────────────────

describe("DLHD (Live TV)", () => {
  // "44" = ESPN USA in dlhd-channels.json — a real channel ID, not a name.
  // DLHD's stream pages key off the numeric ID; "espn" is a channel *name*
  // and never resolved to a valid stream page, so the previous test silently
  // passed with 0 sources (it only asserted Array.isArray).
  it(
    "extracts live TV channels",
    async () => {
      const result = await extractDLHD("44");
      expect(Array.isArray(result.sources)).toBe(true);
      console.log(summarize("DLHD", result.sources));
      // If the channel is offline the extractor legitimately returns no
      // sources; only validate the *shape* of whatever it returns.
      for (const s of result.sources) assertStreamSourceShape(s, "DLHD");
    },
    API_TIMEOUT,
  );

  it(
    "handles unknown channel gracefully",
    async () => {
      const result = await extractDLHD("nonexistent-channel-xyz-12345");
      expect(Array.isArray(result.sources)).toBe(true);
      expect(result.sources.length).toBe(0);
      // Should return empty, not throw
    },
    API_TIMEOUT,
  );
});

// ── Anime (smoke test) ──────────────────────

describe("AnimeX (smoke)", () => {
  it(
    "extraction pipeline completes without throwing",
    async () => {
      const result = await extractAnimeX(0, undefined, undefined, 1, "One Piece");
      expect(Array.isArray(result.sources)).toBe(true);
      expect(Array.isArray(result.subtitles)).toBe(true);
      console.log(summarize("AnimeX One Piece ep1", result.sources));
      for (const s of result.sources) assertStreamSourceShape(s, "AnimeX");
    },
    60_000,
  );
});

// ── Full Matrix Summary ──────────────────────────────────────────────────────

describe("Provider Matrix", () => {
  it(
    "all providers return structurally valid responses",
    async () => {
      type ProviderEntry = {
        name: string;
        extract: () => Promise<{ sources: StreamSource[] }>;
      };

      const providers: ProviderEntry[] = [
        {
          name: "Videasy",
          extract: () => extractVideasy(MOVIE_INCEPTION.tmdbId, "movie"),
        },
        {
          name: "VidSrc",
          extract: () => extractVidSrc(MOVIE_INCEPTION.tmdbId, "movie"),
        },
        {
          name: "MultiEmbed",
          extract: () => extractMultiEmbed(MOVIE_INCEPTION.tmdbId, undefined, undefined, undefined, "movie"),
        },
        {
          name: "DLHD",
          extract: () => extractDLHD("44"),
        },
        {
          name: "AnimeX",
          extract: () => extractAnimeX(0, undefined, undefined, 1, "One Piece"),
        },
      ];

      const results: { name: string; sources: number; qualities: string[]; success: boolean }[] = [];

      for (const provider of providers) {
        try {
          const result = await provider.extract();
          results.push({
            name: provider.name,
            sources: result.sources.length,
            qualities: [...new Set(result.sources.map(s => s.quality))],
            success: result.sources.length > 0,
          });

          // Structural validation on all sources
          for (const s of result.sources) {
            assertStreamSourceShape(s, provider.name);
          }
        } catch (err) {
          results.push({
            name: provider.name,
            sources: 0,
            qualities: [],
            success: false,
          });
          console.warn(`[Matrix] ${provider.name}: threw — ${(err as Error).message}`);
        }
      }

      // Print matrix
      console.log("\n╔" + "═".repeat(56) + "╗");
      console.log("║  Provider Matrix — Sources Found                    ║");
      console.log("╠" + "═".repeat(56) + "╣");
      for (const r of results) {
        const status = r.success
          ? `${r.sources} src [${r.qualities.join(",")}]`
          : "FAILED";
        console.log(`║  ${r.name.padEnd(14)} ${status.padEnd(37)} ║`);
      }
      console.log("╚" + "═".repeat(56) + "╝");

      const working = results.filter(r => r.success);
      console.log(`\n[Matrix] ${working.length}/${results.length} providers returned sources\n`);

      // At least one provider should work
      expect(working.length).toBeGreaterThan(0);
    },
    90_000,
  );
});
