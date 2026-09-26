/**
 * electron-builder afterPack hook.
 *
 * Runs once per platform/arch after the app directory is assembled and
 * before it is wrapped into a DMG / AppImage / deb.
 *
 *  macOS  — ad-hoc code-sign the .app (`codesign --sign -`). We ship without
 *           an Apple developer identity, and electron-builder then skips
 *           signing altogether. A completely unsigned app is refused on
 *           Apple silicon ("Flyx is damaged and can't be opened"), which made
 *           people strip quarantine flags / chmod in Terminal after every
 *           update. An ad-hoc signature is enough for Gatekeeper to offer the
 *           normal right-click → Open path instead.
 *  Linux/macOS — make sure the launcher and the bundled ffmpeg carry the
 *           executable bit (extraResources copies don't always preserve it).
 *
 * The real work is in `runAfterPack(ctx, deps)` with injectable exec/chmod so
 * it can be unit-tested on any OS.
 */

"use strict";

const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

const EXECUTABLE_MODE = 0o755;

function bundledBinaries(appOutDir, platform, appName) {
  const list = [];
  if (platform === "darwin") {
    const app = path.join(appOutDir, `${appName}.app`);
    list.push(path.join(app, "Contents", "MacOS", appName));
    list.push(path.join(app, "Contents", "Resources", "server", "ffmpeg", "ffmpeg"));
  } else if (platform === "linux") {
    list.push(path.join(appOutDir, "flyx"));
    list.push(path.join(appOutDir, "resources", "server", "ffmpeg", "ffmpeg"));
  }
  return list;
}

/**
 * @param {{ appOutDir: string, electronPlatformName: string, packager: { appInfo: { productFilename: string } } }} ctx
 * @param {{ execFile?: Function, chmod?: Function, exists?: Function, log?: Function }} [deps]
 * @returns {{ signed: boolean, chmodded: string[] }}
 */
function runAfterPack(ctx, deps = {}) {
  const execFile = deps.execFile || ((cmd, args) => execFileSync(cmd, args, { stdio: "inherit" }));
  const chmod = deps.chmod || ((p, mode) => fs.chmodSync(p, mode));
  const exists = deps.exists || ((p) => fs.existsSync(p));
  const log = deps.log || ((msg) => console.log(`  • [after-pack] ${msg}`));

  const platform = ctx.electronPlatformName;
  const appName = ctx.packager.appInfo.productFilename;
  const result = { signed: false, chmodded: [] };

  if (platform !== "darwin" && platform !== "linux") return result;

  for (const bin of bundledBinaries(ctx.appOutDir, platform, appName)) {
    if (!exists(bin)) continue;
    try {
      chmod(bin, EXECUTABLE_MODE);
      result.chmodded.push(bin);
    } catch (err) {
      log(`could not chmod ${bin}: ${(err && err.message) || err}`);
    }
  }
  if (result.chmodded.length) log(`marked executable: ${result.chmodded.map((p) => path.basename(p)).join(", ")}`);

  if (platform === "darwin") {
    const app = path.join(ctx.appOutDir, `${appName}.app`);
    if (exists(app)) {
      try {
        // --deep signs the helpers and frameworks too; --force replaces any
        // partial signature electron-builder may have left.
        execFile("codesign", ["--force", "--deep", "--sign", "-", app]);
        result.signed = true;
        log(`ad-hoc signed ${path.basename(app)}`);
      } catch (err) {
        log(`ad-hoc codesign failed (continuing unsigned): ${(err && err.message) || err}`);
      }
    }
  }

  return result;
}

module.exports = async function afterPack(ctx) {
  runAfterPack(ctx);
};
module.exports.runAfterPack = runAfterPack;
module.exports.bundledBinaries = bundledBinaries;
