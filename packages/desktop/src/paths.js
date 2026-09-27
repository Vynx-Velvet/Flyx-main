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
 * Prefers Electron's own app.isPackaged; outside Electron (unit tests,
 * plain Node) require("electron") yields the binary path, so we're not
 * packaged.
 */
function isPackaged() {
  try {
    const electron = require("electron");
    if (electron && electron.app && typeof electron.app.isPackaged === "boolean") {
      return electron.app.isPackaged;
    }
  } catch {}
  return false;
}

/**
 * Locate the embedded standalone server.
 *
 * Packaged: ONLY <resources>/server — fail closed (null → "embedded server
 * is missing") rather than trusting FLYX_STANDALONE_DIR or the CWD, either
 * of which would let whoever controls the launch environment / working
 * directory run their own server.js with the master token in its env.
 * Dev: FLYX_STANDALONE_DIR → repo .flyx-standalone → CWD fallback.
 *
 * @param {{packaged?: boolean, resourcesPath?: string, env?: object, cwd?: string}} [opts]
 */
function getStandaloneDir(opts = {}) {
  const packaged = opts.packaged !== undefined ? opts.packaged : isPackaged();
  const resourcesPath =
    opts.resourcesPath !== undefined ? opts.resourcesPath : process.resourcesPath;
  const env = opts.env || process.env;
  const cwd = opts.cwd || process.cwd();

  // Packaged: the build script ships .flyx-standalone as resources/server.
  if (packaged) {
    if (!resourcesPath) return null;
    const packagedDir = path.join(resourcesPath, "server");
    return fs.existsSync(packagedDir) ? packagedDir : null;
  }
  if (env.FLYX_STANDALONE_DIR) {
    const d = path.resolve(env.FLYX_STANDALONE_DIR);
    if (fs.existsSync(d)) return d;
  }
  // Repo root (3 levels up from packages/desktop/src/)
  const repo = path.resolve(__dirname, "..", "..", "..");
  const dev = path.join(repo, ".flyx-standalone");
  if (fs.existsSync(dev)) return dev;
  // CWD fallback (dev only)
  const alt = path.join(cwd, ".flyx-standalone");
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
