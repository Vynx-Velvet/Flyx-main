/**
 * DLHD segment unwrapping.
 *
 * Since Sept 2026 the DLHD player no longer serves MPEG-TS segments directly.
 * Each playlist entry points at an *image* on a public CDN (TikTok's, at the
 * time of writing) and the player decodes the transport stream out of it in
 * the browser. Four wrappers are in use; this module reverses all of them,
 * mirroring the player's own `unwrap()`:
 *
 *   1. WebP  — the TS sits in an `EXIF` RIFF chunk.
 *   2. PNG   — the TS is appended raw after the `IEND` chunk ("goat" layout).
 *   3. PNG   — the TS is gzip'd and packed into the RGB pixel bytes, prefixed
 *              with the ASCII marker `TIKTIKPX` + big-endian length.
 *   4. Blob  — an ASCII marker `TIKTIKRAW` (raw TS follows) or `TIKTIKTSGZ`
 *              (gzip'd TS follows) somewhere in the body.
 *
 * As a last resort we scan for a 188-byte-aligned pair of MPEG-TS sync bytes.
 * Pure Node (zlib only) so it can be unit-tested with synthetic wrappers.
 */

import { gunzipSync, inflateSync } from "node:zlib";

const TS_SYNC = 0x47;
const TS_PACKET = 188;

const MARK_TSGZ = Buffer.from("TIKTIKTSGZ", "ascii");
const MARK_RAW = Buffer.from("TIKTIKRAW", "ascii");
const MARK_PIX = Buffer.from("TIKTIKPX", "ascii");

/** True when `bytes` already starts like an MPEG-TS stream. */
export function looksLikeTS(bytes: Uint8Array): boolean {
  return (
    bytes.length > TS_PACKET &&
    bytes[0] === TS_SYNC &&
    bytes[TS_PACKET] === TS_SYNC
  );
}

function ascii(bytes: Uint8Array, off: number, n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += String.fromCharCode(bytes[off + i]!);
  return s;
}

function dataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** WebP: TS carried in the EXIF chunk. */
export function webpExifTS(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 16) return null;
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return null;
  const dv = dataView(bytes);
  let off = 12;
  while (off + 8 <= bytes.length) {
    const tag = ascii(bytes, off, 4);
    const n = dv.getUint32(off + 4, true);
    off += 8;
    if (off + n > bytes.length) return null;
    if (tag === "EXIF") {
      const data = bytes.subarray(off, off + n);
      return looksLikeTS(data) ? data : null;
    }
    off += n + (n & 1);
  }
  return null;
}

function isPNG(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50;
}

/** PNG: TS appended after the IEND chunk. */
export function pngIendTS(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 16 || !isPNG(bytes)) return null;
  const dv = dataView(bytes);
  let off = 8;
  while (off + 8 <= bytes.length) {
    const len = dv.getUint32(off);
    if (len > bytes.length - off - 12) return null;
    const type = ascii(bytes, off + 4, 4);
    off += 8 + len + 4;
    if (type === "IEND") {
      const tail = bytes.subarray(off);
      return looksLikeTS(tail) ? tail : null;
    }
  }
  return null;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Decode an 8-bit RGB / RGBA non-interlaced PNG to packed RGB bytes.
 * Returns null for any other PNG flavour (the wrapper never uses them).
 */
