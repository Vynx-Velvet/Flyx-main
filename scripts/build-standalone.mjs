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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const APP_DIR = join(ROOT, "packages", "app");
const STANDALONE_DIR = join(ROOT, ".flyx-standalone");

console.log("[standalone] Building Next.js standalone...");

// Step 1: Build with DUMMY env only. Never load the Flyx data dir .env —
// it holds the user's real JWT secret, host key, master token and account
// password, and build-time env can end up baked into build output that gets
// shipped publicly. Real config is injected at runtime by the desktop app.
execSync("npx next build", {
  cwd: APP_DIR,
  env: {
    ...process.env,
    TMDB_API_KEY: "dummy-key-for-build",
    JWT_SECRET: "dummy-secret-for-build-0123456789abcdef",
    HOST_KEY: "dummy-host-key-for-build",
    FLYX_STANDALONE: "1",
  },
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
  console.error("[standalone] ERROR: No standalone output found. Is output: 'standalone' in next.config.ts?");
  process.exit(1);
}

console.log("[standalone] Copying standalone output...");
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
  console.log("[standalone] Static files copied to app .next/static");
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
  console.log("[standalone] Public assets copied to app public/");
}

// Step 5b: Minimal desktop .env — NEVER copy the real one. Next's standalone
// output includes packages/app/.env (which holds the real TMDB API key), and
// that file ends up in the public installer. Ship only harmless placeholders.
const envPath = join(STANDALONE_DIR, "packages", "app", ".env");
writeFileSync(envPath, "TMDB_API_KEY=dummy-key-for-build\nFLYX_DESKTOP=true\n", "utf-8");
console.log("[standalone] Standalone .env reset to dummy values (Electron injects runtime config)");

// Step 6: Copy workspace packages (@flyx/*) into standalone node_modules.
// Next.js standalone output does not automatically include monorepo workspace
// symlinks. Without them, API routes that import from @flyx/extractors,
// @flyx/providers, @flyx/core, etc. crash with MODULE_NOT_FOUND at runtime.
const flyxSrc = join(ROOT, "node_modules", "@flyx");
const flyxDest = join(STANDALONE_DIR, "node_modules", "@flyx");
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
      console.warn(`[standalone] Skipping broken symlink: @flyx/${name}`);
      continue;
    }

    // Skip @flyx/app (already part of the standalone build)
    if (name === "app") continue;
    // Skip @flyx/desktop (Electron) and @flyx/cli (not needed by server)
    if (name === "desktop" || name === "cli") continue;

    const destPath = join(flyxDest, name);
    const pkgJson = join(realPath, "package.json");

    if (!existsSync(pkgJson)) {
      console.warn(`[standalone] Skipping @flyx/${name}: no package.json`);
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
    console.log(`[standalone] Copied workspace package: @flyx/${name}`);
  }
}

console.log("[standalone] Done! Standalone build at:", STANDALONE_DIR);
console.log("[standalone] Run 'flyx start' to launch the server.");
