import { describe, expect, it } from "vitest";
import { isPublicHttpUrl, rewriteHlsPlaylist } from "./proxy";

describe("proxy URL validation", () => {
  it("allows public HTTP(S) URLs", () => {
    expect(isPublicHttpUrl("https://cdn.example/video/master.m3u8")).toBe(true);
  });

  it("rejects local and private-network targets", () => {
    expect(isPublicHttpUrl("http://localhost/admin")).toBe(false);
    expect(isPublicHttpUrl("http://127.0.0.1/admin")).toBe(false);
    expect(isPublicHttpUrl("http://192.168.1.10/video")).toBe(false);
    expect(isPublicHttpUrl("file:///etc/passwd")).toBe(false);
  });
});

describe("rewriteHlsPlaylist", () => {
  it("rewrites segment lines and URI attributes through the private proxy", () => {
    const result = rewriteHlsPlaylist(
      '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\nsegment-1.ts',
      "https://cdn.example/path/master.m3u8",
      "https://worker.example/private/proxy",
      { referer: "https://player.example/" },
    );

    expect(result).toContain(encodeURIComponent("https://cdn.example/path/key.bin"));
    expect(result).toContain(encodeURIComponent("https://cdn.example/path/segment-1.ts"));
    expect(result).toContain("referer=https%3A%2F%2Fplayer.example%2F");
  });
});
