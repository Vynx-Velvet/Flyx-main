/**
 * Flyx Desktop — Electron main process.
 *
 * Spawns the embedded standalone server (Electron's bundled Node), opens a
 * window on http://127.0.0.1:<port>, and keeps serving on the LAN after the
 * window closes (close-to-tray). Watches $DATA_DIR/.env: any edit triggers
 * a debounced server restart (setup wizard completion, network mode toggle,
 * settings changes) — the edge runtime snapshots env at boot, so restarting
 * is the only way every runtime agrees on the latest values.
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
let currentHostname = "0.0.0.0";
let updateDownloaded = false;
let watchSuppressUntil = 0;
let restartTimer = null;
let restartInFlight = false;
let crashCount = 0;

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
  bootstrap(); // first run: writes secrets + HOSTNAME=0.0.0.0
  ensureMasterToken(); // migrate pre-token data dirs (before watcher is armed)
  ensureSecrets(); // heal .env files missing JWT_SECRET/HOST_KEY (older builds)
  const env = readEnv();

  currentPort = await resolvePort(env);
  if (currentPort !== Number(env.PORT)) {
    // Back-write our port pick; suppress the env watcher for our own write.
    watchSuppressUntil = Date.now() + 2000;
    updateEnv("PORT", String(currentPort));
  }
  currentHostname = (env.HOSTNAME && env.HOSTNAME.trim()) || "0.0.0.0";

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
  // (Filter /_next/static so chunk loads don't drown the trail.)
  try {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*"] },
      (details, callback) => {
        if (!/\/_next\/(static|image)\//.test(details.url)) {
          server.log(`[http] ${details.method} ${details.url}`);
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
  for (let i = 0; i < 20; i++) {
    if (!(await isPortInUse(port))) return port;
    server.log(`port ${port} in use — bumping`);
    port += 1;
  }
  return port;
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
      : "The embedded server did not respond within 60 seconds.";
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
  } finally {
    intentionalStop = false;
    restartInFlight = false;
  }
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
  currentHostname = (env.HOSTNAME && env.HOSTNAME.trim()) || "0.0.0.0";
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

function createWindow() {
  const iconPath = path.join(__dirname, "..", "build", "icon.png");
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
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  // Renderer console + crash trails — teed into flyx-server.log so the
  // wizard's "[Setup UI] …" logs (and any JS errors) are visible there.
  // Electron ≥32 passes a details object; older builds passed positional
  // args — handle both.
  mainWindow.webContents.on("console-message", (_event, ...args) => {
    const first = args[0];
    const details = first && typeof first === "object" ? first : null;
    const message =
      details && "message" in details ? details.message : String(args[1] ?? "");
    if (message) server.log(`[renderer] ${message}`);
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    server.log(`[renderer] process gone: ${details && details.reason}`);
  });
  mainWindow.webContents.on("did-fail-load", (_event, code, desc, url) => {
    server.log(`[renderer] failed load (${code}) ${desc} ${url}`);
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
 * go through /login. The token persists in $DATA_DIR/.env, so it survives
 * restarts; the cookie just needs re-asserting per boot/port.
 */
async function setMasterCookie() {
  try {
    const token = (readEnv().FLYX_MASTER_TOKEN || "").trim();
    if (!token) {
      server.log("no FLYX_MASTER_TOKEN in .env — master auto-login disabled");
      return;
    }
    const cookies = session.defaultSession.cookies;
    const expirationDate = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600;
    for (const host of ["localhost", "127.0.0.1"]) {
      await cookies.set({
        url: `http://${host}:${currentPort}`,
        name: "flyx_master_token",
        value: token,
        httpOnly: true,
        secure: false, // the desktop server speaks plain http (even on LAN)
        sameSite: "lax",
        path: "/",
        expirationDate,
      });
    }
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
    .loadURL("data:text/html;charset=utf-8," + encodeURIComponent(RESTARTING_HTML))
    .catch(() => {});
}

function sendToWindow(channel) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel);
  }
}

// ── Tray ─────────────────────────────────────────────────────────

const TRAY_FALLBACK_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function loadTrayIcon() {
  try {
    const img = nativeImage.createFromPath(
      path.join(__dirname, "..", "build", "icon.png"),
    );
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
    ...(updater.isActive()
      ? [
          ...(updateDownloaded
            ? [
                {
                  label: "Restart to Update",
                  click: () => updater.quitAndInstall(),
                },
              ]
            : []),
          {
            label: updateDownloaded ? "Update ready" : "Check for Updates",
            enabled: !updateDownloaded,
            click: () => updater.checkForUpdates(),
          },
        ]
      : []),
    { type: "separator" },
    { label: "Quit Flyx", click: () => quitApp() },
  ];
  return Menu.buildFromTemplate(template);
}

function onUpdateDownloaded() {
  updateDownloaded = true;
  if (tray && !tray.isDestroyed()) tray.setContextMenu(buildTrayMenu());
  sendToWindow("flyx:update-downloaded");
}

// ── IPC ──────────────────────────────────────────────────────────

function registerIpc() {
  ipcMain.handle("flyx:get-version", () => app.getVersion());
  ipcMain.handle("flyx:get-lan-urls", () =>
    currentHostname === "0.0.0.0" ? getLANURLs(currentPort) : [],
  );
  ipcMain.handle("flyx:get-local-url", () => getLocalURL(currentPort));
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
  server.stopServer(); // graceful attempt (SIGTERM → SIGKILL)
  // Synchronous guarantee the child doesn't outlive us on Windows:
  try {
    const pid = currentChild && currentChild.pid;
    if (!pid) return;
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /T /F 2>nul`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGKILL");
    }
  } catch {}
});
