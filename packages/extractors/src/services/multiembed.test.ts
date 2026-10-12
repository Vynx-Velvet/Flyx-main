import { createCipheriv, createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decodeXpsSources, looksLikeMediaSegment, parseServersFromEmbed, probeHlsSource, probePlayable } from "./multiembed";

const MASTER = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000\n720/index.m3u8\n";
const MEDIA = "#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6,\nseg-1.ts\n#EXTINF:6,\nseg-2.ts\n";
const TS = new Uint8Array([0x47, 0x40, 0x11, 0x10, ...new Array(12).fill(0)]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(8).fill(0)]);

/** Fake CDN: master → 720/index.m3u8 → seg-1.ts, with a configurable segment answer. */
function cdn(segment: () => Response, media = MEDIA) {
  const seen: { url: string; headers: Headers }[] = [];
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    seen.push({ url, headers: new Headers(init?.headers) });
    if (url.endsWith("/master.m3u8")) return new Response(MASTER);
    if (url.endsWith("/720/index.m3u8")) return new Response(media);
    if (url.endsWith("/720/seg-1.ts")) return segment();
    return new Response("nope", { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, seen };
}

const source = { url: "https://cdn.example/v/master.m3u8", quality: "Auto", type: "hls" as const, referer: "https://play.xpass.top/" };

describe("MultiEmbed playability probe", () => {
  it("recognizes TS, ID3 and fMP4 segment heads, and rejects PNG/HTML/JSON wrappers", () => {
    expect(looksLikeMediaSegment(TS)).toBe(true);
    expect(looksLikeMediaSegment(new Uint8Array([0x49, 0x44, 0x33, 4]))).toBe(true);
    expect(looksLikeMediaSegment(new TextEncoder().encode("\0\0\0\x18styp"))).toBe(true);
    expect(looksLikeMediaSegment(PNG)).toBe(false);
    expect(looksLikeMediaSegment(new TextEncoder().encode("<html>"))).toBe(false);
    expect(looksLikeMediaSegment(new TextEncoder().encode('{"error":1}'))).toBe(false);
  });

  it("follows master → variant → first segment with the source's referer", async () => {
    const { fetchImpl, seen } = cdn(() => new Response(TS, { status: 206 }));
    expect(await probeHlsSource(source, fetchImpl)).toBe(true);
    expect(seen.map((s) => s.url)).toEqual([
      "https://cdn.example/v/master.m3u8",
      "https://cdn.example/v/720/index.m3u8",
      "https://cdn.example/v/720/seg-1.ts",
    ]);
    expect(seen.every((s) => s.headers.get("referer") === "https://play.xpass.top/")).toBe(true);
    expect(seen[2]!.headers.get("range")).toBe("bytes=0-1023");
  });

  it("drops a server whose playlist works but whose segments are refused or PNG-wrapped", async () => {
    expect(await probeHlsSource(source, cdn(() => new Response('{"error":"forbidden"}', { status: 403 })).fetchImpl)).toBe(false);
    expect(await probeHlsSource(source, cdn(() => new Response(PNG, { status: 206 })).fetchImpl)).toBe(false);
  });

  it("drops a server whose playlist is not HLS or fails", async () => {
    const html = (async () => new Response("<html>502</html>", { status: 200 })) as unknown as typeof fetch;
    const dead = (async () => new Response("", { status: 502 })) as unknown as typeof fetch;
    const unreachable = (async () => {
      throw new Error("aborted");
    }) as unknown as typeof fetch;
    expect(await probeHlsSource(source, html)).toBe(false);
    expect(await probeHlsSource(source, dead)).toBe(false);
    expect(await probeHlsSource(source, unreachable)).toBe(false);
  });

  it("stops waiting on hung servers shortly after one proves playable", async () => {
    const good = cdn(() => new Response(TS, { status: 206 })).fetchImpl;
    const fetchImpl = ((input: string | URL, init?: RequestInit) => {
      if (String(input).includes("hung.example")) {
        // Never answers — only the abort ends it.
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        });
      }
      return good(input, init);
    }) as typeof fetch;
    const started = Date.now();
    const verdicts = await probePlayable(
      [{ ...source, url: "https://hung.example/master.m3u8" }, source, { ...source, type: "mp4" as const }],
      fetchImpl,
      50,
    );
    expect(verdicts).toEqual([false, true, true]);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("accepts any 2xx segment when the playlist is encrypted (ciphertext can't be sniffed)", async () => {
    const encrypted = MEDIA.replace("#EXT-X-TARGETDURATION:6\n", '#EXT-X-TARGETDURATION:6\n#EXT-X-KEY:METHOD=AES-128,URI="k.key"\n');
    expect(await probeHlsSource(source, cdn(() => new Response(PNG, { status: 200 }), encrypted).fetchImpl)).toBe(true);
  });
});

describe("MultiEmbed server changes", () => {
  it("recognizes current servers without turning Vsrc into a Swish hash", () => {
    const servers = parseServersFromEmbed(`
      <a onclick="go('https://vidsrc.buzz/embed/tv/1396/2/3')">Vsrc</a>
      <a onclick="go('https://videm.xyz/embed/tv/1396/2/3')">Videm</a>
      <a onclick="go('https://streamsrcs.2embed.cc/vcr-tv?tmdb=1396&s=2&e=3')">Vcr</a>
      <iframe data-src="https://vidsrc.buzz/embed/tv/1396/2/3"></iframe>
    `);
    expect(servers.map((s) => s.type)).toEqual(["vsrc", "videm", "vcr"]);
    expect(servers[0]?.url).toBe("https://vidsrc.buzz/embed/tv/1396/2/3");
    expect(parseServersFromEmbed('<iframe data-src="https://unknown.example/player"></iframe>')).toEqual([]);
  });

  it("authenticates and decodes the dynamic XPS list; rejects a wrong token", () => {
    const url = new URL("https://play.xpass.top/data/movie/550?token=fixture.signature");
    const key = createHash("sha256").update(`spv3-data-response|spv3-build-1787821613-50e5fc97c9dce367|${url.pathname}|fixture.signature`).digest();
    const iv = Buffer.alloc(12, 7);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const servers = [{ name: "TIK 1", url: "/mdata/movie/playlist.json" }];
    const payload = Buffer.concat([iv, cipher.update(JSON.stringify(servers)), cipher.final(), cipher.getAuthTag()]).toString("base64url");
    expect(decodeXpsSources(payload, url)).toEqual(servers);
    url.searchParams.set("token", "wrong.signature");
    expect(() => decodeXpsSources(payload, url)).toThrow();
    expect(() => decodeXpsSources("short", url)).toThrow(/Truncated/);
  });
});
