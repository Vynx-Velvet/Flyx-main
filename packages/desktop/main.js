/**
 * Flyx Desktop — Electron main process.
 *
 * Spawns the embedded standalone server (Electron's bundled Node), opens a
 * window on http://127.0.0.1:<port>, and keeps serving on the LAN after the
 * window closes (close-to-tray). Watches $DATA_DIR/.env: any edit triggers
 * a debounced server restart (setup wizard completion, network mode toggle,
 * settings changes) — the edge runtime snapshots env at boot, so restarting
 * is the only way every runtime agrees on the latest values.
 *
 * Trust model: the window (master cookie + preload bridge) is pinned to
 * http://127.0.0.1:<port> — see src/security.js. IPC only answers that
 * origin, navigation elsewhere is blocked (https opens in the OS browser),
 * and the server must prove it's ours (boot nonce) before the window loads.
 */

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  dialog,
  nativeImage,
  clipboard,
  session,
  shell,
} = require("electron");

// Dev convenience: never touch real data when running unpackaged.
// Must be set BEFORE paths.js computes DATA_DIR at require time.
if (!app.isPackaged && !process.env.FLYX_DATA_DIR) {
  process.env.FLYX_DATA_DIR = path.join(__dirname, "..", "..", ".flyx-dev-data");
}

const { PORT, envPath, serverLog } = require("./src/paths");
const { bootstrap, readEnv, updateEnv, ensureMasterToken, ensureSecrets } = require("./src/env-store");
const server = require("./src/server-manager");
const { getLANURLs, getLocalURL, isPortInUse } = require("./src/network");
const updater = require("./src/updater");
const ghUpdater = require("./src/github-updater");
const vlc = require("./src/vlc");
const {
  appOrigin,
  isTrustedSender,
  classifyNavigation,
  isPermissionAllowed,
  stripQuery,
  redactUrls,
} = require("./src/security");

app.setName("Flyx");

// Windows only: stable AppUserModelID so the OS media session (SMTC) and
// taskbar attribute Flyx's now-playing metadata to this app (matches the
// electron-builder appId "com.flyx.desktop"). No-op on other platforms.
app.setAppUserModelId("com.flyx.desktop");

// ── State ────────────────────────────────────────────────────────

let mainWindow = null;
let tray = null;
let currentChild = null;
let isQuitting = false;
let intentionalStop = false;
let currentPort = PORT;
let currentHostname = "127.0.0.1"; // localhost-only unless .env opts into LAN
let updateDownloaded = false;
let watchSuppressUntil = 0;
let restartTimer = null;
let restartInFlight = false;
let crashCount = 0;
let updateInFlight = false;

// ── Single instance ──────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => showMainWindow());
  app.whenReady().then(onReady);
}

// ── Startup ──────────────────────────────────────────────────────

