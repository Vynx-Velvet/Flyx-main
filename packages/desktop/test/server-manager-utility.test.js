import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import { PassThrough } from "stream";
import fs from "fs";
import os from "os";
import path from "path";
import cp from "child_process";
import { resetDesktopModules } from "./helpers.js";

let dataDir;
let standaloneDir;

function fakeUtility() {
  const proc = new EventEmitter();
  proc.pid = 777;
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.kill = vi.fn(() => {
    proc.emit("exit", 0);
    return true;
  });
  return proc;
}

beforeEach(() => {
  resetDesktopModules();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();

  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "flyx-smu-"));
  standaloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "flyx-standalone-u-"));
  const appDir = path.join(standaloneDir, "packages", "app");
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(path.join(appDir, "server.js"), "// stub server\n");
  fs.writeFileSync(path.join(appDir, ".env"), "FLYX_DESKTOP=true\n");

  vi.stubEnv("FLYX_DATA_DIR", dataDir);
  vi.stubEnv("FLYX_STANDALONE_DIR", standaloneDir);
});

describe("shouldUseUtilityProcess", () => {
  it("is on for macOS only by default", async () => {
    const sm = await import("../src/server-manager.js");
    expect(sm.shouldUseUtilityProcess("darwin", {})).toBe(true);
    expect(sm.shouldUseUtilityProcess("win32", {})).toBe(false);
    expect(sm.shouldUseUtilityProcess("linux", {})).toBe(false);
  });

  it("honours the FLYX_SERVER_HOST override in both directions", async () => {
    const sm = await import("../src/server-manager.js");
    expect(sm.shouldUseUtilityProcess("win32", { FLYX_SERVER_HOST: "utility" })).toBe(true);
    expect(sm.shouldUseUtilityProcess("darwin", { FLYX_SERVER_HOST: "child" })).toBe(false);
  });
});

describe("forkUtilityProcess", () => {
  it("wraps a utility process in the child-process surface the shell uses", async () => {
    const sm = await import("../src/server-manager.js");
    const proc = fakeUtility();
    const fork = vi.fn(() => proc);

    const child = sm.forkUtilityProcess("/srv/server.js", { cwd: "/srv", env: { A: "1" }, fork });

    expect(fork).toHaveBeenCalledWith("/srv/server.js", [], {
      cwd: "/srv",
      env: { A: "1" },
      stdio: "pipe",
      serviceName: "Flyx Server",
    });
    expect(child.pid).toBe(777);
    expect(child.exitCode).toBeNull();
    expect(child.signalCode).toBeNull();
    expect(child.stdout).toBe(proc.stdout);
    expect(child.utility).toBe(proc);

    const onExit = vi.fn();
    child.on("exit", onExit);
    proc.emit("exit", 3);
    expect(child.exitCode).toBe(3);
    expect(onExit).toHaveBeenCalledWith(3);
  });

  it("falls back to a plain child process when utilityProcess is unavailable", async () => {
    const fake = new EventEmitter();
    fake.stdout = new PassThrough();
    fake.stderr = new PassThrough();
    fake.pid = 1;
    fake.exitCode = null;
    const spawnSpy = vi.spyOn(cp, "spawn").mockReturnValue(fake);
    const sm = await import("../src/server-manager.js");
    // Outside Electron, require("electron") yields the binary path, not the API.
    const child = sm.forkUtilityProcess("/srv/server.js", { cwd: "/srv", env: {} });
    expect(child).toBe(fake);
    expect(spawnSpy).toHaveBeenCalledTimes(1);
  });
});

describe("spawnServer on macOS", () => {
  it("uses the utility process instead of spawning the app binary", async () => {
    vi.stubEnv("FLYX_SERVER_HOST", "utility");
    const spawnSpy = vi.spyOn(cp, "spawn");
    const sm = await import("../src/server-manager.js");

    // No electron API in tests → the helper falls back to spawn, which proves
    // the utility path was taken (the log line says so) without needing Electron.
    const fake = new EventEmitter();
    fake.stdout = new PassThrough();
    fake.stderr = new PassThrough();
    fake.pid = 2;
    fake.exitCode = null;
    spawnSpy.mockReturnValue(fake);

    const child = sm.spawnServer({ port: 3903, hostname: "127.0.0.1" });
    expect(child).toBe(fake);
    const logText = fs.readFileSync(path.join(dataDir, "logs", "flyx-server.log"), "utf8");
    expect(logText).toMatch(/utility process/);
    expect(logText).toMatch(/utilityProcess unavailable/);
    sm.stopServer(child);
  });

  it("stopServer asks a utility host to stop through Electron, not the pid", async () => {
    const sm = await import("../src/server-manager.js");
    const proc = fakeUtility();
    const child = sm.forkUtilityProcess("/srv/server.js", { cwd: "/srv", env: {}, fork: () => proc });
    vi.spyOn(process, "kill").mockImplementation(() => true); // "alive" for the poll
    const killSpy = vi.spyOn(process, "kill");

    const stopping = sm.stopServer(child);
    expect(proc.kill).toHaveBeenCalledTimes(1);
    // Once it reported exit, nothing should signal the pid directly.
    expect(killSpy).not.toHaveBeenCalledWith(777, "SIGTERM");
    expect(child.exitCode).toBe(0);
    // Let the poller see it gone.
    process.kill.mockImplementation(() => {
      throw new Error("ESRCH");
    });
    const result = await stopping;
    expect(result.stopped).toBe(true);
  });
});
