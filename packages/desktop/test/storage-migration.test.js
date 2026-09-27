import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  planMigration,
  fingerprint,
  migrateLegacyOriginStorage,
  MARKER_FILE,
} = require("../src/storage-migration");

const wl = (...ids) =>
  JSON.stringify(ids.map((id) => ({ id: `movie-${id}`, contentId: String(id), mediaType: "movie", title: `T${id}`, addedAt: id })));

describe("planMigration", () => {
  it("copies everything into an empty new origin", () => {
    const old = { flyx_watchlist_v1: wl(1, 2), "flyx-sidebar-collapsed": "1" };
    expect(planMigration(old, {})).toEqual(old);
  });

  it("unions the watchlist, keeping items added since the update", () => {
    const writes = planMigration(
      { "flyx_watchlist_v1:acc": wl(1, 2) },
      { "flyx_watchlist_v1:acc": wl(3, 1) },
    );
    const ids = JSON.parse(writes["flyx_watchlist_v1:acc"]).map((i) => i.contentId);
    expect(ids).toEqual(["3", "1", "2"]);
  });

  it("puts a pre-account (bare) key into the new origin's single account key", () => {
    const writes = planMigration({ flyx_watchlist_v1: wl(1) }, { "flyx_watchlist_v1:acc": wl(2) });
    expect(Object.keys(writes)).toEqual(["flyx_watchlist_v1:acc"]);
    expect(JSON.parse(writes["flyx_watchlist_v1:acc"]).map((i) => i.contentId)).toEqual(["2", "1"]);
  });

  it("keeps the newer watch progress per episode", () => {
    const ep = (s, e, t, cur) => ({ contentId: "99", contentType: "tv", seasonNumber: s, episodeNumber: e, currentTime: cur, updatedAt: t });
    const writes = planMigration(
      { flyx_watch_progress: JSON.stringify([ep(1, 1, 100, 10), ep(1, 2, 500, 20)]) },
      { flyx_watch_progress: JSON.stringify([ep(1, 1, 300, 30)]) },
    );
    const merged = JSON.parse(writes.flyx_watch_progress);
    expect(merged.map((e) => [e.episodeNumber, e.currentTime])).toEqual([
      [2, 20],
      [1, 30],
    ]);
  });

  it("keeps the most recently read manga chapter", () => {
    const writes = planMigration(
      { flyx_manga_progress_v1: JSON.stringify({ a: { chapterNumber: 5, lastReadAt: 10 }, b: { chapterNumber: 2, lastReadAt: 10 } }) },
      { flyx_manga_progress_v1: JSON.stringify({ a: { chapterNumber: 7, lastReadAt: 20 } }) },
    );
    expect(JSON.parse(writes.flyx_manga_progress_v1)).toEqual({
      a: { chapterNumber: 7, lastReadAt: 20 },
      b: { chapterNumber: 2, lastReadAt: 10 },
    });
  });

  it("leaves other keys the new origin already has alone, and writes nothing when up to date", () => {
    expect(planMigration({ "flyx:player:volume": "0.2" }, { "flyx:player:volume": "0.8" })).toEqual({});
    const same = { flyx_watchlist_v1: wl(1) };
    expect(planMigration(same, same)).toEqual({});
  });

  it("never replaces new data with unparseable old data", () => {
    expect(planMigration({ flyx_watchlist_v1: "{broken" }, { flyx_watchlist_v1: wl(1) })).toEqual({});
  });
});

describe("migrateLegacyOriginStorage", () => {
  let dir;
  let stores;
  let logs;
  let flushes;

  // Fake BrowserWindow: each "origin page" reads/writes stores[origin].
  class FakeWindow {
    constructor() {
      this.destroyed = false;
      this.webContents = {
        session: { flushStorageData: () => flushes++ },
        executeJavaScript: async (code) => {
          const store = (stores[this.origin] ??= {});
          if (code === "location.origin") return this.origin;
          if (code.includes("localStorage.getItem")) return { ...store };
          const writes = JSON.parse(code.match(/const w = (.*);\n/)[1]);
          Object.assign(store, writes);
          return Object.keys(writes).length;
        },
      };
    }
    async loadURL(url, opts) {
      expect(url.startsWith("data:")).toBe(true);
      this.origin = opts.baseURLForDataURL.replace(/\/$/, "");
    }
    isDestroyed() {
      return this.destroyed;
    }
    destroy() {
      this.destroyed = true;
    }
  }

  const run = () =>
    migrateLegacyOriginStorage({
      BrowserWindow: FakeWindow,
      userDataDir: dir,
      targetOrigin: "http://127.0.0.1:3891",
      legacyPorts: [3891, 3891, NaN],
      log: (m) => logs.push(m),
    });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "flyx-storage-mig-"));
    stores = { "http://localhost:3891": { flyx_watchlist_v1: wl(1, 2) } };
    logs = [];
    flushes = 0;
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("migrates once, leaves the old origin intact, and records a fingerprint", async () => {
    await run();
    expect(JSON.parse(stores["http://127.0.0.1:3891"].flyx_watchlist_v1)).toHaveLength(2);
    expect(stores["http://localhost:3891"].flyx_watchlist_v1).toBe(wl(1, 2));
    expect(flushes).toBe(1);
    const marker = JSON.parse(fs.readFileSync(path.join(dir, MARKER_FILE), "utf-8"));
    expect(marker.origins["http://localhost:3891->http://127.0.0.1:3891"]).toBe(
      fingerprint(stores["http://localhost:3891"]),
    );
  });

  it("doesn't bring back an item removed after migrating", async () => {
    await run();
    stores["http://127.0.0.1:3891"].flyx_watchlist_v1 = wl(2);
    await run();
    expect(JSON.parse(stores["http://127.0.0.1:3891"].flyx_watchlist_v1).map((i) => i.contentId)).toEqual(["2"]);
  });

  it("runs again when the old version was used in between", async () => {
    await run();
    stores["http://localhost:3891"].flyx_watchlist_v1 = wl(1, 2, 3);
    await run();
    expect(JSON.parse(stores["http://127.0.0.1:3891"].flyx_watchlist_v1).map((i) => i.contentId)).toEqual(["1", "2", "3"]);
  });

  it("never throws; logs and retries next launch", async () => {
    const Broken = class extends FakeWindow {
      async loadURL() {
        throw new Error("boom");
      }
    };
    await migrateLegacyOriginStorage({
      BrowserWindow: Broken,
      userDataDir: dir,
      targetOrigin: "http://127.0.0.1:3891",
      legacyPorts: [3891],
      log: (m) => logs.push(m),
    });
    expect(logs.join("\n")).toMatch(/failed: boom/);
    expect(fs.existsSync(path.join(dir, MARKER_FILE))).toBe(false);
  });
});
