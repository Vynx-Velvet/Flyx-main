/**
 * Flyx Desktop — Auto-update wiring (electron-updater → GitHub Releases).
 *
 * Active only when packaged AND not the portable .exe (portable can't
 * self-update — electron-updater needs an installer). Never blocks the
 * app: all errors go to the server log; updates install on quit.
 */

const { app, Notification } = require("electron");
const { log } = require("./server-manager");

let active = false;
let autoUpdater = null;

/**
 * Wire up electron-updater. Returns true when updates are possible on
 * this build, false otherwise (dev, portable exe).
 */
function initUpdater({ onDownloaded } = {}) {
  if (app.isPackaged === false || process.env.PORTABLE_EXECUTABLE_FILE) {
    return false;
  }

  // Lazy require so dev/portable never even load the module
  autoUpdater = require("electron-updater").autoUpdater;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: (m) => log(`[updater] ${m}`),
    warn: (m) => log(`[updater] warn: ${m}`),
    error: (m) => log(`[updater] error: ${m}`),
  };

  autoUpdater.on("checking-for-update", () => log("[updater] checking…"));
  autoUpdater.on("update-available", (info) =>
    log(`[updater] ${info.version} available — downloading`),
  );
  autoUpdater.on("update-not-available", (info) =>
    log(`[updater] up to date (${info.version})`),
  );
  autoUpdater.on("download-progress", (p) => {
    if (p.percent && Math.round(p.percent) % 20 === 0) {
      log(`[updater] download ${Math.round(p.percent)}%`);
    }
  });
  autoUpdater.on("update-downloaded", (info) => {
    log(`[updater] ${info.version} downloaded — will install on quit`);
    const n = new Notification({
      title: "Flyx update ready",
      body: `Version ${info.version} downloaded. Restart Flyx to update.`,
    });
    n.on("click", () => {
      autoUpdater.quitAndInstall();
    });
    n.show();
    if (onDownloaded) onDownloaded(info);
  });
  autoUpdater.on("error", (err) => {
    // Offline / no releases / rate-limited — never bother the user
    log(`[updater] error: ${(err && err.message) || err}`);
  });

  active = true;
  return true;
}

function isActive() {
  return active;
}

function checkForUpdates() {
  if (!active || !autoUpdater) return Promise.resolve();
  return autoUpdater.checkForUpdates().catch((err) => {
    log(`[updater] check failed: ${(err && err.message) || err}`);
  });
}

function quitAndInstall() {
  if (!active || !autoUpdater) return;
  log("[updater] quitting to install");
  autoUpdater.quitAndInstall();
}

module.exports = { initUpdater, isActive, checkForUpdates, quitAndInstall };
