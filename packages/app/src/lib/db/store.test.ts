import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  _resetStoreCache,
  createAccount,
  deleteAccount,
  getAccountAuth,
  getAccountCount,
  isStorePristine,
  listAccounts,
  setAccountPassword,
  withAccountLock,
} from "./index";

let dir: string;
const prevDataDir = process.env.FLYX_DATA_DIR;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "flyx-db-test-"));
  process.env.FLYX_DATA_DIR = dir;
  _resetStoreCache();
});

afterEach(() => {
  _resetStoreCache();
  if (prevDataDir === undefined) delete process.env.FLYX_DATA_DIR;
  else process.env.FLYX_DATA_DIR = prevDataDir;
  fs.rmSync(dir, { recursive: true, force: true });
});

const storeFile = () => path.join(dir, "store.json");

describe("lib/db store", () => {
  it("starts empty and pristine when store.json does not exist", () => {
    expect(getAccountCount()).toBe(0);
    expect(isStorePristine()).toBe(true);
    expect(fs.existsSync(storeFile())).toBe(true);
  });

  it("does not share the accounts array between fresh stores", () => {
    createAccount("alice", "salt:hash", true);
    _resetStoreCache();
    fs.rmSync(storeFile());
    // A second fresh store must not see alice via a shared EMPTY_STORE array.
    expect(getAccountCount()).toBe(0);
  });

  it("moves a corrupt store aside instead of silently wiping it", () => {
    fs.writeFileSync(storeFile(), "{ not json");
    expect(getAccountCount()).toBe(0);
    const aside = fs.readdirSync(dir).filter((f) => f.startsWith("store.json.corrupt-"));
    expect(aside).toHaveLength(1);
    expect(fs.readFileSync(path.join(dir, aside[0]), "utf-8")).toBe("{ not json");
    // Recovered, not pristine: anonymous default-admin creation stays off.
    expect(isStorePristine()).toBe(false);
    _resetStoreCache();
    expect(isStorePristine()).toBe(false); // persisted across restarts
  });

  it("treats a wrongly-shaped store as corrupt", () => {
    fs.writeFileSync(storeFile(), JSON.stringify({ accounts: "nope" }));
    expect(getAccountCount()).toBe(0);
    expect(isStorePristine()).toBe(false);
  });

  it("throws on a persistent read error and never overwrites the file", () => {
    // A directory where the file should be → EISDIR on every read attempt.
    fs.mkdirSync(storeFile());
    expect(() => getAccountCount()).toThrow(/could not be read/);
    expect(fs.statSync(storeFile()).isDirectory()).toBe(true);
  });

  it("clears the recovery flag once an account is created", () => {
    fs.writeFileSync(storeFile(), "garbage");
    expect(isStorePristine()).toBe(false);
    createAccount("owner", "salt:hash", true);
    const raw = JSON.parse(fs.readFileSync(storeFile(), "utf-8"));
    expect(raw.recoveredAt).toBeUndefined();
    expect(raw.initialized).toBe(true);
  });

  it("a store that once held accounts is not pristine even when emptied", () => {
    const a = createAccount("temp", "salt:hash", false);
    deleteAccount(a.id);
    expect(getAccountCount()).toBe(0);
    expect(isStorePristine()).toBe(false);
  });

  it("bumps tokenVersion on password change", () => {
    const a = createAccount("bob", "salt:hash", false);
    expect(getAccountAuth(a.id)?.tokenVersion).toBe(0);
    setAccountPassword(a.id, "salt2:hash2");
    expect(getAccountAuth(a.id)?.tokenVersion).toBe(1);
  });

  it("onlyIfEmpty refuses a second first account", () => {
    createAccount("first", "salt:hash", true, { onlyIfEmpty: true });
    expect(() => createAccount("second", "salt:hash", true, { onlyIfEmpty: true })).toThrow();
    expect(listAccounts().map((a) => a.username)).toEqual(["first"]);
  });

  it("withAccountLock serializes check-then-create flows", async () => {
    const attempt = (name: string) =>
      withAccountLock(async () => {
        if (getAccountCount() > 0) return null;
        await new Promise((r) => setTimeout(r, 20)); // simulated scrypt
        return createAccount(name, "salt:hash", true);
      });
    const results = await Promise.all([attempt("a"), attempt("b")]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(getAccountCount()).toBe(1);
  });

  it("writes store.json owner-only (POSIX)", () => {
    createAccount("perm", "salt:hash", false);
    if (process.platform !== "win32") {
      expect(fs.statSync(storeFile()).mode & 0o777).toBe(0o600);
    }
  });
});
