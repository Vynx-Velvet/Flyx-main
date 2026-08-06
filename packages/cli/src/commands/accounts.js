/**
 * flyx accounts — Manage Flyx user accounts.
 *
 * Subcommands: add, list, remove, reset-password
 * All work directly with store.json — server can be running or stopped.
 */

const { hashPassword } = require("../lib/password");
const {
  createAccount,
  listAccounts,
  findAccount,
  deleteAccount,
  updatePassword,
  getAccountCount,
} = require("../lib/store");
const { ask, askPassword, confirm } = require("../lib/prompts");
const { checkHealth } = require("../lib/server");

function warnIfRunning() {
  // We'll check inline in each command
}

async function addAccount(username, options = {}) {
  if (!username) {
    console.error("Usage: flyx accounts add <username> [--admin] [--password <pw>]");
    process.exit(1);
  }

  if (username.length < 3) {
    console.error("❌ Username must be at least 3 characters.");
    process.exit(1);
  }

  if (findAccount(username)) {
    console.error(`❌ Account "${username}" already exists.`);
    process.exit(1);
  }

  let password;
  if (options.password) {
    password = options.password;
  } else {
    password = await askPassword("Password (min 8 chars)");
    if (!password) {
      console.error("❌ Password is required.");
      process.exit(1);
    }
  }

  if (password.length < 8) {
    console.error("❌ Password must be at least 8 characters.");
    process.exit(1);
  }

  const isAdmin = options.admin || false;
  const hash = await hashPassword(password);
  const account = createAccount(username, hash, isAdmin);

  if (options.json) {
    console.log(JSON.stringify(account));
  } else {
    console.log(`✅ Account created: ${account.username}${account.isAdmin ? " (admin)" : ""}`);
  }
}

function listAllAccounts(options = {}) {
  const accounts = listAccounts();

  if (options.json) {
    console.log(JSON.stringify({ accounts, total: accounts.length }, null, 2));
    return;
  }

  if (accounts.length === 0) {
    console.log("No accounts found. Run 'flyx setup' to create your first account.");
    return;
  }

  console.log("");
  console.log("  Username          Admin   Created");
  console.log("  ────────────────  ─────  ──────────────────────────");
  for (const a of accounts) {
    const name = a.username.padEnd(18);
    const admin = a.isAdmin ? " ✅   " : "      ";
    console.log(`  ${name} ${admin} ${a.createdAt}`);
  }
  console.log(`\n  ${accounts.length} account(s)\n`);
}

async function removeAccount(username, options = {}) {
  if (!username) {
    console.error("Usage: flyx accounts remove <username> [--yes]");
    process.exit(1);
  }

  const account = findAccount(username);
  if (!account) {
    console.error(`❌ Account "${username}" not found.`);
    process.exit(1);
  }

  // Guard: don't delete the last admin
  if (account.isAdmin) {
    const allAccounts = listAccounts();
    const adminCount = allAccounts.filter((a) => a.isAdmin).length;
    if (adminCount <= 1) {
      console.error("❌ Cannot delete the last admin account.");
      process.exit(1);
    }
  }

  if (!options.yes) {
    const ok = await confirm(`Delete account "${username}"? This cannot be undone.`, { defaultYes: false });
    if (!ok) { console.log("Cancelled."); return; }
  }

  deleteAccount(username);
  console.log(`✅ Account "${username}" removed.`);
}

async function resetPassword(username, options = {}) {
  if (!username) {
    console.error("Usage: flyx accounts reset-password <username> [--password <pw>]");
    process.exit(1);
  }

  const account = findAccount(username);
  if (!account) {
    console.error(`❌ Account "${username}" not found.`);
    process.exit(1);
  }

  let password;
  if (options.password) {
    password = options.password;
  } else {
    password = await askPassword("New password (min 8 chars)");
  }

  if (!password || password.length < 8) {
    console.error("❌ Password must be at least 8 characters.");
    process.exit(1);
  }

  const hash = await hashPassword(password);
  updatePassword(username, hash);
  console.log(`✅ Password reset for "${username}". Existing login sessions remain valid until expiry.`);
}

module.exports = { default: null, addAccount, listAllAccounts, removeAccount, resetPassword };
