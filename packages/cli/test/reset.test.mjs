import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRequire } from "module";
import fs from "fs";
import os from "os";
import path from "path";

const require = createRequire(import.meta.url);
const { makeTempDataDir, loadFresh, rmrf } = require("./helpers.js");

describe("reset safety", () => {
  let dir;
  let reset;

  beforeEach(() => {
    dir = makeTempDataDir();
    reset = loadFresh(dir, "commands/reset.js");
  });
  afterEach(() => rmrf(dir));

  it("refuses a directory without any Flyx marker", () => {
    fs.writeFileSync(path.join(dir, "important.docx"), "x");
    expect(reset.checkResetTarget(dir)).toMatch(/no Flyx files/);
  });

  it("accepts a directory with a Flyx marker", () => {
    fs.writeFileSync(path.join(dir, "store.json"), "{}");
    expect(reset.checkResetTarget(dir)).toBeNull();
  });

  it("accepts logs/flyx-server.log as a marker", () => {
    fs.mkdirSync(path.join(dir, "logs"));
    fs.writeFileSync(path.join(dir, "logs", "flyx-server.log"), "");
    expect(reset.checkResetTarget(dir)).toBeNull();
  });

  it("refuses filesystem / drive roots even with a marker name", () => {
    const root = path.parse(dir).root;
    expect(reset.checkResetTarget(root)).toMatch(/root/);
  });

  it("refuses the home directory and its parents", () => {
    const home = os.homedir();
    expect(reset.checkResetTarget(home)).toMatch(/home directory/);
    expect(reset.checkResetTarget(path.dirname(home))).toMatch(/home directory|root/);
    // A fake home inside our temp dir: the temp dir itself is its parent.
    const fakeHome = path.join(dir, "user");
    fs.mkdirSync(fakeHome);
    fs.writeFileSync(path.join(dir, ".env"), "");
    expect(reset.checkResetTarget(dir, { homeDir: fakeHome })).toMatch(/home directory/);
    expect(reset.checkResetTarget(fakeHome, { homeDir: fakeHome })).toMatch(/home directory/);
  });

  it("refuses relative paths and non-directories", () => {
    expect(reset.checkResetTarget("relative/dir")).toMatch(/absolute/);
    const f = path.join(dir, "file");
    fs.writeFileSync(f, "");
    expect(reset.checkResetTarget(f)).toMatch(/not a directory/);
  });

  it("deletes only known Flyx entries", () => {
    const known = [".env", "store.json", "store.json.tmp", "state.json", "config.json",
      "downloads.json", "flyx.pid", "store.json.corrupt-2026-01-01T00-00-00-000Z"];
    for (const f of known) fs.writeFileSync(path.join(dir, f), "x");
    fs.mkdirSync(path.join(dir, "logs"));
    fs.writeFileSync(path.join(dir, "logs", "flyx-server.log"), "x");
    fs.writeFileSync(path.join(dir, "notes.txt"), "keep me");
    fs.mkdirSync(path.join(dir, "Documents"));

    const { removed, skipped } = reset.deleteFlyxEntries(dir);
    expect(removed.sort()).toEqual([...known, "logs"].sort());
    expect(skipped.sort()).toEqual(["Documents", "notes.txt"]);
    expect(fs.readdirSync(dir).sort()).toEqual(["Documents", "notes.txt"]);
  });

  it("--keep-env keeps .env", () => {
    fs.writeFileSync(path.join(dir, ".env"), "A=1");
    fs.writeFileSync(path.join(dir, "store.json"), "{}");
    reset.deleteFlyxEntries(dir, { keepEnv: true });
    expect(fs.readdirSync(dir)).toEqual([".env"]);
  });
});

describe("FLYX_DATA_DIR validation", () => {
  it("rejects a relative FLYX_DATA_DIR", () => {
    expect(() => loadFresh("relative/flyx", "lib/paths.js")).toThrow(/absolute/);
  });
});
