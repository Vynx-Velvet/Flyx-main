/**
 * flyx update — Pull latest from GitHub and rebuild the server.
 *
 * Flow:
 *   1. Git fetch + pull from remote
 *   2. npm ci (exact lockfile install)
 *   3. Rebuild standalone server
 *   4. Restart if it was running
 */

const { execSync, execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { confirm } = require("../lib/prompts");
const { readState, stopServer, isProcessAlive } = require("../lib/server");

// ── Helpers ────────────────────────────────────────────────────────

// All git calls go through execFileSync with an argv array — no shell, so
// user-supplied --remote/--branch values can't inject commands.
function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: "pipe" }).trim();
}

function gitMaybe(args, cwd) {
  try { return git(args, cwd); } catch { return ""; }
}

const BRANCH_RE = /^[A-Za-z0-9._/-]+$/;

/** Branch names: safe charset, no leading '-' or '/', no '..'. */
function isValidBranch(name) {
  return (
    typeof name === "string" &&
    BRANCH_RE.test(name) &&
    !name.startsWith("-") &&
    !name.startsWith("/") &&
    !name.includes("..") &&
    !name.endsWith("/") &&
    !name.endsWith(".lock")
  );
}

/**
 * Remote URLs: only https://, ssh:// or scp-style git@host:path. This rules
 * out option injection (leading '-') and git's ext::/fd:: transports, which
 * run arbitrary commands.
 */
function isValidRemoteUrl(url) {
  if (typeof url !== "string" || url.length > 2048) return false;
  if (/\s/.test(url) || url.startsWith("-")) return false;
  return (
    /^https:\/\/[A-Za-z0-9.-]+(:\d+)?\/[A-Za-z0-9._~/-]+$/.test(url) ||
    /^ssh:\/\/[A-Za-z0-9._-]+@[A-Za-z0-9.-]+(:\d+)?\/[A-Za-z0-9._~/-]+$/.test(url) ||
    /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:[A-Za-z0-9._~/-]+$/.test(url)
  );
}

/**
 * macOS/Linux: install the current platform's Tailwind/lightningcss natives
 * that the Windows-generated lockfile omits (same workaround as
 * .github/workflows/desktop-build.yml). Versions come from the lockfile.
 */
function installPlatformNatives(rootDir) {
  if (process.platform === "win32") return;
  const lock = JSON.parse(fs.readFileSync(path.join(rootDir, "package-lock.json"), "utf-8"));
  const pkgs = lock.packages || {};
  const specs = [];
  for (const name of ["lightningcss", "@tailwindcss/oxide"]) {
    const entry = pkgs[`node_modules/${name}`];
    if (entry && /^[0-9A-Za-z.+-]+$/.test(entry.version || "")) specs.push(`${name}@${entry.version}`);
  }
  if (specs.length === 0) return;
  execFileSync("npm", ["install", "--no-save", "--ignore-scripts", ...specs], {
    cwd: rootDir,
    stdio: "pipe",
  });
}

function hasGit(cwd) {
  try {
    git(["rev-parse", "--git-dir"], cwd);
    return true;
  } catch {
    return false;
  }
}

function hasUncommittedChanges(cwd) {
  const s = gitMaybe(["status", "--porcelain"], cwd);
  return s.length > 0;
}

function getCurrentBranch(cwd) {
  return git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
}

function revParse(ref, cwd) {
  return gitMaybe(["rev-parse", "--verify", "--quiet", ref], cwd);
}

// ── Main ───────────────────────────────────────────────────────────

