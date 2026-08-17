/**
 * Now-playing title builder for the system media session (Windows SMTC —
 * read by VRChat companions like MagicChatbox) and the window title.
 *
 * Formats (locked):
 *   TV     → "Demon Slayer — S2 E1"
 *   Anime  → "Demon Slayer — EP 3"   (malId present or isAnime flag)
 *   Movie  → "Interstellar (2014)"   (year only when available)
 *   document.title → "{mediaTitle} | Flyx"  (matches the root layout template)
 *
 * Returns all-null for placeholder titles ("Loading...", "Title 12345",
 * "Anime 57658") so callers never publish junk to the OS.
 */

export interface BuildNowPlayingInput {
  mediaType: "movie" | "tv";
  title?: string | null;
  season?: number;
  episode?: number;
  year?: number | string | null;
  malId?: number | string | null;
  isAnime?: boolean;
}

export interface NowPlayingInfo {
  /** MediaSession "track title" — carries the season/episode label. */
  mediaTitle: string | null;
  /** `{mediaTitle} | Flyx` — null when there is nothing to show. */
  documentTitle: string | null;
  /** Short episode label ("S2 E1", "EP 3") for the MediaMetadata album slot. */
  episodeLabel: string | null;
}

const PLACEHOLDER_TITLE = /^(loading\.\.\.|title\s+\d+|anime\s+\d+|untitled)$/i;

const EMPTY: NowPlayingInfo = { mediaTitle: null, documentTitle: null, episodeLabel: null };

export function buildNowPlaying(input: BuildNowPlayingInput): NowPlayingInfo {
  const title = (input.title ?? "").trim();
  if (!title || PLACEHOLDER_TITLE.test(title)) return EMPTY;

  const isAnime = input.isAnime ?? Boolean(input.malId);
  let mediaTitle = title;
  let episodeLabel: string | null = null;

  if (isAnime && input.episode != null) {
    episodeLabel = `EP ${input.episode}`;
  } else if (input.mediaType === "tv" && input.season != null && input.episode != null) {
    episodeLabel = `S${input.season} E${input.episode}`;
  } else if (input.year) {
    mediaTitle = `${title} (${input.year})`;
  }

  if (episodeLabel) mediaTitle = `${title} — ${episodeLabel}`;

  return { mediaTitle, documentTitle: `${mediaTitle} | Flyx`, episodeLabel };
}
