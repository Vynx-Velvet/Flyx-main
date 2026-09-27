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
 *  All     — secret guard: fail the build if the packaged server tree
 *           contains any .env other than the dummy packages/app/.env that
 *           scripts/build-desktop.mjs writes (a real .env holds the TMDB
 *           token / user secrets and must never ship in a public installer).
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

// Exactly what scripts/build-desktop.mjs writes (step 5b).
const DUMMY_ENV = "TMDB_API_KEY=dummy-key-for-build\nFLYX_DESKTOP=true\n";
const ENV_TEMPLATE_RE = /\.(example|sample|template|defaults)$/i;

function serverResourcesDir(appOutDir, platform, appName) {
  if (platform === "darwin") {
    return path.join(appOutDir, `${appName}.app`, "Contents", "Resources", "server");
  }
  return path.join(appOutDir, "resources", "server");
}

/**
 * Throw if `serverDir` holds any .env* file other than the dummy
 * packages/app/.env (templates like .env.example are fine).
 *
 * @returns {string[]} the .env files that were checked
 */
function assertNoRealEnv(serverDir, deps = {}) {
  const readdir = deps.readdir || ((d) => fs.readdirSync(d, { withFileTypes: true }));
  const readFile = deps.readFile || ((f) => fs.readFileSync(f, "utf8"));
  const exists = deps.exists || ((p) => fs.existsSync(p));
  if (!exists(serverDir)) return [];

  const found = [];
  const stack = [serverDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readdir(dir)) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (/^\.env(\..*)?$/i.test(entry.name) && !ENV_TEMPLATE_RE.test(entry.name)) {
        found.push(full);
      }
    }
  }

  const dummyPath = path.join(serverDir, "packages", "app", ".env");
  const bad = [];
  for (const file of found) {
    if (file === dummyPath && readFile(file).replace(/\r\n/g, "\n") === DUMMY_ENV) continue;
    bad.push(path.relative(serverDir, file));
  }
  if (bad.length) {
    throw new Error(
      `[after-pack] refusing to package: real .env file(s) in the server payload: ${bad.join(", ")}. ` +
        "Run scripts/build-desktop.mjs (it writes a dummy .env) and make sure no other .env is copied.",
    );
  }
  return found;
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

  // Every platform: never ship a real .env (throws → build fails).
  if (!deps.skipEnvCheck) {
    assertNoRealEnv(serverResourcesDir(ctx.appOutDir, platform, appName), deps.envCheck);
  }

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
module.exports.assertNoRealEnv = assertNoRealEnv;
module.exports.serverResourcesDir = serverResourcesDir;
