/**
 * electron-builder afterAllArtifactBuild hook.
 *
 * Makes sure every Linux AppImage we publish carries the executable bit.
 * (Browsers drop the bit when a user downloads the file — nothing on our side
 * can change that — but the artifact itself, and anything that fetches it
 * with the bit preserved, should be runnable as-is. The in-app updater also
 * chmods what it downloads.)
 */

"use strict";

const fs = require("fs");
const path = require("path");

function runAfterArtifacts(ctx, deps = {}) {
  const chmod = deps.chmod || ((p, mode) => fs.chmodSync(p, mode));
  const log = deps.log || ((msg) => console.log(`  • [after-artifacts] ${msg}`));
  const touched = [];
  for (const file of ctx.artifactPaths || []) {
    if (!/\.appimage$/i.test(file)) continue;
    try {
      chmod(file, 0o755);
      touched.push(file);
      log(`marked executable: ${path.basename(file)}`);
    } catch (err) {
      log(`could not chmod ${file}: ${(err && err.message) || err}`);
    }
  }
  return touched;
}

module.exports = async function afterAllArtifactBuild(ctx) {
  runAfterArtifacts(ctx);
  return [];
};
module.exports.runAfterArtifacts = runAfterArtifacts;
