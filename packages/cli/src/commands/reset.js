/**
 * flyx reset — Factory reset. Stops server, deletes all data.
 */

const fs = require("fs");
const path = require("path");
const { DATA_DIR } = require("../lib/paths");
const { readState, stopServer, isProcessAlive } = require("../lib/server");
const { ask, confirm } = require("../lib/prompts");

async function runReset(options = {}) {
  console.log("⚠️  FACTORY RESET — This will delete all Flyx data:\n");
  console.log(`   • All user accounts`);
  console.log(`   • Configuration (.env)`);
  console.log(`   • Logs`);
  console.log(`   • Provider caches`);
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
    await stopServer(state.pid);
  }

  // Delete contents of data dir
  const keepEnv = options.keepEnv || false;

  try {
    const entries = fs.readdirSync(DATA_DIR);
    for (const entry of entries) {
      if (keepEnv && entry === ".env") {
        console.log(`  Keeping: .env`);
        continue;
      }
      const fullPath = path.join(DATA_DIR, entry);
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`  Removed: ${entry}`);
    }
    console.log("\n✅ Flyx has been reset.");
    console.log("   Run 'flyx setup' to configure a fresh instance.\n");
  } catch (err) {
    console.error(`\n❌ Reset failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { default: runReset };
