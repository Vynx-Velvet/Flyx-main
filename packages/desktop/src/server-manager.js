/**
 * Flyx Desktop — Server process management.
 *
 * Port of packages/cli/src/lib/server.js (which is itself a port of the
 * Flyx 2.x desktop server-manager). Differences from the CLI version:
 *  - Spawns the standalone server with Electron's own bundled Node
 *    (process.execPath + ELECTRON_RUN_AS_NODE=1) — no system Node needed.
 *  - No PID/state files, no console output (Electron has no TTY).
 *  - Supports restart() for HOSTNAME/PORT re-binds.
 *  - Boot nonce: every launch generates a random FLYX_BOOT_NONCE that only
 *    our server child knows. The health poll sends it back and requires
 *    `bootOk: true`, so a different local process squatting on the port
 *    can never be mistaken for our server (and handed the master cookie).
 */

const { spawn } = require("child_process");
const crypto = require("crypto");
const { EventEmitter } = require("events");
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
const { readEnv, filterServerEnv } = require("./env-store");

const HEALTH_POLL_MS = 1000;
const HEALTH_TIMEOUT_MS = 60000;
const HEALTH_PATH = "/api/health";

// Per-launch secret shared only with our own server child (env) — see the
// header comment. Never logged, never shown to the renderer.
const BOOT_NONCE = crypto.randomBytes(16).toString("hex");
const BOOT_HEADER = "x-flyx-boot-check";

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

/**
 * GET /api/health with the boot nonce. `bootOk` is true only when the
 * server echoed `bootOk: true` — i.e. it has our FLYX_BOOT_NONCE in its env.
 */
function checkHealth(port, { nonce = BOOT_NONCE } = {}) {
  return new Promise((resolve) => {
    const req = http.get(
      `http://127.0.0.1:${port || PORT}${HEALTH_PATH}`,
      { timeout: 2000, headers: { [BOOT_HEADER]: nonce } },
      (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => {
          let data = null;
          try {
            data = JSON.parse(body);
          } catch {}
          const ok = res.statusCode === 200;
          resolve({ ok, bootOk: ok && Boolean(data) && data.bootOk === true, data });
        });
      },
    );
    req.on("error", () => resolve({ ok: false, bootOk: false, data: null }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, bootOk: false, data: null });
    });
  });
}

/**
 * Poll until OUR server answers. A 200 without `bootOk` is some other
 * process on the port (or a server that isn't ours) — keep waiting; if it
 * never changes the caller gets `ready: false` and shows the error dialog.
 */
async function pollUntilReady(port, { onTick, nonce, timeoutMs = HEALTH_TIMEOUT_MS } = {}) {
  const start = Date.now();
  let impostorLogged = false;
  while (Date.now() - start < timeoutMs) {
    const { ok, bootOk, data } = await checkHealth(port, nonce ? { nonce } : undefined);
    const elapsed = Date.now() - start;
    if (bootOk) return { ready: true, data, elapsed };
    if (ok && !impostorLogged) {
      impostorLogged = true;
      log(`health on port ${port} answered without the boot nonce — not our server (yet)`);
    }
    if (onTick) onTick(elapsed);
    await new Promise((r) => setTimeout(r, HEALTH_POLL_MS));
  }
  return { ready: false, data: null, elapsed: Date.now() - start };
}

// ── Utility process (macOS Dock fix) ─────────────────────────────

/**
 * Whether to host the server in an Electron utility process instead of a
 * separate OS-level child. Default: macOS only (the platform with the extra
 * Dock icon). FLYX_SERVER_HOST=utility|child forces either mode anywhere.
 */
function shouldUseUtilityProcess(platform = process.platform, env = process.env) {
  const forced = (env.FLYX_SERVER_HOST || "").trim().toLowerCase();
  if (forced === "utility") return true;
  if (forced === "child") return false;
  return platform === "darwin";
}

/**
 * Electron's utilityProcess 'exit' event carries the raw waitpid() status on
 * POSIX (and the plain exit code on Windows). A normal exit stores the code
 * in bits 8–15 — exit(9) arrives as 2304 — while a signal death keeps the
 * signal number in the low 7 bits. Normalise to the exit code the rest of
 * the shell (logs, error dialogs, crash counting) expects.
 *
 * @param {number|null|undefined} code
 * @param {string} [platform]
 */
function decodeUtilityExitCode(code, platform = process.platform) {
  if (typeof code !== "number") return 0;
  if (platform === "win32" || code < 256) return code;
  if ((code & 0x7f) === 0) return (code >> 8) & 0xff; // WIFEXITED → WEXITSTATUS
  return code;
}