async function onReady() {
  cleanupStalePortableExes(); // portable self-update: drop the exact previous build
  // The embedded server writes downloads here by default (overridable in
  // Settings → Downloads). Must be set before the server child is spawned so
  // it's inherited via process.env.
  try {
    process.env.FLYX_DEFAULT_DOWNLOAD_DIR = app.getPath("downloads");
  } catch {
    /* app not ready for getPath yet — server falls back to ~/Downloads */
  }
  bootstrap(); // first run: writes secrets + HOSTNAME=127.0.0.1 (LAN is opt-in)
  ensureMasterToken(); // migrate pre-token data dirs (before watcher is armed)
  ensureSecrets(); // heal .env files missing JWT_SECRET/HOST_KEY (older builds)
  const env = readEnv();

  const port = await resolvePort(env);
  if (!port) {
    dialog.showErrorBox(
      "Flyx could not start",
      "Every port Flyx tried is already in use by another program on this " +
        "computer (on 127.0.0.1 or ::1).\n\nClose the program using it, or " +
        `set a different PORT in:\n${envPath}`,
    );
    app.quit();
    return;
  }
  currentPort = port;
  if (currentPort !== Number(env.PORT)) {
    // Back-write our port pick; suppress the env watcher for our own write.
    watchSuppressUntil = Date.now() + 2000;
    updateEnv("PORT", String(currentPort));
  }
  currentHostname = (env.HOSTNAME && env.HOSTNAME.trim()) || "127.0.0.1";

  installPermissionHandlers();
  registerIpc();
  createTray();
  watchEnvFile();

  if (!(await startAndWait())) return; // error dialog shown inside

  // The embedded server owns its origin; renderer bundles cached by a
  // previous build must never survive a launch. A stale wizard that posts
  // an old API shape fails every save and looks exactly like "setup keeps
  // resetting" — so always start with a cold cache.
  try {
    await session.defaultSession.clearCache();
  } catch (err) {
    server.log(`cache clear failed: ${err && err.message}`);
  }

  await setMasterCookie();

  // Renderer observability: log every HTTP request the window makes, at
  // the Chromium network layer. The wizard's save POST must appear as
  // "[http] POST .../api/setup/save" here BEFORE the server can log its
  // own side — a missing entry proves the click never fired a request.
  // (Filter /_next/static so chunk loads don't drown the trail.) Query
  // strings are dropped: they carry signed stream tokens + upstream URLs.
  try {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*"] },
      (details, callback) => {
        if (!/\/_next\/(static|image)\//.test(details.url)) {
          server.log(`[http] ${details.method} ${stripQuery(details.url)}`);
        }
        callback({});
      },
    );
  } catch (err) {
    server.log(`webRequest hook failed: ${err && err.message}`);
  }

  createWindow();
  loadApp();

  if (updater.initUpdater({ onDownloaded: onUpdateDownloaded })) {
    setTimeout(() => updater.checkForUpdates(), 10000);
  }

  // Keep tray LAN URLs fresh (network interfaces change)
  setInterval(() => {
    if (tray && !tray.isDestroyed()) tray.setContextMenu(buildTrayMenu());
  }, 15000);
}

async function resolvePort(env) {
  let port = parseInt(env.PORT, 10);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) port = PORT;
  return findFreePort(port);
}

/**
 * First port from `start` that nothing listens on — on 127.0.0.1 AND ::1
 * (a squatter on either could otherwise sit in front of our server).
 * Resolves null when 20 consecutive ports are taken — never "use it anyway".
 */
async function findFreePort(start) {
  let port = start;
  for (let i = 0; i < 20 && port <= 65535; i++, port++) {
    if (!(await isPortInUse(port))) return port;
    server.log(`port ${port} in use — bumping`);
  }
  return null;
}

/**
 * Spawn the server and wait for /api/health. On failure (immediate exit or
 * timeout) show an error dialog pointing at the log and quit.
 */
async function startAndWait() {
  let child;
  try {
    child = server.spawnServer({
      port: currentPort,
      hostname: currentHostname,
      onExit: (code) => onServerExit(code),
    });
    currentChild = child;
  } catch (err) {
    dialog.showErrorBox("Flyx could not start", String((err && err.message) || err));
    app.quit();
    return false;
  }

  const result = await Promise.race([
    server.pollUntilReady(currentPort).then((r) => ({ kind: "poll", r })),
    waitForExit(child).then((code) => ({ kind: "exit", code })),
  ]);

  if (result.kind === "poll" && result.r.ready) {
    crashCount = 0;
    return true;
  }

  const reason =
    result.kind === "exit"
      ? `The embedded server exited immediately (code ${result.code}).`
      : "The embedded server did not respond within 60 seconds " +
        `(or another program is answering on port ${currentPort}).`;
  dialog.showErrorBox(
    "Flyx could not start",
    `${reason}\n\nDetails were written to:\n${serverLog}`,
  );
  app.quit();
  return false;
}

// ── Server lifecycle ─────────────────────────────────────────────

/** Resolves with the exit code — covers an already-exited child too. */
function waitForExit(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve(child.exitCode);
      return;
    }
    child.once("exit", (code) => resolve(code));
  });
}

function onServerExit(code) {
  if (isQuitting || intentionalStop) return;
  server.log(`unexpected server exit (code ${code}) — restarting`);
  crashCount += 1;
  if (crashCount > 3) {
    dialog.showErrorBox(
      "Flyx server crashed repeatedly",
      `The embedded server keeps exiting.\n\nDetails were written to:\n${serverLog}`,
    );
    quitApp();
    return;
  }
  restartFlow();
}

/**
 * Restart the server (network mode change, manual restart, crash recovery).
 * Shows a "Restarting…" page in the window, then reloads the app when the
 * server is healthy again.
 */
