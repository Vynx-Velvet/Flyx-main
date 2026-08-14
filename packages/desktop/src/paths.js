/**
 * Flyx Desktop — Platform paths and constants.
 *
 * Port of packages/cli/src/lib/paths.js (which is itself a port of the
 * Flyx 2.x desktop paths module). Differences from the CLI version:
 *  - The standalone server lives in <resources>/server when packaged.
 *  - No state.json / flyx.pid — Electron keeps process state in memory.
 */

const path = require("path");
const os = require("os");
const fs = require("fs");

const PORT = 3891;

function getDataDir() {
  if (process.env.FLYX_DATA_DIR) {
    return path.resolve(process.env.FLYX_DATA_DIR);
  }
  if (process.platform === "win32") {
    const localAppData =
      process.env.LOCALAPPDATA ||
      path.join(os.homedir(), "AppData", "Local");
    return path.join(localAppData, "flyx");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "flyx");
  }
  return path.join(os.homedir(), ".local", "share", "flyx");
}

const DATA_DIR = getDataDir();

/**
 * Whether we're running inside a packaged app (vs `electron .` dev).
 * In a packaged app `process.defaultApp` is unset.
 */
function isPackaged() {
  return !process.defaultApp;
}

function getStandaloneDir() {
  // Packaged: the build script ships .flyx-standalone as resources/server.
  if (isPackaged() && process.resourcesPath) {
    const packaged = path.join(process.resourcesPath, "server");
    if (fs.existsSync(packaged)) return packaged;
  }
  if (process.env.FLYX_STANDALONE_DIR) {
    const d = path.resolve(process.env.FLYX_STANDALONE_DIR);
    if (fs.existsSync(d)) return d;
  }
  // Repo root (3 levels up from packages/desktop/src/)
  const repo = path.resolve(__dirname, "..", "..", "..");
  const dev = path.join(repo, ".flyx-standalone");
  if (fs.existsSync(dev)) return dev;
  // CWD fallback
  const alt = path.join(process.cwd(), ".flyx-standalone");
  if (fs.existsSync(alt)) return alt;
  return null;
}

const STANDALONE_DIR = getStandaloneDir();
const SERVER_SCRIPT = STANDALONE_DIR
  ? path.join(STANDALONE_DIR, "packages", "app", "server.js")
  : null;

module.exports = {
  PORT,
  DATA_DIR,
  STANDALONE_DIR,
  SERVER_SCRIPT,
  isPackaged,
  getDataDir,
  getStandaloneDir,
  // Derived paths
  envPath: path.join(DATA_DIR, ".env"),
  storePath: path.join(DATA_DIR, "store.json"),
  configPath: path.join(DATA_DIR, "config.json"),
  logsDir: path.join(DATA_DIR, "logs"),
  serverLog: path.join(DATA_DIR, "logs", "flyx-server.log"),
};
