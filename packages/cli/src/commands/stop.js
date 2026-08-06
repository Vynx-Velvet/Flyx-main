/**
 * flyx stop — Stop a running Flyx server.
 */

const { readState, stopServer, checkHealth, isProcessAlive } = require("../lib/server");
const { PORT } = require("../lib/paths");

async function runStop(options = {}) {
  const state = readState();
  const port = (state && state.port) || PORT;

  if (!state || !state.pid) {
    // Check if server is running without a state file
    const health = await checkHealth(port);
    if (health.ok) {
      console.log("⚠️  Flyx is running but has no PID record.");
      console.log("   It was likely started in foreground mode in another terminal.");
      console.log("   Stop it there with Ctrl+C.");
      process.exit(1);
    }
    console.log("Flyx is not running.");
    process.exit(0);
  }

  if (!isProcessAlive(state.pid)) {
    console.log("Flyx is not running (stale PID file cleaned up).");
    try { require("fs").unlinkSync(require("../lib/paths").statePath); } catch {}
    process.exit(0);
  }

  console.log(`Stopping Flyx (PID ${state.pid})...`);
  const { stopped, forced } = await stopServer(state.pid);

  if (stopped) {
    console.log(forced ? "✅ Stopped (forced)." : "✅ Stopped.");
  } else {
    console.log("⚠️  Could not confirm stop. Try 'flyx stop --force' or kill the process manually.");
    process.exit(1);
  }
}

module.exports = { default: runStop };
