/**
 * flyx status — Show server status and info.
 */

const { readState, checkHealth, isProcessAlive } = require("../lib/server");
const { getLANURLs, getLocalURL } = require("../lib/network");
const { getAccountCount } = require("../lib/store");
const { envExists } = require("../lib/env-file");
const { PORT, DATA_DIR, STANDALONE_DIR } = require("../lib/paths");

async function runStatus(options = {}) {
  const json = options.json || false;
  const state = readState();
  const port = (state && state.port) || PORT;

  let running = false;
  let pid = null;
  let uptime = null;
  let version = null;
  let providerCount = null;
  let mode = null;

  // Check if running via state file
  if (state && state.pid && isProcessAlive(state.pid)) {
    const health = await checkHealth(port);
    if (health.ok) {
      running = true;
      pid = state.pid;
      mode = state.mode || "unknown";
      if (health.data) {
        uptime = health.data.uptime;
        version = health.data.version;
        providerCount = health.data.providers;
      }
    }
  }

  // Fallback: no state file but server responds
  if (!running) {
    const health = await checkHealth(port);
    if (health.ok) {
      running = true;
      mode = "foreground (no PID record)";
      if (health.data) {
        uptime = health.data.uptime;
        version = health.data.version;
        providerCount = health.data.providers;
      }
    }
  }

  const accounts = getAccountCount();
  const configured = envExists();
  const lanURLs = getLANURLs(port);
  const localURL = getLocalURL(port);

  if (json) {
    console.log(JSON.stringify({
      running,
      pid,
      port,
      mode,
      uptime,
      version,
      providerCount,
      accounts,
      configured,
      urls: { local: localURL, lan: lanURLs.map((u) => u.url) },
      dataDir: DATA_DIR,
      standaloneDir: STANDALONE_DIR,
    }, null, 2));
    return;
  }

  // Pretty output
  console.log("");
  if (running) {
    console.log("  🟢 Flyx is running");
    console.log(`     PID:       ${pid || "unknown"}`);
    console.log(`     Mode:      ${mode}`);
    console.log(`     Port:      ${port}`);
    if (uptime != null) {
      const mins = Math.floor(uptime / 60);
      const hrs = Math.floor(mins / 60);
      const time = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
      console.log(`     Uptime:    ${time}`);
    }
    if (version) console.log(`     Version:   ${version}`);
    if (providerCount != null) console.log(`     Providers: ${providerCount}`);
    console.log(`     Local:     ${localURL}`);
    for (const u of lanURLs) {
      console.log(`     LAN:       ${u.url}`);
    }
  } else {
    console.log("  🔴 Flyx is not running");
    console.log(`     Port:      ${port}`);
    console.log(`     Configured: ${configured ? "Yes" : "No (run 'flyx setup')"}`);
  }
  console.log(`     Accounts:  ${accounts}`);
  console.log(`     Data dir:  ${DATA_DIR}`);
  console.log("");
}

module.exports = { default: runStatus };
