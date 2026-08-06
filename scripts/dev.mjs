/**
 * Flyx dev launcher — starts Next.js without nested npm/turbo shims.
 * Avoids Windows npm stdin spawn bugs when running `next.cmd` via package scripts.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, "packages", "app");

const nextCandidates = [
  path.join(root, "node_modules", "next", "dist", "bin", "next"),
  path.join(appDir, "node_modules", "next", "dist", "bin", "next"),
];

const nextBin = nextCandidates.find((p) => fs.existsSync(p));

if (!nextBin) {
  console.error(
    "[flyx] Could not find next binary. Run `npm install` from the repo root."
  );
  process.exit(1);
}

if (!fs.existsSync(path.join(appDir, "package.json"))) {
  console.error("[flyx] packages/app is missing.");
  process.exit(1);
}

const args = ["dev", ...process.argv.slice(2)];
console.log(`[flyx] Starting Next.js in packages/app …`);
console.log(`[flyx] ${process.execPath} ${nextBin} ${args.join(" ")}`);

const child = spawn(process.execPath, [nextBin, ...args], {
  cwd: appDir,
  stdio: "inherit",
  env: {
    ...process.env,
    FORCE_COLOR: process.env.FORCE_COLOR ?? "1",
  },
  windowsHide: false,
});

const forward = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.on("SIGINT", () => forward("SIGINT"));
process.on("SIGTERM", () => forward("SIGTERM"));

child.on("error", (err) => {
  console.error("[flyx] Failed to start Next.js:", err);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 0);
});
