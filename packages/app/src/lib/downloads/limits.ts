/**
 * Shared resource limits for downloads.
 *
 * Both delivery paths — the admin download queue (/api/downloads) and the
 * direct-to-device stream (/api/downloads/stream) — can start ffmpeg or
 * buffer a manga chapter in memory, so they share one set of counters:
 *
 *  - ffmpeg processes across queue + streaming (the queue waits for a slot,
 *    a streaming request gets 429 when none is free);
 *  - concurrent direct streams per user and in total, per kind. Video
 *    streams answer 429 when the user already has one running; manga
 *    chapters (seconds each, requested in bulk by the client) briefly wait
 *    for a slot instead.
 *
 * State lives on globalThis for the same reason as the job manager: Next
 * bundles each route separately, and the counters must be process-wide.
 */

/** Max ffmpeg processes alive at once (queue runs ≤2, leaving one for streaming). */
export const MAX_FFMPEG_PROCESSES = 3;

export type StreamKind = "video" | "manga";

/** Per-kind caps on concurrent /api/downloads/stream requests. */
export const STREAM_LIMITS: Record<StreamKind, { perUser: number; total: number }> = {
  video: { perUser: 1, total: 4 },
  manga: { perUser: 2, total: 4 },
};

/** How long a manga stream request may wait for a slot before 429. */
export const MANGA_SLOT_WAIT_MS = 2 * 60 * 1000;

function envBytes(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Hard cap on one video download's output (default 20 GB, FLYX_DOWNLOAD_MAX_BYTES overrides). */
export const MAX_VIDEO_BYTES = envBytes("FLYX_DOWNLOAD_MAX_BYTES", 20 * 1024 ** 3);
/** Hard cap on one manga page image. */
export const MAX_MANGA_IMAGE_BYTES = 20 * 1024 * 1024;
/** Hard cap on one manga chapter (sum of all pages, held in memory for the CBZ). */
export const MAX_MANGA_CHAPTER_BYTES = 500 * 1024 * 1024;
/** Hard cap on pages per chapter (CBZ entries are numbered 001–999). */
export const MAX_MANGA_PAGES = 999;

export type Release = () => void;

interface StreamPool {
  total: number;
  byUser: Map<string, number>;
  waiters: Array<() => void>;
}

interface LimitState {
  ffmpegActive: number;
  ffmpegWaiters: Array<() => void>;
  streams: Record<StreamKind, StreamPool>;
}

const g = globalThis as unknown as { __flyxDownloadLimits?: LimitState };
const state: LimitState = (g.__flyxDownloadLimits ??= {
  ffmpegActive: 0,
  ffmpegWaiters: [],
  streams: {
    video: { total: 0, byUser: new Map(), waiters: [] },
    manga: { total: 0, byUser: new Map(), waiters: [] },
  },
});

function once(fn: () => void): Release {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    fn();
  };
}

// ── ffmpeg processes ────────────────────────────────────────────

function releaseFfmpeg(): void {
  const next = state.ffmpegWaiters.shift();
  if (next) next(); // hand the slot straight to the next waiter
  else state.ffmpegActive = Math.max(0, state.ffmpegActive - 1);
}

/** Take an ffmpeg slot if one is free (streaming path). */
export function tryAcquireFfmpeg(): Release | null {
  if (state.ffmpegActive >= MAX_FFMPEG_PROCESSES) return null;
  state.ffmpegActive++;
  return once(releaseFfmpeg);
}

/** Wait for an ffmpeg slot (queue path). Rejects if `signal` aborts first. */
export function acquireFfmpeg(signal?: AbortSignal): Promise<Release> {
  const immediate = tryAcquireFfmpeg();
  if (immediate) return Promise.resolve(immediate);
  if (signal?.aborted) return Promise.reject(new Error("cancelled"));
  return new Promise((resolve, reject) => {
    const grant = () => {
      signal?.removeEventListener("abort", onAbort);
      resolve(once(releaseFfmpeg));
    };
    const onAbort = () => {
      const idx = state.ffmpegWaiters.indexOf(grant);
      if (idx !== -1) state.ffmpegWaiters.splice(idx, 1);
      reject(new Error("cancelled"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    state.ffmpegWaiters.push(grant);
  });
}

// ── Direct streams ──────────────────────────────────────────────

function streamFree(kind: StreamKind, userKey: string): boolean {
  const pool = state.streams[kind];
  const lim = STREAM_LIMITS[kind];
  return (pool.byUser.get(userKey) ?? 0) < lim.perUser && pool.total < lim.total;
}

function takeStream(kind: StreamKind, userKey: string): Release {
  const pool = state.streams[kind];
  pool.byUser.set(userKey, (pool.byUser.get(userKey) ?? 0) + 1);
  pool.total++;
  return once(() => {
    const n = (pool.byUser.get(userKey) ?? 1) - 1;
    if (n <= 0) pool.byUser.delete(userKey);
    else pool.byUser.set(userKey, n);
    pool.total = Math.max(0, pool.total - 1);
    // Let every waiter re-check (they may be waiting on different users).
    const waiters = pool.waiters.splice(0);
    for (const w of waiters) w();
  });
}

/** Take a direct-stream slot for `userKey`, or null when the user/server is busy. */
export function tryAcquireStream(userKey: string, kind: StreamKind = "video"): Release | null {
  return streamFree(kind, userKey) ? takeStream(kind, userKey) : null;
}

/**
 * Wait up to `waitMs` for a direct-stream slot. Resolves null on timeout or
 * when `signal` aborts (client went away).
 */
export function acquireStream(
  userKey: string,
  kind: StreamKind,
  waitMs: number,
  signal?: AbortSignal,
): Promise<Release | null> {
  const immediate = tryAcquireStream(userKey, kind);
  if (immediate || waitMs <= 0 || signal?.aborted) return Promise.resolve(immediate);
  const pool = state.streams[kind];
  return new Promise((resolve) => {
    let finished = false;
    const finish = (r: Release | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      const idx = pool.waiters.indexOf(check);
      if (idx !== -1) pool.waiters.splice(idx, 1);
      resolve(r);
    };
    const check = () => {
      if (finished) return;
      if (streamFree(kind, userKey)) finish(takeStream(kind, userKey));
      else pool.waiters.push(check);
    };
    const onAbort = () => finish(null);
    const timer = setTimeout(() => finish(null), waitMs);
    signal?.addEventListener("abort", onAbort, { once: true });
    pool.waiters.push(check);
  });
}

/** Test helper: current counters. */
export function limitSnapshot(): {
  ffmpeg: number;
  ffmpegWaiting: number;
  video: number;
  manga: number;
} {
  return {
    ffmpeg: state.ffmpegActive,
    ffmpegWaiting: state.ffmpegWaiters.length,
    video: state.streams.video.total,
    manga: state.streams.manga.total,
  };
}
