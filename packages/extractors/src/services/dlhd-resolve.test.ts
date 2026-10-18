import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dlhdChannelSlug,
  extractDLHD,
  getDLHDPlaylistToken,
  probeDLHDEdge,
  resetDLHDStateForTests,
  withDLHDPlaylistToken,
} from "./dlhd";

const EDGE = "https://edge.cowedd4855ws.sbs";
const PLAYER = "https://dembed.st";
const PLAYLIST = "#EXTM3U\n#EXT-X-TARGETDURATION:7\n#EXTINF:6.0,\nhttps://cdn.example/seg1.png\n";

interface FakeOptions {
  /** Channels whose playlist is live on the edge (others 404). */
  live?: string[];
  /** Front domains answer (else every front request throws like a firewall drop). */
  front?: boolean;
  /** Edge host the player pages point at. */
  playerEdge?: string;
  /** Channel id → third-party iframe on the front's stream page. */
  embeds?: Record<string, string>;
  /** Edge refuses connections entirely. */
  edgeDown?: boolean;
}

/**
 * Upstream as of Oct 2026: tokens from {edge}/api/playlist-token (player
 * origin required, one channel per token), playlists need `t=`, front pages
 * embed the player, player pages carry `const SRC`.
 */
function fakeUpstream(opts: FakeOptions = {}) {
  const live = new Set(opts.live ?? ["51"]);
  const playerEdge = opts.playerEdge ?? EDGE;
  const issued = new Map<string, string>();
  let serial = 0;
  const calls: { url: string; headers: Headers }[] = [];
  const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    calls.push({ url: url.href, headers });
    const edgeOrigins = [EDGE, playerEdge];
    if (edgeOrigins.includes(url.origin)) {
      if (opts.edgeDown && url.origin === EDGE) throw new TypeError("fetch failed");
      if (url.pathname === "/api/playlist-token") {
        if (headers.get("origin") !== PLAYER) return new Response("forbidden", { status: 403 });
        const slug = url.searchParams.get("slug")!;
        const token = `tok-${slug}-${++serial}`;
        issued.set(slug, token);
        return Response.json({ token, ttl: 120 });
      }
      const m = url.pathname.match(/^\/(premium(\d+))\/index\.m3u8$/);
      if (m) {
        if (!url.searchParams.get("t")) return new Response("token required", { status: 403 });
        if (url.searchParams.get("t") !== issued.get(m[1]!)) return new Response("forbidden", { status: 403 });
        return live.has(m[2]!) ? new Response(PLAYLIST) : new Response("unknown channel", { status: 404 });
      }
      return new Response("nope", { status: 404 });
    }
    if (/^(dlhd\.st|dlive\.sx|dlstreams\.st|dlhd\.pk)$/.test(url.hostname)) {
      if (!opts.front) throw new TypeError("fetch failed: connect timeout");
      const id = url.pathname.match(/stream-(\d+)\.php/)?.[1] ?? "";
      const src = opts.embeds?.[id] ?? `${PLAYER}/premiumtv/daddy.php?id=${id}`;
      return new Response(`<iframe src="${src}" width="100%"></iframe>`);
    }
    if (url.origin === PLAYER && url.pathname === "/premiumtv/daddy.php") {
      const id = url.searchParams.get("id");
      return new Response(`<script>const SRC = "${playerEdge}/premium${id}/index.m3u8";</script>`);
    }
    throw new TypeError(`unexpected fetch ${url.href}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, issued };
}

beforeEach(() => {
  resetDLHDStateForTests();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DLHD playlist tokens", () => {
  it("only treats edge channel playlists as tokenized", () => {
    expect(dlhdChannelSlug(`${EDGE}/premium51/index.m3u8?_=1`)).toBe("premium51");
    expect(dlhdChannelSlug("https://cdn.example/premium51/seg.ts")).toBeNull();
    expect(dlhdChannelSlug("https://cdn.example/live/index.m3u8")).toBeNull();
    expect(dlhdChannelSlug("not a url")).toBeNull();
  });

  it("mints with the player origin, reuses the token, and sets t= on the URL", async () => {
    const { calls } = fakeUpstream();
    const url = await withDLHDPlaylistToken(`${EDGE}/premium51/index.m3u8?_=9`, PLAYER);
    expect(new URL(url).searchParams.get("t")).toBe("tok-premium51-1");
    expect(new URL(url).searchParams.get("_")).toBe("9");
    expect(await getDLHDPlaylistToken(`${EDGE}/premium51/index.m3u8`, PLAYER)).toBe("tok-premium51-1");
    const mints = calls.filter((c) => c.url.includes("/api/playlist-token"));
    expect(mints).toHaveLength(1);
    expect(mints[0]!.headers.get("origin")).toBe(PLAYER);
    expect(mints[0]!.headers.get("referer")).toBe(`${PLAYER}/`);
  });

  it("never sends the edge itself as the token origin, and forces a fresh token on demand", async () => {
    fakeUpstream();
    expect(await getDLHDPlaylistToken(`${EDGE}/premium51/index.m3u8`, EDGE)).toBe("tok-premium51-1");
    expect(await getDLHDPlaylistToken(`${EDGE}/premium51/index.m3u8`, PLAYER, { force: true })).toBe("tok-premium51-2");
  });

  it("leaves non-edge URLs untouched", async () => {
    const { calls } = fakeUpstream();
    expect(await withDLHDPlaylistToken("https://cdn.example/live/index.m3u8", PLAYER)).toBe(
      "https://cdn.example/live/index.m3u8",
    );
    expect(calls).toHaveLength(0);
  });
});

describe("DLHD resolution", () => {
  it("resolves on the built-in edge with a token, without touching the front or player", async () => {
    const { calls } = fakeUpstream({ live: ["51"] });
    const result = await extractDLHD("51");
    expect(result.sources[0]).toMatchObject({ url: `${EDGE}/premium51/index.m3u8`, origin: PLAYER, referer: PLAYER });
    expect(calls.every((c) => new URL(c.url).origin === EDGE)).toBe(true);
  });

  it("reports availability from the edge: live, off air (404)", async () => {
    fakeUpstream({ live: ["51"] });
    expect(await probeDLHDEdge("51")).toBe("online");
    expect(await probeDLHDEdge("41")).toBe("offline");
    expect(await probeDLHDEdge("abc")).toBeNull();
  });

  it("replaces a token the edge rejects", async () => {
    const { issued } = fakeUpstream({ live: ["51"] });
    expect(await probeDLHDEdge("51")).toBe("online");
    issued.set("premium51", "rotated-upstream"); // our cached token is now refused
    expect(await probeDLHDEdge("51")).toBe("online");
  });

  it("when the front is unreachable, resolves on the player host and learns a rotated edge", async () => {
    const NEW_EDGE = "https://edge.rotated.example";
    const { calls } = fakeUpstream({ live: ["51", "60"], edgeDown: true, playerEdge: NEW_EDGE });
    const first = await extractDLHD("51");
    expect(first.sources[0]).toMatchObject({ url: `${NEW_EDGE}/premium51/index.m3u8`, origin: PLAYER });
    const frontHits = () => calls.filter((c) => /dlhd\.st|dlive\.sx|dlstreams\.st|dlhd\.pk/.test(c.url)).length;
    expect(frontHits()).toBe(4);

    // Next channel: the learned edge answers directly; the dead front is not retried.
    const before = calls.length;
    const second = await extractDLHD("60");
    expect(second.sources[0]?.url).toBe(`${NEW_EDGE}/premium60/index.m3u8`);
    expect(frontHits()).toBe(4);
    expect(calls.slice(before).every((c) => new URL(c.url).origin === NEW_EDGE)).toBe(true);
  });

  it("calls a channel off air when the edge 404s and the front is unreachable", async () => {
    fakeUpstream({ live: ["51"] });
    expect(await extractDLHD("41")).toEqual({ sources: [], subtitles: [], reason: "offline" });
  });

  it("says unreachable — not off air — when nothing answers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));
    expect(await extractDLHD("51")).toEqual({ sources: [], subtitles: [], reason: "unreachable" });
  });

  it("calls a channel off air when the front's player points at the playlist the edge 404'd", async () => {
    fakeUpstream({ live: ["51"], front: true });
    expect(await extractDLHD("41")).toEqual({ sources: [], subtitles: [], reason: "offline" });
  });

  it("still spots third-party embeds through the front when it answers", async () => {
    fakeUpstream({ live: ["51"], front: true, embeds: { "48": "https://videocdn-4727.website/e/48" } });
    expect(await extractDLHD("48")).toMatchObject({
      sources: [],
      reason: "unsupported",
      unsupportedEmbed: "https://videocdn-4727.website",
    });
  });
});
