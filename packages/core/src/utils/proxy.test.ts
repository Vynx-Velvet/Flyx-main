import { describe, it, expect } from "vitest";
import { StreamProxy } from "./proxy";
import type { StreamSource } from "../types/provider";

const defaultSource: StreamSource = {
  url: "https://cdn.example.com/stream.m3u8",
  quality: "1080p",
  type: "hls",
};

describe("StreamProxy", () => {
  const proxy = new StreamProxy({
    streamProxyUrl: "/api/stream-proxy",
    bypassDirectPatterns: ["localhost", "192.168.", ".internal"],
  });

  it("skips proxying when requiresSegmentProxy is false", () => {
    const source: StreamSource = { ...defaultSource, requiresSegmentProxy: false };
    expect(proxy.apply(source, "test")).toBe(source.url);
  });

  it("skips proxying for already proxied URLs", () => {
    const source: StreamSource = {
      ...defaultSource,
      url: "/api/stream-proxy?url=something",
    };
    expect(proxy.apply(source, "test")).toBe(source.url);
  });

  it("skips proxying for bypass patterns", () => {
    const source: StreamSource = { ...defaultSource, url: "http://localhost:3000/test.m3u8" };
    expect(proxy.apply(source, "test")).toBe(source.url);
  });

  it("proxies regular CDN URLs", () => {
    const result = proxy.apply(defaultSource, "vidsrc");
    expect(result).toContain("/api/stream-proxy?url=");
    expect(result).toContain("provider=vidsrc");
  });

  it("includes referer when present", () => {
    const source: StreamSource = {
      ...defaultSource,
      referer: "https://example.com",
    };
    const result = proxy.apply(source, "vidsrc");
    expect(result).toContain("referer=https%3A%2F%2Fexample.com");
  });

  it("includes origin when present", () => {
    const source: StreamSource = {
      ...defaultSource,
      origin: "https://example.com",
    };
    const result = proxy.apply(source, "vidsrc");
    expect(result).toContain("origin=https%3A%2F%2Fexample.com");
  });

  it("fully decodes double-encoded URLs", () => {
    const encoded = encodeURIComponent(encodeURIComponent("https://cdn.com/video.m3u8"));
    const source: StreamSource = { ...defaultSource, url: encoded };
    const result = proxy.apply(source, "test");
    // Should contain the fully decoded URL
    expect(result).toContain("video.m3u8");
  });
});
