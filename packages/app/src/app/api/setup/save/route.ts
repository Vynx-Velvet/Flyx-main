import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from "fs";
import { join } from "path";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/get-session";
import { createAccount, findAccountByUsername, getAccountCount, withAccountLock } from "@/lib/db";
import { addLog } from "@/lib/log-store";
import { isMasterRequest } from "@/lib/request-master";
import { assertSafeEnvEntry } from "@/lib/security/env-safety";

export const runtime = "nodejs";

/** Parse a KEY=VALUE env file (tolerant: skips comments/blank/malformed lines). */
function parseEnvFile(raw: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return vars;
}

function serializeEnvFile(vars: Record<string, string>): string {
  let content = "# Flyx environment — managed by flyx setup\n\n";
  for (const [k, v] of Object.entries(vars)) {
    content += `${k}=${v}\n`;
  }
  return content;
}

/**
 * Who may (re-)run setup. Desktop: only the master window (the middleware
 * also enforces this). Elsewhere the wizard is open on genuine first run so
 * the operator can configure a fresh server — but once setup is complete
 * (flag set or any account exists) it rewrites credentials and secrets, so
 * it then requires an admin session.
 */
async function setupAllowed(request: NextRequest): Promise<boolean> {
  if (isMasterRequest(request)) return true;
  if (process.env.FLYX_DESKTOP === "true") return false;
  const setupDone = process.env.SETUP_COMPLETE === "true" || getAccountCount() > 0;
  if (!setupDone) return true;
  return (await getSession())?.isAdmin === true;
}

export async function POST(request: NextRequest) {
  // Log before anything can hang — a request whose body never completes
  // (request.json() below) would otherwise leave zero trace, and "the
  // wizard silently reset" is exactly what the user reports then.
  console.log("[Flyx Setup] save request received");
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) ?? {};
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  // Serialized with every other account-creating flow: the authorization
  // check below reads "is setup done / does an account exist?", and two
  // concurrent first-run saves must not both pass it.
  return withAccountLock(() => save(request, body));
}

