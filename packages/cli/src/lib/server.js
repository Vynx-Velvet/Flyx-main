/**
 * Flyx CLI — Server process management.
 *
 * Port of packages/desktop/main/server-manager.js
 * Handles: spawn, health polling, PID file, daemon mode.
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
  statePath,
  serverLog,
  logsDir,
} = require("./paths");
const { readEnv } = require("./env-file");

const HEALTH_POLL_MS = 1000;
const HEALTH_TIMEOUT_MS = 60000;
const HEALTH_PATH = "/api/health";

// ── PID / State ─────────────────────────────────────────────────

function readState() {
  try {
    if (!fs.existsSync(statePath)) return null;
    return JSON.parse(fs.readFileSync(statePath, "utf-8"));
  } catch {
    return null;
  }
}

function writeState(data) {
  if (!fs.existsSync(path.dirname(statePath))) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
  }
  const tmp = statePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, statePath);
}

function removeState() {
  try { fs.unlinkSync(statePath); } catch {}
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
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

function spawnServer({ port, hostname } = {}) {
  if (!SERVER_SCRIPT || !fs.existsSync(SERVER_SCRIPT)) {
    throw new Error(
      `Server build not found.\n` +
      `Expected: ${SERVER_SCRIPT || "not found"}\n` +
      `Run "flyx update" to build the standalone server.`,
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

  // Also read the standalone .env (has TMDB key from build step)
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
    FLYX_CLI: "true",
    HOSTNAME: filteredEnv.HOSTNAME || env.HOSTNAME || h,
    PORT: String(p),
    NODE_ENV: "production",
  };

  const cwd = path.join(STANDALONE_DIR, "packages", "app");
  const logStream = fs.createWriteStream(serverLog, { flags: "a" });

  const child = spawn("node", [SERVER_SCRIPT], {
    cwd,
    env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Tee output to log file
  child.stdout.on("data", (d) => {
    logStream.write(d);
  });
  child.stderr.on("data", (d) => {
    logStream.write(d);
  });

  child.on("exit", () => {
    logStream.end();
    removeState();
  });

  return { child, logStream };
}

// ── Stop ─────────────────────────────────────────────────────────

function stopServer(pid) {
  return new Promise((resolve) => {
    if (!isProcessAlive(pid)) {
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
        removeState();
        resolve({ stopped: true, forced });
      }
    }, 300);

    // Max wait
    setTimeout(() => {
      clearTimeout(grace);
      clearInterval(check);
      removeState();
      resolve({ stopped: false, forced });
    }, 8000);
  });
}

module.exports = {
  readState,
  writeState,
  removeState,
  isProcessAlive,
  checkHealth,
  pollUntilReady,
  spawnServer,
  stopServer,
  ensureLogsDir,
  HEALTH_TIMEOUT_MS,
};
