import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { resetDesktopModules } from "./helpers.js";

beforeEach(() => {
  resetDesktopModules();
  vi.unstubAllEnvs();
  delete process.env.FLYX_DATA_DIR;
  delete process.env.FLYX_STANDALONE_DIR;
  delete process.resourcesPath;
});

describe("paths", () => {
  it("resolves DATA_DIR and derived paths from FLYX_DATA_DIR", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flyx-paths-"));
    vi.stubEnv("FLYX_DATA_DIR", dir);
    const { DATA_DIR, envPath, logsDir, serverLog } = await import("../src/paths.js");
    expect(DATA_DIR).toBe(path.resolve(dir));
    expect(envPath).toBe(path.join(dir, ".env"));
    expect(logsDir).toBe(path.join(dir, "logs"));
    expect(serverLog).toBe(path.join(dir, "logs", "flyx-server.log"));
  });

  it("defaults DATA_DIR to the platform user-data location", async () => {
    delete process.env.FLYX_DATA_DIR;
    const { DATA_DIR } = await import("../src/paths.js");
    const base =
      process.platform === "win32"
        ? process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local")
        : process.platform === "darwin"
          ? path.join(os.homedir(), "Library", "Application Support")
          : path.join(os.homedir(), ".local", "share");
    expect(DATA_DIR).toBe(path.join(base, "flyx"));
  });

  it("resolves STANDALONE_DIR from FLYX_STANDALONE_DIR", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flyx-standalone-"));
    fs.mkdirSync(path.join(dir, "packages", "app"), { recursive: true });
    fs.writeFileSync(path.join(dir, "packages", "app", "server.js"), "// stub\n");
    vi.stubEnv("FLYX_STANDALONE_DIR", dir);
    const { STANDALONE_DIR, SERVER_SCRIPT } = await import("../src/paths.js");
    expect(STANDALONE_DIR).toBe(path.resolve(dir));
    expect(SERVER_SCRIPT).toBe(path.join(dir, "packages", "app", "server.js"));
  });

  it("uses resourcesPath/server when packaged", async () => {
    const res = fs.mkdtempSync(path.join(os.tmpdir(), "flyx-res-"));
    fs.mkdirSync(path.join(res, "server", "packages", "app"), { recursive: true });
    fs.writeFileSync(path.join(res, "server", "packages", "app", "server.js"), "// stub\n");
    const { getStandaloneDir } = await import("../src/paths.js");
    expect(getStandaloneDir({ packaged: true, resourcesPath: res })).toBe(path.join(res, "server"));
  });

  it("packaged builds ignore FLYX_STANDALONE_DIR and the CWD and fail closed", async () => {
    const res = fs.mkdtempSync(path.join(os.tmpdir(), "flyx-res-empty-"));
    const planted = fs.mkdtempSync(path.join(os.tmpdir(), "flyx-planted-"));
    fs.mkdirSync(path.join(planted, ".flyx-standalone", "packages", "app"), { recursive: true });
    const { getStandaloneDir } = await import("../src/paths.js");
    expect(
      getStandaloneDir({
        packaged: true,
        resourcesPath: res, // no server/ inside
        env: { FLYX_STANDALONE_DIR: planted },
        cwd: planted,
      }),
    ).toBeNull();
    expect(getStandaloneDir({ packaged: true, resourcesPath: undefined, env: {}, cwd: planted })).toBeNull();
  });

  it("isPackaged is false outside Electron (tests / plain Node)", async () => {
    const { isPackaged } = await import("../src/paths.js");
    expect(isPackaged()).toBe(false);
  });
});
