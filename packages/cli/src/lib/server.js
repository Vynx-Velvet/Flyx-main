/**
 * Flyx CLI — Server process management.
 *
 * Port of packages/desktop/main/server-manager.js
 * Handles: spawn, health polling, PID file, daemon mode.
 */

const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
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
const { readEnv, parseEnv, filterBlockedKeys } = require("./env-file");

const HEALTH_POLL_MS = 1000;
const HEALTH_TIMEOUT_MS = 60000;
const HEALTH_PATH = "/api/health";
// How far the server's self-reported start time (now - uptime) may drift from
// state.json's startedAt and still count as "the process we spawned".
const START_TIME_TOLERANCE_MS = 120000;
const DEFAULT_HOSTNAME = "127.0.0.1";

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
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: "utf-8", mode: 0o600 });
  fs.renameSync(tmp, statePath);
}

function removeState() {
  try { fs.unlinkSync(statePath); } catch {}
}

function isValidPid(pid) {
  return Number.isSafeInteger(pid) && pid > 0;
}

function isProcessAlive(pid) {
  if (!isValidPid(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ── Health check ─────────────────────────────────────────────────

function checkHealth(port, { bootNonce } = {}) {
  return new Promise((resolve) => {
    const headers = bootNonce ? { "x-flyx-boot-check": bootNonce } : {};
    const req = http.get(
      `http://127.0.0.1:${port || PORT}${HEALTH_PATH}`,
      { timeout: 2000, headers },
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
  const bootNonce = crypto.randomBytes(24).toString("hex");
  // Loopback by default. LAN exposure only when the user chose it in setup
  // (HOSTNAME in the data-dir .env) or passed --hostname explicitly.
  const env = filterBlockedKeys(readEnv());

  ensureLogsDir();

  // Merge AppData .env OVER process.env, but only for keys that have
  // non-empty values — a blank TMDB key in AppData should not overwrite
  // the placeholder from the standalone build. Blocked keys (NODE_OPTIONS,
  // PATH, FLYX_FFMPEG_PATH, …) were already dropped above: a hand-edited
  // .env must not be able to steer how the server process starts.
  const filteredEnv = {};
  for (const [k, v] of Object.entries(env)) {
    if (v && String(v).trim()) {
      filteredEnv[k] = v;
    }
  }

  // The standalone .env only holds non-secret placeholders written by
  // scripts/build-standalone.mjs; real secrets come from the data-dir .env.
  const standaloneEnvPath = path.join(STANDALONE_DIR, "packages", "app", ".env");
  let standaloneEnv = {};
  if (fs.existsSync(standaloneEnvPath)) {
    const parsed = filterBlockedKeys(parseEnv(fs.readFileSync(standaloneEnvPath, "utf-8")));
    for (const [k, v] of Object.entries(parsed)) {
      if (v && v.trim()) standaloneEnv[k] = v;
    }
  }

  const serverEnv = {
    ...process.env,
    ...standaloneEnv,
    ...filteredEnv,
    FLYX_DATA_DIR: DATA_DIR,
    FLYX_CLI: "true",
    HOSTNAME: hostname || filteredEnv.HOSTNAME || DEFAULT_HOSTNAME,
    PORT: String(p),
    NODE_ENV: "production",
    // Per-launch secret: /api/health answers bootOk:true only to a request
    // carrying it, which lets `flyx stop` prove the process on the port is
    // the one we spawned before signalling the recorded PID.
    FLYX_BOOT_NONCE: bootNonce,
  };

  const cwd = path.join(STANDALONE_DIR, "packages", "app");
  const logStream = fs.createWriteStream(serverLog, { flags: "a" });

  // Use the Node binary running the CLI, not whatever "node" is first on PATH.
  const child = spawn(process.execPath, [SERVER_SCRIPT], {
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

  return { child, logStream, bootNonce };
}

// ── Identity check ──────────────────────────────────────────────

/**
 * Decide whether the pid recorded in state.json is still *our* Flyx server
 * before signalling it — PIDs get reused, and state.json can be stale or
 * hand-edited. We require:
 *   1. an integer pid that is alive,
 *   2. /api/health answering "ok" on the recorded port,
 *   3. if state.json holds the launch's boot nonce, the server confirming it
 *      (bootOk: true) — only the process we spawned knows it, and
 *   4. (when both are known) the server's start time (now - uptime) matching
 *      state.startedAt within START_TIME_TOLERANCE_MS.
 * This is cross-platform (no wmic/ps parsing).
 */
async function verifyFlyxProcess(state) {
  if (!state || !isValidPid(state.pid)) {
    return { ok: false, reason: "no valid PID recorded" };
  }
  if (!isProcessAlive(state.pid)) {
    return { ok: false, reason: "process not running", stale: true };
  }
  const port = Number.isSafeInteger(state.port) ? state.port : PORT;
  const bootNonce = typeof state.bootNonce === "string" ? state.bootNonce : undefined;
  const health = await checkHealth(port, { bootNonce });
  if (!health.ok || !health.data || health.data.status !== "ok") {
    return { ok: false, reason: `Flyx health check on port ${port} did not respond` };
  }
  if (bootNonce && health.data.bootOk !== true) {
    return {
      ok: false,
      reason: `the server on port ${port} is not the one started with this PID record`,
      stale: true,
    };
  }
  const startedAt = Date.parse(state.startedAt || "");
  const uptime = Number(health.data.uptime);
  if (Number.isFinite(startedAt) && Number.isFinite(uptime)) {
    const serverStart = Date.now() - uptime * 1000;
    if (Math.abs(serverStart - startedAt) > START_TIME_TOLERANCE_MS) {
      return {
        ok: false,
        reason: `server on port ${port} was not started by this PID record (start time mismatch)`,
        stale: true,
      };
    }
  }
  return { ok: true };
}

// ── Stop ─────────────────────────────────────────────────────────

function killTree(pid) {
  if (!isValidPid(pid)) return;
  try { process.kill(pid, "SIGKILL"); } catch {}
  // On Windows, also try taskkill for the process tree
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    } catch {}
  }
}

/**
 * Stop the server described by `state` (the state.json record). Refuses to
 * signal anything that doesn't pass verifyFlyxProcess(). Resolves to
 * { stopped, forced, refused?, reason? }.
 */
async function stopServer(state, { force = false } = {}) {
  if (typeof state === "number") state = { pid: state }; // legacy call shape

  const pid = state && state.pid;
  if (!isValidPid(pid) || !isProcessAlive(pid)) {
    removeState();
    return { stopped: true, forced: false };
  }

  const check = await verifyFlyxProcess(state);
  if (!check.ok) {
    if (check.stale) removeState();
    return { stopped: false, forced: false, refused: true, reason: check.reason };
  }

  return new Promise((resolve) => {
    let forced = false;
    let grace = null;

    if (force) {
      forced = true;
      killTree(pid);
    } else {
      // SIGTERM first
      try { process.kill(pid, "SIGTERM"); } catch {}
      grace = setTimeout(() => {
        forced = true;
        killTree(pid);
      }, 5000);
    }

    // Poll for exit
    const poll = setInterval(() => {
      if (!isProcessAlive(pid)) {
        clearTimeout(grace);
        clearInterval(poll);
        clearTimeout(maxWait);
        removeState();
        resolve({ stopped: true, forced });
      }
    }, 300);

    // Max wait
    const maxWait = setTimeout(() => {
      clearTimeout(grace);
      clearInterval(poll);
      resolve({ stopped: false, forced });
    }, 8000);
  });
}

module.exports = {
  readState,
  writeState,
  removeState,
  isProcessAlive,
  isValidPid,
  verifyFlyxProcess,
  checkHealth,
  pollUntilReady,
  spawnServer,
  stopServer,
  ensureLogsDir,
  HEALTH_TIMEOUT_MS,
  DEFAULT_HOSTNAME,
};
