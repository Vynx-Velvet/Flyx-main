/**
 * eb-node.cjs — run electron-builder under Electron's bundled Node.
 *
 * Needed on machines whose system Node is < 22.12 (which cannot require(ESM);
 * app-builder-lib 26.15+ requires ESM-only @noble/hashes 2.x from its blockmap
 * module). CI already runs Node ≥ 22.12, so `npm run dist` works there
 * directly; `npm run dist:local` uses this script so older local Nodes work
 * too.
 *
 * Usage: node eb-node.cjs [electron-builder args]   (run from packages/desktop)
 *
 * Two tricks are applied inside Electron's Node:
 *  - Electron sets process.versions.electron but not process.defaultApp in
 *    run-as-node mode, which makes yargs parse argv from index 1 (the script
 *    path becomes an "Unknown argument"). Reset both indicators.
 *  - Electron patches fs to treat .asar paths as archives even in run-as-node
 *    mode, which breaks writing default_app.asar ("Invalid package"). Setting
 *    process.noAsar disables the patching.
 */
"use strict";

const { spawn } = require("child_process");
const path = require("path");

if (!process.env.ELECTRON_RUN_AS_NODE) {
  // Parent process (system node): re-spawn ourselves under Electron's Node.
  // require("electron") resolves to the electron.exe path (its index.js
  // exports the binary location).
  const electronPath = require("electron");
  const child = spawn(electronPath, [__filename, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  });
  child.on("exit", (code) => process.exit(code ?? 1));
  child.on("error", (err) => {
    console.error(`eb-node: failed to spawn electron (${err.message})`);
    process.exit(1);
  });
} else {
  // Child process (Electron's Node): fix argv/yargs detection + asar fs
  // patching, then hand off to the real electron-builder CLI.
  delete process.versions.electron;
  process.defaultApp = true;
  process.noAsar = true;
  require(path.resolve(__dirname, "..", "..", "node_modules", "electron-builder", "out", "cli", "cli.js"));
}
