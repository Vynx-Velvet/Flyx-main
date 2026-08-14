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
    expect(env.HOSTNAME).toBe("0.0.0.0"); // LAN sharing on by default
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

  it.skipIf(process.platform === "win32")("writes .env with 0600 permissions", async () => {
    const { writeEnv } = await import("../src/env-store.js");
    writeEnv({ A: "1" });
    const mode = fs.statSync(envPathOf()).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});
