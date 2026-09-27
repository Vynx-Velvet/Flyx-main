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

/** Longest filename we produce (well under every filesystem's 255 limit). */
export const MAX_FILENAME_LENGTH = 150;

/** Windows device names — reserved with or without an extension ("CON", "nul.txt"). */
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])$/i;

/**
 * Strip path-hostile characters so titles can become filenames: no path
 * separators or control characters, no trailing dots/spaces (Windows drops
 * them, so "..", "a." and "a " misbehave), no reserved device names, and
 * capped in length (keeping a short extension intact).
 */
export function sanitizeFilename(name: string, maxLength = MAX_FILENAME_LENGTH): string {
  let cleaned = String(name || "")
    // eslint-disable-next-line no-control-regex -- strips control chars on purpose
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");

  const chars = Array.from(cleaned);
  if (chars.length > maxLength) {
    const ext = /\.[A-Za-z0-9]{1,8}$/.exec(cleaned)?.[0] ?? "";
    cleaned = chars
      .slice(0, maxLength - ext.length)
      .join("")
      .replace(/[. ]+$/, "") + ext;
  }

  if (!cleaned) return "download";
  // "CON", "con.mp4", "Nul .txt" … are all device names on Windows.
  const stem = cleaned.split(".")[0]!.trim();
  if (WINDOWS_RESERVED.test(stem)) cleaned = `_${cleaned}`;
  return cleaned;
}

const TITLE_MAX_LENGTH = MAX_FILENAME_LENGTH - 30;

/** Human/disk filename for a downloadable item (shared by queue + direct stream). */
export function buildFilename(item: DownloadItemInput): string {
  if (item.kind === "video") {
    // Leave room for the " - S01E02 (Dub).mp4" suffix within the length cap.
    const t = sanitizeFilename(item.title || "Video", TITLE_MAX_LENGTH);
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
  const t = sanitizeFilename(item.title || "Manga", TITLE_MAX_LENGTH);
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
