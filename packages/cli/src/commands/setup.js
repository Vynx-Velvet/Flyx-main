/**
 * flyx setup — Interactive first-time setup wizard.
 */

const { ask, askPassword, confirm, select } = require("../lib/prompts");
const { writeEnv, envExists, ensureDataDir } = require("../lib/env-file");
const { hashPassword } = require("../lib/password");
const { createAccount, listAccounts, getAccountCount } = require("../lib/store");
const { randomString, randomPassword } = require("../lib/random");
const { getLANURLs, getLocalURL } = require("../lib/network");
const { PORT } = require("../lib/paths");

async function validateTMDB(key) {
  if (!key) return { ok: true, skipped: true };
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(7000) },
    );
    if (res.status === 200) return { ok: true };
    if (res.status === 401) return { ok: false, error: "That API key doesn't work. Make sure it's the full token (starts with eyJ...)." };
    return { ok: false, error: `TMDB returned ${res.status}. Try again or press Enter to skip.` };
  } catch {
    return { ok: false, error: "Could not reach TMDB (network error). Press Enter to skip, or try again." };
  }
}

async function runSetup(options = {}) {
  const nonInteractive = options.nonInteractive || !process.stdin.isTTY;

  console.log("\n🎬  Welcome to Flyx Setup!\n");
  console.log("Your privacy-first streaming hub. Movies, TV, anime, manga, live sports —");
  console.log("all in one place, with no ads and no tracking.\n");
  console.log("This wizard will get you streaming in under 2 minutes.\n");

  if (envExists() && !options.force) {
    const overwrite = nonInteractive
      ? options.force
      : await confirm("An existing configuration was found. Overwrite it?");
    if (!overwrite) {
      console.log("Setup cancelled. Your existing config is untouched.");
      return;
    }
  }

  ensureDataDir();

  // ── Step 1: TMDB Key ──────────────────────────────────────────
  console.log("── Step 1: TMDB API Key ──\n");
  console.log("TMDB provides movie/TV metadata (posters, descriptions, cast).");
  console.log("It's free — get a key at: https://www.themoviedb.org/settings/api\n");

  let tmdbKey = options.tmdbKey || "";
  if (!nonInteractive) {
    while (true) {
      const input = await ask("TMDB API key (press Enter to skip)", { defaultValue: tmdbKey });
      if (!input) {
        tmdbKey = "";
        console.log("  Skipped — you can add it later with: flyx config set TMDB_API_KEY <key>\n");
        break;
      }
      const result = await validateTMDB(input);
      if (result.ok) {
        tmdbKey = input;
        console.log("  ✅ Key verified!\n");
        break;
      }
      console.log(`  ❌ ${result.error}`);
      const skip = await confirm("Skip for now?");
      if (skip) { tmdbKey = ""; break; }
    }
  }

  // ── Step 2: Account Mode ──────────────────────────────────────
  console.log("── Step 2: Account Mode ──\n");

  const mode = options.mode || (nonInteractive ? "shared" : await select("Who will use Flyx?", [
    { label: "Just Me (private — no landing page)", value: "private" },
    { label: "Family & Friends (shared — landing page with login)", value: "shared" },
  ]));
  const isShared = mode === "shared";
  console.log(`  Mode: ${isShared ? "Shared (Family & Friends)" : "Private (Just Me)"}\n`);

  // ── Step 3: Network ───────────────────────────────────────────
  console.log("── Step 3: Network ──\n");

  const network = options.network || (nonInteractive ? "lan" : await select("Network mode:", [
    { label: "Localhost only (127.0.0.1 — this computer only)", value: "localhost" },
    { label: "Local Network (0.0.0.0 — accessible from phones/TVs)", value: "lan" },
  ]));
  const hostname = network === "lan" ? "0.0.0.0" : "127.0.0.1";

  if (network === "lan") {
    const urls = getLANURLs();
    if (urls.length > 0) {
      console.log("  📡 Your network URLs:");
      urls.forEach((u) => console.log(`     ${u.url}`));
    }
  }
  console.log(`  Local URL: ${getLocalURL()}\n`);

  // ── Step 4: Admin Account ─────────────────────────────────────
  console.log("── Step 4: Admin Account ──\n");

  let username, password;

  if (isShared) {
    username = options.username || (nonInteractive ? "admin" : await ask("Admin username", { defaultValue: "admin" }));
    while (username.length < 3) {
      username = await ask("Username must be at least 3 characters");
    }
    if (options.password) {
      password = options.password;
    } else if (nonInteractive) {
      password = randomPassword();
    } else {
      password = await askPassword("Admin password (min 8 chars)");
      while (password.length < 8) {
        console.log("Password must be at least 8 characters.");
        password = await askPassword("Admin password");
      }
    }
    console.log(`  Admin: ${username}`);
  } else {
    // Private mode
    const displayName = options.username || (nonInteractive ? "You" : await ask("Your display name", { defaultValue: "You" }));
    username = displayName.toLowerCase().replace(/\s+/g, "-");
    if (options.password) {
      password = options.password;
    } else {
      password = randomPassword();
    }
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password}`);
    console.log("  ⚠️  Save this password — you'll need it to log in!");
  }

  // ── Generate secrets ──────────────────────────────────────────
  const jwtSecret = randomString(64);
  const hostKey = randomString(24);

  // ── Step 5: Summary ───────────────────────────────────────────
  console.log("\n── Ready to Create ──\n");
  console.log(`  TMDB Key:    ${tmdbKey ? "✅ " + tmdbKey.slice(0, 8) + "..." : "⏭️  Skipped"}`);
  console.log(`  Mode:        ${isShared ? "Shared (landing page)" : "Private (no landing page)"}`);
  console.log(`  Network:     ${hostname} (port ${PORT})`);
  console.log(`  Admin:       ${username}`);
  if (isShared) {
    console.log(`  Host Key:    ${hostKey}`);
    console.log("               (share this with family/friends to create accounts)");
  }
  console.log(`  Data dir:    ${require("../lib/paths").DATA_DIR}`);

  if (!nonInteractive) {
    const go = await confirm("\nCreate this configuration?", { defaultYes: true });
    if (!go) { console.log("Setup cancelled."); return; }
  }

  // ── Write .env ────────────────────────────────────────────────
  writeEnv({
    TMDB_API_KEY: tmdbKey,
    JWT_SECRET: jwtSecret,
    HOST_KEY: hostKey,
    ENABLE_LANDING_PAGE: isShared ? "true" : "false",
    HOSTNAME: hostname,
    PORT: String(PORT),
  });
  console.log("✅  Configuration saved to AppData.");

  // Also write to standalone dir if it exists (so CLI `start` picks it up)
  const { STANDALONE_DIR } = require("../lib/paths");
  if (STANDALONE_DIR) {
    const standaloneEnvPath = require("path").join(STANDALONE_DIR, "packages", "app", ".env");
    try {
      // Read existing standalone .env (has TMDB key from build)
      let existing = "";
      if (require("fs").existsSync(standaloneEnvPath)) {
        existing = require("fs").readFileSync(standaloneEnvPath, "utf-8");
      }
      // Merge: keep existing TMDB key if setup didn't provide one
      const mergedLines = [];
      const existingVars = {};
      for (const line of existing.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const eq = trimmed.indexOf("=");
          if (eq > 0) existingVars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
        }
      }
      // Our vars take priority, but keep existing TMDB key if ours is blank
      const finalVars = { ...existingVars };
      const ourVars = { TMDB_API_KEY: tmdbKey, JWT_SECRET: jwtSecret, HOST_KEY: hostKey, ENABLE_LANDING_PAGE: isShared ? "true" : "false", HOSTNAME: hostname, PORT: String(PORT) };
      for (const [k, v] of Object.entries(ourVars)) {
        if (k === "TMDB_API_KEY" && (!v || !v.trim())) {
          // Keep existing TMDB key
          continue;
        }
        finalVars[k] = v;
      }
      // Write merged
      let content = "# Flyx environment — managed by flyx setup\n\n";
      for (const [k, v] of Object.entries(finalVars)) {
        content += `${k}=${v}\n`;
      }
      require("fs").writeFileSync(standaloneEnvPath, content, "utf-8");
      console.log("✅  Synced to standalone build.");
    } catch (err) {
      // Non-fatal — standalone dir might not exist yet
    }
  }

  // ── Create admin account ──────────────────────────────────────
  try {
    const hash = await hashPassword(password);
    createAccount(username, hash, true);
    console.log(`✅  Admin account created: ${username}`);
  } catch (err) {
    console.log(`❌  Failed to create account: ${err.message}`);
  }

  // ── Done ──────────────────────────────────────────────────────
  console.log("\n🎉  Flyx is ready!\n");
  console.log(`   Start the server:  flyx start`);
  console.log(`   Local URL:         ${getLocalURL()}`);
  if (network === "lan") {
    const urls = getLANURLs();
    if (urls.length > 0) {
      console.log(`   Network URL:       ${urls[0].url}`);
    }
  }
  console.log("");

  // ── Offer to build standalone ─────────────────────────────────
  if (!nonInteractive) {
    const startNow = await confirm("Start Flyx now?", { defaultYes: true });
    if (startNow) {
      // We'll need to build first if standalone doesn't exist
      const { SERVER_SCRIPT } = require("../lib/paths");
      const fs = require("fs");
      if (!SERVER_SCRIPT || !fs.existsSync(SERVER_SCRIPT)) {
        console.log("\nBuilding standalone server first...");
        const { execSync } = require("child_process");
        try {
          execSync("node scripts/build-standalone.mjs", {
            cwd: require("path").resolve(__dirname, "..", "..", "..", ".."),
            stdio: "inherit",
          });
        } catch {
          console.log("❌ Build failed. Run 'flyx update' manually.");
          return;
        }
      }
      // Run start
      const { default: startCmd } = require("./start");
      await startCmd({});
    }
  }
}

module.exports = { default: runSetup };
