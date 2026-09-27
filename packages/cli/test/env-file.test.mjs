import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRequire } from "module";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);
const { makeTempDataDir, loadFresh, rmrf } = require("./helpers.js");

describe("env-file", () => {
  let dir;
  let envFile;

  beforeEach(() => {
    dir = makeTempDataDir();
    envFile = loadFresh(dir, "lib/env-file.js");
  });
  afterEach(() => rmrf(dir));

  it("rejects values containing CR, LF or NUL", () => {
    for (const bad of ["a\nJWT_SECRET=evil", "a\rb", "a\u0000b"]) {
      expect(() => envFile.writeEnv({ TMDB_API_KEY: bad })).toThrow(/line break/);
      expect(() => envFile.updateEnv("TMDB_API_KEY", bad)).toThrow(/line break/);
    }
    expect(fs.existsSync(path.join(dir, ".env"))).toBe(false);
  });

  it("refuses blocked keys via updateEnv", () => {
    for (const key of [
      "NODE_OPTIONS",
      "node_path",
      "ELECTRON_RUN_AS_NODE",
      "npm_config_prefix",
      "LD_PRELOAD",
      "DYLD_INSERT_LIBRARIES",
      "PATH",
      "ComSpec",
      "HOME",
      "OPENSSL_CONF",
      "FLYX_FFMPEG_PATH",
      "FLYX_DATA_DIR",
      "FLYX_SERVER_HOST",
    ]) {
      expect(() => envFile.updateEnv(key, "x"), key).toThrow(/cannot be set/);
    }
  });

  it("rejects invalid key names", () => {
    expect(() => envFile.updateEnv("BAD KEY", "x")).toThrow(/Invalid env key/);
    expect(() => envFile.updateEnv("A=B", "x")).toThrow(/Invalid env key/);
  });

  it("drops blocked keys already present when rewriting", () => {
    fs.writeFileSync(path.join(dir, ".env"), "NODE_OPTIONS=--require=/tmp/x.js\nTMDB_API_KEY=abc\n");
    envFile.updateEnv("PORT", "3891");
    const vars = envFile.readEnv();
    expect(vars.NODE_OPTIONS).toBeUndefined();
    expect(vars.TMDB_API_KEY).toBe("abc");
    expect(vars.PORT).toBe("3891");
  });

  it("filterBlockedKeys strips process-control keys", () => {
    const out = envFile.filterBlockedKeys({
      NODE_OPTIONS: "x",
      PATH: "x",
      FLYX_STANDALONE_DIR: "x",
      JWT_SECRET: "keep",
      HOSTNAME: "127.0.0.1",
    });
    expect(out).toEqual({ JWT_SECRET: "keep", HOSTNAME: "127.0.0.1" });
  });

  it("writes atomically with 0600 permissions (POSIX)", () => {
    envFile.writeEnv({ JWT_SECRET: "s3cret", HOSTNAME: "127.0.0.1" });
    const p = path.join(dir, ".env");
    expect(envFile.readEnv()).toEqual({ JWT_SECRET: "s3cret", HOSTNAME: "127.0.0.1" });
    expect(fs.existsSync(p + ".tmp")).toBe(false);
    if (process.platform !== "win32") {
      expect(fs.statSync(p).mode & 0o777).toBe(0o600);
    }
  });
});
