/**
 * Flyx Desktop — carry browser storage over from the pre-3.2.5 origin.
 *
 * Up to 3.2.4 the window loaded http://localhost:<port>; since 3.2.5 it
 * loads http://127.0.0.1:<port> (see security.js). localStorage is kept
 * per origin, so the watchlist, Continue Watching progress, manga progress
 * and player/subtitle preferences saved under "localhost" were invisible
 * after the update — still on disk (downgrading showed them again), just
 * under the old origin.
 *
 * Before the window loads, this copies the old origin's localStorage into
 * the new one:
 *  - the watchlist is a union (items added since the update are kept),
 *  - watch / manga progress keep the newer entry per title,
 *  - every other key is copied only if the new origin doesn't have it.
 * The old origin's data is left untouched, so going back to 3.2.4 still
 * works.
 *
 * No request is ever made to "localhost" (which may resolve to [::1],
 * where another program could be listening — the reason for the switch):
 * each origin is opened as an empty data: page whose base URL is that
 * origin, which gives script access to its storage and nothing else.
 *
 * It runs again only when the old origin's content changes (someone used
 * 3.2.4 again) — never on every launch, which would bring back items
 * deliberately removed from the watchlist.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const WATCHLIST = "flyx_watchlist_v1";
const WATCH_PROGRESS = "flyx_watch_progress";
const MANGA_PROGRESS = "flyx_manga_progress_v1";
const MERGED_BASES = [WATCHLIST, WATCH_PROGRESS, MANGA_PROGRESS];

const MARKER_FILE = "origin-storage-migration.json";
const TIMEOUT_MS = 15000;

// ── Pure merge logic ────────────────────────────────────────────

/** { base, scope } for per-account keys (`<base>` or `<base>:<accountId>`). */
function mergedKeyInfo(key) {
  for (const base of MERGED_BASES) {
    if (key === base) return { base, scope: null };
    if (key.startsWith(base + ":")) return { base, scope: key.slice(base.length + 1) };
  }
  return null;
}

function parse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function watchlistId(item) {
  return item.id || `${item.mediaType || "movie"}-${item.contentId}`;
}

function progressId(entry) {
  return [entry.contentId, entry.contentType, entry.seasonNumber ?? "", entry.episodeNumber ?? ""].join("|");
}

function progressTime(entry) {
  return Number(entry.updatedAt ?? entry.lastWatchedAt ?? 0) || 0;
}

/** Merge an old-origin value into the new origin's value for one key. */
function mergeValue(base, newRaw, oldRaw) {
  const next = parse(newRaw);
  const old = parse(oldRaw);

  if (base === WATCHLIST) {
    if (!Array.isArray(next) || !Array.isArray(old)) return newRaw;
    const have = new Set(next.filter(Boolean).map(watchlistId));
    const added = old.filter((i) => i && i.contentId && !have.has(watchlistId(i)));
    return added.length ? JSON.stringify([...next, ...added]) : newRaw;
  }

  if (base === WATCH_PROGRESS) {
    if (!Array.isArray(next) || !Array.isArray(old)) return newRaw;
    const byId = new Map();
    for (const e of [...next, ...old]) {
      if (!e || !e.contentId) continue;
      const id = progressId(e);
      const cur = byId.get(id);
      if (!cur || progressTime(e) > progressTime(cur)) byId.set(id, e);
    }
    const merged = [...byId.values()].sort((a, b) => progressTime(b) - progressTime(a));
    const out = JSON.stringify(merged);
    return out === JSON.stringify(next) ? newRaw : out;
  }

  if (base === MANGA_PROGRESS) {
    const isMap = (v) => v && typeof v === "object" && !Array.isArray(v);
    if (!isMap(next) || !isMap(old)) return newRaw;
    let changed = false;
    const merged = { ...next };
    for (const [id, entry] of Object.entries(old)) {
      const cur = merged[id];
      if (!cur || Number(entry?.lastReadAt ?? 0) > Number(cur?.lastReadAt ?? 0)) {
        merged[id] = entry;
        changed = true;
      }
    }
    return changed ? JSON.stringify(merged) : newRaw;
  }

  return newRaw;
}

/**
 * Writes that bring `oldEntries` (the localhost origin's localStorage) into
 * the 127.0.0.1 origin whose current contents are `newEntries`.
 *
 * A pre-account-scoping key (bare `flyx_watchlist_v1`) goes into the one
 * account key of that kind the new origin already has, when there is
 * exactly one — the app's own legacy migration would otherwise drop it in
 * favor of the existing account key.
 *
 * @param {Record<string,string>} oldEntries
 * @param {Record<string,string>} newEntries
 * @returns {Record<string,string>} key → value to set on the new origin
 */
