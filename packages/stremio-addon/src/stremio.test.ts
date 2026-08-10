import type { StreamSource } from "@flyx/core";
import { describe, expect, it } from "vitest";
import { buildStreamResponse, MANIFEST, parseStremioId } from "./stremio";

describe("Stremio manifest", () => {
  it("uses the selected permanent values", () => {
    expect(MANIFEST).toMatchObject({
      id: "community.flyx.private",
      version: "1.0.0",
      name: "Flyx Streams",
      types: ["movie", "series"],
    });
    expect(MANIFEST.resources[0]).toMatchObject({ name: "stream", idPrefixes: ["tt"] });
  });
});

describe("parseStremioId", () => {
  it("parses a Cinemeta movie ID", () => {
    expect(parseStremioId("movie", "tt0133093")).toEqual({
      imdbId: "tt0133093",
      mediaType: "movie",
    });
  });

  it("parses season and episode from a Cinemeta series ID", () => {
    expect(parseStremioId("series", "tt0944947:1:2")).toEqual({
      imdbId: "tt0944947",
      mediaType: "tv",
      season: 1,
      episode: 2,
    });
  });

  it("rejects incomplete or mismatched IDs", () => {
    expect(parseStremioId("series", "tt0944947")).toBeNull();
    expect(parseStremioId("movie", "tt0944947:1:1")).toBeNull();
    expect(parseStremioId("series", "tt0944947:1:0")).toBeNull();
  });
});

describe("buildStreamResponse", () => {
  it("keeps direct sources direct and protects sources that need headers", () => {
    const sources: StreamSource[] = [
      { url: "https://cdn.example/video.mp4", quality: "720p", type: "mp4", title: "Direct" },
      {
        url: "https://cdn.example/master.m3u8",
        quality: "Auto",
        type: "hls",
        title: "Protected",
        referer: "https://player.example/",
        requiresSegmentProxy: true,
        tokenUrl: "https://token.example/generate",
      },
    ];

    const response = buildStreamResponse(
      sources,
      "videasy",
      "https://worker.example/private-token/proxy",
    );

    expect(response.streams[0]?.title).toBe("Protected\nAuto • HLS");
    expect(response.streams[0]?.url).toContain("/private-token/proxy?");
    expect(response.streams[0]?.url).toContain("referer=");
    expect(response.streams[0]?.url).toContain("tokenUrl=");
    expect(response.streams[1]?.url).toBe("https://cdn.example/video.mp4");
  });
});
