import { describe, it, expect, vi } from "vitest";
import path from "path";
import { runAfterPack, bundledBinaries } from "../build/after-pack.cjs";
import { runAfterArtifacts } from "../build/after-artifacts.cjs";

function ctx(platform, appOutDir = "/out") {
  return { electronPlatformName: platform, appOutDir, packager: { appInfo: { productFilename: "Flyx" } } };
}

describe("afterPack hook", () => {
  it("ad-hoc signs the app bundle and marks binaries executable on macOS", () => {
    const execFile = vi.fn();
    const chmod = vi.fn();
    const exists = vi.fn(() => true);
    const res = runAfterPack(ctx("darwin"), { execFile, chmod, exists, log: () => {} });

    const app = path.join("/out", "Flyx.app");
    expect(execFile).toHaveBeenCalledWith("codesign", ["--force", "--deep", "--sign", "-", app]);
    expect(res.signed).toBe(true);
    expect(chmod).toHaveBeenCalledWith(path.join(app, "Contents", "MacOS", "Flyx"), 0o755);
    expect(chmod).toHaveBeenCalledWith(path.join(app, "Contents", "Resources", "server", "ffmpeg", "ffmpeg"), 0o755);
  });

  it("marks the launcher and bundled ffmpeg executable on Linux, no signing", () => {
    const execFile = vi.fn();
    const chmod = vi.fn();
    const res = runAfterPack(ctx("linux"), { execFile, chmod, exists: () => true, log: () => {} });
    expect(execFile).not.toHaveBeenCalled();
    expect(res.signed).toBe(false);
    expect(res.chmodded).toEqual([path.join("/out", "flyx"), path.join("/out", "resources", "server", "ffmpeg", "ffmpeg")]);
  });

  it("skips files that are not there and keeps going when codesign fails", () => {
    const execFile = vi.fn(() => {
      throw new Error("codesign: not available");
    });
    const chmod = vi.fn();
    const exists = vi.fn((p) => p.endsWith(".app") || p.endsWith("Flyx"));
    const log = vi.fn();
    const res = runAfterPack(ctx("darwin"), { execFile, chmod, exists, log });
    expect(res.signed).toBe(false);
    expect(chmod).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/codesign failed/));
  });

  it("does nothing on Windows", () => {
    const execFile = vi.fn();
    const chmod = vi.fn();
    const res = runAfterPack(ctx("win32"), { execFile, chmod, exists: () => true, log: () => {} });
    expect(execFile).not.toHaveBeenCalled();
    expect(chmod).not.toHaveBeenCalled();
    expect(res).toEqual({ signed: false, chmodded: [] });
  });

  it("lists the expected binaries per platform", () => {
    expect(bundledBinaries("/o", "win32", "Flyx")).toEqual([]);
    expect(bundledBinaries("/o", "linux", "Flyx")[0]).toBe(path.join("/o", "flyx"));
  });
});

describe("afterAllArtifactBuild hook", () => {
  it("chmods only AppImage artifacts", () => {
    const chmod = vi.fn();
    const touched = runAfterArtifacts(
      { artifactPaths: ["/d/Flyx-3.2.2.AppImage", "/d/Flyx-3.2.2.deb", "/d/Flyx-3.2.2.dmg", "/d/Flyx-Setup-3.2.2.exe"] },
      { chmod, log: () => {} },
    );
    expect(touched).toEqual(["/d/Flyx-3.2.2.AppImage"]);
    expect(chmod).toHaveBeenCalledWith("/d/Flyx-3.2.2.AppImage", 0o755);
  });

  it("tolerates a missing artifact list and chmod errors", () => {
    expect(runAfterArtifacts({}, { chmod: vi.fn(), log: () => {} })).toEqual([]);
    const log = vi.fn();
    const chmod = vi.fn(() => {
      throw new Error("EPERM");
    });
    expect(runAfterArtifacts({ artifactPaths: ["/d/x.AppImage"] }, { chmod, log })).toEqual([]);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/could not chmod/));
  });
});
