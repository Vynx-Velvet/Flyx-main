import { describe, it, expect } from "vitest";
import {
  parseDownloadItem,
  downloadContentDisposition,
  streamFilename,
} from "./stream-request";

function qs(entries: Record<string, string>): URLSearchParams {
  return new URLSearchParams(entries);
}

describe("parseDownloadItem", () => {
  it("parses a movie video item", () => {
    expect(parseDownloadItem(qs({ tmdbId: "550", mediaType: "movie", title: "Fight Club" }))).toEqual({
      kind: "video",
      tmdbId: 550,
      mediaType: "movie",
      season: undefined,
      episode: undefined,
      malId: undefined,
      title: "Fight Club",
      provider: undefined,
      quality: undefined,
    });
  });

  it("parses a tv episode with quality", () => {
    expect(
      parseDownloadItem(qs({ tmdbId: "1", mediaType: "tv", season: "2", episode: "3", quality: "1080p" })),
    ).toMatchObject({
      kind: "video",
      tmdbId: 1,
      mediaType: "tv",
      season: 2,
      episode: 3,
      quality: "1080p",
    });
  });

  it("allows anime (tmdbId=0 + malId)", () => {
    expect(parseDownloadItem(qs({ tmdbId: "0", mediaType: "movie", malId: "123" }))).toMatchObject({
      kind: "video",
      tmdbId: 0,
      malId: 123,
    });
  });

  it("parses anime episodes (tv + season 1 + malId)", () => {
    expect(
      parseDownloadItem(
        qs({ tmdbId: "0", mediaType: "tv", season: "1", episode: "5", malId: "123" }),
      ),
    ).toMatchObject({
      kind: "video",
      tmdbId: 0,
      mediaType: "tv",
      season: 1,
      episode: 5,
      malId: 123,
    });
  });

  it("parses the sub/dub language param", () => {
    expect(
      parseDownloadItem(qs({ tmdbId: "0", mediaType: "movie", malId: "123", language: "dub" })),
    ).toMatchObject({ language: "dub" });
    expect(
      parseDownloadItem(qs({ tmdbId: "0", mediaType: "movie", malId: "123", language: "sub" })),
    ).toMatchObject({ language: "sub" });
    expect(
      parseDownloadItem(qs({ tmdbId: "0", mediaType: "movie", malId: "123" })),
    ).toMatchObject({ language: undefined });
  });

  it("parses a manga item", () => {
    expect(parseDownloadItem(qs({ kind: "manga", mangaId: "abc", chapter: "7" }))).toEqual({
      kind: "manga",
      mangaId: "abc",
      chapter: 7,
      title: undefined,
    });
  });

  it("rejects a video without a valid tmdbId", () => {
    expect(() => parseDownloadItem(qs({ mediaType: "movie" }))).toThrow(/tmdbId/);
    expect(() => parseDownloadItem(qs({ tmdbId: "0", mediaType: "movie" }))).toThrow(/tmdbId/);
  });

  it("rejects tv without season/episode", () => {
    expect(() => parseDownloadItem(qs({ tmdbId: "1", mediaType: "tv" }))).toThrow(/season\/episode/);
  });

  it("rejects manga without a chapter", () => {
    expect(() => parseDownloadItem(qs({ kind: "manga", mangaId: "abc" }))).toThrow(/mangaId\/chapter/);
  });
});

describe("streamFilename", () => {
  it("names movies and episodes", () => {
    expect(
      streamFilename({ kind: "video", tmdbId: 1, mediaType: "movie", title: "Fight Club" }),
    ).toBe("Fight Club.mp4");
    expect(
      streamFilename({
        kind: "video",
        tmdbId: 1,
        mediaType: "tv",
        season: 2,
        episode: 3,
        title: "Show",
      }),
    ).toBe("Show - S02E03.mp4");
    expect(
      streamFilename({ kind: "manga", mangaId: "abc", chapter: 7, title: "Manga" }),
    ).toBe("Manga - Chapter 7.cbz");
  });
});

describe("downloadContentDisposition", () => {
  it("quotes the ASCII fallback and percent-encodes UTF-8", () => {
    const header = downloadContentDisposition("Fight Club.mp4");
    expect(header).toContain('filename="Fight Club.mp4"');
    expect(header).toContain("filename*=UTF-8''Fight%20Club.mp4");
  });

  it("strips quotes from the ASCII fallback", () => {
    const header = downloadContentDisposition('A "quoted".mp4');
    expect(header).toContain('filename="A quoted.mp4"');
  });
});
