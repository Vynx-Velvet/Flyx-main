/**
 * Cross-device sync types.
 *
 * @module sync
 */

/** Data that can be synced between devices. */
export interface SyncData {
  /** Watchlist entries. */
  watchlist?: SyncWatchlistEntry[];
  /** Watch progress entries. */
  watchProgress?: SyncWatchProgressEntry[];
  /** Continue watching entries. */
  continueWatching?: SyncContinueWatchingEntry[];
  /** User preferences. */
  preferences?: SyncPreferences;
  /** Schema version for migration handling. */
  version: number;
  /** Last modified timestamp (Unix ms). */
  updatedAt: number;
}

/** A watchlist entry. */
export interface SyncWatchlistEntry {
  /** TMDB ID. */
  tmdbId: number;
  /** Media type. */
  mediaType: "movie" | "tv";
  /** When added to watchlist (Unix ms). */
  addedAt: number;
  /** Optional MAL ID for anime. */
  malId?: number;
}

/** Watch progress for a specific item. */
export interface SyncWatchProgressEntry {
  /** TMDB ID. */
  tmdbId: number;
  /** Media type. */
  mediaType: "movie" | "tv";
  /** Season number (TV only). */
  season?: number;
  /** Episode number (TV only). */
  episode?: number;
  /** Progress in seconds. */
  progressSeconds: number;
  /** Total duration in seconds. */
  durationSeconds: number;
  /** Whether playback is complete. */
  completed: boolean;
  /** Last watched timestamp (Unix ms). */
  watchedAt: number;
}

/** Continue watching entry (appears on home screen). */
export interface SyncContinueWatchingEntry {
  /** TMDB ID. */
  tmdbId: number;
  /** Media type. */
  mediaType: "movie" | "tv";
  /** Title for display. */
  title: string;
  /** Poster path for display. */
  posterPath?: string;
  /** Season number (TV only). */
  season?: number;
  /** Episode number (TV only). */
  episode?: number;
  /** Progress in seconds. */
  progressSeconds: number;
  /** Total duration in seconds. */
  durationSeconds: number;
  /** Last watched timestamp (Unix ms). */
  watchedAt: number;
}

/** User preferences synced across devices. */
export interface SyncPreferences {
  /** Preferred subtitle language (ISO 639-1). */
  subtitleLanguage?: string;
  /** Preferred audio language (ISO 639-1). */
  audioLanguage?: string;
  /** Default playback speed. */
  playbackSpeed?: number;
  /** Whether to skip intros automatically. */
  autoSkipIntro?: boolean;
  /** Whether to skip outros automatically. */
  autoSkipOutro?: boolean;
  /** Preferred streaming quality. */
  preferredQuality?: string;
}

/** Sync code for pairing devices. */
export interface SyncCode {
  /** 6-character alphanumeric code. */
  code: string;
  /** Hashed version stored on the server. */
  hash: string;
  /** When the code was created (Unix ms). */
  createdAt: number;
  /** When the code expires (Unix ms). */
  expiresAt: number;
}

/** Sync operation types. */
export type SyncOperation = "pull" | "push" | "full";

/** Sync request sent to the server. */
export interface SyncRequest {
  /** Sync code hash. */
  codeHash: string;
  /** Operation type. */
  operation: SyncOperation;
  /** Data to push (only for push/full). */
  data?: Partial<SyncData>;
}

/** Sync response from the server. */
export interface SyncResponse {
  /** Whether the sync succeeded. */
  success: boolean;
  /** Synced data from the server. */
  data?: SyncData;
  /** Error message if failed. */
  error?: string;
  /** Server timestamp (Unix ms). */
  serverTime: number;
}