async function restartFlow() {
  if (restartInFlight) return;
  restartInFlight = true;
  intentionalStop = true;

  sendToWindow("flyx:server-restarting");
  showRestartingPage();

  try {
    currentChild = await server.restart({
      port: currentPort,
      hostname: currentHostname,
      onExit: (code) => onServerExit(code),
      // Re-probe once the old server is gone: something may have taken the
      // port in between. Never spawn onto (or health-check) a squatter.
      beforeSpawn: (port) => ensurePortStillFree(port),
    });

    const result = await Promise.race([
      server.pollUntilReady(currentPort).then((r) => ({ kind: "poll", r })),
      waitForExit(currentChild).then((code) => ({ kind: "exit", code })),
    ]);

    if (result.kind === "poll" && result.r.ready) {
      crashCount = 0;
      await setMasterCookie(); // re-assert after a restart (port may differ)
      sendToWindow("flyx:server-ready");
      loadApp();
      return;
    }

    dialog.showErrorBox(
      "Flyx could not restart",
      "The embedded server failed to come back up.\n\n" +
        `Details were written to:\n${serverLog}`,
    );
    quitApp();
  } catch (err) {
    server.log(`restart failed: ${(err && err.message) || err}`);
    dialog.showErrorBox(
      "Flyx could not restart",
      `${(err && err.message) || err}\n\nDetails were written to:\n${serverLog}`,
    );
    quitApp();
  } finally {
    intentionalStop = false;
    restartInFlight = false;
  }
}

/**
 * Called by server.restart() after the old server stopped. Gives a
 * just-closed listener a moment to release the port, then moves to the next
 * free port (back-writing PORT to .env) if something else holds it.
 */
async function ensurePortStillFree(port) {
  for (let i = 0; i < 6; i++) {
    if (!(await isPortInUse(port))) return port;
    await new Promise((r) => setTimeout(r, 400));
  }
  const next = await findFreePort(port + 1);
  if (!next) {
    throw new Error(`Port ${port} is in use by another program and no free port was found.`);
  }
  server.log(`port ${port} still in use after stop — moving to ${next}`);
  currentPort = next;
  watchSuppressUntil = Date.now() + 2000;
  updateEnv("PORT", String(next));
  return next;
}

// ── Env watcher ──────────────────────────────────────────────────

function watchEnvFile() {
  fs.watchFile(envPath, { interval: 500 }, () => {
    if (Date.now() < watchSuppressUntil) return;
    clearTimeout(restartTimer);
    restartTimer = setTimeout(handleEnvChange, 800); // debounce atomic renames
  });
}

async function handleEnvChange() {
  const env = readEnv();

  const newPort = parseInt(env.PORT, 10);
  const portChanged =
    Number.isInteger(newPort) &&
    newPort >= 1024 &&
    newPort <= 65535 &&
    newPort !== currentPort;

  if (portChanged && (await isPortInUse(newPort))) {
    // Port is taken — keep the current one (leave the .env value alone;
    // it will be re-tried on the next env change).
    server.log(`env PORT=${newPort} is in use — keeping ${currentPort}`);
    return;
  }

  // ANY .env change restarts the server — not just HOSTNAME/PORT re-binds.
  // The Next middleware runs in the edge runtime, which snapshots
  // process.env at boot and never sees the in-memory mutations that
  // setup/save makes. A secret generated at save time (JWT_SECRET) would
  // otherwise be used by the Node signer but not the edge verifier, and
  // the master would loop between / and auto-login forever. A restart is
  // the only way to bring every runtime onto the same environment.
  if (portChanged) currentPort = newPort;
  currentHostname = (env.HOSTNAME && env.HOSTNAME.trim()) || "127.0.0.1";
  server.log(
    `env changed — restarting (port ${currentPort}, hostname ${currentHostname})`,
  );
  restartFlow();
}

// ── Window ───────────────────────────────────────────────────────

