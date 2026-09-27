/**
 * flyx reset — Factory reset. Stops server, deletes Flyx data.
 *
 * Safety: FLYX_DATA_DIR is user-controllable, so before deleting anything we
 * check the directory actually looks like a Flyx data dir and is not a
 * drive/filesystem root, the home directory or one of its parents. Only
 * entries Flyx itself creates are removed — anything else is left in place.
 * `--yes` skips the confirmation prompt, never these checks.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { DATA_DIR } = require("../lib/paths");
const { readState, stopServer, isProcessAlive } = require("../lib/server");
const { ask } = require("../lib/prompts");

/** At least one of these must exist for a directory to count as a Flyx data dir. */
const MARKER_ENTRIES = ["store.json", ".env", "state.json", path.join("logs", "flyx-server.log"), "flyx-server.log"];

/**
 * Entries Flyx (CLI, desktop app, server) writes into the data dir:
 *   .env, store.json, state.json, config.json, downloads.json (+ their
 *   atomic-write .tmp files and store.json.corrupt-* backups), flyx.pid,
 *   logs/ and a legacy top-level flyx-server.log.
 */
const KNOWN_FILE_RE = /^(\.env|store\.json|state\.json|config\.json|downloads\.json)(\.tmp(-[\w.-]+)?|\.corrupt-[\w.-]+|\.bak)?$/;
const KNOWN_EXACT = new Set(["flyx.pid", "logs", "flyx-server.log"]);

function isKnownFlyxEntry(name) {
  return KNOWN_EXACT.has(name) || KNOWN_FILE_RE.test(name);
}

function normalize(p) {
  let r = path.resolve(p);
  try { r = fs.realpathSync.native(r); } catch {}
  return process.platform === "win32" ? r.toLowerCase() : r;
}

function isSameOrParent(parent, child) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * Returns null if `dir` is safe to reset, otherwise a human-readable reason.
 * `homeDir` is injectable for tests.
 */
function checkResetTarget(dir, { homeDir = os.homedir() } = {}) {
  if (!dir || !path.isAbsolute(dir)) return "data directory is not an absolute path";
  const target = normalize(dir);

  if (path.parse(target).root === target || path.dirname(target) === target) {
    return "data directory is a filesystem/drive root";
  }
  if (homeDir) {
    const home = normalize(homeDir);
    if (isSameOrParent(target, home)) {
      return "data directory is your home directory or one of its parents";
    }
  }

  let stat;
  try { stat = fs.lstatSync(target); } catch {
    return "data directory does not exist";
  }
  if (!stat.isDirectory()) return "data directory is not a directory";

  const hasMarker = MARKER_ENTRIES.some((m) => fs.existsSync(path.join(target, m)));
  if (!hasMarker) {
    return "data directory contains no Flyx files (store.json, .env, state.json or flyx-server.log)";
  }
  return null;
}

/** Delete known Flyx entries from `dir`. Returns { removed, skipped }. */
function deleteFlyxEntries(dir, { keepEnv = false, log = () => {} } = {}) {
  const removed = [];
  const skipped = [];
  for (const entry of fs.readdirSync(dir)) {
    if (keepEnv && entry === ".env") {
      log(`  Keeping: .env`);
      continue;
    }
    if (!isKnownFlyxEntry(entry)) {
      skipped.push(entry);
      continue;
    }
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
    removed.push(entry);
    log(`  Removed: ${entry}`);
  }
  return { removed, skipped };
}

async function runReset(options = {}) {
  const problem = checkResetTarget(DATA_DIR);
  if (problem) {
    console.error(`❌ Refusing to reset ${DATA_DIR}: ${problem}.`);
    console.error("   Check FLYX_DATA_DIR. Nothing was deleted.");
    process.exit(1);
  }

  console.log("⚠️  FACTORY RESET — This will delete all Flyx data:\n");
  console.log(`   • All user accounts`);
  console.log(`   • Configuration (.env)`);
  console.log(`   • Logs`);
  console.log(`   • Download history`);
  console.log(`\n   Data directory: ${DATA_DIR}\n`);

  if (!options.yes) {
    const typed = await ask('Type "FLYX" to confirm reset');
    if (typed !== "FLYX") {
      console.log("Reset cancelled.");
      return;
    }
  }

  // Stop server if running
  const state = readState();
  if (state && state.pid && isProcessAlive(state.pid)) {
    console.log("Stopping server...");
    const res = await stopServer(state);
    if (res.refused) {
      console.log(`  ⚠️  Did not stop PID ${state.pid}: ${res.reason}.`);
    }
  }

  try {
    const { skipped } = deleteFlyxEntries(DATA_DIR, {
      keepEnv: options.keepEnv || false,
      log: (m) => console.log(m),
    });
    if (skipped.length > 0) {
      console.log(`\n  Left in place (not created by Flyx): ${skipped.join(", ")}`);
    }
    console.log("\n✅ Flyx has been reset.");
    console.log("   Run 'flyx setup' to configure a fresh instance.\n");
  } catch (err) {
    console.error(`\n❌ Reset failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { default: runReset, checkResetTarget, deleteFlyxEntries, isKnownFlyxEntry };
