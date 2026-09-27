/**
 * Media proxy authorization — no live server needed: getSession is mocked
 * and upstream fetches are stubbed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const session = vi.hoisted(() => ({ current: null as null | { sub: string } }));
vi.mock("@/lib/auth/get-session", () => ({ getSession: async () => session.current }));
// Extractors aren't exercised here (and the "@flyx/extractors/services"
// alias is shadowed by "@flyx/extractors" in vitest.config).
vi.mock("@flyx/extractors/services", () => ({
  getTokenUrl: () => undefined,
  extractDLHD: async () => ({ sources: [] }),
  unwrapDLHDSegment: (b: Uint8Array) => b,
  looksLikeTS: () => true,
}));
vi.mock("@/lib/extraction", () => ({ pipeline: { extract: async () => ({ success: false, sources: [] }) } }));

import { GET as proxyGET } from "./route";
import { GET as livetvPlaylistGET } from "../../livetv/playlist/route";
import { GET as livetvSegmentGET } from "../../livetv/segment/route";
import { GET as subtitlesGET } from "../../subtitles/proxy/route";
import { GET as mangaImageGET } from "../../manga/image/route";
import { GET as vlcGET } from "../vlc/route";
import { GET as tmdbGET } from "../../tmdb/route";
import { signProxyUrl } from "@/lib/security/proxy-sign";

const HOST = "http://127.0.0.1:3891";
const req = (path: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest(new URL(path, HOST), init);

// 93.184.215.34 is a public literal IP: assertPublicUrl skips DNS for it.
const CDN = "http://93.184.215.34";

describe("media proxy authorization", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-test-secret-test-secret";
    session.current = null;
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects every proxy without a session or signature (and never fetches)", async () => {
    const url = encodeURIComponent(`${CDN}/a.m3u8`);
    const routes: Array<[string, (r: NextRequest) => Promise<Response>]> = [
      [`/api/stream/proxy?url=${url}`, proxyGET],
      [`/api/livetv/playlist?url=${url}`, livetvPlaylistGET],
      [`/api/livetv/segment?url=${url}`, livetvSegmentGET],
      [`/api/subtitles/proxy?url=${encodeURIComponent("https://dl.opensubtitles.org/a.srt")}`, subtitlesGET],
      [`/api/manga/image?url=${encodeURIComponent("https://hot.planeptune.us/a.jpg")}`, mangaImageGET],
    ];
    for (const [path, handler] of routes) {
      const res = await handler(req(path));
      expect(res.status, path).toBe(401);
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a tampered or expired signature", async () => {
    const signed = signProxyUrl(`/api/stream/proxy?url=${encodeURIComponent(`${CDN}/a.ts`)}`);
    const tampered = signed.replace("a.ts", "b.ts");
    expect((await proxyGET(req(tampered))).status).toBe(401);
    const expired = signProxyUrl(`/api/stream/proxy?url=${encodeURIComponent(`${CDN}/a.ts`)}`, -5);
    expect((await proxyGET(req(expired))).status).toBe(401);
  });

  it("accepts a valid signature, rewrites the playlist with signed URIs, signed-only CORS", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",URI="audio.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=1\nv/index.m3u8\n',
        { status: 200, headers: { "content-type": "text/html" } },
      ),
    );
    const res = await proxyGET(req(signProxyUrl(`/api/stream/proxy?url=${encodeURIComponent(`${CDN}/m.m3u8`)}`)));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/vnd.apple.mpegurl");
    // Signature-authorized (Chromecast receiver) → readable cross-origin.
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
    const text = await res.text();
    const uris = [...text.matchAll(/(?:URI="|^)(\/api\/stream\/proxy\?[^"\n]+)/gm)].map((m) => m[1]!);
    expect(uris).toHaveLength(2);
    // Each rewritten URI is independently valid for a cookie-less client.
    session.current = null;
    fetchSpy.mockImplementation(async () => new Response("x", { status: 200, headers: { "content-type": "video/mp2t" } }));
    for (const u of uris) {
      expect(new URL(u, HOST).searchParams.get("sig")).toBeTruthy();
      expect((await proxyGET(req(u))).status).not.toBe(401);
    }
  });

  it("serves a logged-in session and neutralises HTML content types", async () => {
    session.current = { sub: "u1" };
    fetchSpy.mockResolvedValueOnce(
      new Response("<script>alert(document.cookie)</script>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "set-cookie": "evil=1" },
      }),
    );
    const res = await proxyGET(req(`/api/stream/proxy?url=${encodeURIComponent(`${CDN}/x.ts`)}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toBe("sandbox; default-src 'none'");
    // Cookie-authorized responses must never be readable cross-origin.
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("refuses private/loopback upstreams even with a session", async () => {
    session.current = { sub: "u1" };
    for (const target of ["http://127.0.0.1:3891/api/settings", "http://169.254.169.254/latest", "file:///etc/passwd"]) {
      const res = await proxyGET(req(`/api/stream/proxy?url=${encodeURIComponent(target)}`));
      expect([400, 403]).toContain(res.status);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses a redirect onto a private address", async () => {
    session.current = { sub: "u1" };
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://10.0.0.1/admin" } }));
    const res = await proxyGET(req(`/api/stream/proxy?url=${encodeURIComponent(`${CDN}/r.ts`)}`));
    expect(res.status).toBe(403);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("/api/stream/vlc", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-test-secret-test-secret";
    session.current = null;
  });

  it("requires a session", async () => {
    const res = await vlcGET(req(`/api/stream/vlc?url=${encodeURIComponent("https://cdn.example/a.m3u8")}`));
    expect(res.status).toBe(401);
  });

  it("rejects newline / control-character / non-http URLs", async () => {
    session.current = { sub: "u1" };
    for (const bad of [
      "https://cdn.example/a.m3u8\nsmb://evil/share",
      "https://cdn.example/a.m3u8\r\n#EXTVLCOPT:x",
      "https://cdn.example/a b.m3u8",
      "smb://evil/share",
      "file:///etc/passwd",
      "/api/settings",
      "//evil.example/x",
    ]) {
      const res = await vlcGET(req(`/api/stream/vlc?url=${encodeURIComponent(bad)}`));
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
  });

  it("emits a single signed host-proxy entry", async () => {
    session.current = { sub: "u1" };
    const res = await vlcGET(
      req(`/api/stream/vlc?url=${encodeURIComponent("https://cdn.example/a.m3u8")}&title=${encodeURIComponent("T\n#EXTVLCOPT:x")}`),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    const entries = body.split("\n").filter((l) => l && !l.startsWith("#"));
    expect(entries).toHaveLength(1);
    const u = new URL(entries[0]!);
    expect(u.pathname).toBe("/api/stream/proxy");
    expect(u.searchParams.get("url")).toBe("https://cdn.example/a.m3u8");
    expect(u.searchParams.get("sig")).toBeTruthy();
    expect(body.split("\n").filter((l) => l.startsWith("#EXTVLCOPT")).every((l) => !l.includes(":x"))).toBe(true);
  });

  it("signs an already-proxied Live TV playlist path (json)", async () => {
    session.current = { sub: "u1" };
    const path = `/api/livetv/playlist?url=${encodeURIComponent("https://cdn.example/l.m3u8")}&origin=x`;
    const res = await vlcGET(req(`/api/stream/vlc?format=json&url=${encodeURIComponent(path)}`));
    const data = (await res.json()) as { ok: boolean; url: string };
    expect(data.ok).toBe(true);
    const u = new URL(data.url);
    expect(u.pathname).toBe("/api/livetv/playlist");
    expect(u.searchParams.get("sig")).toBeTruthy();
  });
});

describe("/api/tmdb", () => {
  beforeEach(() => {
    session.current = null;
    process.env.TMDB_API_KEY = "k";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("requires a session", async () => {
    expect((await tmdbGET(req(`/api/tmdb?path=${encodeURIComponent("/movie/550")}`))).status).toBe(401);
  });

  it("only forwards allowlisted paths", async () => {
    session.current = { sub: "u1" };
    const fetchSpy = vi.fn(async () => Response.json({ id: 1 }));
    vi.stubGlobal("fetch", fetchSpy);
    for (const bad of ["/account", "/authentication/token/new", "/movie/../account", "//evil.example/x", "/3/movie/1", "@evil.example"]) {
      expect((await tmdbGET(req(`/api/tmdb?path=${encodeURIComponent(bad)}`))).status, bad).toBe(400);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    const ok = await tmdbGET(req(`/api/tmdb?path=${encodeURIComponent("/search/multi?query=a%20b&page=1")}`));
    expect(ok.status).toBe(200);
    const called = new URL(String((fetchSpy.mock.calls[0] as unknown[])[0]));
    expect(called.origin + called.pathname).toBe("https://api.themoviedb.org/3/search/multi");
    expect(called.searchParams.get("query")).toBe("a b");
  });
});
