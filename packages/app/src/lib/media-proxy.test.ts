import { describe, it, expect } from "vitest";
import {
  BoundedCache,
  guardStream,
  looksLikeM3u8,
  peekStream,
  rewriteHlsPlaylist,
  safeMediaContentType,
} from "./media-proxy";

const BASE = "https://cdn.example/hls/v1/master.m3u8?token=abc";
const tag = (abs: string) => `/p?url=${encodeURIComponent(abs)}&sig=S`;

function rewrite(text: string) {
  const seen: Array<{ url: string; kind: string; tag: string }> = [];
  const out = rewriteHlsPlaylist(text, BASE, (url, ctx) => {
    seen.push({ url, ...ctx });
    return tag(url);
  });
  return { out, seen };
}

describe("rewriteHlsPlaylist", () => {
  it("rewrites bare URI lines (relative, root-relative and absolute)", () => {
    const { out, seen } = rewrite(
      ["#EXTM3U", "#EXTINF:4,", "seg1.ts", "#EXTINF:4,", "/root/seg2.ts", "https://other.example/seg3.ts?x=%2B"].join("\n"),
    );
    expect(seen.map((s) => s.url)).toEqual([
      "https://cdn.example/hls/v1/seg1.ts",
      "https://cdn.example/root/seg2.ts",
      "https://other.example/seg3.ts?x=%2B", // absolute URLs are passed verbatim
    ]);
    expect(seen.every((s) => s.kind === "line")).toBe(true);
    expect(out.split("\n").filter((l) => !l.startsWith("#"))).toEqual(seen.map((s) => tag(s.url)));
  });

  it("rewrites URI= on every tag that carries one", () => {
    const tags = [
      '#EXT-X-KEY:METHOD=AES-128,URI="key.bin",IV=0x1',
      '#EXT-X-SESSION-KEY:METHOD=AES-128,URI="skey.bin"',
      '#EXT-X-MAP:URI="init.mp4",BYTERANGE="720@0"',
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",NAME="en",URI="audio/en.m3u8"',
      '#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=1,URI="iframe.m3u8"',
      '#EXT-X-PART:DURATION=1,URI="part1.mp4"',
      '#EXT-X-PRELOAD-HINT:TYPE=PART,URI="part2.mp4"',
      '#EXT-X-RENDITION-REPORT:URI="../v2/index.m3u8",LAST-MSN=3',
    ];
    const { out, seen } = rewrite(["#EXTM3U", ...tags].join("\n"));
    expect(seen.map((s) => s.tag)).toEqual([
      "EXT-X-KEY",
      "EXT-X-SESSION-KEY",
      "EXT-X-MAP",
      "EXT-X-MEDIA",
      "EXT-X-I-FRAME-STREAM-INF",
      "EXT-X-PART",
      "EXT-X-PRELOAD-HINT",
      "EXT-X-RENDITION-REPORT",
    ]);
    expect(seen.find((s) => s.tag === "EXT-X-RENDITION-REPORT")!.url).toBe("https://cdn.example/hls/v2/index.m3u8");
    // No upstream URI survives un-proxied; other attributes are preserved.
    for (const line of out.split("\n").slice(1)) {
      expect(line).toMatch(/URI="\/p\?url=https%3A%2F%2Fcdn\.example%2F[^"]+&sig=S"/);
    }
    expect(out).toContain('BYTERANGE="720@0"');
    expect(out).toContain("IV=0x1");
    expect(out).toContain('GROUP-ID="a"');
  });

  it("does not treat other *URI attributes as URI", () => {
    const { out, seen } = rewrite('#EXT-X-FOO:XURI="x",BAR=1');
    expect(seen).toEqual([]);
    expect(out).toBe('#EXT-X-FOO:XURI="x",BAR=1');
  });

  it("drops non-http(s) URIs; keeps data: only on EXT-X-KEY", () => {
    const { out, seen } = rewrite(
      [
        "#EXTM3U",
        '#EXT-X-KEY:METHOD=AES-128,URI="data:text/plain;base64,AAAAAAAAAAAAAAAAAAAAAA=="',
        '#EXT-X-MAP:URI="data:video/mp4;base64,AAAA"',
        '#EXT-X-MEDIA:TYPE=AUDIO,URI="file:///etc/passwd"',
        '#EXT-X-KEY:METHOD=AES-128,URI="file:///c:/key"',
        "file:///etc/passwd",
        "javascript:alert(1)",
        "smb://host/share/x.ts",
        "#EXTINF:4,",
        "ok.ts",
      ].join("\n"),
    );
    expect(seen.map((s) => s.url)).toEqual(["https://cdn.example/hls/v1/ok.ts"]);
    expect(out).toContain('URI="data:text/plain;base64,AAAAAAAAAAAAAAAAAAAAAA=="');
    expect(out).not.toMatch(/data:video|file:|javascript:|smb:/);
  });

  it("lets the builder drop entries and keeps plain tags/blank lines", () => {
    const out = rewriteHlsPlaylist("#EXTM3U\n\n#EXT-X-VERSION:3\nseg.ts", BASE, () => null);
    expect(out).toBe("#EXTM3U\n\n#EXT-X-VERSION:3");
  });
});

