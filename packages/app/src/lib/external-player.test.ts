import { describe, it, expect } from "vitest";
import {
  androidIntentUrl,
  buildVlcPlaylist,
  handoffTitle,
  hostStreamUrl,
  iosCallbackUrl,
  normalizeExternalPlayerMode,
  pickLaunchStrategy,
  playlistFilename,
  vlcRouteQuery,
  vlcRouteUrl,
  validateHandoffUrl,
} from "./external-player";

describe("hostStreamUrl", () => {
  const origin = "http://192.168.1.5:3891";

  it("routes a raw CDN source through the host proxy with its headers", () => {
    const url = hostStreamUrl(origin, {
      url: "https://cdn.example/pl/abc/master.m3u8",
      referer: "https://embed.example/",
      origin: "https://embed.example",
    });
    const parsed = new URL(url);
    expect(parsed.origin).toBe(origin);
    expect(parsed.pathname).toBe("/api/stream/proxy");
    expect(parsed.searchParams.get("url")).toBe("https://cdn.example/pl/abc/master.m3u8");
    expect(parsed.searchParams.get("referer")).toBe("https://embed.example/");
    expect(parsed.searchParams.get("origin")).toBe("https://embed.example");
  });

  it("omits header params that are not set", () => {
    const url = hostStreamUrl(origin, { url: "https://cdn.example/v.mp4" });
    expect(url).toBe(`${origin}/api/stream/proxy?url=${encodeURIComponent("https://cdn.example/v.mp4")}`);
  });

  it("makes an already-proxied relative URL absolute without double wrapping", () => {
    const rel = "/api/stream/proxy?url=https%3A%2F%2Fcdn%2Fa.m3u8&referer=x";
    expect(hostStreamUrl(`${origin}/`, { url: rel })).toBe(`${origin}${rel}`);
  });

  it("leaves an absolute proxied URL untouched", () => {
    const abs = "http://localhost:3891/api/stream/proxy?url=https%3A%2F%2Fcdn%2Fa.m3u8";
    expect(hostStreamUrl(origin, { url: abs })).toBe(abs);
  });

  it("returns an empty string for an empty source", () => {
    expect(hostStreamUrl(origin, { url: "  " })).toBe("");
  });
});

describe("vlcRouteQuery / vlcRouteUrl", () => {
  it("serialises the title identity like the downloads stream route", () => {
    const q = new URLSearchParams(
      vlcRouteQuery(
        {
          tmdbId: 1399,
          mediaType: "tv",
          season: 1,
          episode: 4,
          malId: 21,
          title: "Show",
          provider: "videasy",
          quality: "1080p",
          language: "dub",
        },
        { startTime: 61.9, format: "json" },
      ),
    );
    expect(q.get("tmdbId")).toBe("1399");
    expect(q.get("mediaType")).toBe("tv");
    expect(q.get("season")).toBe("1");
    expect(q.get("episode")).toBe("4");
    expect(q.get("malId")).toBe("21");
    expect(q.get("title")).toBe("Show");
    expect(q.get("provider")).toBe("videasy");
    expect(q.get("quality")).toBe("1080p");
    expect(q.get("language")).toBe("dub");
    expect(q.get("t")).toBe("61");
    expect(q.get("format")).toBe("json");
  });

  it("drops zero start time and the default format", () => {
    const url = vlcRouteUrl({ tmdbId: 550, mediaType: "movie" });
    expect(url).toBe("/api/stream/vlc?tmdbId=550&mediaType=movie");
  });
});

describe("handoffTitle", () => {
  it("adds the episode label for TV", () => {
    expect(handoffTitle({ title: "Show", mediaType: "tv", season: 2, episode: 7 })).toBe(
      "Show — S2 E7",
    );
  });
  it("falls back to Flyx when untitled", () => {
    expect(handoffTitle({ title: "  " })).toBe("Flyx");
    expect(handoffTitle({ title: "Movie", mediaType: "movie" })).toBe("Movie");
  });
});

describe("buildVlcPlaylist", () => {
  it("emits an extended M3U with a resume position", () => {
    expect(
      buildVlcPlaylist({ title: "Show — S1 E1", url: "http://h/api/stream/proxy?url=x", startTime: 120.4 }),
    ).toBe(
      [
        "#EXTM3U",
        "#EXTINF:-1,Show — S1 E1",
        "#EXTVLCOPT:network-caching=3000",
        "#EXTVLCOPT:start-time=120",
        "http://h/api/stream/proxy?url=x",
        "",
      ].join("\n"),
    );
  });

  it("omits start-time at zero and strips newlines from the title", () => {
    const body = buildVlcPlaylist({ title: "A\r\nB", url: "http://h/x" });
    expect(body).not.toContain("start-time");
    expect(body).toContain("#EXTINF:-1,A B\n");
  });
});

