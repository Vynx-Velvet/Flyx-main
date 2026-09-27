import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { resetDesktopModules } from "./helpers.js";

let dataDir;

beforeEach(() => {
  resetDesktopModules();
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "flyx-env-"));
  process.env.FLYX_DATA_DIR = dataDir;
  delete process.env.FLYX_STANDALONE_DIR;
});

const envPathOf = () => path.join(dataDir, ".env");

describe("env-store bootstrap", () => {
  it("writes all secrets on first run and marks firstRun", async () => {
    const { bootstrap, readEnv } = await import("../src/env-store.js");
    const result = bootstrap();
    expect(result).toEqual({ firstRun: true });

    const env = readEnv();
    expect(env.JWT_SECRET).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(env.HOST_KEY).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(env.FLYX_MASTER_TOKEN).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(env.HOSTNAME).toBe("127.0.0.1"); // localhost-only by default (LAN is opt-in)
    expect(env.FLYX_DESKTOP).toBe("true");
    expect(env.PORT).toBe("3891");
  });

  it("never overwrites an existing .env (JWT-rotation guard)", async () => {
    fs.writeFileSync(envPathOf(), "JWT_SECRET=user-secret\nHOSTNAME=127.0.0.1\n");
    const { bootstrap, readEnv } = await import("../src/env-store.js");
    const result = bootstrap();
    expect(result).toEqual({ firstRun: false });

    const env = readEnv();
    expect(env.JWT_SECRET).toBe("user-secret");
    expect(env.HOSTNAME).toBe("127.0.0.1");
    expect(env.PORT).toBeUndefined(); // untouched
  });
});

describe("env-store ensureMasterToken", () => {
  it("adds a token to an existing .env without touching other keys", async () => {
    fs.writeFileSync(
      envPathOf(),
      "JWT_SECRET=user-secret\nHOSTNAME=0.0.0.0\nPORT=3891\n",
    );
    const { ensureMasterToken, readEnv } = await import("../src/env-store.js");

    const token = ensureMasterToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{64}$/);

    const env = readEnv();
    expect(env.FLYX_MASTER_TOKEN).toBe(token);
    expect(env.JWT_SECRET).toBe("user-secret"); // untouched
    expect(env.HOSTNAME).toBe("0.0.0.0"); // untouched
  });

  it("returns the existing token unchanged (no rotation on every boot)", async () => {
    fs.writeFileSync(envPathOf(), "FLYX_MASTER_TOKEN=existing-token-abc\n");
    const { ensureMasterToken, readEnv } = await import("../src/env-store.js");

    expect(ensureMasterToken()).toBe("existing-token-abc");
    expect(readEnv().FLYX_MASTER_TOKEN).toBe("existing-token-abc");
  });
});

describe("env-store read/write", () => {
  it("roundtrips values and writes atomically (no .tmp leftovers)", async () => {
    const { writeEnv, readEnv } = await import("../src/env-store.js");
    writeEnv({ A: "1", B: "two words" });

    expect(readEnv()).toEqual({ A: "1", B: "two words" });
    const entries = fs.readdirSync(dataDir);
    expect(entries).not.toContain(".env.tmp");
  });

  it("updateEnv preserves other keys", async () => {
    const { writeEnv, updateEnv, readEnv } = await import("../src/env-store.js");
    writeEnv({ KEEP: "yes", CHANGE: "before" });
    updateEnv("CHANGE", "after");

    const env = readEnv();
    expect(env.KEEP).toBe("yes");
    expect(env.CHANGE).toBe("after");
  });

  it("updateEnv / writeEnv refuse values with CR, LF or NUL (no smuggled lines)", async () => {
    const { writeEnv, updateEnv, readEnv } = await import("../src/env-store.js");
    writeEnv({ JWT_SECRET: "keep-me" });

    expect(() => updateEnv("TMDB_API_KEY", "abc\nJWT_SECRET=attacker")).toThrow(/line break/);
    expect(() => updateEnv("TMDB_API_KEY", "abc\rJWT_SECRET=attacker")).toThrow(/line break/);
    expect(() => updateEnv("TMDB_API_KEY", "abc\u0000")).toThrow(/line break/);
    expect(() => updateEnv("BAD KEY", "x")).toThrow(/Invalid env key/);
    expect(() => writeEnv({ A: "1\nB=2" })).toThrow(/line break/);

    // Nothing was written by the rejected calls.
    expect(readEnv()).toEqual({ JWT_SECRET: "keep-me" });
  });

  it("readEnv drops lines with a mid-line CR or NUL so later writes never wedge", async () => {
    fs.writeFileSync(envPathOf(), "GOOD=1\r\nBAD=a\rB=2\nNUL=x\u0000y\n");
    const { readEnv, updateEnv } = await import("../src/env-store.js");
    expect(readEnv()).toEqual({ GOOD: "1" });
    expect(() => updateEnv("PORT", "3900")).not.toThrow();
  });

  it.skipIf(process.platform === "win32")("writes .env with 0600 permissions", async () => {
    const { writeEnv } = await import("../src/env-store.js");
    writeEnv({ A: "1" });
    const mode = fs.statSync(envPathOf()).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});

describe("env-store server env filtering (mirror of env-safety.ts)", () => {
  it("blocks process-level keys", async () => {
    const { isBlockedEnvKey } = await import("../src/env-store.js");
    for (const k of [
      "NODE_OPTIONS",
      "node_options",
      "NODE_EXTRA_CA_CERTS",
      "ELECTRON_RUN_AS_NODE",
      "npm_config_prefix",
      "LD_PRELOAD",
      "DYLD_INSERT_LIBRARIES",
      "PATH",
      "Path",
      "COMSPEC",
      "SystemRoot",
      "HOME",
      "APPDATA",
      "UV_THREADPOOL_SIZE",
      "OPENSSL_CONF",
      "SSL_CERT_FILE",
      "FLYX_FFMPEG_PATH",
      "FLYX_STANDALONE_DIR",
      "FLYX_DATA_DIR",
      "FLYX_VLC_PATH",
      "FLYX_UPDATE_REPO",
      "FLYX_SERVER_HOST",
    ]) {
      expect(isBlockedEnvKey(k), k).toBe(true);
    }
    for (const k of ["TMDB_API_KEY", "JWT_SECRET", "HOSTNAME", "PORT", "FLYX_MASTER_TOKEN", "FLYX_DESKTOP"]) {
      expect(isBlockedEnvKey(k), k).toBe(false);
    }
  });

  it("filterServerEnv keeps safe keys and reports skipped key NAMES only", async () => {
    const { filterServerEnv } = await import("../src/env-store.js");
    const { env, skipped } = filterServerEnv({
      TMDB_API_KEY: "k",
      HOSTNAME: "0.0.0.0",
      NODE_OPTIONS: "--import=data:text/javascript,evil",
      ELECTRON_RUN_AS_NODE: "1",
      "export BAD": "x",
      MULTI: "a\nB=1",
    });
    expect(env).toEqual({ TMDB_API_KEY: "k", HOSTNAME: "0.0.0.0" });
    expect(skipped.sort()).toEqual(["ELECTRON_RUN_AS_NODE", "MULTI", "NODE_OPTIONS", "export BAD"].sort());
  });
});
