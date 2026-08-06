import { describe, it, expect } from "vitest";
import type { ContentCategory, ExtractionRequest, StreamSource, SubtitleTrack } from "@flyx/core";
import { BaseProvider } from "./BaseProvider";

class TestProvider extends BaseProvider {
  readonly name = "test";
  readonly priority = 50;
  readonly supportedContent: ContentCategory[] = ["movie", "tv"];

  protected async doExtract(request: ExtractionRequest): Promise<{
    sources: StreamSource[];
    subtitles?: SubtitleTrack[];
  }> {
    if (request.tmdbId === 0) throw new Error("Invalid TMDB ID");
    return {
      sources: [
        { url: "https://cdn.test/stream.m3u8", quality: "1080p", type: "hls", title: "Server 1" },
      ],
      subtitles: [{ label: "English", url: "https://cdn.test/sub.vtt", language: "en" }],
    };
  }
}

describe("BaseProvider", () => {
  const provider = new TestProvider();
  const request: ExtractionRequest = { tmdbId: 123, mediaType: "movie" };

  it("extract returns success with normalised sources", async () => {
    const result = await provider.extract(request);
    expect(result.success).toBe(true);
    expect(result.provider).toBe("test");
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]!.quality).toBe("1080p");
    expect(result.timing).toBeGreaterThanOrEqual(0);
  });

  it("extract normalises subtitles", async () => {
    const result = await provider.extract(request);
    expect(result.subtitles).toHaveLength(1);
    expect(result.subtitles[0]!.label).toBe("English");
    expect(result.subtitles[0]!.language).toBe("en");
  });

  it("extract catches errors and returns failure result", async () => {
    const badRequest: ExtractionRequest = { tmdbId: 0, mediaType: "movie" };
    const result = await provider.extract(badRequest);
    expect(result.success).toBe(false);
    expect(result.sources).toHaveLength(0);
    expect(result.error).toBeDefined();
    expect(result.timing).toBeGreaterThanOrEqual(0);
  });

  it("getConfig returns serialisable config", () => {
    const config = provider.getConfig();
    expect(config.name).toBe("test");
    expect(config.priority).toBe(50);
    expect(config.enabled).toBe(true);
    expect(config.supportedContent).toEqual(["movie", "tv"]);
  });

  it("supportsContent matches by supported categories", () => {
    // VOD provider matches movie and TV content
    expect(provider.supportsContent("movie")).toBe(true);
    expect(provider.supportsContent("tv")).toBe(true);
  });

  it("VOD provider does NOT match anime content", () => {
    // VOD provider with ["movie","tv"] must not match anime
    expect(provider.supportsContent("tv", { isAnime: true })).toBe(false);
    expect(provider.supportsContent("movie", { isAnime: true })).toBe(false);
  });

  it("VOD provider does NOT match live TV content", () => {
    expect(provider.supportsContent("tv", { isLive: true })).toBe(false);
  });

  it("fetchSourceByName returns matching source", async () => {
    const source = await provider.fetchSourceByName("Server 1", request);
    expect(source).not.toBeNull();
    expect(source!.title).toBe("Server 1");
  });

  it("fetchSourceByName returns null when no match", async () => {
    const source = await provider.fetchSourceByName("nonexistent", request);
    expect(source).toBeNull();
  });
});
