/**
 * Download job manager — in-memory queue with a small JSON history file so
 * the Downloads page survives restarts. Concurrency is capped because ffmpeg
 * remuxes and CDN pulls are heavy.
 *
 * State lives on globalThis: Next.js bundles each route handler separately,
 * so a plain module-level Map could be duplicated between /api/downloads and
 * /api/downloads/[id]. A process-global singleton guarantees they share one
 * queue.
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  ensureDownloadDir,
  getDownloadDir,
  buildFilename,
  type DownloadItemInput,
  type DownloadJob,
} from "./types";
import { downloadVideo, type VideoDownloadRequest } from "./video";
import { downloadMangaChapter, type MangaDownloadRequest } from "./manga";

const MAX_CONCURRENT = 2;

const HISTORY_DIR = process.env.FLYX_DATA_DIR
  ? path.resolve(process.env.FLYX_DATA_DIR)
  : path.resolve(process.cwd(), ".flyx");
const HISTORY_PATH = path.join(HISTORY_DIR, "downloads.json");

interface DownloadState {
  jobs: Map<string, DownloadJob>;
  queue: string[];
  controllers: Map<string, AbortController>;
  active: number;
  initialized: boolean;
  persistTimer: ReturnType<typeof setTimeout> | null;
}

const g = globalThis as unknown as { __flyxDownloads?: DownloadState };
const state: DownloadState = (g.__flyxDownloads ??= {
  jobs: new Map(),
  queue: [],
  controllers: new Map(),
  active: 0,
  initialized: false,
  persistTimer: null,
});

// ── Persistence ──────────────────────────────────────────────────

function persist(): void {
  try {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
    fs.writeFileSync(
      HISTORY_PATH,
      JSON.stringify(Array.from(state.jobs.values()), null, 2),
      "utf-8",
    );
  } catch {
    /* best effort */
  }
}

// Progress updates fire frequently (ffmpeg emits ~2/sec per job) — debounce
// the JSON history write so we don't hammer the disk mid-download.
function schedulePersist(): void {
  if (state.persistTimer) return;
  state.persistTimer = setTimeout(() => {
    state.persistTimer = null;
    persist();
  }, 1000);
}

function persistNow(): void {
  if (state.persistTimer) {
    clearTimeout(state.persistTimer);
    state.persistTimer = null;
  }
  persist();
}

function init(): void {
  if (state.initialized) return;
  state.initialized = true;
  try {
    if (!fs.existsSync(HISTORY_PATH)) return;
    const raw = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf-8"));
    if (!Array.isArray(raw)) return;
    for (const j of raw) {
      if (!j || typeof j.id !== "string") continue;
      // A running job at shutdown can't resume — mark it as interrupted.
      if (j.status === "queued" || j.status === "downloading" || j.status === "processing") {
        j.status = "error";
        j.error = "Interrupted — the app restarted";
        j.updatedAt = Date.now();
      }
      state.jobs.set(j.id, j as DownloadJob);
    }
  } catch {
    /* corrupt history — start fresh */
  }
}

// ── Job construction ─────────────────────────────────────────────

function buildJob(item: DownloadItemInput): DownloadJob {
  const now = Date.now();
  const base: DownloadJob = {
    id: randomUUID(),
    kind: item.kind,
    label: "",
    status: "queued",
    progress: 0,
    bytes: 0,
    totalBytes: 0,
    outTimeMs: 0,
    createdAt: now,
    updatedAt: now,
  };

  if (item.kind === "video") {
    base.tmdbId = item.tmdbId;
    base.mediaType = item.mediaType;
    base.season = item.season;
    base.episode = item.episode;
    base.malId = item.malId;
    base.provider = item.provider;
    base.quality = item.quality;
    base.language = item.language;
    base.durationSec = item.durationSec;
    base.filename = buildFilename(item);
    if (item.mediaType === "tv" && item.season && item.episode) {
      const e = String(item.episode).padStart(2, "0");
      // Anime uses absolute episode numbers (no season), e.g. "E05".
      if (item.malId) {
        base.label = `${item.title || "Episode"} — E${e}`;
      } else {
        const s = String(item.season).padStart(2, "0");
        base.label = `${item.title || "Episode"} — S${s}E${e}`;
      }
    } else {
      base.label = item.title || "Movie";
    }
  } else {
    base.mangaId = item.mangaId;
    base.chapter = item.chapter;
    base.filename = buildFilename(item);
    base.label = `${item.title || "Manga"} — Chapter ${item.chapter}`;
  }

  return base;
}

