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
let serverScript;

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.pid = 4242;
  child.exitCode = null;
  child.signalCode = null;
  child.kill = vi.fn();
  return child;
}

beforeEach(() => {
  resetDesktopModules();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();

  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "flyx-sm-"));
  standaloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "flyx-standalone-"));
  const appDir = path.join(standaloneDir, "packages", "app");
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(path.join(appDir, "server.js"), "// stub server\n");
  fs.writeFileSync(
    path.join(appDir, ".env"),
    "FLYX_DESKTOP=true\nTMDB_API_KEY=standaloneKey\n",
  );
  serverScript = path.join(appDir, "server.js");

  vi.stubEnv("FLYX_DATA_DIR", dataDir);
  vi.stubEnv("FLYX_STANDALONE_DIR", standaloneDir);
  vi.stubEnv("TMDB_API_KEY", "processKey");
});

describe("spawnServer", () => {
  it("spawns Electron-as-node with the right script, cwd, and env merge order", async () => {
    // Data-dir .env beats process.env and the standalone .env;
    // blank values never override.
    fs.writeFileSync(
      path.join(dataDir, ".env"),
      "TMDB_API_KEY=dataKey\nHOSTNAME=1.2.3.4\nEMPTY_KEY=\n",
    );

    const fake = fakeChild();
    const spawnSpy = vi.spyOn(cp, "spawn").mockReturnValue(fake);

    const sm = await import("../src/server-manager.js");
    const child = sm.spawnServer({ port: 3901, hostname: "127.0.0.1" });

    expect(child).toBe(fake);
    expect(spawnSpy).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = spawnSpy.mock.calls[0];

    expect(cmd).toBe(process.execPath); // Electron's bundled Node
    expect(args).toEqual([serverScript]);
    expect(opts.cwd).toBe(path.join(standaloneDir, "packages", "app"));

    expect(opts.env.ELECTRON_RUN_AS_NODE).toBe("1");
    expect(opts.env.FLYX_DESKTOP).toBe("true");
    expect(opts.env.NODE_ENV).toBe("production");
    expect(opts.env.PORT).toBe("3901");
    expect(opts.env.FLYX_DATA_DIR).toBe(dataDir);
    // Merge order: data .env > standalone .env > process.env
    expect(opts.env.TMDB_API_KEY).toBe("dataKey");
    // HOSTNAME from .env beats the hostname param
    expect(opts.env.HOSTNAME).toBe("1.2.3.4");
    // Blank values are filtered out entirely
    expect(opts.env.EMPTY_KEY).toBeUndefined();

    sm.stopServer(child);
  });

  it("falls back to the hostname param when .env has none", async () => {
    vi.spyOn(cp, "spawn").mockReturnValue(fakeChild());
    const sm = await import("../src/server-manager.js");
    const child = sm.spawnServer({ port: 3902, hostname: "127.0.0.1" });

    const [, , opts] = cp.spawn.mock.calls[0];
    expect(opts.env.HOSTNAME).toBe("127.0.0.1");
    expect(opts.env.PORT).toBe("3902");

    sm.stopServer(child);
  });

  it(
    "throws when no standalone server is bundled",
    async () => {
      // Only meaningful on a clean checkout (the repo dev build at
      // .flyx-standalone/ is a fallback that masks this case).
      const repoStandalone = path.resolve(__dirname, "..", "..", "..", ".flyx-standalone");
      if (fs.existsSync(repoStandalone)) return;

      vi.stubEnv("FLYX_STANDALONE_DIR", path.join(dataDir, "missing"));
      delete process.resourcesPath;
      const sm = await import("../src/server-manager.js");
      expect(() => sm.spawnServer()).toThrow(/embedded server is missing/);
    },
  );

  it("tracks liveness via the child exit event", async () => {
    const fake = fakeChild();
    vi.spyOn(cp, "spawn").mockReturnValue(fake);
    const sm = await import("../src/server-manager.js");

    const child = sm.spawnServer({});
    expect(sm.isRunning()).toBe(true);

    child.emit("exit", 0);
    expect(sm.isRunning()).toBe(false);
  });
});

describe("stopServer", () => {
  it("SIGTERMs a real child and resolves when it exits", async () => {
    const { spawn } = await vi.importActual("child_process");
    const sm = await import("../src/server-manager.js");

    const victim = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const result = await sm.stopServer(victim);
    expect(result.stopped).toBe(true);
    expect(result.forced).toBe(false);
  }, 15000);
});

describe("pollUntilReady", () => {
  it("detects a healthy server", async () => {
    const { createServer } = await vi.importActual("http");
    const sm = await import("../src/server-manager.js");

    const srv = createServer((req, res) => {
      if (req.url === "/api/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise((resolve) => srv.listen(0, "127.0.0.1", resolve));
    const port = srv.address().port;

    const result = await sm.pollUntilReady(port);
    expect(result.ready).toBe(true);
    expect(result.data.status).toBe("ok");

    await new Promise((resolve) => srv.close(resolve));
  });

  it("reports unhealthy on a dead port", async () => {
    const sm = await import("../src/server-manager.js");
    const result = await sm.checkHealth(1); // port 1 is never healthy
    expect(result.ok).toBe(false);
  }, 10000);
});
