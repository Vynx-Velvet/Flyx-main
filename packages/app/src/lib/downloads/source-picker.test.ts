import { describe, it, expect } from "vitest";
import type { StreamSource } from "@flyx/core";
import { qualityScore, pickBestSource, listQualities } from "./source-picker";

function src(
  url: string,
  quality: string,
  type: StreamSource["type"] = "hls",
): StreamSource {
  return { url, quality, type };
}

describe("qualityScore", () => {
  it("ranks common labels", () => {
    expect(qualityScore("4K")).toBe(4000);
    expect(qualityScore("2160p")).toBe(4000);
    expect(qualityScore("1440p")).toBe(1440);
    expect(qualityScore("1080p")).toBe(1080);
    expect(qualityScore("720p")).toBe(720);
    expect(qualityScore("480p")).toBe(480);
    expect(qualityScore("360p")).toBe(360);
  });

  it("extracts digits from descriptive labels", () => {
    expect(qualityScore("1080p (HDR)")).toBe(1080);
    expect(qualityScore("Full HD 1080")).toBe(1080);
  });

  it("returns 0 for unknown/empty labels", () => {
    expect(qualityScore("Auto")).toBe(0);
    expect(qualityScore("HD")).toBe(0);
    expect(qualityScore("")).toBe(0);
    expect(qualityScore(undefined)).toBe(0);
  });
});

describe("pickBestSource", () => {
  it("picks the highest quality with no hint", () => {
    const best = pickBestSource([
      src("a", "720p"),
      src("b", "1080p"),
      src("c", "480p"),
    ]);
    expect(best?.url).toBe("b");
  });

  it("prefers plain MP4 on a quality tie", () => {
    const best = pickBestSource([
      src("hls1080", "1080p", "hls"),
      src("mp41080", "1080p", "mp4"),
    ]);
    expect(best?.url).toBe("mp41080");
  });

  it("returns an exact quality match when available", () => {
    const best = pickBestSource(
      [src("a", "1080p"), src("b", "720p"), src("c", "480p")],
      "720p",
    );
    expect(best?.url).toBe("b");
  });

  it("matches case-insensitively", () => {
    const best = pickBestSource([src("a", "1080p")], "1080P");
    expect(best?.url).toBe("a");
  });

  it("falls back to the closest quality when there is no exact match", () => {
    const best = pickBestSource(
      [src("a", "1080p"), src("b", "480p")],
      "720p",
    );
    // 720 is nearer 480 (240) than 1080 (360)
    expect(best?.url).toBe("b");
  });

  it("falls back to best available for an unknown quality label", () => {
    const best = pickBestSource([src("a", "720p"), src("b", "1080p")], "Auto");
    expect(best?.url).toBe("b");
  });

  it("ignores sources without a url", () => {
    const best = pickBestSource([
      { url: "", quality: "4K", type: "hls" },
      src("b", "1080p"),
    ]);
    expect(best?.url).toBe("b");
  });

  it("returns null for empty or unusable lists", () => {
    expect(pickBestSource([])).toBeNull();
    expect(pickBestSource([{ url: "", quality: "1080p", type: "hls" }])).toBeNull();
  });
});

describe("listQualities", () => {
  it("returns distinct qualities highest-first", () => {
    expect(
      listQualities([
        src("a", "720p"),
        src("b", "1080p"),
        src("c", "4K"),
        src("d", "1080p"),
      ]),
    ).toEqual(["4K", "1080p", "720p"]);
  });

  it("skips empty urls and empty labels", () => {
    expect(
      listQualities([
        { url: "", quality: "1080p", type: "hls" },
        src("a", "720p"),
        { url: "b", quality: "", type: "hls" },
      ]),
    ).toEqual(["720p"]);
  });
});