/**
 * Fork `script` via electron.utilityProcess and wrap it in the small
 * child_process-like surface the rest of the shell relies on
 * (pid / exitCode / signalCode / stdout / stderr / kill / 'exit').
 * Falls back to a plain child process when utilityProcess is unavailable.
 *
 * @param {string} script
 * @param {{cwd: string, env: Record<string,string>, fork?: Function}} opts
 */
function forkUtilityProcess(script, { cwd, env, fork } = {}) {
  let forkImpl = fork;
  if (!forkImpl) {
    try {
      const electron = require("electron");
      forkImpl = electron && electron.utilityProcess && electron.utilityProcess.fork;
    } catch {
      forkImpl = null;
    }
  }
  if (typeof forkImpl !== "function") {
    log("utilityProcess unavailable — falling back to child process");
    return spawn(process.execPath, [script], {
      cwd,
      env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  // ELECTRON_RUN_AS_NODE must never reach a utility process. Electron's
  // helper binary honours that variable before anything else: it boots as
  // plain Node, rejects Chromium's own flags ("bad option: --type=utility",
  // "--utility-sub-type=node.mojom.NodeService", …) and exits with code 9 —
  // which macOS reports as waitpid status 2304 ("The embedded server exited
  // immediately (code 2304)"). A utility process already is a Node
  // environment; it needs no flag.
  const utilityEnv = { ...env };
  delete utilityEnv.ELECTRON_RUN_AS_NODE;

  const proc = forkImpl(script, [], {
    cwd,
    env: utilityEnv,
    stdio: "pipe",
    serviceName: "Flyx Server",
  });

  const adapter = new EventEmitter();
  adapter.pid = proc.pid;
  adapter.exitCode = null;
  adapter.signalCode = null;
  adapter.stdout = proc.stdout;
  adapter.stderr = proc.stderr;
  adapter.utility = proc;
  adapter.kill = () => {
    try {
      return proc.kill();
    } catch {
      return false;
    }
  };
  if (typeof proc.on === "function") {
    proc.on("spawn", () => {
      adapter.pid = proc.pid;
      adapter.emit("spawn");
    });
    proc.on("exit", (code) => {
      adapter.exitCode = decodeUtilityExitCode(code);
      if (adapter.exitCode !== code) {
        log(`utility process raw exit status ${code} → exit code ${adapter.exitCode}`);
      }
      adapter.emit("exit", adapter.exitCode);
    });
  }
  return adapter;
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
  const h = hostname || "127.0.0.1";

  ensureLogsDir();

  // Data-dir .env keys that control how Node/Electron start (NODE_OPTIONS,
  // ELECTRON_*, PATH, LD_PRELOAD, FLYX_FFMPEG_PATH, …) never reach the
  // child: .env is writable by the web app, so honouring them would turn a
  // settings write into code execution on the next restart.
  const { env, skipped } = filterServerEnv(readEnv());
  if (skipped.length) {
    log(`ignoring unsafe .env keys for the server: ${skipped.join(", ")}`);
  }

  // Merge AppData .env OVER process.env, but only for keys that have
  // non-empty values — a blank TMDB key in AppData should not overwrite
  // the real key from the standalone build.
  const filteredEnv = {};
  for (const [k, v] of Object.entries(env)) {
    if (v && String(v).trim()) {
      filteredEnv[k] = v;
    }
  }

  // Also read the standalone .env (has the FLYX_DESKTOP marker). Same key
  // rules — it ships with the app, but it costs nothing to hold it to them.
  const standaloneEnvPath = path.join(STANDALONE_DIR, "packages", "app", ".env");
  const standaloneRaw = {};
  if (fs.existsSync(standaloneEnvPath)) {
    const raw = fs.readFileSync(standaloneEnvPath, "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const k = trimmed.slice(0, eq);
      const v = trimmed.slice(eq + 1);
      if (v && v.trim()) standaloneRaw[k] = v;
    }
  }
  const standaloneEnv = filterServerEnv(standaloneRaw).env;

  // Ship the bundled ffmpeg binary to the server (extraResources copies it
  // to <STANDALONE_DIR>/ffmpeg). The server's downloader also falls back to
  // its own cwd lookup and `ffmpeg` on PATH.
  const ffmpegBin = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const bundledFfmpeg = path.join(STANDALONE_DIR, "ffmpeg", ffmpegBin);

  const serverEnv = {
    ...process.env,
    ...standaloneEnv,
    ...filteredEnv,
    FLYX_DATA_DIR: DATA_DIR,
    FLYX_DESKTOP: "true",
    ...(fs.existsSync(bundledFfmpeg) ? { FLYX_FFMPEG_PATH: bundledFfmpeg } : {}),
    // Child-process mode runs the app binary as Node (ELECTRON_RUN_AS_NODE=1).
    // forkUtilityProcess() strips this again for a utility process — there
    // it turns the helper into plain Node and kills the server at boot.
    ELECTRON_RUN_AS_NODE: "1",
    HOSTNAME: filteredEnv.HOSTNAME || h,
    PORT: String(p),
    NODE_ENV: "production",
    // After every spread: .env can never pin or leak the boot nonce.
    FLYX_BOOT_NONCE: BOOT_NONCE,
  };

  const cwd = path.join(STANDALONE_DIR, "packages", "app");
  const logStream = fs.createWriteStream(serverLog, { flags: "a" });

  const viaUtility = shouldUseUtilityProcess();
  log(`spawning server (port ${p}, hostname ${serverEnv.HOSTNAME}, ${viaUtility ? "utility process" : "child process"})`);

  // macOS: a child spawned from the app binary (ELECTRON_RUN_AS_NODE) is
  // its own app to the OS, so a second icon — the "terminal" one — appears
  // in the Dock next to Flyx. Electron's utilityProcess runs the same
  // script inside Flyx's own process tree with no Dock presence.
  const child = viaUtility
    ? forkUtilityProcess(SERVER_SCRIPT, { cwd, env: serverEnv })
    : spawn(process.execPath, [SERVER_SCRIPT], {
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

/**
 * True once the child has reported exit (child_process sets exitCode /
 * signalCode before emitting "exit"; the utility-process adapter mirrors
 * that). After this its pid may already belong to an unrelated process —
 * never signal or taskkill it.
 */
function hasExited(child) {
  if (!child) return true;
  return (
    (child.exitCode !== null && child.exitCode !== undefined) ||
    (child.signalCode !== null && child.signalCode !== undefined)
  );
}

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
    const target = child || activeChild;
    const pid = target && target.pid;
    // A child that already reported exit needs no signal — and its pid may
    // have been reused by an unrelated process (PID reuse → wrong tree killed).
    if (!target || hasExited(target)) {
      resolve({ stopped: true, forced: false });
      return;
    }
    if (!pid || !isProcessAlive(pid)) {
      resolve({ stopped: true, forced: false });
      return;
    }

    // SIGTERM first — through Electron for a utility process (it owns the
    // handle), straight to the pid for a plain child.
    if (target && target.utility) {
      try { target.kill(); } catch {}
    } else {
      try { process.kill(pid, "SIGTERM"); } catch {}
    }

    let forced = false;
    const grace = setTimeout(() => {
      if (hasExited(target)) return; // exited during the grace period
      forced = true;
      try { process.kill(pid, "SIGKILL"); } catch {}
      // On Windows, also try taskkill for process tree
      if (process.platform === "win32") {
        try {
          require("child_process").execSync(`taskkill /PID ${pid} /T /F 2>nul`, { stdio: "ignore" });
        } catch {}
      }
    }, 5000);

    // Poll for exit (the exit event is authoritative; the pid probe covers
    // an exit whose event hasn't been delivered yet)
    const check = setInterval(() => {
      if (hasExited(target) || !isProcessAlive(pid)) {
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
 *
 * `beforeSpawn(port)` (optional, async) runs once the old server is gone
 * and may return a different port — main.js re-probes the port there so a
 * process that grabbed it in the meantime is never talked to.
 */
async function restart({ port, hostname, onExit, beforeSpawn } = {}) {
  const oldChild = activeChild;
  const oldStream = activeLogStream;
  if (oldChild) {
    await stopServer(oldChild);
    try { oldStream.end(); } catch {}
  }
  let p = port;
  if (typeof beforeSpawn === "function") {
    const picked = await beforeSpawn(port);
    if (picked) p = picked;
  }
  return spawnServer({ port: p, hostname, onExit });
}

module.exports = {
  isRunning,
  isProcessAlive,
  hasExited,
  checkHealth,
  pollUntilReady,
  spawnServer,
  stopServer,
  restart,
  ensureLogsDir,
  log,
  shouldUseUtilityProcess,
  forkUtilityProcess,
  decodeUtilityExitCode,
  HEALTH_TIMEOUT_MS,
  BOOT_NONCE,
  BOOT_HEADER,
};
