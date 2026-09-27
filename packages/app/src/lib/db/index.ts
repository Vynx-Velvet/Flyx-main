/**
 * Flyx 3.0 — JSON File Store
 *
 * Zero-dependency persistent storage for accounts and settings.
 * Uses a single JSON file on disk. Suitable for self-hosted
 * deployments with a small number of managed accounts.
 *
 * When the project adopts @flyx/db with proper SQLite/D1 support,
 * this can be swapped out transparently.
 */

import fs from "node:fs";
import path from "node:path";

// Use FLYX_DATA_DIR in desktop mode, otherwise .flyx in CWD. Resolved per
// call (not at import) so tests can point an isolated data dir at it.
function dbDir(): string {
  return process.env.FLYX_DATA_DIR
    ? path.resolve(process.env.FLYX_DATA_DIR)
    : path.resolve(process.cwd(), ".flyx");
}

function dbPath(): string {
  return path.join(dbDir(), "store.json");
}

interface StoredAccount {
  id: string;
  username: string;
  passwordHash: string;
  isAdmin: boolean;
  createdAt: string;
  /** Bumped on password change/reset — invalidates every JWT issued before. */
  tokenVersion?: number;
}

interface StoreData {
  version: number;
  accounts: StoredAccount[];
  settings: Record<string, string>;
  /** Set once any account has ever been created. */
  initialized?: boolean;
  /**
   * Set when an unreadable store.json was moved aside and replaced with an
   * empty one. While set, the default admin is never auto-created for an
   * anonymous visitor — only the desktop master or the setup wizard (run by
   * an authorized caller) may create the first account again.
   */
  recoveredAt?: string;
}

function emptyStore(): StoreData {
  return { version: 1, accounts: [], settings: {} };
}

let _store: StoreData | null = null;
let _storePath: string | null = null;
let _lastRead = 0;

