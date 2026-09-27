/**
 * Flyx CLI — Store.json read/write + account CRUD.
 *
 * Port of packages/app/src/lib/db/index.ts
 * Same schema, same file path resolution (FLYX_DATA_DIR).
 * Atomic writes (tmp + rename) to avoid corruption.
 */

const fs = require("fs");
const crypto = require("crypto");
const { DATA_DIR, storePath } = require("./paths");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

class CorruptStoreError extends Error {
  constructor(message, backupPath) {
    super(message);
    this.name = "CorruptStoreError";
    this.backupPath = backupPath;
  }
}

function emptyStore() {
  return { version: 1, accounts: [], settings: {} };
}

/**
 * Read store.json. A missing file is an empty store. A file that exists but
 * can't be parsed is NEVER silently replaced — that would wipe every account
 * and make the next account created an admin. Instead it is copied to
 * store.json.corrupt-<timestamp> and a CorruptStoreError is thrown.
 */
function readStore() {
  ensureDir();
  let raw;
  try {
    raw = fs.readFileSync(storePath, "utf-8");
  } catch (err) {
    if (err && err.code === "ENOENT") {
      const empty = emptyStore();
      writeStore(empty);
      return empty;
    }
    throw err;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = null;
  }
  if (!data || typeof data !== "object" || !Array.isArray(data.accounts)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${storePath}.corrupt-${stamp}`;
    try {
      fs.copyFileSync(storePath, backupPath, fs.constants.COPYFILE_EXCL);
      try { fs.chmodSync(backupPath, 0o600); } catch {}
    } catch {}
    throw new CorruptStoreError(
      `store.json is unreadable or corrupt (${storePath}).
` +
        `   A copy was saved to ${backupPath}.
` +
        `   Fix or restore the file by hand; Flyx will not overwrite it.`,
      backupPath,
    );
  }
  return data;
}

function writeStore(data) {
  ensureDir();
  const tmp = storePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: "utf-8", mode: 0o600 });
  try { fs.chmodSync(tmp, 0o600); } catch {}
  fs.renameSync(tmp, storePath);
}

// ── Account CRUD ────────────────────────────────────────────────

function createAccount(username, passwordHash, isAdmin) {
  const store = readStore();
  if (store.accounts.some((a) => a.username === username)) {
    throw new Error(`Account "${username}" already exists`);
  }
  const account = {
    id: crypto.randomUUID(),
    username,
    passwordHash,
    isAdmin: isAdmin || store.accounts.length === 0, // first is always admin
    createdAt: new Date().toISOString(),
  };
  store.accounts.push(account);
  writeStore(store);
  return { id: account.id, username: account.username, isAdmin: account.isAdmin, createdAt: account.createdAt };
}

function listAccounts() {
  const store = readStore();
  return store.accounts.map((a) => ({
    id: a.id,
    username: a.username,
    isAdmin: a.isAdmin,
    createdAt: a.createdAt,
  }));
}

function findAccount(username) {
  const store = readStore();
  return store.accounts.find((a) => a.username === username) || null;
}

function deleteAccount(username) {
  const store = readStore();
  const idx = store.accounts.findIndex((a) => a.username === username);
  if (idx === -1) return false;
  store.accounts.splice(idx, 1);
  writeStore(store);
  return true;
}

function updatePassword(username, newPasswordHash) {
  const store = readStore();
  const account = store.accounts.find((a) => a.username === username);
  if (!account) return false;
  account.passwordHash = newPasswordHash;
  writeStore(store);
  return true;
}

function getAccountCount() {
  return readStore().accounts.length;
}

module.exports = {
  CorruptStoreError,
  readStore,
  writeStore,
  createAccount,
  listAccounts,
  findAccount,
  deleteAccount,
  updatePassword,
  getAccountCount,
};
