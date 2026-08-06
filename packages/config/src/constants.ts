/**
 * Shared constants for Flyx 3.0.
 *
 * @module constants
 */

/** All supported content categories. */
export const CONTENT_CATEGORIES = [
  "movie",
  "tv",
  "anime",
  "manga",
  "live-tv",
  "live-sports",
  "ppv",
  "iptv",
] as const;

/** Default pagination settings. */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/** Stream-related constants. */
export const STREAM = {
  /** Maximum number of segment-level errors before switching sources. */
  MAX_SEGMENT_ERRORS: 8,
  /** Timeout for a source to start playing (ms). */
  SOURCE_START_TIMEOUT_MS: 5_000,
  /** Maximum HLS recovery attempts before failing over. */
  MAX_RECOVERY_ATTEMPTS: 2,
} as const;

/** API rate limits (per IP). */
export const RATE_LIMITS = {
  /** Stream extraction requests per minute. */
  STREAM_EXTRACT_RPM: 30,
  /** Content search requests per minute. */
  SEARCH_RPM: 60,
  /** Sync requests per minute. */
  SYNC_RPM: 10,
} as const;

/** Cache TTLs in milliseconds. */
export const CACHE_TTL = {
  /** Stream extraction results. */
  STREAMS: 15 * 60 * 1000, // 15 min
  /** Provider configurations. */
  PROVIDERS: 5 * 60 * 1000, // 5 min
  /** TMDB metadata. */
  METADATA: 60 * 60 * 1000, // 60 min
  /** Search results. */
  SEARCH: 5 * 60 * 1000, // 5 min
  /** Live TV channel listings. */
  LIVETV: 2 * 60 * 1000, // 2 min
  /** DLHD whitelist session. */
  DLHD_WHITELIST: 20 * 60 * 1000, // 20 min
} as const;

/** Sync intervals. */
export const SYNC = {
  /** How often to auto-sync (ms). */
  AUTO_SYNC_INTERVAL_MS: 30_000,
  /** Sync code length (characters). */
  CODE_LENGTH: 6,
  /** Sync code expiry (ms). */
  CODE_EXPIRY_MS: 10 * 60 * 1000, // 10 min
} as const;

/** Default playback settings. */
export const PLAYBACK = {
  DEFAULT_SPEED: 1.0,
  DEFAULT_QUALITY: "Auto",
  DEFAULT_SUBTITLE_LANGUAGE: "en",
  VOLUME_STEP: 0.05,
  SEEK_STEP_SECONDS: 10,
} as const;
