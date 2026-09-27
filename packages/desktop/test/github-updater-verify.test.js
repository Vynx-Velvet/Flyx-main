import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import {
  parseUpdateYml,
  parseUpdateYmlMinimal,
  expectedChecksum,
  verifyFile,
  verifyDownload,
  planPortableCleanup,
  isUpdateMetadataName,
  fetchText,
} from "../src/github-updater.js";

function tempAsset(name, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flyx-upd-"));
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return {
    file,
    sha512: crypto.createHash("sha512").update(content).digest("base64"),
    sha256: crypto.createHash("sha256").update(content).digest("hex"),
    size: Buffer.byteLength(content),
  };
}

const latestYml = (name, sha512, size) =>
  `version: 3.2.5\nfiles:\n  - url: ${name}\n    sha512: ${sha512}\n    size: ${size}\n` +
  `path: ${name}\nsha512: ${sha512}\nreleaseDate: '2026-09-26T00:00:00.000Z'\n`;

describe("latest.yml parsing", () => {
  it("minimal parser and js-yaml agree on electron-builder's format", () => {
    const text = latestYml("Flyx-Setup-3.2.5.exe", "abc/def+==", 123);
    for (const parsed of [parseUpdateYmlMinimal(text), parseUpdateYml(text)]) {
      expect(parsed.files).toHaveLength(1);
      expect(parsed.files[0]).toMatchObject({ url: "Flyx-Setup-3.2.5.exe", sha512: "abc/def+==", size: 123 });
      expect(parsed.path).toBe("Flyx-Setup-3.2.5.exe");
    }
    expect(parseUpdateYmlMinimal(text).releaseDate).toBe("2026-09-26T00:00:00.000Z");
  });

  it("parses the real 3.1.0 latest.yml shape", () => {
    const real =
      "version: 3.1.0\nfiles:\n  - url: Flyx-Setup-3.1.0.exe\n" +
      "    sha512: wW3rrrsTh0/jU7SIH0I2DCQb0RqqF5DfBiatT3eDL8MWknATvDoMM/eSRNS0NAncIr8gRrv1YXYemimzfN1Hzg==\n" +
      "    size: 130688955\npath: Flyx-Setup-3.1.0.exe\n" +
      "sha512: wW3rrrsTh0/jU7SIH0I2DCQb0RqqF5DfBiatT3eDL8MWknATvDoMM/eSRNS0NAncIr8gRrv1YXYemimzfN1Hzg==\n" +
      "releaseDate: '2026-09-13T19:20:18.909Z'\n";
    const exp = expectedChecksum({ assetName: "Flyx-Setup-3.1.0.exe", metadataTexts: [real] });
    expect(exp.size).toBe(130688955);
    expect(exp.digest).toMatch(/^wW3rrrs.*Hzg==$/);
  });

  it("recognises update metadata asset names", () => {
    expect(isUpdateMetadataName("latest.yml")).toBe(true);
    expect(isUpdateMetadataName("latest-mac.yml")).toBe(true);
    expect(isUpdateMetadataName("latest-linux.yml")).toBe(true);
    expect(isUpdateMetadataName("Flyx-Setup-3.2.5.exe")).toBe(false);
    expect(isUpdateMetadataName("evil-latest.yml")).toBe(false);
  });
});

describe("expectedChecksum", () => {
  it("prefers the latest.yml sha512 entry for the asset", () => {
    const exp = expectedChecksum({
      assetName: "Flyx-Setup-3.2.5.exe",
      metadataTexts: [latestYml("Flyx-Setup-3.2.5.exe", "SHA==", 10)],
      assetDigest: "sha256:" + "a".repeat(64),
    });
    expect(exp).toEqual({ algorithm: "sha512", encoding: "base64", digest: "SHA==", size: 10, source: "latest.yml" });
  });

  it("falls back to GitHub's sha256 asset digest for assets latest.yml doesn't list (portable)", () => {
    const exp = expectedChecksum({
      assetName: "Flyx-Portable-3.2.5.exe",
      metadataTexts: [latestYml("Flyx-Setup-3.2.5.exe", "SHA==", 10)],
      assetDigest: "sha256:" + "B".repeat(64),
      assetSize: 99,
    });
    expect(exp).toMatchObject({ algorithm: "sha256", encoding: "hex", digest: "b".repeat(64), size: 99 });
  });

  it("returns null when nothing vouches for the asset", () => {
    expect(expectedChecksum({ assetName: "Flyx-Portable-3.2.5.exe", metadataTexts: [] })).toBeNull();
    expect(expectedChecksum({ assetName: "x.exe", assetDigest: "md5:abc" })).toBeNull();
  });
});

