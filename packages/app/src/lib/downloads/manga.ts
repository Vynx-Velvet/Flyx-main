/**
 * Manga chapter download — fetch page images and bundle them into a CBZ
 * (a plain ZIP archive with a .cbz extension, the standard comic format).
 */

import fs from "node:fs";
import path from "node:path";
import { zipSync } from "fflate";
import { getChapterPages } from "@flyx/extractors/services";
import { BodyTooLargeError, readBodyLimited, safeFetch } from "@/lib/security/safe-fetch";
import { MAX_MANGA_CHAPTER_BYTES, MAX_MANGA_IMAGE_BYTES, MAX_MANGA_PAGES } from "./limits";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0";

export interface MangaDownloadRequest {
  mangaId: string;
  chapter: number;
  title?: string;
}

function extFor(url: string): string {
  try {
    const p = new URL(url).pathname;
    const ext = path.extname(p).toLowerCase();
    if (ext === ".jpg" || ext === ".jpeg" || ext === ".png" || ext === ".webp") {
      return ext === ".jpeg" ? ".jpg" : ext;
    }
  } catch {
    /* fall through */
  }
  return ".jpg";
}

async function fetchImage(
  url: string,
  signal?: AbortSignal,
  maxBytes = MAX_MANGA_IMAGE_BYTES,
): Promise<{ data: Uint8Array; ext: string }> {
  // Page URLs come from a scraped third-party site: refuse private/loopback
  // targets (checked on every redirect hop) and cap the body size.
  const res = await safeFetch(url, {
    headers: { "User-Agent": UA, Accept: "image/avif,image/webp,image/png,image/jpeg,*/*" },
    signal,
  });
  if (!res.ok) throw new Error(`image fetch failed (HTTP ${res.status})`);
  let buf: Uint8Array;
  try {
    buf = await readBodyLimited(res, maxBytes);
  } catch (err) {
    if (err instanceof BodyTooLargeError) throw new Error("manga chapter exceeds the size limit");
    throw err;
  }
  return { data: buf, ext: extFor(url) };
}

export async function buildMangaChapterCbz(
  req: MangaDownloadRequest,
  onProgress?: (p: { done: number; total: number }) => void,
  signal?: AbortSignal,
): Promise<{ zipped: Uint8Array; pageCount: number }> {
  const pages = await getChapterPages(req.mangaId, req.chapter, req.title);
  if (pages.length === 0) {
    throw new Error(`No pages found for chapter ${req.chapter}`);
  }

  if (pages.length > MAX_MANGA_PAGES) {
    throw new Error(`Chapter has too many pages (${pages.length})`);
  }

  // The whole chapter is held in memory to build the CBZ, so cap its size.
  const entries: Record<string, Uint8Array> = {};
  let totalBytes = 0;
  for (let i = 0; i < pages.length; i++) {
    if (signal?.aborted) throw new Error("cancelled");
    const page = pages[i];
    const remaining = MAX_MANGA_CHAPTER_BYTES - totalBytes;
    const { data, ext } = await fetchImage(
      page.imageUrl,
      signal,
      Math.min(MAX_MANGA_IMAGE_BYTES, remaining),
    );
    totalBytes += data.byteLength;
    const name = `${String(i + 1).padStart(3, "0")}${ext}`;
    entries[name] = data;
    onProgress?.({ done: i + 1, total: pages.length });
  }

  return { zipped: zipSync(entries, { level: 0 }), pageCount: pages.length };
}

export async function downloadMangaChapter(
  req: MangaDownloadRequest,
  dest: string,
  onProgress: (p: { done: number; total: number }) => void,
  signal?: AbortSignal,
): Promise<number> {
  const { zipped, pageCount } = await buildMangaChapterCbz(req, onProgress, signal);
  fs.writeFileSync(dest, zipped);
  return pageCount;
}