// ── Processing ───────────────────────────────────────────────────

function patch(id: string, p: Partial<DownloadJob>, { immediate = false } = {}): void {
  const job = state.jobs.get(id);
  if (!job) return;
  Object.assign(job, p, { updatedAt: Date.now() });
  if (immediate) persistNow();
  else schedulePersist();
}

async function runJob(id: string): Promise<void> {
  const job = state.jobs.get(id);
  if (!job) return;

  const dir = getDownloadDir();
  try {
    ensureDownloadDir(dir);
  } catch (err) {
    patch(id, { status: "error", error: `Cannot create download folder: ${(err as Error).message}` }, { immediate: true });
    return;
  }

  const dest = path.join(dir, job.filename || `${id}.download`);
  const controller = new AbortController();
  state.controllers.set(id, controller);

  try {
    if (job.kind === "video") {
      const req: VideoDownloadRequest = {
        tmdbId: job.tmdbId!,
        mediaType: job.mediaType!,
        season: job.season,
        episode: job.episode,
        malId: job.malId,
        title: job.label,
        provider: job.provider,
        durationSec: job.durationSec,
        quality: job.quality,
        language: job.language,
      };
      await downloadVideo(
        req,
        dest,
        ({ bytes, totalBytes, outTimeMs, durationSec }) => {
          let progress = 0;
          if (totalBytes > 0) progress = Math.min(99, Math.round((bytes / totalBytes) * 100));
          else if (durationSec && outTimeMs > 0) {
            progress = Math.min(99, Math.round((outTimeMs / 1000 / durationSec) * 100));
          }
          patch(id, { status: "downloading", bytes, totalBytes, outTimeMs, progress });
        },
        controller.signal,
      );
    } else {
      const req: MangaDownloadRequest = {
        mangaId: job.mangaId!,
        chapter: job.chapter!,
        title: job.label,
      };
      await downloadMangaChapter(
        req,
        dest,
        ({ done, total }) => {
          patch(id, {
            status: "downloading",
            progress: Math.min(99, Math.round((done / total) * 100)),
            totalBytes: total,
            bytes: done,
          });
        },
        controller.signal,
      );
    }

    patch(id, { status: "done", progress: 100, filepath: dest }, { immediate: true });
  } catch (err) {
    if (controller.signal.aborted) {
      patch(id, { status: "cancelled" }, { immediate: true });
    } else {
      patch(id, { status: "error", error: (err as Error).message }, { immediate: true });
    }
    try {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    } catch {
      /* partial file may be locked/absent */
    }
  } finally {
    state.controllers.delete(id);
    state.active -= 1;
    pump();
  }
}

function pump(): void {
  while (state.active < MAX_CONCURRENT && state.queue.length > 0) {
    const id = state.queue.shift();
    if (!id) break;
    const job = state.jobs.get(id);
    if (!job || job.status !== "queued") continue;
    state.active += 1;
    void runJob(id);
  }
}

// ── Public API ───────────────────────────────────────────────────

export function listJobs(): DownloadJob[] {
  init();
  return Array.from(state.jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function getJob(id: string): DownloadJob | null {
  init();
  return state.jobs.get(id) || null;
}

export function createJobs(items: DownloadItemInput[]): DownloadJob[] {
  init();
  const created: DownloadJob[] = [];
  for (const item of items) {
    const job = buildJob(item);
    state.jobs.set(job.id, job);
    state.queue.push(job.id);
    created.push(job);
  }
  persistNow();
  pump();
  return created;
}

export function cancelJob(id: string): boolean {
  init();
  const job = state.jobs.get(id);
  if (!job) return false;

  if (job.status === "queued") {
    const idx = state.queue.indexOf(id);
    if (idx !== -1) state.queue.splice(idx, 1);
    patch(id, { status: "cancelled" }, { immediate: true });
    return true;
  }
  if (job.status === "downloading" || job.status === "processing") {
    state.controllers.get(id)?.abort();
    return true;
  }
  return false;
}

export function removeJob(id: string): boolean {
  init();
  const job = state.jobs.get(id);
  if (!job) return false;
  if (job.status === "downloading" || job.status === "queued" || job.status === "processing") {
    cancelJob(id);
  }
  state.jobs.delete(id);
  persistNow();
  return true;
}