describe("verifyFile / verifyDownload", () => {
  it("accepts a file whose sha512 + size match latest.yml", async () => {
    const a = tempAsset("Flyx-Setup-3.2.5.exe", "installer bytes");
    const seen = [];
    const res = await verifyDownload({
      file: a.file,
      assetName: "Flyx-Setup-3.2.5.exe",
      metadataUrls: ["https://github.com/x/releases/download/v3.2.5/latest.yml"],
      fetchText: async (url) => {
        seen.push(url);
        return latestYml("Flyx-Setup-3.2.5.exe", a.sha512, a.size);
      },
    });
    expect(res).toEqual({ ok: true, source: "latest.yml" });
    expect(seen).toEqual(["https://github.com/x/releases/download/v3.2.5/latest.yml"]);
  });

  it("rejects a tampered file (hash mismatch)", async () => {
    const good = tempAsset("Flyx-Setup-3.2.5.exe", "installer bytes");
    const evil = tempAsset("Flyx-Setup-3.2.5.exe", "installer byteZ"); // same size
    const res = await verifyDownload({
      file: evil.file,
      assetName: "Flyx-Setup-3.2.5.exe",
      metadataUrls: ["https://x/latest.yml"],
      fetchText: async () => latestYml("Flyx-Setup-3.2.5.exe", good.sha512, good.size),
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/checksum mismatch/);
  });

  it("rejects a size mismatch", async () => {
    const a = tempAsset("Flyx-Setup-3.2.5.exe", "installer bytes");
    const res = await verifyFile(a.file, {
      algorithm: "sha512",
      encoding: "base64",
      digest: a.sha512,
      size: a.size + 1,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/size mismatch/);
  });

  it("refuses when latest.yml is missing/unreachable and there is no GitHub digest", async () => {
    const a = tempAsset("Flyx-Setup-3.2.5.exe", "installer bytes");
    const res = await verifyDownload({
      file: a.file,
      assetName: "Flyx-Setup-3.2.5.exe",
      metadataUrls: ["https://x/latest.yml"],
      fetchText: async () => {
        throw new Error("HTTP 404");
      },
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/No published checksum/);
    const none = await verifyDownload({ file: a.file, assetName: "Flyx-Setup-3.2.5.exe", metadataUrls: [] });
    expect(none.ok).toBe(false);
  });

  it("verifies the portable exe via the GitHub sha256 digest", async () => {
    const a = tempAsset("Flyx-Portable-3.2.5.exe", "portable bytes");
    const ok = await verifyDownload({
      file: a.file,
      assetName: "Flyx-Portable-3.2.5.exe",
      assetDigest: `sha256:${a.sha256}`,
      assetSize: a.size,
    });
    expect(ok).toEqual({ ok: true, source: "github-digest" });
    const bad = await verifyDownload({
      file: a.file,
      assetName: "Flyx-Portable-3.2.5.exe",
      assetDigest: `sha256:${"0".repeat(64)}`,
    });
    expect(bad.ok).toBe(false);
  });
});

describe("https-only networking", () => {
  it("refuses plain http URLs outright", async () => {
    await expect(fetchText("http://github.com/x/latest.yml")).rejects.toThrow(/non-https/);
    await expect(fetchText("file:///etc/passwd")).rejects.toThrow(/non-https/);
  });
});

describe("planPortableCleanup", () => {
  const dir = process.platform === "win32" ? "C:\\Users\\u\\Apps" : "/home/u/apps";
  const old = path.join(dir, "Flyx-Portable-3.2.4.exe");
  const cur = path.join(dir, "Flyx-Portable-3.2.5.exe");

  it("deletes exactly the recorded old exe, only from the build it handed off to", () => {
    expect(planPortableCleanup({ oldExe: old, newExe: cur }, cur)).toBe(old);
    // The old exe relaunched before the new one → nothing yet
    expect(planPortableCleanup({ oldExe: old, newExe: cur }, old)).toBeNull();
  });

  it("never deletes itself, non-Flyx files, or files in another folder", () => {
    expect(planPortableCleanup({ oldExe: cur, newExe: cur }, cur)).toBeNull();
    expect(planPortableCleanup({ oldExe: path.join(dir, "important.exe"), newExe: cur }, cur)).toBeNull();
    const elsewhere = path.join(dir, "..", "other", "Flyx-Portable-3.2.4.exe");
    expect(planPortableCleanup({ oldExe: elsewhere, newExe: cur }, cur)).toBeNull();
    expect(planPortableCleanup(null, cur)).toBeNull();
    expect(planPortableCleanup({ oldExe: 1, newExe: cur }, cur)).toBeNull();
  });
});
