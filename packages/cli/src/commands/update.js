/**
 * flyx update — Pull latest from GitHub and rebuild the server.
 *
 * Flow:
 *   1. Git fetch + pull from remote
 *   2. npm install (if package files changed)
 *   3. Rebuild standalone server
 *   4. Restart if it was running
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { ask, confirm } = require("../lib/prompts");
const { readState, stopServer, isProcessAlive } = require("../lib/server");
const { STANDALONE_DIR } = require("../lib/paths");

// ── Helpers ────────────────────────────────────────────────────────

function git(args, cwd) {
  return execSync(`git ${args}`, { cwd, encoding: "utf-8", stdio: "pipe" }).trim();
}

function gitMaybe(args, cwd) {
  try { return git(args, cwd); } catch { return ""; }
}

function hasGit(cwd) {
  try {
    git("rev-parse --git-dir", cwd);
    return true;
  } catch {
    return false;
  }
}

function hasUncommittedChanges(cwd) {
  const s = gitMaybe("status --porcelain", cwd);
  return s.length > 0;
}

function getCurrentBranch(cwd) {
  return git("rev-parse --abbrev-ref HEAD", cwd);
}

function hasUpstream(cwd) {
  const s = gitMaybe("rev-parse --abbrev-ref --symbolic-full-name @{u}", cwd);
  return s.length > 0 && !s.startsWith("fatal:");
}

function revParse(ref, cwd) {
  return gitMaybe(`rev-parse ${ref}`, cwd);
}

// ── Main ───────────────────────────────────────────────────────────

async function runUpdate(options = {}) {
  const rootDir = path.resolve(__dirname, "..", "..", "..", "..");
  const buildScript = path.join(rootDir, "scripts", "build-standalone.mjs");
  const skipGit = options.git === false; // --no-git flag

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
      let remoteUrl = gitMaybe("remote get-url origin", rootDir);

      if (options.remote) {
        if (remoteUrl && options.remote !== remoteUrl) {
          git(`remote set-url origin ${options.remote}`, rootDir);
          console.log(`🔗 Remote updated: ${options.remote}`);
        } else if (!remoteUrl) {
          git(`remote add origin ${options.remote}`, rootDir);
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
        console.log(git("status --short", rootDir));

        const discard = options.force
          ? true
          : await confirm("Discard them and pull latest?");

        if (!discard) {
          console.log("\n   Stash your changes and try again, or use --no-git to skip the pull.\n");
          process.exit(0);
        }

        console.log("Resetting local changes...");
        git("checkout -- .", rootDir);
        git("clean -fd", rootDir);
      }

      // Fetch latest
      console.log(`📡 Fetching ${remoteUrl}...`);
      try {
        git(`fetch ${remote} --prune`, rootDir);
      } catch (err) {
        console.error(`❌ Failed to fetch from ${remote}. Check your connection and remote URL.`);
        console.error(`   ${err.stderr || err.message}`);
        process.exit(1);
      }

      // Determine branch
      const localBranch = options.branch || getCurrentBranch(rootDir);
      const targetRef = `${remote}/${localBranch}`;

      const localCommit = revParse("HEAD", rootDir);
      const remoteCommit = revParse(targetRef, rootDir);

      if (!remoteCommit) {
        console.error(`❌ Branch "${localBranch}" not found on remote.`);
        console.error(`   Available branches:`);
        try {
          const branches = git("ls-remote --heads origin", rootDir)
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
          git(`reset --hard ${targetRef}`, rootDir);
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
    console.log("📦 Checking dependencies...");
    try {
      execSync("npm install --prefer-offline --no-audit --no-fund", {
        cwd: rootDir,
        stdio: "pipe",
      });
      console.log("✅ Dependencies up to date.");
    } catch (err) {
      console.log("⚠️  npm install had issues — continuing anyway.");
    }
  }

  // ── Stop if running ─────────────────────────────────────────────

  if (wasRunning) {
    console.log("\n🛑 Stopping server before rebuild...");
    await stopServer(state.pid);
  }

  // ── Rebuild standalone ──────────────────────────────────────────

  console.log("\n🔧 Building standalone server...\n");
  try {
    execSync(`node "${buildScript}"`, {
      cwd: rootDir,
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

  // ── Restart ─────────────────────────────────────────────────────

  if (wasRunning) {
    console.log("\n🔄 Restarting server...\n");
    const { default: runStart } = require("./start");
    await runStart({ daemon: state.mode === "daemon" });
  } else {
    console.log("\nRun 'flyx start' to launch the server.\n");
  }
}

module.exports = { default: runUpdate };
