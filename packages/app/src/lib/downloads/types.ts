/**
 * Flyx downloads — shared types + helpers.
 *
 * Downloads run server-side (the embedded Node server writes files to the
 * machine's disk) and are surfaced to the UI via the /api/downloads routes.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSetting } from "@/lib/db";

export type DownloadKind = "video" | "manga";

export type DownloadPhase =
  | "queued"
  | "downloading"
  | "processing"
  | "done"
  | "error"
  | "cancelled";

/** A single downloadable item as submitted by the client. */
export type DownloadItemInput =
  | {
      kind: "video";
      tmdbId: number;
      mediaType: "movie" | "tv";
      season?: number;
      episode?: number;
      malId?: number;
      title?: string;
      provider?: string;
      durationSec?: number;
      /** Requested quality label ("1080p", "4K", …). Falls back to best available. */
      quality?: string;
      /** Sub/Dub audio track (anime only). */
      language?: "sub" | "dub";
    }
  | {
      kind: "manga";
      mangaId: string;
      chapter: number;
      title?: string;
    };

export interface DownloadJob {
  id: string;
  kind: DownloadKind;
  label: string;
  status: DownloadPhase;
  progress: number; // 0-100 (best effort)
  bytes: number;
  totalBytes: number;
  outTimeMs: number; // ffmpeg processed time (HLS/DASH)
  durationSec?: number;
  filename?: string;
  filepath?: string;
  error?: string;
  // request fields (video)
  tmdbId?: number;
  mediaType?: "movie" | "tv";
  season?: number;
  episode?: number;
  malId?: number;
  provider?: string;
  quality?: string;
  language?: "sub" | "dub";
  // request fields (manga)
  mangaId?: string;
  chapter?: number;
  createdAt: number;
  updatedAt: number;
}

/** Strip path-hostile characters so titles can become filenames. */
export function sanitizeFilename(name: string): string {
  const cleaned = String(name || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "download";
}

/** Human/disk filename for a downloadable item (shared by queue + direct stream). */
export function buildFilename(item: DownloadItemInput): string {
  if (item.kind === "video") {
    const t = sanitizeFilename(item.title || "Video");
    const audioSuffix = item.language === "dub" ? " (Dub)" : item.language === "sub" ? " (Sub)" : "";
    if (item.mediaType === "tv" && item.season && item.episode) {
      const e = String(item.episode).padStart(2, "0");
      // Anime uses absolute episode numbers (no season), e.g. "E05".
      if (item.malId) return `${t} - E${e}${audioSuffix}.mp4`;
      const s = String(item.season).padStart(2, "0");
      return `${t} - S${s}E${e}${audioSuffix}.mp4`;
    }
    return `${t}${audioSuffix}.mp4`;
  }
  const t = sanitizeFilename(item.title || "Manga");
  return `${t} - Chapter ${item.chapter}.cbz`;
}

/** Resolve the download directory (custom setting → desktop default → ~/Downloads). */
export function getDownloadDir(): string {
  const custom = (getSetting("download_dir") || "").trim();
  if (custom) return custom;
  if (process.env.FLYX_DEFAULT_DOWNLOAD_DIR) {
    return process.env.FLYX_DEFAULT_DOWNLOAD_DIR;
  }
  return path.join(os.homedir(), "Downloads");
}

export function defaultDownloadDir(): string {
  if (process.env.FLYX_DEFAULT_DOWNLOAD_DIR) {
    return process.env.FLYX_DEFAULT_DOWNLOAD_DIR;
  }
  return path.join(os.homedir(), "Downloads");
}

export function ensureDownloadDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

// Re-exported so existing importers keep working; the pure helpers live in
// source-picker.ts (dependency-free for unit testing).
export { qualityScore } from "./source-picker";
