import { describe, it, expect } from "vitest";
import { deflateSync, gzipSync } from "node:zlib";
import {
  looksLikeTS,
  pngIendTS,
  pngPixelTS,
  unwrapDLHDSegment,
  webpExifTS,
} from "./dlhd-unwrap";

/** A fake transport stream: N packets of 188 bytes each starting with 0x47. */
function fakeTS(packets = 4): Uint8Array {
  const ts = new Uint8Array(packets * 188);
  for (let p = 0; p < packets; p++) {
    ts[p * 188] = 0x47;
    for (let i = 1; i < 188; i++) ts[p * 188 + i] = (p * 31 + i) & 0xff;
  }
  return ts;
}

function u32be(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}

function u32le(n: number): Uint8Array {
  return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

const asciiBytes = (s: string) => new Uint8Array(Buffer.from(s, "ascii"));

/** Minimal PNG chunk (CRC is not validated by the decoder, so it is zeroed). */
function chunk(type: string, data: Uint8Array): Uint8Array {
  return concat(u32be(data.length), asciiBytes(type), data, new Uint8Array(4));
}

const PNG_SIG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Encode packed RGB bytes as an 8-bit RGB PNG with a given per-row filter. */
function encodePNG(rgb: Uint8Array, w: number, h: number, filter: 0 | 1 | 2): Uint8Array {
  const stride = w * 3;
  const raw = new Uint8Array(h * (1 + stride));
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const row = rgb.subarray(y * stride, (y + 1) * stride);
    raw[y * (1 + stride)] = filter;
    const out = raw.subarray(y * (1 + stride) + 1, (y + 1) * (1 + stride));
    for (let i = 0; i < stride; i++) {
      const a = i >= 3 ? row[i - 3]! : 0;
      const b = prev[i]!;
      const pred = filter === 1 ? a : filter === 2 ? b : 0;
      out[i] = (row[i]! - pred) & 255;
    }
    prev = row;
  }
  const ihdr = concat(u32be(w), u32be(h), new Uint8Array([8, 2, 0, 0, 0]));
  return concat(PNG_SIG, chunk("IHDR", ihdr), chunk("IDAT", new Uint8Array(deflateSync(raw))), chunk("IEND", new Uint8Array(0)));
}

describe("looksLikeTS", () => {
  it("requires sync bytes at 0 and 188", () => {
    expect(looksLikeTS(fakeTS())).toBe(true);
    const bad = fakeTS();
    bad[188] = 0;
    expect(looksLikeTS(bad)).toBe(false);
    expect(looksLikeTS(new Uint8Array(10))).toBe(false);
  });
});

describe("unwrapDLHDSegment", () => {
  it("returns a plain transport stream untouched", () => {
    const ts = fakeTS();
    expect(unwrapDLHDSegment(ts)).toBe(ts);
  });

  it("extracts the TS from a WebP EXIF chunk", () => {
    const ts = fakeTS(3);
    const exif = concat(asciiBytes("EXIF"), u32le(ts.length), ts, new Uint8Array(ts.length & 1));
    const vp8 = concat(asciiBytes("VP8 "), u32le(4), new Uint8Array([1, 2, 3, 4]));
    const body = concat(vp8, exif);
    const webp = concat(asciiBytes("RIFF"), u32le(body.length + 4), asciiBytes("WEBP"), body);
    expect(webpExifTS(webp)).toEqual(ts);
    expect(unwrapDLHDSegment(webp)).toEqual(ts);
  });

  it("extracts a TS appended after the PNG IEND chunk", () => {
    const ts = fakeTS(2);
    const png = concat(encodePNG(new Uint8Array(3), 1, 1, 0), ts);
    expect(pngIendTS(png)).toEqual(ts);
    expect(unwrapDLHDSegment(png)).toEqual(ts);
  });

  it.each([0, 1, 2] as const)("decodes a gzip'd TS packed into PNG pixels (filter %i)", (filter) => {
    const ts = fakeTS(5);
    const gz = new Uint8Array(gzipSync(Buffer.from(ts)));
    const payload = concat(asciiBytes("TIKTIKPX"), u32be(gz.length), gz);
    const w = 16;
    const h = Math.ceil(payload.length / (w * 3));
    const rgb = new Uint8Array(w * h * 3);
    rgb.set(payload);
    const png = encodePNG(rgb, w, h, filter);
    expect(pngPixelTS(png)).toEqual(ts);
    expect(unwrapDLHDSegment(png)).toEqual(ts);
  });

  it("extracts a raw TS behind the TIKTIKRAW marker", () => {
    const ts = fakeTS(2);
    const blob = concat(new Uint8Array([9, 9, 9]), asciiBytes("TIKTIKRAW"), ts);
    expect(unwrapDLHDSegment(blob)).toEqual(ts);
  });

  it("gunzips a TS behind the TIKTIKTSGZ marker", () => {
    const ts = fakeTS(2);
    const blob = concat(asciiBytes("junk"), asciiBytes("TIKTIKTSGZ"), new Uint8Array(gzipSync(Buffer.from(ts))));
    expect(unwrapDLHDSegment(blob)).toEqual(ts);
  });

  it("falls back to scanning for aligned sync bytes", () => {
    const ts = fakeTS(3);
    const blob = concat(new Uint8Array([1, 2, 3, 4, 5]), ts);
    expect(unwrapDLHDSegment(blob)).toEqual(ts);
  });

  it("throws when a PNG carries no payload", () => {
    const png = encodePNG(new Uint8Array(3 * 4), 2, 2, 0);
    expect(() => unwrapDLHDSegment(png)).toThrow(/no TS payload/);
  });

  it("throws when nothing resembles a transport stream", () => {
    expect(() => unwrapDLHDSegment(new Uint8Array(400))).toThrow(/not found/);
  });
});
