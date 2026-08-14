/**
 * Flyx Desktop — Server process management.
 *
 * Port of packages/cli/src/lib/server.js (which is itself a port of the
 * Flyx 2.x desktop server-manager). Differences from the CLI version:
 *  - Spawns the standalone server with Electron's own bundled Node
 *    (process.execPath + ELECTRON_RUN_AS_NODE=1) — no system Node needed.
 *  - No PID/state files, no console output (Electron has no TTY).
 *  - Supports restart() for HOSTNAME/PORT re-binds.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");
const {
  PORT,
  DATA_DIR,
  STANDALONE_DIR,
  SERVER_SCRIPT,
  serverLog,
  logsDir,
} = require("./paths");
const { readEnv } = require("./env-store");

const HEALTH_POLL_MS = 1000;
const HEALTH_TIMEOUT_MS = 60000;
const HEALTH_PATH = "/api/health";

// ── Active child state ──────────────────────────────────────────

let activeChild = null;
let activeLogStream = null;

function isRunning() {
  return activeChild !== null && activeChild.exitCode === null;
}

function log(message) {
  ensureLogsDir();
  try {
    fs.appendFileSync(
      serverLog,
      `[desktop ${new Date().toISOString()}] ${message}\n`,
      "utf-8",
    );
  } catch {}
}

// ── Health check ─────────────────────────────────────────────────

function checkHealth(port) {
  return new Promise((resolve) => {
    const req = http.get(
      `http://127.0.0.1:${port || PORT}${HEALTH_PATH}`,
      { timeout: 2000 },
      (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => {
          try {
            resolve({ ok: res.statusCode === 200, data: JSON.parse(body) });
          } catch {
            resolve({ ok: res.statusCode === 200, data: null });
          }
        });
      },
    );
    req.on("error", () => resolve({ ok: false, data: null }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, data: null });
    });
  });
}

async function pollUntilReady(port, { onTick } = {}) {
  const start = Date.now();
  while (Date.now() - start < HEALTH_TIMEOUT_MS) {
    const { ok, data } = await checkHealth(port);
    const elapsed = Date.now() - start;
    if (ok) return { ready: true, data, elapsed };
    if (onTick) onTick(elapsed);
    await new Promise((r) => setTimeout(r, HEALTH_POLL_MS));
  }
  return { ready: false, data: null, elapsed: Date.now() - start };
}

// ── Server spawn ─────────────────────────────────────────────────

function ensureLogsDir() {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

/**
 * Spawn the standalone Next.js server as a child of Electron's Node.
 *
 * @param {{port?: number, hostname?: string, onExit?: (code: number|null) => void}} [opts]
 */
function spawnServer({ port, hostname, onExit } = {}) {
  if (!SERVER_SCRIPT || !fs.existsSync(SERVER_SCRIPT)) {
    throw new Error(
      "Flyx data is damaged: the embedded server is missing.\n" +
      `Expected: ${SERVER_SCRIPT || "not found"}\n` +
      "Reinstall the app to fix this.",
    );
  }

  const p = port || PORT;
  const h = hostname || "0.0.0.0";
  const env = readEnv();

  ensureLogsDir();

  // Merge AppData .env OVER process.env, but only for keys that have
  // non-empty values — a blank TMDB key in AppData should not overwrite
  // the real key from the standalone build.
  const filteredEnv = {};
  for (const [k, v] of Object.entries(env)) {
    if (v && String(v).trim()) {
      filteredEnv[k] = v;
    }
  }

  // Also read the standalone .env (has the FLYX_DESKTOP marker)
  const standaloneEnvPath = path.join(STANDALONE_DIR, "packages", "app", ".env");
  let standaloneEnv = {};
  if (fs.existsSync(standaloneEnvPath)) {
    const raw = fs.readFileSync(standaloneEnvPath, "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const k = trimmed.slice(0, eq);
      const v = trimmed.slice(eq + 1);
      if (v && v.trim()) standaloneEnv[k] = v;
    }
  }

  const serverEnv = {
    ...process.env,
    ...standaloneEnv,
    ...filteredEnv,
    FLYX_DATA_DIR: DATA_DIR,
    FLYX_DESKTOP: "true",
    // Electron's bundled Node runs the server (ELECTRON_RUN_AS_NODE=1)
    ELECTRON_RUN_AS_NODE: "1",
    HOSTNAME: filteredEnv.HOSTNAME || env.HOSTNAME || h,
    PORT: String(p),
    NODE_ENV: "production",
  };

  const cwd = path.join(STANDALONE_DIR, "packages", "app");
  const logStream = fs.createWriteStream(serverLog, { flags: "a" });

  log(`spawning server (port ${p}, hostname ${serverEnv.HOSTNAME})`);

  const child = spawn(process.execPath, [SERVER_SCRIPT], {
    cwd,
    env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });

  activeChild = child;
  activeLogStream = logStream;

  // Tee output to log file
  child.stdout.on("data", (d) => {
    logStream.write(d);
  });
  child.stderr.on("data", (d) => {
    logStream.write(d);
  });

  child.on("exit", (code) => {
    log(`server exited (code ${code === null ? "signal" : code})`);
    logStream.end();
    if (activeChild === child) {
      activeChild = null;
      activeLogStream = null;
    }
    if (onExit) onExit(code);
  });

  return child;
}

// ── Stop ─────────────────────────────────────────────────────────

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stopServer(child) {
  return new Promise((resolve) => {
    const pid = child ? child.pid : activeChild && activeChild.pid;
    if (!pid || !isProcessAlive(pid)) {
      resolve({ stopped: true, forced: false });
      return;
    }

    // SIGTERM first
    try { process.kill(pid, "SIGTERM"); } catch {}

    let forced = false;
    const grace = setTimeout(() => {
      forced = true;
      try { process.kill(pid, "SIGKILL"); } catch {}
      // On Windows, also try taskkill for process tree
      if (process.platform === "win32") {
        try {
          require("child_process").execSync(`taskkill /PID ${pid} /T /F 2>nul`, { stdio: "ignore" });
        } catch {}
      }
    }, 5000);

    // Poll for exit
    const check = setInterval(() => {
      if (!isProcessAlive(pid)) {
        clearTimeout(grace);
        clearInterval(check);
        resolve({ stopped: true, forced });
      }
    }, 300);

    // Max wait
    setTimeout(() => {
      clearTimeout(grace);
      clearInterval(check);
      resolve({ stopped: false, forced });
    }, 8000);
  });
}

// ── Restart ──────────────────────────────────────────────────────

/**
 * Stop the current server and start a fresh one (used when the
 * user changes network mode — HOSTNAME requires a re-bind).
 */
async function restart({ port, hostname, onExit } = {}) {
  const oldChild = activeChild;
  const oldStream = activeLogStream;
  if (oldChild) {
    await stopServer(oldChild);
    try { oldStream.end(); } catch {}
  }
  return spawnServer({ port, hostname, onExit });
}

module.exports = {
  isRunning,
  isProcessAlive,
  checkHealth,
  pollUntilReady,
  spawnServer,
  stopServer,
  restart,
  ensureLogsDir,
  log,
  HEALTH_TIMEOUT_MS,
};
