/**
 * Test helpers: load CLI modules fresh against an isolated temp FLYX_DATA_DIR.
 * Never touches the real Flyx data dir.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const SRC = path.resolve(__dirname, "..", "src");

function makeTempDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "flyx-cli-test-"));
}

/** Point FLYX_DATA_DIR at `dataDir` and require `relPath` (under src/) fresh. */
function loadFresh(dataDir, relPath) {
  process.env.FLYX_DATA_DIR = dataDir;
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(SRC)) delete require.cache[key];
  }
  return require(path.join(SRC, relPath));
}

function rmrf(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

module.exports = { makeTempDataDir, loadFresh, rmrf };
