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

  it("prefers resourcesPath/server when packaged", async () => {
    // In plain Node process.defaultApp is unset, so isPackaged() is true —
    // emulate a packaged app by pointing resourcesPath at a resources dir.
    const res = fs.mkdtempSync(path.join(os.tmpdir(), "flyx-res-"));
    fs.mkdirSync(path.join(res, "server", "packages", "app"), { recursive: true });
    fs.writeFileSync(path.join(res, "server", "packages", "app", "server.js"), "// stub\n");
    process.resourcesPath = res;
    const { STANDALONE_DIR, SERVER_SCRIPT } = await import("../src/paths.js");
    expect(STANDALONE_DIR).toBe(path.join(res, "server"));
    expect(SERVER_SCRIPT).toBe(path.join(res, "server", "packages", "app", "server.js"));
  });
});
