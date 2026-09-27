/**
 * GET  /api/settings/env  — list the desktop .env vars (secrets masked)
 * PATCH /api/settings/env — set/remove vars ({ set, remove })
 *
 * Desktop-only (requires FLYX_DATA_DIR) and restricted to the instance
 * master (flyx_master_token cookie) with an admin session. Editing .env is
 * what powers "change the TMDB key / env vars without leaving the app": the
 * Electron main process watches .env and restarts the server on any change,
 * so the new values take effect automatically.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  chmodSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import { getSession } from "@/lib/auth/get-session";
import { isMasterRequest } from "@/lib/request-master";
import { ENV_KEY_RE, isBlockedEnvKey, isSafeEnvValue } from "@/lib/security/env-safety";
import { findAccountByUsername } from "@/lib/db";
import { normalizeHostEntry } from "@/lib/request-origin";

export const runtime = "nodejs";

// These are generated/managed by Flyx itself — never editable through the UI.
const LOCKED_KEYS = new Set([
  "JWT_SECRET",
  "HOST_KEY",
  "FLYX_MASTER_TOKEN",
  "DEFAULT_PASSWORD",
]);

// Values for keys that look sensitive are masked in GET responses.
const SECRET_RE = /(SECRET|TOKEN|PASSWORD|KEY|MASTER)/i;

function isLocked(key: string): boolean {
  return LOCKED_KEYS.has(key);
}

function isSecret(key: string): boolean {
  return isLocked(key) || SECRET_RE.test(key);
}

function getEnvPath(): string | null {
  const dir = process.env.FLYX_DATA_DIR;
  return dir ? join(dir, ".env") : null;
}

/** Parse a tolerant KEY=VALUE file. */
function parseEnv(raw: string): Record<string, string> {
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

function serializeEnv(vars: Record<string, string>): string {
  let content = "# Flyx environment — managed by flyx settings\n\n";
  for (const [k, v] of Object.entries(vars)) {
    content += `${k}=${v}\n`;
  }
  return content;
}

/** Reject non-master / non-admin callers (403). */
async function forbidden(request: NextRequest): Promise<boolean> {
  if (!isMasterRequest(request)) return true;
  const session = await getSession();
  return !session?.isAdmin;
}

export async function GET(request: NextRequest) {
  const envPath = getEnvPath();
  if (!envPath) {
    return NextResponse.json(
      { ok: false, error: "Environment editing is only available in desktop mode" },
      { status: 400 },
    );
  }
  if (await forbidden(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const vars = existsSync(envPath)
    ? parseEnv(readFileSync(envPath, "utf-8"))
    : {};

  const env = Object.entries(vars)
    .map(([key, value]) => ({
      key,
      value: isSecret(key) ? "" : value,
      secret: isSecret(key),
      locked: isLocked(key),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return NextResponse.json({ ok: true, env });
}

export async function PATCH(request: NextRequest) {
  const envPath = getEnvPath();
  if (!envPath) {
    return NextResponse.json(
      { ok: false, error: "Environment editing is only available in desktop mode" },
      { status: 400 },
    );
  }
  if (await forbidden(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { set?: Record<string, string>; remove?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const set = body?.set && typeof body.set === "object" ? body.set : {};
  const remove = Array.isArray(body?.remove) ? body.remove : [];

  // Validate before mutating anything. Names must be shell-safe identifiers
  // and never process/loader controls (NODE_OPTIONS, ELECTRON_*, PATH… —
  // every .env key lands in the server's environment); values must stay on
  // one line (a newline would smuggle in extra keys).
  for (const [key, value] of Object.entries(set)) {
    if (!ENV_KEY_RE.test(key)) {
      return NextResponse.json({ ok: false, error: `Invalid variable name: ${key}` }, { status: 400 });
    }
    if (isBlockedEnvKey(key)) {
      return NextResponse.json(
        { ok: false, error: `"${key}" cannot be set from Flyx` },
        { status: 400 },
      );
    }
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      return NextResponse.json({ ok: false, error: `Invalid value for ${key}` }, { status: 400 });
    }
    if (!isSafeEnvValue(String(value))) {
      return NextResponse.json(
        { ok: false, error: `Value for ${key} must not contain line breaks` },
        { status: 400 },
      );
    }
    if (isLocked(key)) {
      return NextResponse.json(
        { ok: false, error: `"${key}" is managed by Flyx and cannot be changed` },
        { status: 400 },
      );
    }
  }
  for (const key of remove) {
    if (typeof key !== "string") continue;
    if (!ENV_KEY_RE.test(key)) {
      return NextResponse.json({ ok: false, error: `Invalid variable name: ${key}` }, { status: 400 });
    }
    if (isLocked(key)) {
      return NextResponse.json(
        { ok: false, error: `"${key}" is managed by Flyx and cannot be removed` },
        { status: 400 },
      );
    }
  }

  // Keys with meaning beyond "a string": check them so a typo can't lock
  // the owner out or silently allow nothing.
  if ("DEFAULT_USERNAME" in set) {
    const name = String(set.DEFAULT_USERNAME).trim();
    if (!findAccountByUsername(name)?.isAdmin) {
      return NextResponse.json(
        { ok: false, error: `"${name}" is not an admin account` },
        { status: 400 },
      );
    }
    set.DEFAULT_USERNAME = name;
  }
  if ("FLYX_ALLOWED_HOSTS" in set) {
    const entries = String(set.FLYX_ALLOWED_HOSTS).split(/[\s,]+/).filter(Boolean);
    const hosts: string[] = [];
    for (const entry of entries) {
      const host = normalizeHostEntry(entry);
      if (!host) {
        return NextResponse.json(
          { ok: false, error: `"${entry}" is not a valid address` },
          { status: 400 },
        );
      }
      if (!hosts.includes(host)) hosts.push(host);
    }
    set.FLYX_ALLOWED_HOSTS = hosts.join(",");
  }

  const vars = existsSync(envPath)
    ? parseEnv(readFileSync(envPath, "utf-8"))
    : {};

  for (const key of remove) {
    delete vars[key];
  }
  for (const [key, value] of Object.entries(set)) {
    vars[key] = String(value);
  }

  // Atomic write (tmp + rename) — the desktop env watcher fires on rename
  // and restarts the server so the new values take effect.
  const tmp = envPath + ".tmp";
  try {
    unlinkSync(tmp); // `mode` only applies when the file is created
  } catch {
    /* no stale tmp */
  }
  writeFileSync(tmp, serializeEnv(vars), { encoding: "utf-8", mode: 0o600 });
  try {
    chmodSync(tmp, 0o600);
  } catch {
    /* best-effort on platforms without chmod */
  }
  renameSync(tmp, envPath);

  return NextResponse.json({ ok: true });
}
