import { describe, it, expect } from "vitest";
import { sanitizeFilename, buildFilename } from "./types";

describe("sanitizeFilename", () => {
  it("strips path-hostile characters", () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe("abcdefghij");
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizeFilename("  The   Movie  ")).toBe("The Movie");
  });

  it("falls back to a safe default when empty", () => {
    expect(sanitizeFilename("")).toBe("download");
    expect(sanitizeFilename("***")).toBe("download");
  });
});

describe("buildFilename", () => {
  it("names a movie", () => {
    expect(buildFilename({ kind: "video", tmdbId: 1, mediaType: "movie", title: "Fight Club" })).toBe(
      "Fight Club.mp4",
    );
  });

  it("zero-pads tv season/episode", () => {
    expect(
      buildFilename({ kind: "video", tmdbId: 1, mediaType: "tv", season: 3, episode: 9, title: "Show" }),
    ).toBe("Show - S03E09.mp4");
  });

  it("names anime episodes with absolute episode numbers (no season)", () => {
    expect(
      buildFilename({
        kind: "video",
        tmdbId: 0,
        mediaType: "tv",
        season: 1,
        episode: 7,
        malId: 123,
        title: "One Piece",
      }),
    ).toBe("One Piece - E07.mp4");
  });

  it("tags sub/dub audio on anime files", () => {
    const base = {
      kind: "video" as const,
      tmdbId: 0,
      mediaType: "tv" as const,
      season: 1,
      episode: 7,
      malId: 123,
      title: "One Piece",
    };
    expect(buildFilename({ ...base, language: "sub" })).toBe("One Piece - E07 (Sub).mp4");
    expect(buildFilename({ ...base, language: "dub" })).toBe("One Piece - E07 (Dub).mp4");
  });

  it("names a manga chapter", () => {
    expect(buildFilename({ kind: "manga", mangaId: "abc", chapter: 42, title: "One Piece" })).toBe(
      "One Piece - Chapter 42.cbz",
    );
  });
});
