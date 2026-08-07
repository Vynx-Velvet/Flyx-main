/**
 * flyx setup — Interactive first-time setup wizard.
 *
 * Walks new users through configuring their Flyx instance,
 * then automatically builds and starts the server.
 */

const { ask, askPassword, confirm, select, step } = require("../lib/prompts");
const { writeEnv, envExists, ensureDataDir } = require("../lib/env-file");
const { hashPassword } = require("../lib/password");
const { createAccount } = require("../lib/store");
const { randomString, randomPassword } = require("../lib/random");
const { getLANURLs, getLocalURL } = require("../lib/network");
const { PORT } = require("../lib/paths");

const TOTAL_STEPS = 5;

// TMDB API v3 keys are 32 hex characters (e.g. b89acdd87e12c283f56feb2e016b4964).
// Quick format check so garbage input (like a JWT) fails fast without an API roundtrip.
function looksLikeTMDBKey(key) {
  return /^[0-9a-f]{32}$/i.test(key.trim());
}

async function validateTMDB(key) {
  if (!key) return { ok: true, skipped: true };
  if (!looksLikeTMDBKey(key)) {
    return {
      ok: false,
      error: "That doesn't look like a TMDB API key. It should be 32 hex characters (e.g. b89acdd87e12c283f56feb2e016b4964). Get one at https://www.themoviedb.org/settings/api",
    };
  }
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(7000) },
    );
    if (res.status === 200) return { ok: true };
    if (res.status === 401) return { ok: false, error: "That API key was rejected by TMDB. Double-check it at https://www.themoviedb.org/settings/api" };
    return { ok: false, error: `TMDB returned ${res.status}. Try again or press Enter to skip.` };
  } catch {
    return { ok: false, error: "Could not reach TMDB (network error). Press Enter to skip, or try again." };
  }
}