async function runUpdate(options = {}) {
  const rootDir = path.resolve(__dirname, "..", "..", "..", "..");
  const buildScript = path.join(rootDir, "scripts", "build-standalone.mjs");
  const skipGit = options.git === false; // --no-git flag

  if (options.remote !== undefined && !isValidRemoteUrl(options.remote)) {
    console.error(`❌ Invalid --remote URL: ${options.remote}`);
    console.error("   Use https://host/owner/repo(.git), ssh://user@host/path or git@host:owner/repo.git");
    process.exit(1);
  }
  if (options.branch !== undefined && !isValidBranch(options.branch)) {
    console.error(`❌ Invalid --branch name: ${options.branch}`);
    process.exit(1);
  }

  if (!fs.existsSync(buildScript)) {
    console.error("❌ Build script not found. Are you running from the Flyx source directory?");
    console.error(`   Expected: ${buildScript}`);
    process.exit(1);
  }

  // ── Check server state ──────────────────────────────────────────

  const state = readState();
  const wasRunning = state && state.pid && isProcessAlive(state.pid);

  // ── Git pull ────────────────────────────────────────────────────

  if (!skipGit) {
    console.log("");

    if (!hasGit(rootDir)) {
      console.log("⚠️  Not a git repository. Use --no-git to rebuild without pulling.\n");
    } else {
      // Add / configure remote
      let remote = "origin";
      let remoteUrl = gitMaybe(["remote", "get-url", "origin"], rootDir);

      if (options.remote) {
        if (remoteUrl && options.remote !== remoteUrl) {
          git(["remote", "set-url", "origin", options.remote], rootDir);
          console.log(`🔗 Remote updated: ${options.remote}`);
        } else if (!remoteUrl) {
          git(["remote", "add", "origin", options.remote], rootDir);
          console.log(`🔗 Remote added: ${options.remote}`);
        }
        remoteUrl = options.remote;
      }

      if (!remoteUrl) {
        console.log("⚠️  No git remote configured.");
        console.log("   Set one up first:");
        console.log("     git remote add origin https://github.com/<your-username>/flyx.git");
        console.log("   Then run 'flyx update' again.\n");
        console.log("   Or use --no-git to rebuild without pulling.\n");
        process.exit(0);
      }

      // Check for uncommitted changes
      if (hasUncommittedChanges(rootDir)) {
        console.log("⚠️  You have uncommitted changes:");
        console.log(git(["status", "--short"], rootDir));

        const discard = options.force
          ? true
          : await confirm("Discard them and pull latest?");

        if (!discard) {
          console.log("\n   Stash your changes and try again, or use --no-git to skip the pull.\n");
          process.exit(0);
        }

        console.log("Resetting local changes...");
        git(["checkout", "--", "."], rootDir);
        git(["clean", "-fd"], rootDir);
      }

      // Fetch latest
      console.log(`📡 Fetching ${remoteUrl}...`);
      try {
        git(["fetch", "--prune", remote], rootDir);
      } catch (err) {
        console.error(`❌ Failed to fetch from ${remote}. Check your connection and remote URL.`);
        console.error(`   ${err.stderr || err.message}`);
        process.exit(1);
      }

      // Determine branch
      const localBranch = options.branch || getCurrentBranch(rootDir);
      if (!isValidBranch(localBranch) || localBranch === "HEAD") {
        console.error(`❌ Can't determine a valid branch to track (got "${localBranch}"). Pass --branch <name>.`);
        process.exit(1);
      }
      const targetRef = `${remote}/${localBranch}`;

      const localCommit = revParse("HEAD", rootDir);
      const remoteCommit = revParse(targetRef, rootDir);

      if (!remoteCommit) {
        console.error(`❌ Branch "${localBranch}" not found on remote.`);
        console.error(`   Available branches:`);
        try {
          const branches = git(["ls-remote", "--heads", "origin"], rootDir)
            .split("\n")
            .map((l) => l.split("/").pop())
            .filter(Boolean);
          branches.forEach((b) => console.error(`     - ${b}`));
        } catch {}
        process.exit(1);
      }

      if (localCommit === remoteCommit) {
        console.log("✅ Already up to date.");
      } else {
        console.log(`⬇️  Pulling ${localCommit.slice(0, 7)}..${remoteCommit.slice(0, 7)} (${localBranch})...`);
        try {
          git(["reset", "--hard", targetRef], rootDir);
        } catch (err) {
          console.error("❌ Failed to pull. Try stashing your changes first.");
          process.exit(1);
        }
        console.log("✅ Pulled latest.");
      }
    }
  }

  // ── Install deps ────────────────────────────────────────────────

  const packageLock = path.join(rootDir, "package-lock.json");
  const nodeModules = path.join(rootDir, "node_modules");

  if (fs.existsSync(packageLock) && fs.existsSync(nodeModules)) {
    console.log("📦 Installing dependencies (npm ci)...");
    try {
      // npm ci installs exactly what package-lock.json pins (no silent
      // range upgrades). Constant command string — nothing interpolated.
      execSync("npm ci --no-audit --no-fund", {
        cwd: rootDir,
        stdio: "pipe",
      });
      installPlatformNatives(rootDir);
      console.log("✅ Dependencies up to date.");
    } catch (err) {
      console.log("⚠️  npm ci had issues — continuing anyway.");
    }
  }

  // ── Stop if running ─────────────────────────────────────────────

  if (wasRunning) {
    console.log("\n🛑 Stopping server before rebuild...");
    const res = await stopServer(state);
    if (res.refused) {
      console.log(`⚠️  Did not stop PID ${state.pid}: ${res.reason}.`);
    }
  }

  // ── Rebuild standalone ──────────────────────────────────────────

  console.log("\n🔧 Building standalone server...\n");
  try {
    // Build with DUMMY values only — never the data-dir .env. Build-time
    // env can be baked into the output, and .flyx-standalone is what
    // electron-builder packs. Real secrets are injected when the server is
    // spawned (see lib/server.js).
    execFileSync(process.execPath, [buildScript], {
      cwd: rootDir,
      env: {
        ...process.env,
        TMDB_API_KEY: "dummy-key-for-build",
        JWT_SECRET: "dummy-secret-for-build-0123456789abcdef",
        HOST_KEY: "dummy-host-key-for-build",
      },
      stdio: "inherit",
    });
  } catch (err) {
    console.error("\n❌ Build failed.");
    if (wasRunning) {
      console.error("Your server is stopped. Fix the build, then run 'flyx start'.");
    }
    process.exit(1);
  }

  console.log("✅ Build complete.");

  // macOS/Linux: make sure everything we just produced is runnable. A pull
  // can reset the CLI entry point's mode, and the bundled ffmpeg must be
  // executable for downloads — users should never have to chmod by hand.
  if (process.platform !== "win32") {
    const candidates = [
      path.join(rootDir, "packages", "cli", "cli.js"),
      path.join(rootDir, ".flyx-standalone", "ffmpeg", "ffmpeg"),
    ];
    for (const file of candidates) {
      try {
        if (fs.existsSync(file)) fs.chmodSync(file, 0o755);
      } catch {
        /* best effort */
      }
    }
  }

  // ── Restart ─────────────────────────────────────────────────────

  if (wasRunning) {
    console.log("\n🔄 Restarting server...\n");
    const { default: runStart } = require("./start");
    await runStart({ daemon: state.mode === "daemon" });
  } else {
    console.log("\nRun 'flyx start' to launch the server.\n");
  }
}

module.exports = { default: runUpdate, isValidBranch, isValidRemoteUrl };
