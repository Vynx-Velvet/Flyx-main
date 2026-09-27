import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRequire } from "module";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);
const { makeTempDataDir, loadFresh, rmrf } = require("./helpers.js");

describe("store", () => {
  let dir;
  let store;

  beforeEach(() => {
    dir = makeTempDataDir();
    store = loadFresh(dir, "lib/store.js");
  });
  afterEach(() => rmrf(dir));

  it("treats a missing store.json as empty", () => {
    expect(store.readStore()).toEqual({ version: 1, accounts: [], settings: {} });
    expect(fs.existsSync(path.join(dir, "store.json"))).toBe(true);
  });

  it("never overwrites a corrupt store.json — backs it up and throws", () => {
    const storePath = path.join(dir, "store.json");
    const garbage = '{"version":1,"accounts":[{"username":"admin"'; // truncated
    fs.writeFileSync(storePath, garbage);

    expect(() => store.readStore()).toThrow(store.CorruptStoreError);
    // Original untouched
    expect(fs.readFileSync(storePath, "utf-8")).toBe(garbage);
    // Backup created with the same content
    const backups = fs.readdirSync(dir).filter((f) => f.startsWith("store.json.corrupt-"));
    expect(backups).toHaveLength(1);
    expect(fs.readFileSync(path.join(dir, backups[0]), "utf-8")).toBe(garbage);

    // Account creation must not proceed on top of a corrupt store
    expect(() => store.createAccount("mallory", "salt:hash", false)).toThrow(store.CorruptStoreError);
    expect(fs.readFileSync(storePath, "utf-8")).toBe(garbage);
  });

  it("rejects valid JSON with the wrong shape", () => {
    fs.writeFileSync(path.join(dir, "store.json"), "null");
    expect(() => store.readStore()).toThrow(store.CorruptStoreError);
  });

  it("round-trips accounts and writes 0600 (POSIX)", () => {
    const a = store.createAccount("alice", "salt:hash", false);
    expect(a.isAdmin).toBe(true); // first account
    expect(store.listAccounts().map((x) => x.username)).toEqual(["alice"]);
    if (process.platform !== "win32") {
      expect(fs.statSync(path.join(dir, "store.json")).mode & 0o777).toBe(0o600);
    }
  });
});