async function runSetup(options = {}) {
  const nonInteractive = options.nonInteractive || !process.stdin.isTTY;

  console.log("\n  🎬  Welcome to Flyx!\n");
  console.log("  Your privacy-first streaming hub. Movies, TV, anime,");
  console.log("  manga, and live sports — no ads, no tracking.\n");
  console.log("  Let's get you set up. It takes about a minute.\n");

  if (envExists() && !options.force) {
    const overwrite = nonInteractive
      ? options.force
      : await confirm("A configuration already exists. Overwrite it?");
    if (!overwrite) {
      console.log("  Setup cancelled. Your existing config is untouched.\n");
      return;
    }
  }

  ensureDataDir();

  // ── Step 1: TMDB Key ────────────────────────────────────────────

  step(1, TOTAL_STEPS, "TMDB API Key");
  console.log("  TMDB gives us posters, descriptions, cast info, and more.");
  console.log("  It's free — grab a key at: https://www.themoviedb.org/settings/api\n");

  let tmdbKey = options.tmdbKey || "";
  if (!nonInteractive) {
    while (true) {
      const input = await ask("  TMDB API key (press Enter to skip)", { defaultValue: tmdbKey });
      if (!input) {
        tmdbKey = "";
        console.log("  ⏭️  Skipped — add it later with: flyx config set TMDB_API_KEY <key>\n");
        break;
      }
      const result = await validateTMDB(input);
      if (result.ok) {
        tmdbKey = input;
        console.log("  ✅ Key verified!\n");
        break;
      }
      console.log(`  ❌ ${result.error}`);
      const skip = await confirm("  Skip for now?");
      if (skip) { tmdbKey = ""; break; }
    }
  }

  // ── Step 2: Account Mode ────────────────────────────────────────

  step(2, TOTAL_STEPS, "Who's Watching?");
  console.log("  Choose how people will access your Flyx instance.\n");

  const mode = options.mode || (nonInteractive ? "shared" : await select("  Account mode:", [
    { label: "Just Me — private, no landing page", value: "private" },
    { label: "Family & Friends — shared, with a login page", value: "shared" },
  ]));
  const isShared = mode === "shared";
  console.log(`  ➤ ${isShared ? "Shared — Family & Friends" : "Private — Just Me"}\n`);

  // ── Step 3: Network ─────────────────────────────────────────────

  step(3, TOTAL_STEPS, "Network");

  const network = options.network || (nonInteractive ? "lan" : await select("  Network mode:", [
    { label: "This computer only (localhost)", value: "localhost" },
    { label: "Whole home network — phones, TVs, other devices", value: "lan" },
  ]));
  const hostname = network === "lan" ? "0.0.0.0" : "127.0.0.1";

  if (network === "lan") {
    const urls = getLANURLs();
    if (urls.length > 0) {
      console.log("\n  📡  Network URLs other devices can use:");
      urls.forEach((u) => console.log(`      ${u.url}`));
      console.log("");
    }
  }
  console.log(`  ➤ Local URL: ${getLocalURL()}\n`);

  // ── Step 4: Admin Account ───────────────────────────────────────

  step(4, TOTAL_STEPS, "Your Account");

  let username, password;

  if (isShared) {
    console.log("  Create the admin account for managing Flyx.\n");
    username = options.username || (nonInteractive ? "admin" : await ask("  Admin username", { defaultValue: "admin" }));
    while (username.length < 3) {
      username = await ask("  Username must be at least 3 characters");
    }
    if (options.password) {
      password = options.password;
    } else if (nonInteractive) {
      password = randomPassword();
    } else {
      password = await askPassword("  Admin password (min 8 chars)");
      while (password.length < 8) {
        console.log("  Password must be at least 8 characters.");
        password = await askPassword("  Admin password");
      }
    }
    console.log(`  ➤ Admin account: ${username}\n`);
  } else {
    // Private mode — auto-generate credentials
    console.log("  Since this is a private instance, we'll create an account for you.\n");
    const displayName = options.username || (nonInteractive ? "You" : await ask("  Your display name", { defaultValue: "You" }));
    username = displayName.toLowerCase().replace(/\s+/g, "-");
    if (options.password) {
      password = options.password;
    } else {
      password = randomPassword();
    }
    console.log(`  ➤ Username: ${username}`);
    console.log(`  ➤ Password: ${password}`);
    console.log("  ⚠️  Save this password — you'll need it to log in!\n");
  }

  // ── Generate secrets ────────────────────────────────────────────
  const jwtSecret = randomString(64);
  const hostKey = randomString(24);

  // ── Step 5: Review & Create ─────────────────────────────────────

  step(5, TOTAL_STEPS, "Review");
  console.log(`  TMDB Key:    ${tmdbKey ? "✅ " + tmdbKey.slice(0, 8) + "..." : "⏭️  Skipped (add later)"}`);
  console.log(`  Mode:        ${isShared ? "Shared — landing page" : "Private — direct login"}`);
  console.log(`  Network:     ${hostname} on port ${PORT}`);
  console.log(`  Account:     ${username}`);
  if (isShared) {
    console.log(`  Host Key:    ${hostKey}`);
    console.log("               (share this so others can create accounts)");
  }
  console.log(`  Data:        ${require("../lib/paths").DATA_DIR}`);

  if (!nonInteractive) {
    const go = await confirm("\n  Create this configuration?");
    if (!go) { console.log("\n  Setup cancelled.\n"); return; }
  }

  // ── Write .env ──────────────────────────────────────────────────
  console.log("");
  writeEnv({
    TMDB_API_KEY: tmdbKey,
    JWT_SECRET: jwtSecret,
    HOST_KEY: hostKey,
    HOSTNAME: hostname,
    PORT: String(PORT),
  });
  console.log("  ✅ Configuration saved.");

  // Sync to standalone build if it exists
  const { STANDALONE_DIR } = require("../lib/paths");
  if (STANDALONE_DIR) {
    const standaloneEnvPath = require("path").join(STANDALONE_DIR, "packages", "app", ".env");
    try {
      let existing = "";
      if (require("fs").existsSync(standaloneEnvPath)) {
        existing = require("fs").readFileSync(standaloneEnvPath, "utf-8");
      }
      const existingVars = {};
      for (const line of existing.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const eq = trimmed.indexOf("=");
          if (eq > 0) existingVars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
        }
      }
      const finalVars = { ...existingVars };
      const ourVars = { TMDB_API_KEY: tmdbKey, JWT_SECRET: jwtSecret, HOST_KEY: hostKey, HOSTNAME: hostname, PORT: String(PORT) };
      for (const [k, v] of Object.entries(ourVars)) {
        if (k === "TMDB_API_KEY" && (!v || !v.trim())) continue;
        finalVars[k] = v;
      }
      let content = "# Flyx environment — managed by flyx setup\n\n";
      for (const [k, v] of Object.entries(finalVars)) {
        content += `${k}=${v}\n`;
      }
      require("fs").writeFileSync(standaloneEnvPath, content, "utf-8");
      console.log("  ✅ Synced to build.");
    } catch (err) {
      // Non-fatal — standalone dir might not exist yet
    }
  }

  // ── Create admin account ────────────────────────────────────────
  try {
    const hash = await hashPassword(password);
    createAccount(username, hash, true);
    console.log(`  ✅ Account created: ${username}`);
  } catch (err) {
    console.log(`  ❌ Failed to create account: ${err.message}`);
  }

  // ── Build & Launch ──────────────────────────────────────────────
  // Always build and start automatically — no extra prompts.

  if (options.start === false) {
    console.log("\n  🎉  Flyx is configured!\n");
    console.log(`  Start it up:  flyx start`);
    console.log(`  Local URL:    ${getLocalURL()}\n`);
    return;
  }

  console.log("\n  🚀  Building and launching Flyx...\n");

  const { SERVER_SCRIPT } = require("../lib/paths");
  const fs = require("fs");
  const path = require("path");

  if (!SERVER_SCRIPT || !fs.existsSync(SERVER_SCRIPT)) {
    console.log("  Building the server (this may take a minute)...\n");
    const { execSync } = require("child_process");
    try {
      execSync("node scripts/build-standalone.mjs", {
        cwd: path.resolve(__dirname, "..", "..", "..", ".."),
        stdio: "inherit",
      });
      console.log("");
    } catch {
      console.log("\n  ❌ Build failed. Run 'flyx update' to try again.");
      console.log("  Your configuration is saved — just run 'flyx start' after fixing the build.\n");
      return;
    }
  }

  // Launch the server
  const { default: startCmd } = require("./start");
  await startCmd({});
}

module.exports = { default: runSetup };