describe("playlistFilename", () => {
  it("strips path-hostile characters and keeps the .m3u extension", () => {
    expect(playlistFilename('Show: "One" / Two?')).toBe("Show One Two.m3u");
    expect(playlistFilename("   ")).toBe("flyx-stream.m3u");
  });
});

describe("pickLaunchStrategy", () => {
  it("prefers the desktop bridge over any user agent", () => {
    expect(pickLaunchStrategy({ userAgent: "Android", hasDesktopBridge: true })).toBe("desktop");
  });
  it("detects Android and iOS devices", () => {
    expect(
      pickLaunchStrategy({ userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome", hasDesktopBridge: false }),
    ).toBe("android");
    expect(
      pickLaunchStrategy({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", hasDesktopBridge: false }),
    ).toBe("ios");
    expect(pickLaunchStrategy({ userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0)", hasDesktopBridge: false })).toBe(
      "ios",
    );
  });
  it("falls back to a playlist download elsewhere", () => {
    expect(pickLaunchStrategy({ userAgent: "Mozilla/5.0 (Windows NT 10.0) Firefox", hasDesktopBridge: false })).toBe(
      "playlist",
    );
  });
});

describe("androidIntentUrl / iosCallbackUrl", () => {
  it("targets the VLC package with the stream and a resume position", () => {
    const intent = androidIntentUrl("http://192.168.1.5:3891/api/stream/proxy?url=a", "Show", 12);
    expect(intent.startsWith("intent://192.168.1.5:3891/api/stream/proxy?url=a#Intent;")).toBe(true);
    expect(intent).toContain("scheme=http;");
    expect(intent).toContain("package=org.videolan.vlc;");
    expect(intent).toContain("S.title=Show;");
    expect(intent).toContain("l.position=12000;");
    expect(intent).toContain("S.browser_fallback_url=");
    expect(intent.endsWith(";end")).toBe(true);
  });

  it("uses the https scheme for https hosts and omits position at zero", () => {
    const intent = androidIntentUrl("https://flyx.example/api/stream/proxy?url=a", "T");
    expect(intent).toContain("scheme=https;");
    expect(intent).not.toContain("l.position");
  });

  it("builds the VLC iOS x-callback URL", () => {
    expect(iosCallbackUrl("http://h/x?y=1")).toBe(
      "vlc-x-callback://x-callback-url/stream?url=http%3A%2F%2Fh%2Fx%3Fy%3D1",
    );
  });
});

describe("normalizeExternalPlayerMode", () => {
  it("accepts the three modes and defaults everything else to manual", () => {
    expect(normalizeExternalPlayerMode("off")).toBe("off");
    expect(normalizeExternalPlayerMode("auto")).toBe("auto");
    expect(normalizeExternalPlayerMode("manual")).toBe("manual");
    expect(normalizeExternalPlayerMode(undefined)).toBe("manual");
    expect(normalizeExternalPlayerMode("vlc")).toBe("manual");
  });
});

describe("validateHandoffUrl", () => {
  it("accepts plain http(s) URLs and host proxy paths", () => {
    expect(validateHandoffUrl("https://cdn.example/a.m3u8?t=1")).toBe("https://cdn.example/a.m3u8?t=1");
    expect(validateHandoffUrl("/api/stream/proxy?url=x")).toBe("/api/stream/proxy?url=x");
    expect(validateHandoffUrl("/api/livetv/playlist?url=x")).toBe("/api/livetv/playlist?url=x");
  });

  it("rejects injection, other schemes and other local paths", () => {
    for (const bad of [
      "https://cdn.example/a.m3u8\nsmb://evil/share",
      "https://cdn.example/a\r#EXTVLCOPT:x",
      "https://cdn.example/a\u2028b",
      "https://cdn.example/a b",
      "smb://evil/share",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "https://user:pw@cdn.example/a",
      "/api/settings",
      "//evil.example/a",
      "",
      null,
    ]) {
      expect(validateHandoffUrl(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("buildVlcPlaylist injection guard", () => {
  it("keeps a hostile URL on one line", () => {
    const body = buildVlcPlaylist({ title: "T", url: "http://h/a\nsmb://evil/x" });
    const entries = body.split("\n").filter((l) => l && !l.startsWith("#"));
    expect(entries).toEqual(["http://h/a%0Asmb://evil/x"]);
  });
});