const RESTARTING_HTML = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Restarting Flyx…</title></head>
<body style="margin:0;background:#0b0b12;color:#e5e7eb;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:14px">
<div style="font-size:22px;font-weight:600">Restarting Flyx…</div>
<div style="color:#9ca3af;font-size:14px">Applying new settings — this page reloads automatically.</div>
</body>
</html>`;
const RESTARTING_URL = "data:text/html;charset=utf-8," + encodeURIComponent(RESTARTING_HTML);

/**
 * Resolve the app icon (window + tray). In a packaged build the icon ships
 * unpacked as <resources>/icon.png via extraResources — nativeImage and
 * Chromium read files from real disk, not from inside the asar. In dev it
 * lives at build/icon.png next to main.js.
 */
function getIconPath() {
  if (app.isPackaged && process.resourcesPath) {
    const packaged = path.join(process.resourcesPath, "icon.png");
    if (fs.existsSync(packaged)) return packaged;
  }
  return path.join(__dirname, "build", "icon.png");
}

function createWindow() {
  const iconPath = getIconPath();
  const icon = fs.existsSync(iconPath) ? iconPath : undefined;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0b0b12",
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide(); // keep serving on the LAN
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  // Close-to-tray keeps the renderer alive with the server — notify the
  // page so the watch player pauses and stops buffering while hidden,
  // and resumes when the window comes back.
  mainWindow.on("hide", () => sendToWindow("flyx:window-hidden"));
  mainWindow.on("show", () => sendToWindow("flyx:window-shown"));
  // New windows are never created. https links (target=_blank, window.open)
  // open in the OS browser; links back into the app load in this window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const verdict = classifyNavigation(url, currentPort);
    if (verdict.action === "external") {
      openExternalSafe(verdict.url);
    } else if (verdict.action === "allow" || verdict.action === "rewrite") {
      const target = verdict.action === "rewrite" ? verdict.url : url;
      mainWindow.loadURL(target).catch(() => {});
    } else {
      server.log(`[nav] blocked window.open ${stripQuery(url)}`);
    }
    return { action: "deny" };
  });
  // The window holds the master cookie and the preload bridge — it may only
  // ever show the app origin (or our own "Restarting…" page). Anything else
  // is blocked; https destinations are handed to the OS browser instead.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    guardNavigation(event, (event && event.url) || url);
  });
  mainWindow.webContents.on("will-redirect", (event, url, _isInPlace, isMainFrame) => {
    const mainFrame = event && "isMainFrame" in event ? event.isMainFrame : isMainFrame;
    if (mainFrame === false) return; // iframes (trailers) are sandboxed web content
    guardNavigation(event, (event && event.url) || url);
  });
  // Renderer console + crash trails — teed into flyx-server.log. Only
  // warnings/errors by default (the renderer's info logs carry stream URLs
  // and titles); FLYX_DEBUG=1 restores the full trail for troubleshooting
  // (e.g. the wizard's "[Setup UI] …" logs). URLs are query-stripped either
  // way. Electron ≥32 passes a details object; older builds passed
  // positional args — handle both.
  mainWindow.webContents.on("console-message", (_event, ...args) => {
    const first = args[0];
    const details = first && typeof first === "object" ? first : null;
    const message =
      details && "message" in details ? details.message : String(args[1] ?? "");
    const level = details ? details.level : first;
    const important =
      typeof level === "number" ? level >= 2 : level === "warning" || level === "error";
    if (!important && process.env.FLYX_DEBUG !== "1") return;
    if (message) server.log(`[renderer] ${redactUrls(message)}`);
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    server.log(`[renderer] process gone: ${details && details.reason}`);
  });
  mainWindow.webContents.on("did-fail-load", (_event, code, desc, url) => {
    server.log(`[renderer] failed load (${code}) ${desc} ${stripQuery(url)}`);
  });
}

/** will-navigate / will-redirect policy for the main window. */
function guardNavigation(event, url) {
  const verdict = classifyNavigation(url, currentPort, { allowExact: [RESTARTING_URL] });
  if (verdict.action === "allow") return;
  event.preventDefault();
  if (verdict.action === "rewrite") {
    // localhost / 0.0.0.0 spelling of our own server → pin to 127.0.0.1.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(verdict.url).catch(() => {});
    }
  } else if (verdict.action === "external") {
    openExternalSafe(verdict.url);
  } else {
    server.log(`[nav] blocked navigation to ${stripQuery(url)}`);
  }
}

/** shell.openExternal for https: URLs only — never file:, smb:, custom schemes. */
function openExternalSafe(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return;
  }
  if (u.protocol !== "https:") return;
  shell.openExternal(u.toString()).catch((err) => {
    server.log(`[nav] openExternal failed: ${(err && err.message) || err}`);
  });
}

/**
 * Chromium permission prompts: allow only what the app uses (fullscreen,
 * clipboard write, EME for trailer embeds) and only while the window is on
 * the app origin. Camera/mic, geolocation, notifications, MIDI, HID, … are
 * always denied.
 */
function installPermissionHandlers() {
  const ses = session.defaultSession;
  const topUrlOf = (wc) => {
    try {
      return wc && !wc.isDestroyed() ? wc.getURL() : "";
    } catch {
      return "";
    }
  };
  ses.setPermissionRequestHandler((wc, permission, callback) => {
    const allowed = isPermissionAllowed(permission, { topUrl: topUrlOf(wc), port: currentPort });
    if (!allowed) server.log(`[permission] denied ${permission}`);
    callback(allowed);
  });
  ses.setPermissionCheckHandler((wc, permission, _requestingOrigin, details) => {
    const topUrl = topUrlOf(wc) || (details && details.embeddingOrigin) || "";
    return isPermissionAllowed(permission, { topUrl, port: currentPort });
  });
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    loadApp();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/**
 * Inject the master token into the Electron session's cookie jar BEFORE the
 * window loads. The server grants passwordless auto-login to requests that
 * carry it (see request-master.ts) — so the desktop window never sees a
 * login screen, while LAN browsers (which never have this cookie) always
 * go through /login. The token persists in $DATA_DIR/.env; the cookie is a
 * SESSION cookie for 127.0.0.1 only, re-asserted each boot/restart after
 * the boot-nonce health check proved the server on the port is ours (never
 * "localhost", which may resolve to a different [::1] listener).
 */
async function setMasterCookie() {
  try {
    const token = (readEnv().FLYX_MASTER_TOKEN || "").trim();
    if (!token) {
      server.log("no FLYX_MASTER_TOKEN in .env — master auto-login disabled");
      return;
    }
    const cookies = session.defaultSession.cookies;
    // Drop every older copy first — earlier builds persisted a 10-year
    // cookie for both "localhost" and "127.0.0.1".
    try {
      const existing = await cookies.get({ name: "flyx_master_token" });
      for (const c of existing) {
        const host = String(c.domain || "").replace(/^\./, "");
        if (!host) continue;
        await cookies.remove(`http://${host}${c.path || "/"}`, c.name).catch(() => {});
      }
    } catch {}
    await cookies.set({
      url: appOrigin(currentPort),
      name: "flyx_master_token",
      value: token,
      httpOnly: true,
      secure: false, // the desktop server speaks plain http (even on LAN)
      sameSite: "lax",
      path: "/",
      // no expirationDate → session cookie: never outlives this launch
    });
  } catch (err) {
    server.log(`failed to set master cookie: ${err && err.message}`);
  }
}

