/**
 * Fetch the static ffmpeg binary for the current platform.
 *
 * ffmpeg-static's npm install script is unreliable in some environments, so
 * we download its single-file gzipped release directly and gunzip it. The
 * binary is cached in node_modules/.cache/flyx-ffmpeg (gitignored) so builds
 * only download it once, then copied into the standalone server tree where
 * the desktop app ships it via extraResources.
 *
 * Usage (build scripts call ensureFfmpeg directly):
 *   node scripts/fetch-ffmpeg.mjs [destDir]
 */

import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "fs";
import { gunzipSync } from "zlib";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const RELEASE_TAG = "b6.0"; // ffmpeg-static 5.2.0 binary release tag
const BASE = "https://github.com/eugeneware/ffmpeg-static/releases/download";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CACHE_DIR = join(ROOT, "node_modules", ".cache", "flyx-ffmpeg");

export const FFMPEG_BIN = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

function platformTarget() {
  const p = { win32: "win32", darwin: "darwin", linux: "linux" }[process.platform];
  const a = { x64: "x64", arm64: "arm64", ia32: "ia32" }[process.arch];
  if (!p || !a) throw new Error(`unsupported ffmpeg target: ${process.platform}/${process.arch}`);
  return `${p}-${a}`;
}

/**
 * Ensure `destDir/ffmpeg(.exe)` exists, downloading + gunzipping it if the
 * cache is cold. Returns the path to the binary.
 */
export async function ensureFfmpeg(destDir) {
  const cached = join(CACHE_DIR, FFMPEG_BIN);

  if (!existsSync(cached)) {
    const url = `${BASE}/${RELEASE_TAG}/ffmpeg-${platformTarget()}.gz`;
    console.log(`[ffmpeg] downloading ${url}`);
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`ffmpeg download failed (HTTP ${res.status})`);
    const gz = new Uint8Array(await res.arrayBuffer());
    const bin = gunzipSync(gz);
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(cached, bin);
    if (process.platform !== "win32") chmodSync(cached, 0o755);
    console.log(`[ffmpeg] cached ${cached} (${(bin.byteLength / 1024 / 1024).toFixed(1)} MB)`);
  }

  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, FFMPEG_BIN);
  if (!existsSync(dest) || process.argv[1]?.endsWith("fetch-ffmpeg.mjs")) {
    copyFileSync(cached, dest);
    if (process.platform !== "win32") chmodSync(dest, 0o755);
  }
  return dest;
}

// CLI mode
if (process.argv[1] && process.argv[1].endsWith("fetch-ffmpeg.mjs")) {
  const destDir = process.argv[2] || join(ROOT, ".flyx-standalone", "ffmpeg");
  ensureFfmpeg(destDir)
    .then((p) => console.log(`[ffmpeg] ready: ${p}`))
    .catch((err) => {
      console.error(`[ffmpeg] ${err.message}`);
      process.exit(1);
    });
}