async function save(request: NextRequest, body: Record<string, unknown>): Promise<NextResponse> {
  try {
    if (!(await setupAllowed(request))) {
      console.warn("[Flyx Setup] save rejected: not authorized (setup complete, or desktop non-master)");
      return NextResponse.json(
        { ok: false, error: "Setup is already complete. Sign in as an admin to change it." },
        { status: 403 },
      );
    }

    const { tmdbKey, username, password, displayName, networkMode } = body;

    // Validate required fields. The username/password become the default
    // account's credentials — if they're blank, the post-setup auto-login
    // has nothing to create and the wizard would loop forever.
    if (!tmdbKey || typeof tmdbKey !== "string" || !tmdbKey.trim()) {
      console.warn("[Flyx Setup] save rejected: TMDB API key is required");
      return NextResponse.json({ ok: false, error: "TMDB API key is required" }, { status: 400 });
    }
    const user = typeof username === "string" ? username.trim() : "";
    const pass = typeof password === "string" ? password.trim() : "";
    if (!user) {
      console.warn("[Flyx Setup] save rejected: username is required");
      return NextResponse.json({ ok: false, error: "Username is required" }, { status: 400 });
    }
    if (pass.length < MIN_PASSWORD_LENGTH) {
      console.warn("[Flyx Setup] save rejected: password too short");
      return NextResponse.json(
        { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 },
      );
    }
    console.log(`[Flyx Setup] save accepted (user ${JSON.stringify(user)}, mode ${String(networkMode)})`);

    // Determine data directory
    const dataDir = process.env.FLYX_DATA_DIR
      || join(
          process.env.LOCALAPPDATA || join(process.env.HOME || "", ".local", "share"),
          "flyx"
        );

    if (!existsSync(/*turbopackIgnore: true*/ dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    const envPath = join(dataDir, ".env");

    // Merge into the existing .env — never overwrite. The desktop app
    // pre-generates JWT_SECRET/HOST_KEY on first run; rewriting the file
    // wholesale would wipe them (and any user-added vars).
    const existing = existsSync(envPath)
      ? parseEnvFile(readFileSync(envPath, "utf-8"))
      : {};

    const next: Record<string, string> = { ...existing };
    next.TMDB_API_KEY = tmdbKey.trim();
    // Only the desktop server may mark itself desktop — a CLI/Docker server
    // writing this would switch itself into desktop (master-token) mode.
    if (process.env.FLYX_DESKTOP === "true") next.FLYX_DESKTOP = "true";
    // Marks first-run setup as done. Until this flag exists, the desktop
    // master window is pinned to the wizard (see middleware.ts) — otherwise
    // an account created before setup finished would let auto-login skip the
    // TMDB/network questions entirely.
    next.SETUP_COMPLETE = "true";

    next.DEFAULT_USERNAME = user;
    next.DEFAULT_PASSWORD = pass;
    if (typeof displayName === "string" && displayName.trim()) {
      next.DEFAULT_DISPLAY_NAME = displayName.trim();
    }
    next.HOSTNAME = networkMode === "network" ? "0.0.0.0" : "127.0.0.1";

    // Generate secrets if this is a fresh (non-desktop) setup
    if (!next.JWT_SECRET) {
      next.JWT_SECRET = randomBytes(32).toString("base64url");
    }
    if (!next.HOST_KEY) {
      next.HOST_KEY = randomBytes(18).toString("base64url");
    }

    // Every value written must stay on its own line: a line break in the TMDB
    // key or password would smuggle extra keys (a second JWT_SECRET,
    // NODE_OPTIONS…) into .env.
    for (const key of ["TMDB_API_KEY", "DEFAULT_USERNAME", "DEFAULT_PASSWORD", "DEFAULT_DISPLAY_NAME"]) {
      if (next[key] === undefined) continue;
      try {
        assertSafeEnvEntry(key, next[key]);
      } catch {
        console.warn(`[Flyx Setup] save rejected: ${key} contains a line break`);
        return NextResponse.json(
          { ok: false, error: "Values must not contain line breaks" },
          { status: 400 },
        );
      }
    }

    // Atomic write (tmp + rename) — desktop's env watcher fires on rename.
    // Owner-only: .env holds JWT_SECRET and the default password.
    const tmpPath = envPath + ".tmp";
    try {
      unlinkSync(tmpPath); // `mode` only applies when the file is created
    } catch {
      /* no stale tmp */
    }
    writeFileSync(tmpPath, serializeEnvFile(next), { encoding: "utf-8", mode: 0o600 });
    renameSync(tmpPath, envPath);

    // Mutate the running server's env so the new credentials and secret
    // take effect without a restart (JWT sign/verify and the middleware
    // read process.env per request). HOSTNAME changes need a re-bind —
    // the desktop main process restarts the server when it sees the
    // .env change; non-desktop hosts must restart manually.
    for (const key of [
      "TMDB_API_KEY",
      "JWT_SECRET",
      "HOST_KEY",
      "DEFAULT_USERNAME",
      "DEFAULT_PASSWORD",
      "DEFAULT_DISPLAY_NAME",
      "HOSTNAME",
      "SETUP_COMPLETE",
    ]) {
      if (next[key]) process.env[key] = next[key];
    }

    // Create the default admin account as part of setup. The post-setup
    // auto-login signs the master in from the account store — if the account
    // didn't exist at this point, auto-login could only fall back to
    // auto-creating from env creds, and any hiccup there bounced the wizard
    // right back to /setup ("Launch Flyx" looped). A save that returns ok
    // must always leave a usable account behind.
    //
    // BUT: the .env write above is the critical path — it already carries
    // the credentials and the SETUP_COMPLETE flag. If the account store is
    // broken (e.g. a truncated store.json that a force-kill left behind), a
    // throw here used to 500 the save *after* the flag was written, so the
    // wizard showed a raw TypeError and "Launch Flyx" never worked. Instead:
    // log the failure and still return ok — auto-login re-creates the
    // default account from the env credentials on the next boot (the
    // auto-create branch runs whenever the store has zero accounts), and
    // the store itself now self-heals on read (shape validation in db).
    //
    // The caller is authorized (first run, master, or admin), so a default
    // username that has no account yet — first run, a recovered store, or a
    // re-run that picked a new name — gets one. An existing account's
    // password is never silently replaced. (Runs under the account lock,
    // see POST.)
    try {
      if (!findAccountByUsername(user)) {
        const passwordHash = await hashPassword(pass);
        const account = createAccount(user, passwordHash, true);
        addLog({
          level: "info",
          category: "auth",
          message: `Default admin account "${account.username}" created by setup`,
        });
      }
    } catch (accountErr) {
      addLog({
        level: "error",
        category: "auth",
        message: `Account creation during setup failed (store may be corrupt): ${
          accountErr instanceof Error ? accountErr.message : String(accountErr)
        }`,
      });
    }

    console.log("[Flyx Setup] saved — env written, account handled");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Flyx Setup] save failed:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
