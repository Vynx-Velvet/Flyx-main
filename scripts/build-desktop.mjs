/**
 * Build the Next.js standalone server for desktop packaging (Electron).
 *
 * Usage: node scripts/build-desktop.mjs
 *
 * Steps:
 *   1. Build Next.js with output: "standalone"
 *   2. Copy the standalone output to .flyx-standalone/
 *   3. Copy the .next/static folder
 *   4. Copy public assets
 *   5. Copy workspace packages
 */

import { execSync } from "child_process";
import { cpSync, existsSync, mkdirSync, rmSync, readdirSync, lstatSync, realpathSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ensureFfmpeg } from "./fetch-ffmpeg.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const APP_DIR = join(ROOT, "packages", "app");
const STANDALONE_DIR = join(ROOT, ".flyx-standalone");

console.log("[desktop:build] Building Next.js standalone...");

// Step 1: Build with DUMMY env only (same approach as build-standalone.mjs).
// Next loads packages/app/.env* at build time, and that file holds a real
// TMDB token — build-time env can be inlined into shipped bundles. Next
// never overrides a variable that is already set in process.env, so every
// key found in packages/app/.env* is pinned to a dummy value here, plus the
// secrets the server expects. Real config is injected at runtime by the
// desktop app.
const BUILD_DUMMY_ENV = {
  TMDB_API_KEY: "dummy-key-for-build",
  JWT_SECRET: "dummy-secret-for-build-0123456789abcdef",
  HOST_KEY: "dummy-host-key-for-build",
};
for (const name of readdirSync(APP_DIR)) {
  if (!/^\.env(\..*)?$/.test(name) || /\.example$/.test(name)) continue;
  for (const line of readFileSync(join(APP_DIR, name), "utf-8").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (!m || m[1] in BUILD_DUMMY_ENV || /^(NODE_ENV|FLYX_STANDALONE)$/.test(m[1])) continue;
    BUILD_DUMMY_ENV[m[1]] = "dummy-for-build";
  }
}
execSync("npx next build", {
  cwd: APP_DIR,
  env: { ...process.env, ...BUILD_DUMMY_ENV, FLYX_STANDALONE: "1" },
  stdio: "inherit",
});

// Step 2: Prepare standalone directory
if (existsSync(STANDALONE_DIR)) {
  rmSync(STANDALONE_DIR, { recursive: true });
}
mkdirSync(STANDALONE_DIR, { recursive: true });

// Step 3: Copy standalone output
const nextStandalone = join(APP_DIR, ".next", "standalone");
if (!existsSync(nextStandalone)) {
  console.error("[desktop:build] ERROR: No standalone output found. Is output: 'standalone' in next.config.ts?");
  process.exit(1);
}

console.log("[desktop:build] Copying standalone output...");
cpSync(nextStandalone, STANDALONE_DIR, { recursive: true });

// Step 4: Copy static files (Next.js needs .next/static)
const staticSrc = join(APP_DIR, ".next", "static");

// Copy to standalone root .next/static
const staticDestRoot = join(STANDALONE_DIR, ".next", "static");
if (existsSync(staticSrc)) {
  mkdirSync(dirname(staticDestRoot), { recursive: true });
  cpSync(staticSrc, staticDestRoot, { recursive: true });
}

// Also copy to packages/app/.next/static (where the server actually looks)
const staticDestApp = join(STANDALONE_DIR, "packages", "app", ".next", "static");
if (existsSync(staticSrc)) {
  mkdirSync(dirname(staticDestApp), { recursive: true });
  cpSync(staticSrc, staticDestApp, { recursive: true });
  console.log("[desktop:build] Static files copied to app .next/static");
}

// Step 5: Copy public assets
const publicSrc = join(APP_DIR, "public");
const publicDest = join(STANDALONE_DIR, "public");
if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDest, { recursive: true });
}

