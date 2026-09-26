/**
 * Watch progress store — where the viewer left off, to the second.
 *
 * One entry per movie / per episode, persisted in localStorage under the
 * same key the Continue Watching rail already reads (`flyx_watch_progress`,
 * shape = `WatchProgress` from lib/services/user-tracking). The player
 * writes here every few seconds and on pause/hide/leave; the watchlist page
 * and the Continue Watching rail read it and build exact-second resume links.
 *
 * The pure helpers take/return plain data so they can be unit-tested with a
 * fake storage; the exported convenience functions bind them to
 * window.localStorage and broadcast `WATCH_PROGRESS_EVENT` on every change.
 */

import type { WatchProgress } from "@/lib/services/user-tracking";

export const WATCH_PROGRESS_KEY = "flyx_watch_progress";
export const WATCH_PROGRESS_EVENT = "flyx-watch-progress-changed";

/** Above this the title counts as finished (hidden from resume surfaces). */
export const COMPLETED_PCT = 95;
/** Below this we don't bother remembering (accidental clicks). */
export const MIN_TRACK_SECONDS = 5;

export interface ProgressEntry extends WatchProgress {
  /** MyAnimeList id for anime (contentId may then be the TMDB id or the MAL id). */
  malId?: number;
  /** Set once the viewer reached the end (or COMPLETED_PCT). */
  completed?: boolean;
  updatedAt?: number;
}

export interface ProgressStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ProgressIdentity {
  contentId: string;
  contentType: "movie" | "tv";
  seasonNumber?: number;
  episodeNumber?: number;
}

// ── Pure helpers ────────────────────────────────────────────────

export function readProgress(storage: ProgressStorage | null | undefined): ProgressEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(WATCH_PROGRESS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProgressEntry[]).filter((e) => e && e.contentId) : [];
  } catch {
    return [];
  }
}

export function writeProgress(storage: ProgressStorage | null | undefined, entries: ProgressEntry[]): void {
  if (!storage) return;
  try {
    storage.setItem(WATCH_PROGRESS_KEY, JSON.stringify(entries));
  } catch {
    /* quota / private mode */
  }
}

export function sameItem(a: ProgressIdentity, b: ProgressIdentity): boolean {
  return (
    a.contentId === b.contentId &&
    a.contentType === b.contentType &&
    (a.seasonNumber ?? null) === (b.seasonNumber ?? null) &&
    (a.episodeNumber ?? null) === (b.episodeNumber ?? null)
  );
}

export function completionPct(currentTime: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.max(0, Math.min(100, (currentTime / duration) * 100));
}

export interface UpsertInput extends ProgressIdentity {
  currentTime: number;
  duration: number;
  title?: string;
  posterPath?: string;
  backdropPath?: string;
  malId?: number;
  /** Force "finished" regardless of position (the `ended` event). */
  completed?: boolean;
  now?: number;
}

/**
 * Insert or update one entry. Returns the new list (most recent first) or
 * null when the input is not worth recording yet.
 */
export function upsertEntry(entries: ProgressEntry[], input: UpsertInput): ProgressEntry[] | null {
  const duration = Number.isFinite(input.duration) ? input.duration : 0;
  const currentTime = Math.max(0, Number.isFinite(input.currentTime) ? input.currentTime : 0);
  if (!input.completed && (currentTime < MIN_TRACK_SECONDS || duration <= 0)) return null;

  const pct = input.completed ? 100 : completionPct(currentTime, duration);
  const completed = Boolean(input.completed) || pct >= COMPLETED_PCT;
  const now = input.now ?? Date.now();
  const existing = entries.find((e) => sameItem(e, input));

  const next: ProgressEntry = {
    ...(existing ?? {}),
    contentId: input.contentId,
    contentType: input.contentType,
    seasonNumber: input.seasonNumber,
    episodeNumber: input.episodeNumber,
    currentTime: Math.round(currentTime * 1000) / 1000,
    duration: Math.round(duration),
    completionPercentage: Math.round(pct * 10) / 10,
    completed,
    lastWatchedAt: now,
    updatedAt: now,
    title: input.title ?? existing?.title,
    posterPath: input.posterPath ?? existing?.posterPath,
    backdropPath: input.backdropPath ?? existing?.backdropPath,
    malId: input.malId ?? existing?.malId,
  };

  const rest = entries.filter((e) => !sameItem(e, input));
  return [next, ...rest].slice(0, 200);
}