export function pngRGB(bytes: Uint8Array): Uint8Array | null {
  if (!isPNG(bytes)) return null;
  const dv = dataView(bytes);
  let off = 8;
  let w = 0;
  let h = 0;
  let depth = 0;
  let ctype = 0;
  let interlace = 0;
  const idats: Uint8Array[] = [];
  while (off + 8 <= bytes.length) {
    const len = dv.getUint32(off);
    if (len > bytes.length - off - 12) return null;
    const type = ascii(bytes, off + 4, 4);
    const data = bytes.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      const hd = dataView(data);
      w = hd.getUint32(0);
      h = hd.getUint32(4);
      depth = data[8]!;
      ctype = data[9]!;
      interlace = data[12]!;
    } else if (type === "IDAT") {
      idats.push(data);
    } else if (type === "IEND") {
      break;
    }
    off += 12 + len;
  }
  if (!w || !h || depth !== 8 || interlace || (ctype !== 2 && ctype !== 6)) return null;

  const raw = inflateSync(Buffer.concat(idats.map((d) => Buffer.from(d.buffer, d.byteOffset, d.byteLength))));
  const bpp = ctype === 6 ? 4 : 3;
  const stride = w * bpp;
  const rgb = new Uint8Array(w * h * 3);
  let src = 0;
  let dst = 0;
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    if (src + 1 + stride > raw.length) return null;
    const filter = raw[src++]!;
    const row = raw.subarray(src, src + stride);
    src += stride;
    const recon = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? recon[i - bpp]! : 0;
      const b = prev[i]!;
      const c = i >= bpp ? prev[i - bpp]! : 0;
      let v = row[i]!;
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      else if (filter !== 0) return null;
      recon[i] = v & 255;
    }
    if (ctype === 2) {
      rgb.set(recon, dst);
      dst += stride;
    } else {
      for (let i = 0; i < stride; i += 4) {
        rgb[dst++] = recon[i]!;
        rgb[dst++] = recon[i + 1]!;
        rgb[dst++] = recon[i + 2]!;
      }
    }
    prev = recon;
  }
  return rgb;
}

/** PNG: gzip'd TS packed into pixel bytes behind the TIKTIKPX marker. */
export function pngPixelTS(bytes: Uint8Array): Uint8Array | null {
  const rgb = pngRGB(bytes);
  if (!rgb || rgb.length < 12) return null;
  for (let k = 0; k < MARK_PIX.length; k++) if (rgb[k] !== MARK_PIX[k]) return null;
  const n = dataView(rgb).getUint32(8);
  if (n <= 0 || 12 + n > rgb.length) return null;
  const gz = rgb.subarray(12, 12 + n);
  if (gz.length < 2 || gz[0] !== 0x1f || gz[1] !== 0x8b) return null;
  const ts = new Uint8Array(gunzipSync(Buffer.from(gz.buffer, gz.byteOffset, gz.byteLength)));
  return ts.length && ts[0] === TS_SYNC ? ts : null;
}

function indexOfMarker(bytes: Uint8Array, marker: Buffer): number {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).indexOf(marker);
}

/**
 * Recover the MPEG-TS payload from a DLHD segment body. Returns the input
 * untouched when it is already a transport stream. Throws when no payload
 * can be found (the caller should treat that as an upstream error).
 */
export function unwrapDLHDSegment(input: Uint8Array): Uint8Array {
  const bytes = input;
  if (looksLikeTS(bytes)) return bytes;

  const fromWebp = webpExifTS(bytes);
  if (fromWebp) return fromWebp;

  const fromIend = pngIendTS(bytes);
  if (fromIend) return fromIend;

  if (isPNG(bytes)) {
    const px = pngPixelTS(bytes);
    if (px) return px;
    throw new Error("DLHD segment: PNG carries no TS payload");
  }

  const rawAt = indexOfMarker(bytes, MARK_RAW);
  if (rawAt >= 0) {
    const ts = bytes.subarray(rawAt + MARK_RAW.length);
    if (ts.length && ts[0] === TS_SYNC) return ts;
  }

  const gzAt = indexOfMarker(bytes, MARK_TSGZ);
  if (gzAt >= 0) {
    const gz = bytes.subarray(gzAt + MARK_TSGZ.length);
    return new Uint8Array(gunzipSync(Buffer.from(gz.buffer, gz.byteOffset, gz.byteLength)));
  }

  for (let i = 0; i + TS_PACKET < bytes.length; i++) {
    if (bytes[i] === TS_SYNC && bytes[i + TS_PACKET] === TS_SYNC) return bytes.subarray(i);
  }

  throw new Error("DLHD segment: TS payload not found");
}