// Also copy public to packages/app/public (where the server serves from)
const publicDestApp = join(STANDALONE_DIR, "packages", "app", "public");
if (existsSync(publicSrc)) {
  mkdirSync(dirname(publicDestApp), { recursive: true });
  cpSync(publicSrc, publicDestApp, { recursive: true });
  console.log("[desktop:build] Public assets copied to app public/");
}

// Step 5a: Strip dev/test-only junk Next's standalone copy picks up (it
// copies the whole app package dir in a monorepo, including e2e tests and
// playwright test-results). Never ship those in the desktop payload.
// .flyx/ is runtime state (accounts + password hashes) written when the
// standalone server runs with a local CWD — shipping it would leak any
// accounts created during local testing into the public installer.
// src/ (TypeScript sources — the server runs the compiled .next output),
// build/test config and tsbuildinfo are dead weight that also leak
// internals; nothing reads them at runtime.
for (const junk of [
  "e2e",
  "test-results",
  ".flyx",
  "src",
  "playwright.config.ts",
  "vitest.config.ts",
  "wrangler.toml",
  "tsconfig.tsbuildinfo",
]) {
  const junkPath = join(STANDALONE_DIR, "packages", "app", junk);
  if (existsSync(junkPath)) {
    rmSync(junkPath, { recursive: true });
    console.log(`[desktop:build] Removed standalone junk: ${junk}`);
  }
}

// Step 5a2: Merge the standalone ROOT node_modules into packages/app/node_modules.
// electron-builder's extraResources copy filter silently drops a TOP-LEVEL
// node_modules dir (app-builder-lib util/filter.js: `relative === "node_modules"
// → false`) — only *nested* node_modules survive packaging. The standalone
// root node_modules holds react, react-dom, styled-jsx and the copied @flyx
// workspace packages, all required at runtime. (Dev mode masks this because
// .flyx-standalone sits inside the repo and Node walks up into the root
// node_modules; a packaged tree has no parent to fall back on.)
const rootNm = join(STANDALONE_DIR, "node_modules");
const appNm = join(STANDALONE_DIR, "packages", "app", "node_modules");
if (existsSync(rootNm)) {
  for (const entry of readdirSync(rootNm)) {
    cpSync(join(rootNm, entry), join(appNm, entry), { recursive: true, force: true, errorOnExist: false });
  }
  rmSync(rootNm, { recursive: true });
  console.log("[desktop:build] Merged standalone root node_modules into packages/app/node_modules");
}

// Step 5a3: Patch Next's runtime deps that outputFileTracing misses.
// @next/env is required lazily via Next's require-hook, so the tracer skips
// it — the packaged server crashes with MODULE_NOT_FOUND at startup. (Dev
// mode masks this because .flyx-standalone sits inside the repo and Node
// walks up into the root node_modules; a packaged tree has no parent.)
// The @next/swc-* native binding is loaded dynamically the same way.
for (const name of readdirSync(join(ROOT, "node_modules", "@next"))) {
  const src = join(ROOT, "node_modules", "@next", name);
  const destDir = join(STANDALONE_DIR, "packages", "app", "node_modules", "@next");
  mkdirSync(destDir, { recursive: true });
  cpSync(src, join(destDir, name), { recursive: true });
  console.log(`[desktop:build] Copied missing Next runtime dep: @next/${name}`);
}

// Step 5b: Minimal desktop .env — NEVER copy the real one. Next's standalone
// output includes packages/app/.env (which holds the real TMDB API key), and
// that file ends up in the public installer. Electron injects real config at
// runtime (TMDB key, credentials, JWT secret, etc.) via server-manager + the
// setup wizard, so ship only harmless placeholders.
const envPath = join(STANDALONE_DIR, "packages", "app", ".env");
// Next may also copy .env.local / .env.production etc. — drop every other
// .env* in the app dir first. (build/after-pack.cjs re-checks the whole
// packaged server tree and fails the build on any non-dummy .env.)
for (const name of readdirSync(join(STANDALONE_DIR, "packages", "app"))) {
  if (/^\.env(\..*)?$/.test(name) && name !== ".env") {
    rmSync(join(STANDALONE_DIR, "packages", "app", name), { force: true });
    console.log(`[desktop:build] Removed standalone env file: ${name}`);
  }
}
writeFileSync(envPath, "TMDB_API_KEY=dummy-key-for-build\nFLYX_DESKTOP=true\n", "utf-8");
console.log("[desktop:build] Standalone .env reset to dummy values (Electron injects runtime config)");

