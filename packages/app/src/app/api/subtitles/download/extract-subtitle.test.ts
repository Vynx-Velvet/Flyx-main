import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { deflateRawSync } from "node:zlib";
import { extractSubtitleFromZip, MAX_SUBTITLE_BYTES, SubtitleArchiveError } from "./extract-subtitle";

const SRT = "1\n00:00:01,000 --> 00:00:02,000\nHello\n";

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof SubtitleArchiveError ? err.code : `other:${(err as Error).message}`;
  }
  return undefined;
}

/**
 * Hand-built single-entry zip whose central directory can lie about the
 * uncompressed size (fflate always writes the truth).
 */
function lyingZip(name: string, payload: Uint8Array, declaredSize: number): Uint8Array {
  const data = new Uint8Array(deflateRawSync(payload, { level: 9 }));
  const nameBytes = Buffer.from(name, "utf8");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(declaredSize, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  const cdOffset = 30 + nameBytes.length + data.length;
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(declaredSize, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(0, 42);
  const cdSize = 46 + nameBytes.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  return new Uint8Array(Buffer.concat([local, nameBytes, data, central, nameBytes, eocd]));
}

describe("extractSubtitleFromZip", () => {
  it("extracts the .srt entry (deflated or stored) and prefers it over .vtt", () => {
    const zip = zipSync({
      "readme.nfo": strToU8("x"),
      "movie.vtt": strToU8("WEBVTT\n"),
      "movie.srt": strToU8(SRT),
    });
    const out = extractSubtitleFromZip(zip);
    expect(out.name).toBe("movie.srt");
    expect(Buffer.from(out.bytes).toString("utf8")).toBe(SRT);

    const stored = zipSync({ "a.vtt": strToU8("WEBVTT\n") }, { level: 0 });
    expect(Buffer.from(extractSubtitleFromZip(stored).bytes).toString()).toBe("WEBVTT\n");
  });

  it("does not inflate other entries (a bomb next to the subtitle is ignored)", () => {
    const bomb = new Uint8Array(64 * 1024 * 1024); // compresses to ~64 KB
    const zip = zipSync({ "huge.bin": bomb, "movie.srt": strToU8(SRT) }, { level: 1 });
    const t0 = Date.now();
    expect(extractSubtitleFromZip(zip).name).toBe("movie.srt");
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it("rejects an entry whose declared size is over the limit", () => {
    const zip = zipSync({ "big.srt": new Uint8Array(MAX_SUBTITLE_BYTES + 1) }, { level: 1 });
    expect(codeOf(() => extractSubtitleFromZip(zip))).toBe("too_large");
  });

  it("stops inflating an entry that lies about its size", () => {
    const zip = lyingZip("liar.srt", new Uint8Array(200 * 1024 * 1024), 100);
    const t0 = Date.now();
    expect(codeOf(() => extractSubtitleFromZip(zip))).toBe("too_large");
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it("reports archives without srt/vtt and garbage input", () => {
    expect(codeOf(() => extractSubtitleFromZip(zipSync({ "a.ass": strToU8("x") })))).toBe("unsupported_format");
    expect(codeOf(() => extractSubtitleFromZip(new Uint8Array(100)))).toBe("invalid_archive");
    expect(codeOf(() => extractSubtitleFromZip(new Uint8Array(0)))).toBe("invalid_archive");
  });
});
