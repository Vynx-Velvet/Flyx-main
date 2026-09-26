import { describe, it, expect } from "vitest";
import {
  COMPLETED_PCT,
  completionPct,
  episodeLabel,
  findEntry,
  formatClock,
  formatRemaining,
  latestForContent,
  readProgress,
  resumeHref,
  resumeSeconds,
  upsertEntry,
  writeProgress,
  WATCH_PROGRESS_KEY,
  type ProgressEntry,
} from "./watch-progress";

function memStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    dump: () => Object.fromEntries(map),
  };
}

const movie = (over: Partial<ProgressEntry> = {}): ProgressEntry => ({
  contentId: "550",
  contentType: "movie",
  currentTime: 3735,
  duration: 8340,
  completionPercentage: 44.8,
  lastWatchedAt: 1000,
  title: "Fight Club",
  ...over,
});

describe("read/write", () => {
  it("round-trips through storage and tolerates garbage", () => {
    const s = memStorage();
    writeProgress(s, [movie()]);
    expect(readProgress(s)).toEqual([movie()]);
    expect(readProgress(memStorage({ [WATCH_PROGRESS_KEY]: "{nope" }))).toEqual([]);
    expect(readProgress(null)).toEqual([]);
  });
});

describe("upsertEntry", () => {
  it("ignores positions under the minimum and unknown durations", () => {
    expect(upsertEntry([], { contentId: "1", contentType: "movie", currentTime: 3, duration: 100 })).toBeNull();
    expect(upsertEntry([], { contentId: "1", contentType: "movie", currentTime: 30, duration: NaN })).toBeNull();
  });

  it("records the exact position and percentage, newest first", () => {
    const list = upsertEntry([movie({ contentId: "1" })], {
      contentId: "1399",
      contentType: "tv",
      seasonNumber: 2,
      episodeNumber: 4,
      currentTime: 1335.678,
      duration: 3600,
      title: "Show",
      now: 5000,
    })!;
    expect(list[0]).toMatchObject({
      contentId: "1399",
      seasonNumber: 2,
      episodeNumber: 4,
      currentTime: 1335.678,
      duration: 3600,
      completionPercentage: 37.1,
      completed: false,
      lastWatchedAt: 5000,
      title: "Show",
    });
    expect(list[1]!.contentId).toBe("1");
  });

  it("updates the same episode in place and keeps earlier metadata", () => {
    const first = upsertEntry([], {
      contentId: "1399", contentType: "tv", seasonNumber: 1, episodeNumber: 1,
      currentTime: 100, duration: 1000, posterPath: "/p.jpg", now: 1,
    })!;
    const second = upsertEntry(first, {
      contentId: "1399", contentType: "tv", seasonNumber: 1, episodeNumber: 1,
      currentTime: 200, duration: 1000, now: 2,
    })!;
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ currentTime: 200, posterPath: "/p.jpg", lastWatchedAt: 2 });
  });

  it("marks completion at the threshold or on ended", () => {
    const near = upsertEntry([], { contentId: "1", contentType: "movie", currentTime: 960, duration: 1000 })!;
    expect(near[0]!.completed).toBe(true);
    expect(near[0]!.completionPercentage).toBeGreaterThanOrEqual(COMPLETED_PCT);
    const ended = upsertEntry([], { contentId: "1", contentType: "movie", currentTime: 0, duration: 0, completed: true })!;
    expect(ended[0]).toMatchObject({ completed: true, completionPercentage: 100 });
  });
});

describe("lookups", () => {
  it("findEntry distinguishes episodes", () => {
    const list = [
      movie({ contentId: "9", contentType: "tv", seasonNumber: 1, episodeNumber: 1 }),
      movie({ contentId: "9", contentType: "tv", seasonNumber: 1, episodeNumber: 2 }),
    ];
    expect(findEntry(list, { contentId: "9", contentType: "tv", seasonNumber: 1, episodeNumber: 2 })).toBe(list[1]);
    expect(findEntry(list, { contentId: "9", contentType: "tv", seasonNumber: 2, episodeNumber: 1 })).toBeNull();
  });

  it("latestForContent picks the most recently watched episode", () => {
    const list = [
      movie({ contentId: "9", contentType: "tv", seasonNumber: 1, episodeNumber: 1, lastWatchedAt: 10 }),
      movie({ contentId: "9", contentType: "tv", seasonNumber: 1, episodeNumber: 3, lastWatchedAt: 30 }),
      movie({ contentId: "9", contentType: "tv", seasonNumber: 1, episodeNumber: 2, lastWatchedAt: 20 }),
    ];
    expect(latestForContent(list, "9", "tv")?.episodeNumber).toBe(3);
    expect(latestForContent(list, "9", "movie")).toBeNull();
  });
});

describe("resume", () => {
  it("resumeSeconds floors the position and is 0 for finished or trivial entries", () => {
    expect(resumeSeconds(movie({ currentTime: 1335.9 }))).toBe(1335);
    expect(resumeSeconds(movie({ completed: true }))).toBe(0);
    expect(resumeSeconds(movie({ currentTime: 990, duration: 1000, completionPercentage: 99 }))).toBe(0);
    expect(resumeSeconds(movie({ currentTime: 2 }))).toBe(0);
    expect(resumeSeconds(null)).toBe(0);
  });

  it("builds exact-second resume links for movies, series and anime", () => {
    expect(resumeHref(movie({ currentTime: 3735.4 }))).toBe(
      "/watch?tmdbId=550&mediaType=movie&title=Fight+Club&t=3735",
    );
    expect(
      resumeHref(movie({ contentId: "1399", contentType: "tv", seasonNumber: 2, episodeNumber: 4, currentTime: 61, title: "Show" })),
    ).toBe("/watch?tmdbId=1399&mediaType=tv&season=2&episode=4&title=Show&t=61");
    expect(
      resumeHref(movie({ contentId: "21", contentType: "tv", malId: 21, episodeNumber: 7, currentTime: 90, title: "One Piece" })),
    ).toBe("/watch?malId=21&mediaType=tv&episode=7&title=One+Piece&t=90");
    expect(resumeHref(movie({ completed: true }))).not.toContain("t=");
  });
});

describe("labels", () => {
  it("formats clocks and remaining time", () => {
    expect(formatClock(3735)).toBe("1:02:15");
    expect(formatClock(184)).toBe("3:04");
    expect(formatRemaining(movie({ currentTime: 3735, duration: 8340 }))).toBe("1 h 17 min left");
    expect(formatRemaining(movie({ currentTime: 1000, duration: 2380 }))).toBe("23 min left");
    expect(formatRemaining(movie({ currentTime: 990, duration: 1000 }))).toBe("Less than a minute left");
    expect(formatRemaining(movie({ completed: true }))).toBe("Finished");
  });

  it("labels episodes for series and anime, nothing for movies", () => {
    expect(episodeLabel({ contentId: "1", contentType: "tv", seasonNumber: 2, episodeNumber: 4 })).toBe("S2 E4");
    expect(episodeLabel({ contentId: "1", contentType: "tv", episodeNumber: 7, malId: 21 })).toBe("EP 7");
    expect(episodeLabel({ contentId: "1", contentType: "movie" })).toBe("");
    expect(completionPct(50, 200)).toBe(25);
  });
});
