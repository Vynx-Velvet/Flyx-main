import { describe, expect, it } from "vitest";
import { buildNowPlaying } from "./now-playing";

describe("buildNowPlaying", () => {
  it("formats TV with season/episode in the title slot", () => {
    expect(
      buildNowPlaying({ mediaType: "tv", title: "Demon Slayer", season: 2, episode: 1 }),
    ).toEqual({
      mediaTitle: "Demon Slayer — S2 E1",
      documentTitle: "Demon Slayer — S2 E1 | Flyx",
      episodeLabel: "S2 E1",
    });
  });

  it("formats anime as EP n when malId is present", () => {
    expect(
      buildNowPlaying({ mediaType: "tv", title: "Demon Slayer", season: 2, episode: 3, malId: 38000 })
        .mediaTitle,
    ).toBe("Demon Slayer — EP 3");
  });

  it("treats the isAnime flag the same as malId (mobile player has no malId prop)", () => {
    expect(
      buildNowPlaying({ mediaType: "tv", title: "Jujutsu Kaisen", season: 1, episode: 5, isAnime: true })
        .mediaTitle,
    ).toBe("Jujutsu Kaisen — EP 5");
  });

  it("appends the year for movies when available", () => {
    expect(buildNowPlaying({ mediaType: "movie", title: "Interstellar", year: "2014" }).documentTitle)
      .toBe("Interstellar (2014) | Flyx");
  });

  it("omits the year for movies without one", () => {
    expect(buildNowPlaying({ mediaType: "movie", title: "Interstellar" }).mediaTitle).toBe("Interstellar");
  });

  it("falls back to the bare title for TV without season/episode", () => {
    expect(buildNowPlaying({ mediaType: "tv", title: "Some Show" }).mediaTitle).toBe("Some Show");
  });

  it("does not add a year to TV or anime titles", () => {
    expect(
      buildNowPlaying({ mediaType: "tv", title: "Some Show", season: 1, episode: 1, year: "2020" }).mediaTitle,
    ).toBe("Some Show — S1 E1");
  });

  it("skips placeholder/loading titles entirely", () => {
    for (const bad of ["Loading...", "Title 12345", "Anime 57658", "Untitled", "", "   "]) {
      expect(buildNowPlaying({ mediaType: "tv", title: bad, season: 1, episode: 1 })).toEqual({
        mediaTitle: null,
        documentTitle: null,
        episodeLabel: null,
      });
    }
  });
});
