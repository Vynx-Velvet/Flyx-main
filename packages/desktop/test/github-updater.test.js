import { describe, it, expect } from "vitest";
import {
  normalizeVersion,
  compareVersions,
  pickAsset,
} from "../src/github-updater.js";

describe("normalizeVersion", () => {
  it("strips a leading v and trims", () => {
    expect(normalizeVersion("v3.0.3")).toBe("3.0.3");
    expect(normalizeVersion("  v3.0.3 ")).toBe("3.0.3");
    expect(normalizeVersion("3.0.3")).toBe("3.0.3");
  });

  it("handles empty input", () => {
    expect(normalizeVersion("")).toBe("");
    expect(normalizeVersion(undefined)).toBe("");
    expect(normalizeVersion(null)).toBe("");
  });
});

describe("compareVersions", () => {
  it("detects newer, older, and equal versions", () => {
    expect(compareVersions("3.0.3", "3.0.2")).toBe(1);
    expect(compareVersions("3.0.2", "3.0.3")).toBe(-1);
    expect(compareVersions("3.0.2", "3.0.2")).toBe(0);
    expect(compareVersions("v3.1.0", "3.0.9")).toBe(1);
    expect(compareVersions("3.0.10", "3.0.9")).toBe(1);
    expect(compareVersions("4.0.0", "3.99.99")).toBe(1);
  });

  it("treats missing segments as zero", () => {
    expect(compareVersions("3", "3.0.0")).toBe(0);
    expect(compareVersions("3.0", "3.0.0")).toBe(0);
    expect(compareVersions("3.0.1", "3")).toBe(1);
  });

  it("ignores non-numeric segments", () => {
    expect(compareVersions("3.0.0-beta", "3.0.0")).toBe(0);
    expect(compareVersions("3.0.1-beta", "3.0.0")).toBe(1);
  });
});

describe("pickAsset", () => {
  const assets = [
    { name: "Flyx-Setup-3.0.3.exe", browser_download_url: "https://x/setup.exe" },
    { name: "Flyx-Portable-3.0.3.exe", browser_download_url: "https://x/portable.exe" },
    { name: "Flyx-3.0.3.dmg", browser_download_url: "https://x/flyx.dmg" },
    { name: "Flyx-3.0.3.AppImage", browser_download_url: "https://x/flyx.AppImage" },
    { name: "Flyx-3.0.3.deb", browser_download_url: "https://x/flyx.deb" },
    { name: "latest.yml", browser_download_url: "https://x/latest.yml" },
  ];

  it("picks the portable exe on Windows portable builds", () => {
    const asset = pickAsset(assets, { platform: "win32", portable: true });
    expect(asset.name).toBe("Flyx-Portable-3.0.3.exe");
  });

  it("picks the setup exe on Windows installed builds", () => {
    const asset = pickAsset(assets, { platform: "win32", portable: false });
    expect(asset.name).toBe("Flyx-Setup-3.0.3.exe");
  });

  it("picks the dmg on macOS", () => {
    const asset = pickAsset(assets, { platform: "darwin", portable: false });
    expect(asset.name).toBe("Flyx-3.0.3.dmg");
  });

  it("prefers AppImage then deb on Linux", () => {
    expect(pickAsset(assets, { platform: "linux", portable: false }).name).toBe(
      "Flyx-3.0.3.AppImage",
    );
    const debOnly = assets.filter((a) => !a.name.endsWith(".AppImage"));
    expect(pickAsset(debOnly, { platform: "linux", portable: false }).name).toBe(
      "Flyx-3.0.3.deb",
    );
  });

  it("returns null when no asset matches", () => {
    expect(pickAsset([], { platform: "win32", portable: false })).toBeNull();
    expect(pickAsset(assets, { platform: "freebsd", portable: false })).toBeNull();
  });
});
