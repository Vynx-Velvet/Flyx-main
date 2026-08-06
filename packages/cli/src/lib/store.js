/**
 * Flyx CLI — Store.json read/write + account CRUD.
 *
 * Port of packages/app/src/lib/db/index.ts
 * Same schema, same file path resolution (FLYX_DATA_DIR).
 * Atomic writes (tmp + rename) to avoid corruption.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DATA_DIR, storePath } = require("./paths");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore() {
  ensureDir();
  if (!fs.existsSync(storePath)) {
    const empty = { version: 1, accounts: [], settings: {} };
    writeStore(empty);
    return empty;
  }
  try {
    const raw = fs.readFileSync(storePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    console.warn("[flyx] Corrupt store.json, starting fresh");
    const empty = { version: 1, accounts: [], settings: {} };
    writeStore(empty);
    return empty;
  }
}

function writeStore(data) {
  ensureDir();
  const tmp = storePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
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
  readStore,
  writeStore,
  createAccount,
  listAccounts,
  findAccount,
  deleteAccount,
  updatePassword,
  getAccountCount,
};
