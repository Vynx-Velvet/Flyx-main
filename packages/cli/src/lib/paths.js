/**
 * Flyx CLI — Platform paths and constants.
 *
 * Port of packages/desktop/main/paths.js
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

function getStandaloneDir() {
  if (process.env.FLYX_STANDALONE_DIR) {
    const d = path.resolve(process.env.FLYX_STANDALONE_DIR);
    if (fs.existsSync(d)) return d;
  }
  // Repo root (2 levels up from packages/cli/src/lib/)
  const repo = path.resolve(__dirname, "..", "..", "..", "..");
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
  getDataDir,
  getStandaloneDir,
  // Derived paths
  envPath: path.join(DATA_DIR, ".env"),
  storePath: path.join(DATA_DIR, "store.json"),
  statePath: path.join(DATA_DIR, "state.json"),
  configPath: path.join(DATA_DIR, "config.json"),
  logsDir: path.join(DATA_DIR, "logs"),
  serverLog: path.join(DATA_DIR, "logs", "flyx-server.log"),
  pidPath: path.join(DATA_DIR, "flyx.pid"),
};
