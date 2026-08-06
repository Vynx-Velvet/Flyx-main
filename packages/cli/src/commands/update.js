/**
 * flyx update — Rebuild the standalone server and restart if needed.
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { readState, stopServer, isProcessAlive } = require("../lib/server");

async function runUpdate(options = {}) {
  const rootDir = path.resolve(__dirname, "..", "..", "..", "..");
  const buildScript = path.join(rootDir, "scripts", "build-standalone.mjs");

  if (!fs.existsSync(buildScript)) {
    console.error("❌ Build script not found. Are you running from the Flyx source directory?");
    console.error(`   Expected: ${buildScript}`);
    process.exit(1);
  }

  // Check if server is running
  const state = readState();
  const wasRunning = state && state.pid && isProcessAlive(state.pid);

  if (wasRunning) {
    console.log("Stopping server before update...");
    await stopServer(state.pid);
    console.log("");
  }

  // Run build
  console.log("Building standalone server...\n");
  try {
    execSync(`node "${buildScript}"`, {
      cwd: rootDir,
      stdio: "inherit",
    });
  } catch (err) {
    console.error("\n❌ Build failed.");
    if (wasRunning) {
      console.error("Your server is stopped. Run 'flyx start' to restart with the previous build.");
    }
    process.exit(1);
  }

  console.log("\n✅ Build complete.");

  // Restart if it was running
  if (wasRunning) {
    console.log("Restarting server...\n");
    const { default: runStart } = require("./start");
    await runStart({ daemon: state.mode === "daemon" });
  } else {
    console.log("Run 'flyx start' to launch the server.");
  }
}

module.exports = { default: runUpdate };