function ensureDir(): void {
  const dir = dbDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Block the thread briefly (sync retry backoff for transient read errors). */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Read store.json, retrying transient errors (EBUSY/EPERM from AV scanners
 * or a concurrent rename on Windows). Returns null when the file does not
 * exist; throws on a persistent read error — never treat "couldn't read" as
 * "empty", that used to wipe every account.
 */
function readRaw(file: string): string | null {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return fs.readFileSync(file, "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      lastErr = err;
      sleepSync(50 * (attempt + 1));
    }
  }
  throw new Error(
    `[Flyx DB] store.json could not be read: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  );
}

function parseStore(raw: string): StoreData {
  const parsed = JSON.parse(raw) as Partial<StoreData>;
  // Shape validation: a file that parses but isn't a store (partial write
  // during a crash, schema from an older build) would make every account
  // helper throw TypeError.
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.accounts)) {
    throw new Error("store.json has an unexpected shape");
  }
  return {
    version: typeof parsed.version === "number" ? parsed.version : 1,
    accounts: parsed.accounts,
    settings:
      parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {},
    initialized: parsed.initialized === true || parsed.accounts.length > 0,
    ...(typeof parsed.recoveredAt === "string" ? { recoveredAt: parsed.recoveredAt } : {}),
  };
}

function readStore(): StoreData {
  const file = dbPath();
  // Re-read from disk if it's been more than 1 second since last read
  // (handles multiple server instances in dev mode with hot reload)
  if (_store && _storePath === file && Date.now() - _lastRead < 1000) {
    return _store;
  }

  ensureDir();
  const raw = readRaw(file); // throws on persistent read errors — no write

  if (raw === null) {
    _store = emptyStore();
    _storePath = file;
    writeStore();
    _lastRead = Date.now();
    return _store;
  }

  try {
    _store = parseStore(raw);
  } catch (err) {
    // Unparseable: keep the bad file for manual recovery instead of
    // overwriting it, and remember that this empty store is a recovery (see
    // StoreData.recoveredAt).
    const aside = `${file}.corrupt-${Date.now()}`;
    try {
      fs.renameSync(file, aside);
    } catch (renameErr) {
      throw new Error(
        `[Flyx DB] store.json is corrupt and could not be moved aside: ${
          renameErr instanceof Error ? renameErr.message : String(renameErr)
        }`,
      );
    }
    console.warn(
      `[Flyx DB] Corrupt store file (${err instanceof Error ? err.message : String(err)}) — moved to ${aside}`,
    );
    _store = { ...emptyStore(), recoveredAt: new Date().toISOString() };
    _storePath = file;
    writeStore();
  }
  _storePath = file;
  _lastRead = Date.now();
  return _store;
}

function writeStore(): void {
  ensureDir();
  // Atomic write (tmp + rename): a crash mid-write must never leave a
  // truncated store.json behind. Owner-only permissions — the file holds
  // password hashes.
  const file = dbPath();
  const tmp = file + ".tmp";
  try {
    fs.unlinkSync(tmp); // `mode` only applies when the file is created
  } catch {
    /* no stale tmp */
  }
  fs.writeFileSync(tmp, JSON.stringify(_store, null, 2), { encoding: "utf-8", mode: 0o600 });
  fs.renameSync(tmp, file);
}

/** Test hook: forget the in-memory cache so the next call re-reads disk. */
export function _resetStoreCache(): void {
  _store = null;
  _storePath = null;
  _lastRead = 0;
}

// ─── Account lock ────────────────────────────────────────────

let _accountLock: Promise<unknown> = Promise.resolve();

/**
 * Serialize account-creating flows. Callers check "are there accounts yet?"
 * and then await a password hash before creating — without this, two
 * concurrent first-run requests could both see zero accounts and both
 * create an admin.
 */
export function withAccountLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = _accountLock.then(fn, fn);
  _accountLock = run.catch(() => undefined);
  return run;
}

// ─── Accounts ────────────────────────────────────────────────

export interface Account {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface AccountAuth extends Account {
  tokenVersion: number;
}

export function findAccountByUsername(username: string): (StoredAccount & { passwordHash: string }) | null {
  const store = readStore();
  return store.accounts.find((a) => a.username === username) ?? null;
}

export function findAccountById(id: string): Account | null {
  const store = readStore();
  const a = store.accounts.find((acct) => acct.id === id);
  if (!a) return null;
  return { id: a.id, username: a.username, isAdmin: a.isAdmin, createdAt: a.createdAt };
}

/** Account + current token version (for session verification). */
export function getAccountAuth(id: string): AccountAuth | null {
  const store = readStore();
  const a = store.accounts.find((acct) => acct.id === id);
  if (!a) return null;
  return {
    id: a.id,
    username: a.username,
    isAdmin: a.isAdmin === true,
    createdAt: a.createdAt,
    tokenVersion: typeof a.tokenVersion === "number" ? a.tokenVersion : 0,
  };
}

/** Stored password hash for an account id (for current-password checks). */
export function getPasswordHash(id: string): string | null {
  const store = readStore();
  return store.accounts.find((a) => a.id === id)?.passwordHash ?? null;
}

export function createAccount(
  username: string,
  passwordHash: string,
  isAdmin = false,
  opts: { onlyIfEmpty?: boolean } = {},
): Account {
  const store = readStore();

  // Re-checked here, synchronously with the push below, so a count check
  // done before an awaited hash can't race another request.
  if (opts.onlyIfEmpty && store.accounts.length > 0) {
    throw new Error("An account already exists");
  }
  if (store.accounts.some((a) => a.username === username)) {
    throw new Error(`Account "${username}" already exists`);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  store.accounts.push({
    id,
    username,
    passwordHash,
    isAdmin,
    createdAt: now,
    tokenVersion: 0,
  });
  store.initialized = true;
  delete store.recoveredAt;

  writeStore();

  return { id, username, isAdmin, createdAt: now };
}

/** Replace an account's password hash and revoke its existing sessions. */
export function setAccountPassword(id: string, passwordHash: string): boolean {
  const store = readStore();
  const a = store.accounts.find((acct) => acct.id === id);
  if (!a) return false;
  a.passwordHash = passwordHash;
  a.tokenVersion = (typeof a.tokenVersion === "number" ? a.tokenVersion : 0) + 1;
  writeStore();
  return true;
}

export function listAccounts(): Account[] {
  const store = readStore();
  return store.accounts.map((a) => ({
    id: a.id,
    username: a.username,
    isAdmin: a.isAdmin,
    createdAt: a.createdAt,
  }));
}

export function deleteAccount(id: string): boolean {
  const store = readStore();
  const idx = store.accounts.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  // Sessions die with the account: getSession requires it to exist.
  store.accounts.splice(idx, 1);
  writeStore();
  return true;
}

export function getAccountCount(): number {
  const store = readStore();
  return Array.isArray(store.accounts) ? store.accounts.length : 0;
}

/**
 * True only for a store that has never held an account and wasn't rebuilt
 * after corruption — the one state in which an anonymous first-boot visitor
 * may be handed the default admin account.
 */
export function isStorePristine(): boolean {
  const store = readStore();
  return store.accounts.length === 0 && !store.initialized && !store.recoveredAt;
}

// ─── Settings ────────────────────────────────────────────────

export function getSetting(key: string): string | null {
  const store = readStore();
  return store.settings[key] ?? null;
}

export function setSetting(key: string, value: string): void {
  const store = readStore();
  store.settings[key] = value;
  writeStore();
}

export function getAllSettings(): Record<string, string> {
  const store = readStore();
  return { ...store.settings };
}