// Step 6: Copy workspace packages (@flyx/*) into the app-level node_modules.
// Next.js standalone output does not automatically include monorepo workspace
// symlinks. Without them, API routes that import from @flyx/extractors,
// @flyx/providers, @flyx/core, etc. crash with MODULE_NOT_FOUND at runtime.
// Destination must be the app-level node_modules (NOT the standalone root):
// electron-builder drops top-level node_modules dirs in extraResources, and
// the root one was merged away in step 5a2.
const flyxSrc = join(ROOT, "node_modules", "@flyx");
const flyxDest = join(STANDALONE_DIR, "packages", "app", "node_modules", "@flyx");
if (existsSync(flyxSrc)) {
  mkdirSync(flyxDest, { recursive: true });

  const packages = readdirSync(flyxSrc);
  for (const name of packages) {
    const srcPath = join(flyxSrc, name);
    const stat = lstatSync(srcPath);

    // Resolve symlinks to their real target (workspace packages are symlinked)
    let realPath;
    try {
      realPath = realpathSync(srcPath);
    } catch {
      console.warn(`[desktop:build] Skipping broken symlink: @flyx/${name}`);
      continue;
    }

    // Skip @flyx/app (already part of the standalone build)
    if (name === "app") continue;
    // Skip @flyx/desktop (Electron main process, not needed by server)
    if (name === "desktop") continue;

    const destPath = join(flyxDest, name);
    const pkgJson = join(realPath, "package.json");

    if (!existsSync(pkgJson)) {
      console.warn(`[desktop:build] Skipping @flyx/${name}: no package.json`);
      continue;
    }

    // Only copy package.json + src (exclude node_modules, dist, tests, fixtures)
    const excludeDirs = ["node_modules", "dist", ".turbo", "__fixtures__", "__mocks__"];
    const excludeFiles = [".test.ts", ".test.tsx", ".test.js", ".spec.ts", ".spec.tsx"];

    function shouldExclude(entryPath) {
      const base = entryPath.split(/[\\/]/).pop() || "";
      if (excludeDirs.includes(base)) return true;
      if (excludeFiles.some((ext) => base.endsWith(ext))) return true;
      return false;
    }

    function copyDir(src, dest) {
      if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
      const entries = readdirSync(src);
      for (const entry of entries) {
        if (shouldExclude(entry)) continue;
        const srcEntry = join(src, entry);
        const destEntry = join(dest, entry);
        const entryStat = lstatSync(srcEntry);
        if (entryStat.isDirectory()) {
          copyDir(srcEntry, destEntry);
        } else {
          cpSync(srcEntry, destEntry);
        }
      }
    }

    copyDir(realPath, destPath);
    console.log(`[desktop:build] Copied workspace package: @flyx/${name}`);
  }
}

// Step 7: Fetch the ffmpeg binary (single gzipped file from ffmpeg-static's
// releases) so downloads can remux HLS/DASH streams on-device.
try {
  await ensureFfmpeg(join(STANDALONE_DIR, "ffmpeg"));
} catch (err) {
  console.warn(`[desktop:build] ${err.message} — remux downloads will fall back to system ffmpeg`);
}

// Step 8: Drop source maps from the payload (they embed original sources).
function removeSourceMaps(dir) {
  let removed = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      removed += removeSourceMaps(full);
    } else if (entry.name.endsWith(".map")) {
      rmSync(full, { force: true });
      removed += 1;
    }
  }
  return removed;
}
console.log(`[desktop:build] Removed ${removeSourceMaps(STANDALONE_DIR)} source map file(s)`);

console.log("[desktop:build] Done! Standalone build at:", STANDALONE_DIR);
console.log("[desktop:build] Run 'npm run desktop:package' to create installers.");
