/**
 * Pull one subtitle file out of an (untrusted) zip archive without inflating
 * anything else.
 *
 * The archive comes from a third-party CDN through a public route, so this
 * reads the central directory first, picks the first .srt (else .vtt) entry,
 * rejects it if its declared size is over the limit, and inflates *only that
 * entry* with a hard output cap — a zip bomb (or an entry that lies about its
 * size) fails fast instead of allocating gigabytes.
 */

import { inflateRawSync } from "node:zlib";

/** Largest subtitle file we will extract. */
export const MAX_SUBTITLE_BYTES = 10 * 1024 * 1024;

/** Extensions the browser's native <track> can render (after SRT → VTT). */
const PICK_ORDER = [/\.srt$/i, /\.vtt$/i];

export class SubtitleArchiveError extends Error {
  constructor(
    readonly code: "invalid_archive" | "unsupported_format" | "too_large",
    message: string,
  ) {
    super(message);
    this.name = "SubtitleArchiveError";
  }
}

interface ZipEntry {
  name: string;
  method: number;
  flags: number;
  compressedSize: number;
  size: number;
  localOffset: number;
}

function u16(b: Uint8Array, o: number): number {
  return b[o]! | (b[o + 1]! << 8);
}

function u32(b: Uint8Array, o: number): number {
  return (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16)) + b[o + 3]! * 0x1000000;
}

function listEntries(zip: Uint8Array): ZipEntry[] {
  const bad = (why: string) => new SubtitleArchiveError("invalid_archive", why);
  // End-of-central-directory record: last 22 bytes + up to 64 KB comment.
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0 && i >= zip.length - 22 - 0xffff; i--) {
    if (u32(zip, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw bad("no end of central directory");
  const count = u16(zip, eocd + 10);
  const cdOffset = u32(zip, eocd + 16);
  if (cdOffset === 0xffffffff || count === 0xffff) throw bad("zip64 archives are not supported");
  if (count > 1000) throw bad("too many entries");

  const entries: ZipEntry[] = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > zip.length || u32(zip, p) !== 0x02014b50) throw bad("corrupt central directory");
    const flags = u16(zip, p + 8);
    const nameLen = u16(zip, p + 28);
    const extraLen = u16(zip, p + 30);
    const commentLen = u16(zip, p + 32);
    if (p + 46 + nameLen > zip.length) throw bad("corrupt central directory");
    const nameBytes = zip.subarray(p + 46, p + 46 + nameLen);
    entries.push({
      name: Buffer.from(nameBytes).toString(flags & 0x800 ? "utf8" : "latin1"),
      method: u16(zip, p + 10),
      flags,
      compressedSize: u32(zip, p + 20),
      size: u32(zip, p + 24),
      localOffset: u32(zip, p + 42),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readEntry(zip: Uint8Array, e: ZipEntry, maxBytes: number): Uint8Array {
  const bad = (why: string) => new SubtitleArchiveError("invalid_archive", why);
  if (e.flags & 0x1) throw bad("encrypted entry");
  const lh = e.localOffset;
  if (lh + 30 > zip.length || u32(zip, lh) !== 0x04034b50) throw bad("corrupt local header");
  const start = lh + 30 + u16(zip, lh + 26) + u16(zip, lh + 28);
  const end = start + e.compressedSize;
  if (end > zip.length) throw bad("truncated entry");
  const data = zip.subarray(start, end);

  if (e.method === 0) {
    if (data.length > maxBytes) throw new SubtitleArchiveError("too_large", "subtitle too large");
    return data;
  }
  if (e.method !== 8) throw bad(`unsupported compression method ${e.method}`);
  try {
    // Never trust the declared size alone: cap the actual inflated output.
    return new Uint8Array(inflateRawSync(data, { maxOutputLength: maxBytes }));
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ERR_BUFFER_TOO_LARGE" || err instanceof RangeError) {
      throw new SubtitleArchiveError("too_large", "subtitle too large");
    }
    throw bad("corrupt deflate data");
  }
}

/**
 * Extract the preferred subtitle entry (.srt, else .vtt) from a zip.
 * Throws SubtitleArchiveError with a code the route maps to a response.
 */
export function extractSubtitleFromZip(
  zip: Uint8Array,
  maxBytes = MAX_SUBTITLE_BYTES,
): { name: string; bytes: Uint8Array } {
  const entries = listEntries(zip).filter((e) => !e.name.endsWith("/"));
  let pick: ZipEntry | undefined;
  for (const re of PICK_ORDER) {
    pick = entries.find((e) => re.test(e.name));
    if (pick) break;
  }
  if (!pick) {
    throw new SubtitleArchiveError(
      "unsupported_format",
      `zip has no srt/vtt (${entries.slice(0, 5).map((e) => e.name).join(", ")})`,
    );
  }
  if (pick.size > maxBytes) throw new SubtitleArchiveError("too_large", "subtitle too large");
  return { name: pick.name, bytes: readEntry(zip, pick, maxBytes) };
}
