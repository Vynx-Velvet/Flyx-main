import { describe, it, expect } from "vitest";
import { rewriteM3U8, proxySegmentUrl } from "./m3u8";

const sampleM3U8 = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:6.000,
segment-0.ts
#EXTINF:6.000,
segment-1.ts
#EXT-X-KEY:METHOD=AES-128,URI="key.bin"
#EXTINF:6.000,
segment-2.ts
#EXT-X-ENDLIST`;

const sampleM3U8WithMap = `#EXTM3U
#EXT-X-VERSION:7
#EXT-X-MAP:URI="init.mp4"
#EXTINF:4.000,
segment-0.m4s
#EXT-X-ENDLIST`;

describe("rewriteM3U8", () => {
  it("passes through unchanged when no config is provided", () => {
    const result = rewriteM3U8(sampleM3U8);
    expect(result).toBe(sampleM3U8);
  });

  it("resolves relative segment URIs with baseUrl", () => {
    const result = rewriteM3U8(sampleM3U8, {
      baseUrl: "https://cdn.example.com/stream/",
      resolveRelative: true,
    });

    expect(result).toContain("https://cdn.example.com/stream/segment-0.ts");
    expect(result).toContain("https://cdn.example.com/stream/segment-1.ts");
  });

  it("applies segment transformer to each segment", () => {
    const transformer = (url: string, index: number) => `/proxy?seg=${index}&url=${encodeURIComponent(url)}`;
    const result = rewriteM3U8(sampleM3U8, {
      baseUrl: "https://cdn.example.com/",
      resolveRelative: true,
      segmentTransformer: transformer,
    });

    expect(result).toContain("/proxy?seg=0&url=");
    expect(result).toContain("/proxy?seg=1&url=");
    expect(result).toContain("/proxy?seg=2&url=");
  });

  it("rewrites EXT-X-KEY URIs", () => {
    const keyTransformer = (url: string) => `/proxy/keys?url=${encodeURIComponent(url)}`;
    const result = rewriteM3U8(sampleM3U8, {
      resolveRelative: true,
      baseUrl: "https://cdn.example.com/",
      keyTransformer,
    });

    expect(result).toContain('URI="/proxy/keys?url=');
  });

  it("rewrites EXT-X-MAP URIs when rewriteMap is enabled", () => {
    const result = rewriteM3U8(sampleM3U8WithMap, {
      rewriteMap: true,
      baseUrl: "https://cdn.example.com/",
      resolveRelative: true,
      segmentTransformer: (url) => `/proxy?url=${encodeURIComponent(url)}`,
    });

    expect(result).toContain('URI="/proxy?url=');
  });
});

describe("proxySegmentUrl", () => {
  it("builds a proxy URL for a segment", () => {
    const result = proxySegmentUrl("https://cdn.com/seg.ts", "/api/segment-proxy");
    expect(result).toBe("/api/segment-proxy?url=https%3A%2F%2Fcdn.com%2Fseg.ts");
  });

  it("includes channel ID when provided", () => {
    const result = proxySegmentUrl("https://cdn.com/seg.ts", "/api/segment-proxy", "bbc-one");
    expect(result).toContain("channel=bbc-one");
  });
});
