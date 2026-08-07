/**
 * flyx config — View and edit Flyx configuration.
 */

const { readEnv, writeEnv } = require("../lib/env-file");
const { checkHealth, readState, isProcessAlive } = require("../lib/server");
const { getAccountCount } = require("../lib/store");
const { PORT, DATA_DIR } = require("../lib/paths");

const EDITABLE_KEYS = [
  "TMDB_API_KEY",
  "JWT_SECRET",
  "HOST_KEY",
  "HOSTNAME",
  "PORT",
  "FLYX_NO_BROWSER",
];

const SECRET_KEYS = ["JWT_SECRET", "HOST_KEY", "TMDB_API_KEY"];

function redact(key, value) {
  if (!SECRET_KEYS.includes(key) || !value) return value;
  if (value.length <= 8) return "••••";
  return value.slice(0, 4) + "••••" + value.slice(-4);
}

async function showConfig(options = {}) {
  const env = readEnv();
  const showSecrets = options.showSecrets || false;

  if (options.json) {
    const out = { ...env };
    if (!showSecrets) {
      for (const k of SECRET_KEYS) {
        if (out[k]) out[k] = redact(k, out[k]);
      }
    }
    out._dataDir = DATA_DIR;
    out._accounts = getAccountCount();
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  console.log("\n  Flyx Configuration\n");
  const entries = Object.entries(env).sort(([a], [b]) => a.localeCompare(b));
  for (const [key, value] of entries) {
    const display = showSecrets ? value : redact(key, value);
    console.log(`  ${key.padEnd(24)} ${display}`);
  }
  console.log("");
  console.log(`  Data dir:    ${DATA_DIR}`);
  console.log(`  Accounts:    ${getAccountCount()}`);
  console.log(`  Port:        ${env.PORT || PORT}`);

  // Show if server running
  const state = readState();
  if (state && state.pid && isProcessAlive(state.pid)) {
    console.log(`  Server:      running (PID ${state.pid})`);
    console.log("  ⚠️  Config changes require a restart.");
  } else {
    console.log("  Server:      stopped");
  }
  console.log("");
}

async function setConfig(key, value, options = {}) {
  if (!key || value === undefined) {
    console.error("Usage: flyx config set <key> <value>");
    process.exit(1);
  }

  if (!EDITABLE_KEYS.includes(key)) {
    console.error(`❌ Unknown config key: ${key}`);
    console.error(`   Editable keys: ${EDITABLE_KEYS.join(", ")}`);
    process.exit(1);
  }

  // Validate
  if (key === "PORT") {
    const p = parseInt(value, 10);
    if (isNaN(p) || p < 1 || p > 65535) {
      console.error("❌ PORT must be a number between 1 and 65535.");
      process.exit(1);
    }
  }

  const env = readEnv();
  env[key] = String(value);
  writeEnv(env);

  console.log(`✅ ${key} = ${SECRET_KEYS.includes(key) ? redact(key, value) : value}`);

  // Warn if server running
  const state = readState();
  if (state && state.pid && isProcessAlive(state.pid)) {
    console.log("⚠️  Restart required for changes to take effect: flyx stop && flyx start");
  }
}

module.exports = { default: showConfig, showConfig, setConfig };