function loadApp() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.loadURL(getLocalURL(currentPort)).catch(() => {});
}

function showRestartingPage() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow
    .loadURL(RESTARTING_URL)
    .catch(() => {});
}

function sendToWindow(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

// ── GitHub updates (manual pull — portable + installer) ─────────

function isPortable() {
  return Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
}

/** Where a portable self-update records { oldExe, newExe } before relaunching. */
function portableHandoffPath() {
  return path.join(app.getPath("userData"), "portable-update.json");
}

/**
 * Portable self-update cleanup. The updater downloads the new
 * Flyx-Portable-<version>.exe next to the current one, records the exact
 * old exe path, and relaunches; on the next start (running the new build)
 * delete exactly that one file — never a sweep of the folder, which could
 * hit other Flyx-Portable-*.exe copies the user keeps on purpose.
 */
function cleanupStalePortableExes() {
  if (!isPortable()) return;
  const recordPath = portableHandoffPath();
  let record;
  try {
    record = JSON.parse(fs.readFileSync(recordPath, "utf-8"));
  } catch {
    return; // no hand-off pending
  }
  const current = process.env.PORTABLE_EXECUTABLE_FILE;
  const target = ghUpdater.planPortableCleanup(record, current);
  const forUs =
    record && typeof record.newExe === "string" && current &&
    path.resolve(record.newExe).toLowerCase() === path.resolve(current).toLowerCase();
  if (target) {
    try {
      fs.unlinkSync(target);
      server.log(`[updater] removed old portable build ${path.basename(target)}`);
    } catch (err) {
      server.log(`[updater] could not remove ${path.basename(target)}: ${(err && err.message) || err}`);
    }
  }
  // Clear once the build it was meant for has started (or it's garbage);
  // keep it if the OLD exe was simply launched again before the new one.
  if (target || forUs || !record || typeof record !== "object") {
    try { fs.unlinkSync(recordPath); } catch {}
  }
}

function recordPortableHandoff(newExe) {
  try {
    fs.mkdirSync(path.dirname(portableHandoffPath()), { recursive: true });
    fs.writeFileSync(
      portableHandoffPath(),
      JSON.stringify({ oldExe: process.env.PORTABLE_EXECUTABLE_FILE, newExe }),
      "utf-8",
    );
  } catch (err) {
    server.log(`[updater] could not record portable hand-off: ${(err && err.message) || err}`);
  }
}

function sendUpdateStatus(status) {
  sendToWindow("flyx:update-status", status);
}

/**
 * Spawn a detached Electron-as-node helper that launches `dest` after a
 * short delay, then quit. The delay lets this process fully exit (and
 * release the single-instance lock) before the new build starts.
 */
function launchDetachedAfterDelay(dest) {
  const script =
    'setTimeout(function(){require("child_process").spawn(process.argv[1],[],{detached:true,stdio:"ignore"}).unref()},1500);';
  const child = require("child_process").spawn(
    process.execPath,
    ["-e", script, dest],
    {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    },
  );
  child.unref();
}

/**
 * Download, VERIFY, then install the latest GitHub release for this build.
 * Never throws — resolves with an outcome object and emits
 * `flyx:update-status` events. Callers confirm with the user first
 * (tray dialog / confirmAndInstallGithubUpdate).
 *
 * @param {object} [prefetched] a checkForUpdate() result the user confirmed
 */
async function downloadGithubUpdate(prefetched) {
  if (updateInFlight) {
    return { ok: false, message: "An update is already in progress" };
  }
  updateInFlight = true;
  try {
    return await downloadGithubUpdateInner(prefetched);
  } finally {
    updateInFlight = false;
  }
}

async function downloadGithubUpdateInner(prefetched) {
  const info =
    prefetched ||
    (await ghUpdater.checkForUpdate({
      currentVersion: app.getVersion(),
      platform: process.platform,
      portable: isPortable(),
    }));

  if (!info.available || !info.assetUrl || !info.asset) {
    const message = info.assetUrl
      ? "No compatible download found for this build"
      : "You are already up to date";
    sendUpdateStatus({ phase: "error", message });
    return { ok: false, ...info, message };
  }

  // Portable builds download the new exe next to the current one (the
  // artifact name embeds the version, so it won't collide); installers and
  // other platforms download to the OS temp dir and run from there.
  const assetName = path.basename(info.asset);
  const dest =
    isPortable() && process.env.PORTABLE_EXECUTABLE_DIR
      ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, assetName)
      : path.join(app.getPath("temp"), assetName);
  sendUpdateStatus({ phase: "downloading", percent: 0, asset: info.asset });

  try {
    await ghUpdater.downloadToFile(info.assetUrl, dest, ({ received, total }) => {
      const percent = total ? Math.round((received / total) * 100) : 0;
      sendUpdateStatus({ phase: "downloading", percent, asset: info.asset });
    });
  } catch (err) {
    const message = String((err && err.message) || err);
    server.log(`[updater] github download failed: ${message}`);
    sendUpdateStatus({ phase: "error", message });
    return { ok: false, ...info, message };
  }

  // Integrity gate: the release's latest*.yml sha512 (or GitHub's own
  // sha256 asset digest for files the yml doesn't list, i.e. the portable
  // exe). No match, or nothing to match against → delete and refuse.
  const verdict = await ghUpdater.verifyDownload({
    file: dest,
    assetName,
    metadataUrls: info.metadataUrls || [],
    assetDigest: info.assetDigest || null,
    assetSize: info.assetSize || null,
  });
  if (!verdict.ok) {
    try { fs.unlinkSync(dest); } catch {}
    const message = verdict.error || "Update verification failed";
    server.log(`[updater] ${assetName} rejected: ${message}`);
    sendUpdateStatus({ phase: "error", message });
    return { ok: false, ...info, message };
  }
  server.log(`[updater] ${assetName} verified (${verdict.source})`);

  sendUpdateStatus({ phase: "installing", asset: info.asset, path: dest });

  const ext = path.extname(info.asset).toLowerCase();
  if (ext === ".dmg" || ext === ".deb") {
    // The user must finish the OS-level install (drag to Applications /
    // run the package). Open it and keep Flyx running — quitting now would
    // drop LAN sharing mid-install.
    try {
      const { shell } = require("electron");
      await shell.openPath(dest);
    } catch (err) {
      server.log(`[updater] open ${info.asset} failed: ${(err && err.message) || err}`);
    }
    sendUpdateStatus({ phase: "done", asset: info.asset, path: dest });
    return { ok: true, ...info, path: dest, restarted: false };
  }

  if (ext === ".appimage") {
    try { fs.chmodSync(dest, 0o755); } catch {}
  }

  if (isPortable()) recordPortableHandoff(dest);
  launchDetachedAfterDelay(dest);
  sendUpdateStatus({ phase: "done", asset: info.asset, path: dest });
  quitApp();
  return { ok: true, ...info, path: dest, restarted: true };
}

