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
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "fs";
import { createHash } from "crypto";
import { gunzipSync } from "zlib";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const RELEASE_TAG = "b6.0"; // ffmpeg-static 5.2.0 binary release tag
const BASE = "https://github.com/eugeneware/ffmpeg-static/releases/download";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CACHE_DIR = join(ROOT, "node_modules", ".cache", "flyx-ffmpeg");

/**
 * Pinned SHA-256 digests for the b6.0 release assets. `gz` is the hash of the
 * downloaded ffmpeg-<target>.gz asset; `bin` is the hash of the gunzipped
 * binary (what we cache and ship). Both are verified: the download before we
 * decompress it, the cache on every hit (a tampered or truncated cache is
 * deleted and refetched). Obtained 2026-09-26 by downloading each asset from
 * github.com/eugeneware/ffmpeg-static/releases/tag/b6.0 and running sha256sum
 * on the .gz and on `gunzip -c` output. Targets without an asset in the
 * release (win32-arm64, darwin-ia32) are unsupported.
 */
const FFMPEG_SHA256 = {
  "darwin-arm64": {
    gz: "6be74d6f449889c2e87a75873894f8520cad56c08ac76f2a628d85b0519daaca",
    bin: "a90e3db6a3fd35f6074b013f948b1aa45b31c6375489d39e572bea3f18336584",
  },
  "darwin-x64": {
    gz: "a12354fce7eb62361473bbe10d53a1893695babd35869ec8e92e5dfea8d0440b",
    bin: "cfe20936c83ecf5d68e424b87e8cc45b24dd6be81787810123bb964a0df686f9",
  },
  "linux-arm64": {
    gz: "2b708b2d15041d2a192c1db24c7a8a1d24f645a8242dce1c744ff2392b86ada1",
    bin: "237800b37bb65a81ad47871c6c8b7c45c0a3ca62a5b3f9d2a7a9a2dd9a338271",
  },
  "linux-ia32": {
    gz: "f2872e3bbc849a38adb17679254cb7ad4dd79ae592833e460b69f8d375f2d892",
    bin: "103500b65ccb78c3c804088d6e17111d85e2bd03f5a0c61c349dc2d05e165f09",
  },
  "linux-x64": {
    gz: "17c1ae10b52ac499180679fe6ba77e17642390c4eedb0f1e3b0ac045da55128f",
    bin: "ed652b2f32e0851d1946894fb8333f5b677c1b2ce6b9d187910a67f8b99da028",
  },
  "win32-ia32": {
    gz: "af47ca5de7b9f859f48e4e96ea831bf551b100144b0b871762ab48fba1152f56",
    bin: "fb3766af5cc193ca863e15cd4554a33732973209dad5e3c1433b5e291bceb16c",
  },
  "win32-x64": {
    gz: "450d66226c79405c724e821f291cab0911e934bfa9fa2231adcab587f3e07b50",
    bin: "e9fd5e711debab9d680955fc1e38a2c1160fd280b144476cc3f62bc43ef49db1",
  },
};

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function fileSha256(path) {
  return sha256(readFileSync(path));
}

export const FFMPEG_BIN = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

function platformTarget() {
  const p = { win32: "win32", darwin: "darwin", linux: "linux" }[process.platform];
  const a = { x64: "x64", arm64: "arm64", ia32: "ia32" }[process.arch];
  const target = p && a ? `${p}-${a}` : null;
  if (!target || !FFMPEG_SHA256[target]) {
    throw new Error(`unsupported ffmpeg target: ${process.platform}/${process.arch}`);
  }
  return target;
}

/**
 * Ensure `destDir/ffmpeg(.exe)` exists, downloading + gunzipping it if the
 * cache is cold. Returns the path to the binary.
 */
export async function ensureFfmpeg(destDir) {
  const target = platformTarget();
  const pinned = FFMPEG_SHA256[target];
  const cached = join(CACHE_DIR, FFMPEG_BIN);

  // Cache hit must match the pinned binary hash — otherwise throw it away.
  if (existsSync(cached) && fileSha256(cached) !== pinned.bin) {
    console.warn(`[ffmpeg] cached binary failed SHA-256 check — deleting and refetching`);
    rmSync(cached, { force: true });
  }

  if (!existsSync(cached)) {
    const url = `${BASE}/${RELEASE_TAG}/ffmpeg-${target}.gz`;
    console.log(`[ffmpeg] downloading ${url}`);
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`ffmpeg download failed (HTTP ${res.status})`);
    const gz = new Uint8Array(await res.arrayBuffer());
    const gzHash = sha256(gz);
    if (gzHash !== pinned.gz) {
      throw new Error(
        `ffmpeg download SHA-256 mismatch for ${target}: expected ${pinned.gz}, got ${gzHash}`,
      );
    }
    const bin = gunzipSync(gz);
    const binHash = sha256(bin);
    if (binHash !== pinned.bin) {
      throw new Error(
        `ffmpeg binary SHA-256 mismatch for ${target}: expected ${pinned.bin}, got ${binHash}`,
      );
    }
    mkdirSync(CACHE_DIR, { recursive: true });
    const tmp = `${cached}.tmp-${process.pid}`;
    writeFileSync(tmp, bin);
    renameSync(tmp, cached);
    if (process.platform !== "win32") chmodSync(cached, 0o755);
    console.log(`[ffmpeg] cached ${cached} (${(bin.byteLength / 1024 / 1024).toFixed(1)} MB, sha256 ok)`);
  }

  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, FFMPEG_BIN);
  if (
    !existsSync(dest) ||
    process.argv[1]?.endsWith("fetch-ffmpeg.mjs") ||
    fileSha256(dest) !== pinned.bin
  ) {
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