function planMigration(oldEntries, newEntries) {
  const current = { ...newEntries };
  const writes = {};

  for (const [key, oldValue] of Object.entries(oldEntries)) {
    if (typeof oldValue !== "string") continue;
    const info = mergedKeyInfo(key);

    let target = key;
    if (info && info.scope === null && !(key in current)) {
      const scoped = Object.keys(current).filter((k) => k.startsWith(key + ":"));
      if (scoped.length === 1) target = scoped[0];
    }

    if (!(target in current)) {
      writes[target] = oldValue;
      current[target] = oldValue;
      continue;
    }
    if (info) {
      const merged = mergeValue(info.base, current[target], oldValue);
      if (merged !== current[target]) {
        writes[target] = merged;
        current[target] = merged;
      }
    }
    // Any other key the new origin already has: its value wins.
  }
  return writes;
}

/** Stable fingerprint of an origin's storage (to notice later changes). */
function fingerprint(entries) {
  const sorted = Object.keys(entries)
    .sort()
    .map((k) => [k, entries[k]]);
  return crypto.createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

// ── Marker file ─────────────────────────────────────────────────

function readMarker(userDataDir) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(userDataDir, MARKER_FILE), "utf-8"));
    return data && typeof data.origins === "object" && data.origins ? data : { origins: {} };
  } catch {
    return { origins: {} };
  }
}

function writeMarker(userDataDir, marker) {
  const file = path.join(userDataDir, MARKER_FILE);
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, ...marker }, null, 2), "utf-8");
  fs.renameSync(tmp, file);
}

// ── Electron side ───────────────────────────────────────────────

/**
 * Run `fn(webContents)` in an empty page on `origin` (no network request).
 * Needs the app's "window-all-closed" handler to keep running when the
 * hidden window closes (main.js installs one).
 */
async function withOriginPage(BrowserWindow, origin, fn) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true,
    },
  });
  try {
    await win.loadURL("data:text/html;charset=utf-8,<!doctype html><title>Flyx</title>", {
      baseURLForDataURL: `${origin}/`,
    });
    const actual = await win.webContents.executeJavaScript("location.origin");
    if (actual !== origin) throw new Error(`storage page opened as ${actual}, expected ${origin}`);
    return await fn(win.webContents);
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

const READ_ALL = `(() => {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    out[k] = localStorage.getItem(k);
  }
  return out;
})()`;

function writeAll(writes) {
  // JSON is a valid JS literal; the page has no other content or script.
  return `(() => {
    const w = ${JSON.stringify(writes)};
    for (const k of Object.keys(w)) localStorage.setItem(k, w[k]);
    return Object.keys(w).length;
  })()`;
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Migrate storage from http://localhost:<p> (each legacy port) into
 * `targetOrigin`. Never throws — a failure is logged and retried on the
 * next launch; the app still starts.
 *
 * @param {{ BrowserWindow: any, userDataDir: string, targetOrigin: string,
 *           legacyPorts: number[], log: (msg: string) => void }} opts
 */
async function migrateLegacyOriginStorage({ BrowserWindow, userDataDir, targetOrigin, legacyPorts, log }) {
  const marker = readMarker(userDataDir);
  const ports = [...new Set(legacyPorts.map(Number).filter((p) => Number.isInteger(p) && p > 0))];

  for (const port of ports) {
    const source = `http://localhost:${port}`;
    try {
      await withTimeout(
        (async () => {
          const oldEntries = await withOriginPage(BrowserWindow, source, (wc) => wc.executeJavaScript(READ_ALL));
          const count = Object.keys(oldEntries).length;
          const print = fingerprint(oldEntries);
          const key = `${source}->${targetOrigin}`;
          if (count === 0 || marker.origins[key] === print) return;

          const written = await withOriginPage(BrowserWindow, targetOrigin, async (wc) => {
            const newEntries = await wc.executeJavaScript(READ_ALL);
            const writes = planMigration(oldEntries, newEntries);
            if (Object.keys(writes).length === 0) return 0;
            const n = await wc.executeJavaScript(writeAll(writes));
            // Chromium commits localStorage to disk a few seconds later;
            // flush now so a crash can't lose the copy after the marker
            // below says it's done.
            wc.session.flushStorageData();
            return n;
          });

          marker.origins[key] = print;
          writeMarker(userDataDir, marker);
          log(`[storage] carried ${written} saved item(s) over from ${source} (${count} key(s) there)`);
        })(),
        TIMEOUT_MS,
        `storage migration from ${source}`,
      );
    } catch (err) {
      log(`[storage] migration from ${source} failed: ${(err && err.message) || err}`);
    }
  }
}

module.exports = {
  migrateLegacyOriginStorage,
  planMigration,
  mergeValue,
  fingerprint,
  MARKER_FILE,
};