/**
 * Renderer flow (Settings → Updates → Install): the page can only ASK —
 * the main process re-checks GitHub and the user confirms in a native
 * dialog before anything is downloaded or run.
 */
async function confirmAndInstallGithubUpdate() {
  if (!app.isPackaged) {
    return { ok: false, dev: true, message: "Updates are disabled in development builds" };
  }
  if (updateInFlight) {
    return { ok: false, message: "An update is already in progress" };
  }
  const info = await ghUpdater.checkForUpdate({
    currentVersion: app.getVersion(),
    platform: process.platform,
    portable: isPortable(),
  });
  if (!info.available || !info.assetUrl || !info.asset) {
    const message = info.error
      ? "Could not check for updates"
      : info.assetUrl
        ? "No compatible download found for this build"
        : "You are already up to date";
    sendUpdateStatus({ phase: "error", message });
    return { ok: false, ...info, message };
  }
  const options = {
    type: "question",
    title: "Flyx Update",
    message: `Install Flyx v${info.latest} now?`,
    detail:
      `You have ${info.current}. Flyx will download the update, verify it, ` +
      "then close and start the installer.",
    buttons: ["Install", "Cancel"],
    defaultId: 0,
    cancelId: 1,
  };
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  const { response } = win
    ? await dialog.showMessageBox(win, options)
    : await dialog.showMessageBox(options);
  if (response !== 0) {
    const message = "Update cancelled";
    sendUpdateStatus({ phase: "error", message });
    return { ok: false, cancelled: true, ...info, message };
  }
  return downloadGithubUpdate(info);
}

