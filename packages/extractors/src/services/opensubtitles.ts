/**
 * OpenSubtitles extractor — FREE, no API key required.
 *
 * Scrapes the opensubtitles.org website directly (search results page +
 * download CDN). The site sits behind an Anubis proof-of-work challenge,
 * which opensubtitles-html.ts solves server-side and amortizes across the
 * process via session cookies + caches.
 *
 * Flow:
 *   1. Look up IMDB ID from TMDB ID (via public TMDB API)
 *   2. Scrape search results by IMDB ID + season/episode
 *   3. Pick best subtitle per language (by download count)
 *   4. Return SubtitleTrack[] pointing at /api/subtitles/download
 *      (which unzips + converts SRT→VTT on demand)
 */

import type { SubtitleTrack } from "@flyx/core";
import { searchOpenSubtitles, type OSSubRow } from "./opensubtitles-html";

const UA = "Flyx v3.0";

/** Preferred subtitle languages in priority order. */
const DEFAULT_LANGS = ["eng", "spa", "fre", "ger", "por", "ita", "jpn", "kor", "chi", "ara", "rus", "hin"];

// ── IMDB ID lookup ────────────────────────────────────────────

let _imdbCache = new Map<number, string | null>();

async function tmdbToImdb(tmdbId: number, mediaType: "movie" | "tv"): Promise<string | null> {
  const cacheKey = tmdbId * 10 + (mediaType === "tv" ? 1 : 0);
  const cached = _imdbCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const tmdbKey = process.env.TMDB_API_KEY;
    if (!tmdbKey) {
      _imdbCache.set(cacheKey, null);
      return null;
    }

    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${tmdbKey}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) {
      _imdbCache.set(cacheKey, null);
      return null;
    }

    const data = await res.json();
    const imdbId = data.imdb_id ?? null;
    _imdbCache.set(cacheKey, imdbId);
    return imdbId;
  } catch {
    _imdbCache.set(cacheKey, null);
    return null;
  }
}

export interface OpenSubtitlesResult {
  subtitles: SubtitleTrack[];
  /** Set when the scrape failed at the site level ("blocked" = anti-bot). */
  error?: "blocked" | "failed";
}

/**
 * Extract subtitles from opensubtitles.org for a given TMDB ID.
 * No API key needed — scrapes the public website.
 */
export async function extractOpenSubtitles(
  tmdbId: number,
  mediaType: "movie" | "tv",
  season?: number,
  episode?: number,
  preferredLanguages?: string,
): Promise<OpenSubtitlesResult> {
  if (!tmdbId || tmdbId <= 0) {
    return { subtitles: [] };
  }

  try {
    // Step 1: TMDB ID → IMDB ID
    const imdbId = await tmdbToImdb(tmdbId, mediaType);
    if (!imdbId) {
      console.log(`[opensubtitles] No IMDB ID for TMDB ${tmdbId}`);
      return { subtitles: [] };
    }

    const wanted = (preferredLanguages ? preferredLanguages.split(",") : DEFAULT_LANGS)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    // Step 2: Scrape the search results
    const { rows, error } = await searchOpenSubtitles({
      imdbId,
      season,
      episode,
      languages: wanted,
    });
    if (error) {
      console.warn(`[opensubtitles] search ${error} for IMDB ${imdbId}`);
      return { subtitles: [], error };
    }
    if (rows.length === 0) {
      console.log(`[opensubtitles] No subtitles for IMDB ${imdbId}`);
      return { subtitles: [] };
    }

    // Step 3: Pick best per language (highest download count)
    const bestPerLang = new Map<string, OSSubRow>();
    for (const r of rows) {
      if (wanted.length && !wanted.includes(r.langCode)) continue;
      const existing = bestPerLang.get(r.langCode);
      if (!existing || r.downloads > existing.downloads) {
        bestPerLang.set(r.langCode, r);
      }
    }

    // Step 4: Build SubtitleTrack list — wanted-language priority first,
    // then download count within a language set.
    const ordered = [...bestPerLang.values()].sort((a, b) => {
      const ai = wanted.indexOf(a.langCode);
      const bi = wanted.indexOf(b.langCode);
      if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return b.downloads - a.downloads;
    });

    const subtitles: SubtitleTrack[] = ordered.map((sub) => ({
      label: sub.langName || sub.langCode.toUpperCase(),
      url: `/api/subtitles/download?subId=${sub.subId}`,
      language: sub.langCode,
    }));

    console.log(
      `[opensubtitles] Fetched ${subtitles.length} tracks for IMDB ${imdbId} (TMDB ${tmdbId})`,
    );
    return { subtitles };
  } catch (err) {
    console.error("[opensubtitles] Error:", err);
    return { subtitles: [] };
  }
}