export function findEntry(entries: ProgressEntry[], id: ProgressIdentity): ProgressEntry | null {
  return entries.find((e) => sameItem(e, id)) ?? null;
}

/**
 * The most recently watched entry for a title (any episode). For a series
 * this is what "Continue" should open. Ignores nothing — callers decide
 * what to do with completed entries (see nextUpFor).
 */
export function latestForContent(
  entries: ProgressEntry[],
  contentId: string,
  contentType: "movie" | "tv",
): ProgressEntry | null {
  const matches = entries.filter((e) => e.contentId === contentId && e.contentType === contentType);
  if (!matches.length) return null;
  return matches.sort((a, b) => (b.lastWatchedAt ?? 0) - (a.lastWatchedAt ?? 0))[0]!;
}

/** Resume position in seconds for an entry, or 0 when it should start over. */
export function resumeSeconds(entry: ProgressEntry | null | undefined): number {
  if (!entry || entry.completed) return 0;
  if (entry.completionPercentage >= COMPLETED_PCT) return 0;
  return entry.currentTime > MIN_TRACK_SECONDS ? Math.floor(entry.currentTime) : 0;
}

/** "1:02:15" / "23:04" */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

/** "23 min left" / "1 h 02 min left" / "Finished" */
export function formatRemaining(entry: ProgressEntry): string {
  if (entry.completed || entry.completionPercentage >= COMPLETED_PCT) return "Finished";
  const left = Math.max(0, (entry.duration || 0) - (entry.currentTime || 0));
  const mins = Math.round(left / 60);
  if (left < 60) return "Less than a minute left";
  if (mins < 60) return `${mins} min left`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} h ${String(m).padStart(2, "0")} min left`;
}

/** "S2 E4" for series, "EP 4" for anime, "" for movies. */
export function episodeLabel(entry: ProgressIdentity & { malId?: number }): string {
  if (entry.contentType !== "tv") return "";
  if (entry.malId) return `EP ${entry.episodeNumber ?? 1}`;
  return `S${entry.seasonNumber ?? 1} E${entry.episodeNumber ?? 1}`;
}

/**
 * /watch URL that reopens an entry exactly where it stopped. `t` is read by
 * the player on first load and cleared from the URL when the episode changes.
 */
export function resumeHref(entry: ProgressEntry, opts: { title?: string } = {}): string {
  const q = new URLSearchParams();
  if (entry.malId) {
    q.set("malId", String(entry.malId));
    if (entry.contentId && entry.contentId !== String(entry.malId)) q.set("tmdbId", entry.contentId);
    q.set("mediaType", "tv");
    q.set("episode", String(entry.episodeNumber ?? 1));
  } else {
    q.set("tmdbId", entry.contentId);
    q.set("mediaType", entry.contentType);
    if (entry.contentType === "tv") {
      q.set("season", String(entry.seasonNumber ?? 1));
      q.set("episode", String(entry.episodeNumber ?? 1));
    }
  }
  const title = opts.title ?? entry.title;
  if (title) q.set("title", title);
  const t = resumeSeconds(entry);
  if (t > 0) q.set("t", String(t));
  return `/watch?${q.toString()}`;
}

// ── Bound to window.localStorage ─────────────────────────────────

function storage(): ProgressStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function broadcast() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(WATCH_PROGRESS_EVENT));
  } catch {
    /* ignore */
  }
}

export function getAllWatchProgress(): ProgressEntry[] {
  return readProgress(storage());
}

export function getWatchProgress(id: ProgressIdentity): ProgressEntry | null {
  return findEntry(getAllWatchProgress(), id);
}

export function updateWatchProgress(input: UpsertInput): ProgressEntry | null {
  const s = storage();
  const next = upsertEntry(readProgress(s), input);
  if (!next) return null;
  writeProgress(s, next);
  broadcast();
  return next[0]!;
}

export function removeWatchProgress(id: ProgressIdentity): boolean {
  const s = storage();
  const entries = readProgress(s);
  const filtered = entries.filter((e) => !sameItem(e, id));
  if (filtered.length === entries.length) return false;
  writeProgress(s, filtered);
  broadcast();
  return true;
}

/** Remove every entry for a title (all episodes). */
export function removeContentProgress(contentId: string, contentType: "movie" | "tv"): boolean {
  const s = storage();
  const entries = readProgress(s);
  const filtered = entries.filter((e) => !(e.contentId === contentId && e.contentType === contentType));
  if (filtered.length === entries.length) return false;
  writeProgress(s, filtered);
  broadcast();
  return true;
}