/** Tray flow: check GitHub, prompt, then download + install. */
async function checkGithubAndPromptInstall() {
  if (!app.isPackaged) {
    dialog.showMessageBox({
      type: "info",
      title: "Flyx Update",
      message: "Updates are disabled in development builds.",
    });
    return;
  }
  let info;
  try {
    info = await ghUpdater.checkForUpdate({
      currentVersion: app.getVersion(),
      platform: process.platform,
      portable: isPortable(),
    });
  } catch (err) {
    server.log(`[updater] github check failed: ${(err && err.message) || err}`);
    dialog.showMessageBox({
      type: "error",
      title: "Flyx Update",
      message: "Could not check for updates.",
      detail: "Check your internet connection and try again.",
    });
    return;
  }

  if (!info.available) {
    dialog.showMessageBox({
      type: "info",
      title: "Flyx Update",
      message: "You're up to date.",
      detail: `Flyx ${info.current} is the latest version.`,
    });
    return;
  }

  const { response } = await dialog.showMessageBox({
    type: "info",
    title: "Flyx Update",
    message: `Flyx ${info.latest} is available`,
    detail: `You have ${info.current}. Download and install now?`,
    buttons: ["Download & Install", "Later"],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) await downloadGithubUpdate(info);
}

// ── Tray ─────────────────────────────────────────────────────────

const TRAY_FALLBACK_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function loadTrayIcon() {
  try {
    const img = nativeImage.createFromPath(getIconPath());
    if (!img.isEmpty()) return img.resize({ width: 16, height: 16 });
  } catch {}
  return nativeImage
    .createFromDataURL(TRAY_FALLBACK_PNG)
    .resize({ width: 16, height: 16 });
}

function createTray() {
  tray = new Tray(loadTrayIcon());
  tray.setToolTip("Flyx — media server");
  tray.setContextMenu(buildTrayMenu());
  tray.on("click", () => showMainWindow());
}

function buildTrayMenu() {
  const lan = currentHostname === "0.0.0.0" ? getLANURLs(currentPort) : [];
  const template = [
    { label: "Open Flyx", click: () => showMainWindow() },
    { type: "separator" },
    {
      label: "On your network",
      submenu: lan.length
        ? lan.map((u) => ({
            label: u.url,
            click: () => clipboard.writeText(u.url),
          }))
        : [{ label: "LAN sharing is off", enabled: false }],
    },
    { type: "separator" },
    { label: "Restart Server", click: () => restartFlow() },
    { label: "Check for Updates", click: () => checkGithubAndPromptInstall() },
    ...(updater.isActive() && updateDownloaded
      ? [
          {
            label: "Restart to Update",
            click: () => updater.quitAndInstall(),
          },
        ]
      : []),
    { type: "separator" },
    { label: "Quit Flyx", click: () => quitApp() },
  ];
  return Menu.buildFromTemplate(template);
}

function onUpdateDownloaded(info) {
  updateDownloaded = true;
  if (tray && !tray.isDestroyed()) tray.setContextMenu(buildTrayMenu());
  sendToWindow("flyx:update-downloaded", info);
}

// ── IPC ──────────────────────────────────────────────────────────

/**
 * ipcMain.handle, but only for frames on the app origin
 * (http://127.0.0.1:<currentPort>). Anything else — a navigated-away
 * window, a trailer iframe, a squatter page — gets an error, never data.
 */
function handleTrusted(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event, currentPort)) {
      const from = event && event.senderFrame ? stripQuery(event.senderFrame.url) : "unknown";
      server.log(`[ipc] rejected ${channel} from ${from}`);
      throw new Error("Untrusted sender");
    }
    return handler(event, ...args);
  });
}

