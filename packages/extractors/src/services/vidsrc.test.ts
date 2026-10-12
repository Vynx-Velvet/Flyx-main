import { afterEach, describe, expect, it, vi } from "vitest";
import { extractVidSrc, validatePlayerUrl } from "./vidsrc";

afterEach(() => vi.unstubAllGlobals());

describe("VidSrc player bootstrap", () => {
  it.each([ ["movie", undefined, undefined], ["tv", 2, 3] ] as const)(
    "uses a freshly issued API token for %s and preserves episode selection",
    async (type, season, episode) => {
      let issued = 0;
      const fetchMock = vi.fn(async (input: string | URL) => {
        const url = new URL(input);
        if (url.pathname === "/vs_src.php") {
          expect(url.origin).toBe("https://vidsrc.sh");
          return Response.json({ src: "https://cloudorchestranova.com/embed/movie/550?vs=gate" });
        }
        if (url.pathname === "/embed/movie/550") {
          return new Response('window.CFG = {"playerUrl":"/embed/player/movie/550?vs=inner"};');
        }
        if (url.pathname === "/embed/player/movie/550") {
          issued++;
          return new Response(`window.CONFIG = ${JSON.stringify({ api: `https://data.vidsrc.sh/api.php?type=${type}&tmdb=550`, apiToken: `fresh-${issued}` })};`);
        }
        expect(url.origin).toBe("https://data.vidsrc.sh");
        expect(url.searchParams.get("api_token")).toBe(`fresh-${issued}`);
        expect(url.searchParams.has("stream_urls")).toBe(true);
        if (type === "tv") {
          expect(url.searchParams.get("season")).toBe("2");
          expect(url.searchParams.get("episode")).toBe("3");
        }
        return Response.json({ status_code: "200", data: { stream_urls: ["https://cdn.example/master.m3u8"] } });
      });
      vi.stubGlobal("fetch", fetchMock);
      for (let i = 0; i < 2; i++) {
        const result = await extractVidSrc(550, type, season, episode);
        expect(result.sources).toHaveLength(1);
        expect(result.sources[0]).toMatchObject({ requiresSegmentProxy: true, referer: "https://cloudorchestranova.com/" });
      }
      expect(issued).toBe(2);
    },
  );

  it("follows a rotated player host and uses it as the stream referer", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(input);
      if (url.pathname === "/vs_src.php") {
        return Response.json({ src: "https://stellarconductornexus.com/embed/movie/550?vs=gate" });
      }
      if (url.pathname === "/embed/movie/550") {
        expect(url.origin).toBe("https://stellarconductornexus.com");
        return new Response('window.CFG = {"playerUrl":"/embed/player/movie/550?vs=inner"};');
      }
      if (url.pathname === "/embed/player/movie/550") {
        expect(url.origin).toBe("https://stellarconductornexus.com");
        return new Response(`window.CONFIG = ${JSON.stringify({ api: "https://data.vidsrc.sh/api.php?type=movie&tmdb=550", apiToken: "t" })};`);
      }
      expect(new Headers(init?.headers).get("referer")).toBe("https://stellarconductornexus.com/");
      return Response.json({ status_code: "200", data: { stream_urls: ["https://cdn.example/master.m3u8"] } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await extractVidSrc(550);
    expect(result.sources[0]).toMatchObject({
      referer: "https://stellarconductornexus.com/",
      origin: "https://stellarconductornexus.com",
    });
  });

  it.each([
    "http://stellarconductornexus.com/embed/movie/550",
    "https://127.0.0.1/embed/movie/550",
    "https://[::1]/embed/movie/550",
    "https://localhost/embed/movie/550",
    "https://router.local/embed/movie/550",
    "https://intranet/embed/movie/550",
    "https://player.example:8443/embed/movie/550",
    "https://user:pw@player.example/embed/movie/550",
    "https://player.example/admin",
  ])("rejects %s as a player URL without fetching it", async (src) => {
    expect(() => validatePlayerUrl(src)).toThrow("Unexpected VidSrc player URL");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ src }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await extractVidSrc(550)).sources).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("pins later hops to the first player origin", () => {
    const pinned = "https://stellarconductornexus.com";
    expect(validatePlayerUrl("/embed/player/movie/550?vs=x", pinned).origin).toBe(pinned);
    expect(() => validatePlayerUrl("https://other.example/embed/player/movie/550", pinned)).toThrow();
  });
});