describe("safeMediaContentType", () => {
  it("passes media types through (without parameters)", () => {
    expect(safeMediaContentType("video/mp2t")).toBe("video/mp2t");
    expect(safeMediaContentType("video/MP4; codecs=avc1")).toBe("video/mp4");
    expect(safeMediaContentType("audio/aac")).toBe("audio/aac");
    expect(safeMediaContentType("application/vnd.apple.mpegurl")).toBe("application/vnd.apple.mpegurl");
    expect(safeMediaContentType("application/x-mpegURL")).toBe("application/x-mpegurl");
    expect(safeMediaContentType("text/vtt; charset=utf-8")).toBe("text/vtt");
    expect(safeMediaContentType("binary/octet-stream")).toBe("binary/octet-stream");
    expect(safeMediaContentType("image/png")).toBe("image/png");
  });

  it("maps anything renderable/scriptable to application/octet-stream", () => {
    for (const ct of [
      "text/html",
      "text/html; charset=utf-8",
      "application/xhtml+xml",
      "image/svg+xml",
      "text/xml",
      "application/xml",
      "application/javascript",
      "text/plain",
      "application/json",
      "",
      null,
      "video/mp4<script>",
    ]) {
      expect(safeMediaContentType(ct)).toBe("application/octet-stream");
    }
  });

  it("can refuse images", () => {
    expect(safeMediaContentType("image/png", { allowImages: false })).toBe("application/octet-stream");
  });
});

function streamOf(chunks: string[], delayMs = 0): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    async pull(c) {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      if (i < chunks.length) c.enqueue(enc.encode(chunks[i++]!));
      else c.close();
    },
  });
}

async function readAll(s: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(s).text();
}

describe("peekStream / guardStream", () => {
  it("peeks the head without losing any bytes", async () => {
    const { head, stream } = await peekStream(streamOf(["#EXTM3U\n", "a.ts\n", "b.ts\n"]), 4);
    expect(looksLikeM3u8(new TextDecoder().decode(head))).toBe(true);
    expect(await readAll(stream)).toBe("#EXTM3U\na.ts\nb.ts\n");
  });

  it("handles bodies shorter than the peek window", async () => {
    const { head, stream } = await peekStream(streamOf(["abc"]), 1024);
    expect(head.byteLength).toBe(3);
    expect(await readAll(stream)).toBe("abc");
  });

  it("errors a stalled upstream instead of hanging", async () => {
    const stalled = new ReadableStream<Uint8Array>({ pull: () => new Promise(() => {}) });
    await expect(readAll(guardStream(stalled, { idleMs: 30, totalMs: 10_000 }))).rejects.toThrow(/stalled/);
  });

  it("passes a healthy stream through", async () => {
    expect(await readAll(guardStream(streamOf(["a", "b"], 5), { idleMs: 1000, totalMs: 10_000 }))).toBe("ab");
  });
});

describe("BoundedCache", () => {
  it("evicts least-recently-used entries past the byte budget", () => {
    const c = new BoundedCache<Uint8Array>({ maxEntries: 10, maxBytes: 10, ttlMs: 60_000, sizeOf: (v) => v.byteLength });
    c.set("a", new Uint8Array(4));
    c.set("b", new Uint8Array(4));
    c.get("a"); // a is now most recent
    c.set("c", new Uint8Array(4));
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBeDefined();
    expect(c.totalBytes).toBeLessThanOrEqual(10);
    c.set("huge", new Uint8Array(11)); // larger than the whole budget: not stored
    expect(c.get("huge")).toBeUndefined();
  });

  it("bounds entry count and expires by TTL", async () => {
    const c = new BoundedCache<string>({ maxEntries: 2, ttlMs: 20 });
    c.set("a", "1");
    c.set("b", "2");
    c.set("c", "3");
    expect(c.size).toBe(2);
    expect(c.get("a")).toBeUndefined();
    await new Promise((r) => setTimeout(r, 30));
    expect(c.get("c")).toBeUndefined();
  });
});
