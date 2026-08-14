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

// Use FLYX_DATA_DIR in desktop mode, otherwise .flyx in CWD
const DB_DIR = process.env.FLYX_DATA_DIR
  ? path.resolve(process.env.FLYX_DATA_DIR)
  : path.resolve(process.cwd(), ".flyx");
const DB_PATH = path.join(DB_DIR, "store.json");

interface StoredAccount {
  id: string;
  username: string;
  passwordHash: string;
  isAdmin: boolean;
  createdAt: string;
}

interface StoreData {
  version: number;
  accounts: StoredAccount[];
  settings: Record<string, string>;
}

const EMPTY_STORE: StoreData = {
  version: 1,
  accounts: [],
  settings: {},
};

let _store: StoreData | null = null;
let _lastRead = 0;

function ensureDir(): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function readStore(): StoreData {
  // Re-read from disk if it's been more than 1 second since last read
  // (handles multiple server instances in dev mode with hot reload)
  if (_store && Date.now() - _lastRead < 1000) {
    return _store;
  }

  ensureDir();

  if (!fs.existsSync(DB_PATH)) {
    _store = { ...EMPTY_STORE };
    writeStore();
    _lastRead = Date.now();
    return _store!;
  }

  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<StoreData>;

    // Shape validation: a file that parses but isn't a store (partial write
    // during a crash, schema from an older build) would make every account
    // helper throw TypeError — which used to 500 the setup save forever.
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.accounts)
    ) {
      throw new Error("store.json has an unexpected shape");
    }

    _store = {
      version: typeof parsed.version === "number" ? parsed.version : 1,
      accounts: parsed.accounts,
      settings:
        parsed.settings && typeof parsed.settings === "object"
          ? parsed.settings
          : {},
    };
    _lastRead = Date.now();
    return _store;
  } catch {
    console.warn("[Flyx DB] Corrupt store file, starting fresh");
    _store = { ...EMPTY_STORE };
    writeStore();
    _lastRead = Date.now();
    return _store!;
  }
}

function writeStore(): void {
  ensureDir();
  // Atomic write (tmp + rename): a crash mid-write must never leave a
  // truncated store.json behind — readStore would reset it and the user's
  // accounts with it.
  const tmp = DB_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(_store, null, 2), "utf-8");
  fs.renameSync(tmp, DB_PATH);
}

// ─── Accounts ────────────────────────────────────────────────

export interface Account {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
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

export function createAccount(
  username: string,
  passwordHash: string,
  isAdmin = false,
): Account {
  const store = readStore();

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
  });

  writeStore();

  return { id, username, isAdmin, createdAt: now };
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
  store.accounts.splice(idx, 1);
  writeStore();
  return true;
}

export function getAccountCount(): number {
  const store = readStore();
  return Array.isArray(store.accounts) ? store.accounts.length : 0;
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
