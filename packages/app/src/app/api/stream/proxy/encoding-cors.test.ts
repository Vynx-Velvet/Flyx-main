/**
 * /api/stream/proxy URL decoding, signature-only CORS, the cast hand-off
 * (/api/stream/vlc?target=cast) and the /api/manga/image poster allowlist.
 * No live server: getSession is mocked and upstream fetches are stubbed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const session = vi.hoisted(() => ({ current: null as null | { sub: string } }));
vi.mock("@/lib/auth/get-session", () => ({ getSession: async () => session.current }));
vi.mock("@flyx/extractors/services", () => ({
  getTokenUrl: () => undefined,
  extractDLHD: async () => ({ sources: [] }),
  unwrapDLHDSegment: (b: Uint8Array) => b,
  looksLikeTS: () => true,
}));
vi.mock("@/lib/extraction", () => ({ pipeline: { extract: async () => ({ success: false, sources: [] }) } }));
const lan = vi.hoisted(() => ({
  ifaces: {} as Record<string, Array<{ address: string; family: string; internal: boolean }>>,
}));
// Hostnames resolve to a public address (assertPublicUrl pre-check).
vi.mock("node:dns/promises", () => {
  const lookup = async () => [{ address: "93.184.215.34", family: 4 }];
  return { lookup, default: { lookup } };
});
vi.mock("node:os", async (orig) => {
  const real = await orig<typeof import("node:os")>();
  const networkInterfaces = () => lan.ifaces;
  return { ...real, networkInterfaces, default: { ...real, networkInterfaces } };
});

import { GET as proxyGET, OPTIONS as proxyOPTIONS } from "./route";
import { OPTIONS as segmentOPTIONS } from "../../livetv/segment/route";
import { GET as subtitlesGET } from "../../subtitles/proxy/route";
import { GET as mangaImageGET } from "../../manga/image/route";
import { GET as vlcGET } from "../vlc/route";
import { signProxyUrl } from "@/lib/security/proxy-sign";

const HOST = "http://127.0.0.1:3891";
const req = (path: string, init?: ConstructorParameters<typeof NextRequest>[1], host = HOST) => {
  const r = new NextRequest(new URL(path, host), init);
  r.headers.set("host", new URL(host).host);
  return r;
};
// Public literal IP: assertPublicUrl/guardedLookup skip DNS for it.
const CDN = "http://93.184.215.34";

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

describe("/api/stream/proxy url decoding", () => {
  // %2B (encoded '+'), %25 (encoded '%'), a literal '+', and '&' in the query.
  const upstream = `${CDN}/v/seg%2Bone%25.ts?sig=a+b%2Bc&x=1&y=%26z`;

  it("fetches the upstream URL byte-for-byte (decoded exactly once)", async () => {
    session.current = { sub: "u1" };
    fetchSpy.mockResolvedValueOnce(new Response("x", { status: 200, headers: { "content-type": "video/mp2t" } }));
    const params = new URLSearchParams({ url: upstream });
    const res = await proxyGET(req(`/api/stream/proxy?${params}`));
    expect(res.status).toBe(200);
    expect(String(fetchSpy.mock.calls[0]![0])).toBe(upstream);
  });

  it("is also exact for encodeURIComponent producers", async () => {
    session.current = { sub: "u1" };
    fetchSpy.mockResolvedValueOnce(new Response("x", { status: 200, headers: { "content-type": "video/mp2t" } }));
    const other = `${upstream}&n=2`; // distinct URL: the first test's segment is cached
    await proxyGET(req(`/api/stream/proxy?url=${encodeURIComponent(other)}&referer=${encodeURIComponent("https://r.example/")}`));
    expect(String(fetchSpy.mock.calls[0]![0])).toBe(other);
  });

  it("round-trips through playlist rewriting", async () => {
    session.current = { sub: "u1" };
    fetchSpy.mockResolvedValueOnce(
      new Response(`#EXTM3U\n#EXTINF:4,\nseg%2Bone%25.ts?sig=a+b%2Bc&y=%26z\n`, { status: 200 }),
    );
    const res = await proxyGET(req(`/api/stream/proxy?${new URLSearchParams({ url: `${CDN}/v/index.m3u8` })}`));
    const line = (await res.text()).split("\n").find((l) => l.startsWith("/api/stream/proxy?"))!;
    fetchSpy.mockResolvedValueOnce(new Response("x", { status: 200, headers: { "content-type": "video/mp2t" } }));
    session.current = null; // the rewritten URI is signed
    expect((await proxyGET(req(line))).status).toBe(200);
    expect(String(fetchSpy.mock.calls[1]![0])).toBe(`${CDN}/v/seg%2Bone%25.ts?sig=a+b%2Bc&y=%26z`);
  });
});

describe("signature-only CORS", () => {
  const ok = () => new Response("x", { status: 200, headers: { "content-type": "video/mp2t" } });

  it("adds ACAO: * only when authorized by signature", async () => {
    fetchSpy.mockImplementation(async () => ok());
    const signed = signProxyUrl(`/api/stream/proxy?url=${encodeURIComponent(`${CDN}/a.ts`)}`);
    const viaSig = await proxyGET(req(signed));
    expect(viaSig.headers.get("access-control-allow-origin")).toBe("*");

    session.current = { sub: "u1" };
    const viaCookie = await proxyGET(req(`/api/stream/proxy?url=${encodeURIComponent(`${CDN}/b.ts`)}`));
    expect(viaCookie.status).toBe(200);
    expect(viaCookie.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("applies to the Live TV segment and subtitle proxies too", async () => {
    session.current = { sub: "u1" };
    fetchSpy.mockImplementation(async () => new Response("WEBVTT\n", { status: 200 }));
    const sub = `/api/subtitles/proxy?url=${encodeURIComponent("https://dl.opensubtitles.org/x.vtt")}`;
    expect((await subtitlesGET(req(sub))).headers.get("access-control-allow-origin")).toBeNull();
    session.current = null;
    const signedSub = await subtitlesGET(req(signProxyUrl(sub.replace("x.vtt", "y.vtt"))));
    expect(signedSub.status).toBe(200);
    expect(signedSub.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("answers OPTIONS preflight only for a valid signature", async () => {
    const signed = signProxyUrl(`/api/stream/proxy?url=${encodeURIComponent(`${CDN}/a.ts`)}`);
    const pre = proxyOPTIONS(req(signed, { method: "OPTIONS" }));
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe("*");
    expect(pre.headers.get("access-control-allow-headers")).toContain("Range");

    session.current = { sub: "u1" }; // a cookie never earns a preflight
    const unsigned = proxyOPTIONS(req(`/api/stream/proxy?url=${encodeURIComponent(`${CDN}/a.ts`)}`, { method: "OPTIONS" }));
    expect(unsigned.status).toBe(401);
    expect(unsigned.headers.get("access-control-allow-origin")).toBeNull();
    const tampered = segmentOPTIONS(req(signed.replace("a.ts", "b.ts").replace("/api/stream/proxy", "/api/livetv/segment"), { method: "OPTIONS" }));
    expect(tampered.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("/api/stream/vlc?target=cast", () => {
  const cast = (host?: string) =>
    vlcGET(req(`/api/stream/vlc?target=cast&url=${encodeURIComponent(`${CDN}/m.m3u8`)}&referer=${encodeURIComponent("https://r.example/")}`, undefined, host));

  beforeEach(() => {
    session.current = { sub: "u1" };
    lan.ifaces = {
      "vEthernet (WSL)": [{ address: "172.20.0.1", family: "IPv4", internal: false }],
      "Wi-Fi": [{ address: "192.168.1.50", family: "IPv4", internal: false }],
      Loopback: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
    };
  });
  afterEach(() => {
    delete process.env.HOSTNAME;
    delete process.env.PORT;
  });

  it("requires a session", async () => {
    session.current = null;
    expect((await cast()).status).toBe(401);
  });

  it("refuses with a clear message when bound to localhost only", async () => {
    process.env.HOSTNAME = "127.0.0.1";
    const res = await cast();
    expect(res.status).toBe(409);
    const data = (await res.json()) as { ok: boolean; code: string; error: string };
    expect(data.code).toBe("lan-sharing-off");
    expect(data.error).toBe("Turn on LAN sharing in Settings to cast");
  });

  it("mints a signed absolute LAN URL when LAN sharing is on", async () => {
    process.env.HOSTNAME = "0.0.0.0";
    const res = await cast();
    const data = (await res.json()) as { ok: boolean; url: string };
    expect(data.ok).toBe(true);
    const u = new URL(data.url);
    expect(u.origin).toBe("http://192.168.1.50:3891");
    expect(u.pathname).toBe("/api/stream/proxy");
    expect(u.searchParams.get("url")).toBe(`${CDN}/m.m3u8`);
    expect(u.searchParams.get("referer")).toBe("https://r.example/");
    expect(u.searchParams.get("sig")).toBeTruthy();
  });

  it("uses the LAN address the viewer already reached us at", async () => {
    const res = await cast("http://192.168.1.77:3891");
    const data = (await res.json()) as { url: string };
    expect(new URL(data.url).origin).toBe("http://192.168.1.77:3891");
  });
});

describe("/api/manga/image poster allowlist", () => {
  beforeEach(() => {
    session.current = { sub: "u1" };
  });

  it("allows the AnimeX poster CDN", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } }));
    // node:dns/promises is mocked to a public address — no network needed.
    const res = await mangaImageGET(req(`/api/manga/image?url=${encodeURIComponent("https://ytimgf.youtube-anime.com/images/a.jpg")}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
  });

  it("still rejects look-alike and unlisted hosts", async () => {
    for (const bad of [
      "https://evil.example/ytimgf.youtube-anime.com/a.jpg",
      "https://ytimgf.youtube-anime.com.evil.example/a.jpg",
      "https://wp.youtube-anime.com/a.jpg",
    ]) {
      const res = await mangaImageGET(req(`/api/manga/image?url=${encodeURIComponent(bad)}`));
      expect(res.status, bad).toBe(403);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
