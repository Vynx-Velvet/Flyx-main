/**
 * flyx start — Launch the Flyx server.
 */

const fs = require("fs");
const { SERVER_SCRIPT, PORT } = require("../lib/paths");
const { spawnServer, pollUntilReady, checkHealth, readState, writeState, isProcessAlive } = require("../lib/server");
const { getLANURLs, getLocalURL, isPortInUse } = require("../lib/network");

async function runStart(options = {}) {
  const port = options.port || PORT;
  const daemon = options.daemon || false;

  // Pre-flight: standalone build
  if (!SERVER_SCRIPT || !fs.existsSync(SERVER_SCRIPT)) {
    console.error("❌ Server build not found.");
    console.error(`   Expected: ${SERVER_SCRIPT || "(not resolvable)"}`);
    console.error("   Run: flyx update");
    process.exit(1);
  }

  // Pre-flight: already running?
  const state = readState();
  if (state && state.pid && isProcessAlive(state.pid)) {
    const health = await checkHealth(port);
    if (health.ok) {
      console.log(`✅ Flyx is already running (PID ${state.pid})`);
      console.log(`   ${getLocalURL(port)}`);
      const urls = getLANURLs(port);
      if (urls.length > 0) console.log(`   ${urls[0].url}`);
      process.exit(0);
    }
    // Stale PID — clean up
    try { fs.unlinkSync(require("../lib/paths").statePath); } catch {}
  }

  // Pre-flight: port conflict with foreign process
  if (await isPortInUse(port)) {
    // Could be our own orphan process
    console.error(`❌ Port ${port} is already in use.`);
    console.error("   If Flyx is running in another terminal, stop it first.");
    console.error("   Otherwise, check: netstat -ano | findstr :" + port);
    process.exit(1);
  }

  // Spawn
  console.log("Starting Flyx...");
  const { child } = spawnServer({ port, hostname: options.hostname });

  writeState({
    version: 1,
    pid: child.pid,
    startedAt: new Date().toISOString(),
    port,
    mode: daemon ? "daemon" : "foreground",
  });

  // Health poll (with spinner)
  const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let si = 0;
  const { ready, data, elapsed } = await pollUntilReady(port, {
    onTick: (tickElapsed) => {
      if (!daemon) {
        process.stdout.write(`\r  ${spinner[si++ % spinner.length]} Waiting for server... (${Math.floor(tickElapsed / 1000)}s)`);
      }
    },
  });

  if (!ready) {
    console.error("\n❌ Server didn't start within 60 seconds.");
    console.error("   Check logs: flyx logs");
    child.kill("SIGTERM");
    process.exit(1);
  }

  // Success!
  const localURL = getLocalURL(port);
  const lanURLs = getLANURLs(port);

  console.log(`\r  ✅ Server ready in ${(elapsed / 1000).toFixed(1)}s${" ".repeat(20)}`);
  console.log("");
  console.log("  ╔══════════════════════════════════════╗");
  console.log("  ║        Flyx is Running! 🎬           ║");
  console.log("  ╠══════════════════════════════════════╣");
  console.log(`  ║  Local:  ${localURL.padEnd(28)}║`);
  for (const u of lanURLs) {
    console.log(`  ║  LAN:    ${u.url.padEnd(28)}║`);
  }
  console.log("  ╠══════════════════════════════════════╣");
  console.log(`  ║  PID: ${String(child.pid).padEnd(31)}║`);
  if (data?.version) {
    console.log(`  ║  v${String(data.version).padEnd(33)}║`);
  }
  console.log("  ╚══════════════════════════════════════╝");
  console.log("");
  console.log("  Commands: flyx status | flyx logs | flyx stop");
  console.log("");

  if (daemon) {
    child.unref();
    console.log("  Running in background. Use 'flyx stop' to shut down.\n");
    process.exit(0);
  }

  // Foreground: pipe child output to terminal
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);

  // Handle shutdown signals
  const cleanup = () => {
    console.log("\nShutting down...");
    child.kill("SIGTERM");
    setTimeout(() => {
      try { child.kill("SIGKILL"); } catch {}
      process.exit(0);
    }, 5000);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Wait for child to exit
  child.on("exit", (code) => {
    console.log(`\nServer stopped (exit ${code}).`);
    process.exit(code || 0);
  });
}

module.exports = { default: runStart };