function registerIpc() {
  handleTrusted("flyx:get-version", () => app.getVersion());
  handleTrusted("flyx:get-lan-urls", () =>
    currentHostname === "0.0.0.0" ? getLANURLs(currentPort) : [],
  );
  handleTrusted("flyx:get-local-url", () => getLocalURL(currentPort));
  handleTrusted("flyx:check-updates", async () => {
    if (!app.isPackaged) {
      return { available: false, current: app.getVersion(), dev: true };
    }
    return ghUpdater.checkForUpdate({
      currentVersion: app.getVersion(),
      platform: process.platform,
      portable: isPortable(),
    });
  });
  // Packaged builds only, and always behind a native confirmation dialog.
  handleTrusted("flyx:download-update", () => confirmAndInstallGithubUpdate());
  // Open a host stream URL in VLC on this machine. The renderer passes an
  // absolute /api/stream/… or /api/livetv/… URL on our own server, so VLC
  // pulls the stream through the host exactly like the in-app player does;
  // vlc.launch() rejects anything else.
  handleTrusted("flyx:open-in-vlc", (_event, payload) =>
    vlc.launch(payload || {}, {
      log: (msg) => server.log(msg),
      openPath: (file) => shell.openPath(file),
      tempDir: app.getPath("temp"),
      port: currentPort,
    }),
  );
}

// ── App lifecycle ────────────────────────────────────────────────

function quitApp() {
  isQuitting = true;
  app.quit();
}

app.on("before-quit", () => {
  isQuitting = true;
});

// Never quit on window close — the tray keeps the LAN server alive.
app.on("window-all-closed", () => {});

app.on("activate", () => showMainWindow());

app.on("will-quit", () => {
  intentionalStop = true;
  const child = currentChild;
  // Already exited → its pid may now belong to an unrelated process (PID
  // reuse); signalling or tree-killing it could take down someone else's
  // processes. Nothing to do.
  if (!child || server.hasExited(child)) return;
  try {
    // A utility-process host dies with Electron; ask it to stop and move on.
    if (child.utility) {
      try { child.kill(); } catch {}
      return;
    }
    const pid = child.pid;
    if (!pid) return;
    if (process.platform === "win32") {
      // Synchronous tree kill while the pid is still our live child (Node
      // holds its process handle, so the pid can't have been reused yet).
      // Killing the parent first would orphan ffmpeg and free the pid.
      execSync(`taskkill /PID ${pid} /T /F 2>nul`, { stdio: "ignore" });
    } else {
      server.stopServer(child); // SIGTERM (graceful attempt)
      if (!server.hasExited(child)) process.kill(pid, "SIGKILL");
    }
  } catch {}
});
