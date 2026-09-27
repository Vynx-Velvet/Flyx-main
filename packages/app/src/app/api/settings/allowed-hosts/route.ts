/**
 * GET /api/settings/allowed-hosts — the remote access addresses (admin)
 * PUT /api/settings/allowed-hosts — replace them: { hosts: string[] } (admin)
 *
 * Backs Settings → Security → "Remote access addresses": extra Host names
 * (Tailscale, DuckDNS, a reverse-proxy domain…) the Host allowlist in
 * middleware.ts accepts on top of IPs, localhost and .local names. Stored
 * as FLYX_ALLOWED_HOSTS in $FLYX_DATA_DIR/.env and only this key — the
 * general .env editor stays master-only.
 *
 * The middleware reads the allowlist once at server start, so a change
 * applies on restart: the desktop app restarts itself when .env changes;
 * CLI and Docker hosts must be restarted by the operator.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { addLog } from "@/lib/log-store";
import { envFilePath, readEnvVar, setEnvVar } from "@/lib/env-file";
import { normalizeHostEntry } from "@/lib/request-origin";

export const runtime = "nodejs";

const KEY = "FLYX_ALLOWED_HOSTS";
const MAX_HOSTS = 20;
const MAX_HOST_LENGTH = 253; // DNS name limit

function split(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
}

async function requireAdmin() {
  const session = await getSession();
  return session?.isAdmin ? session : null;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }
  const available = envFilePath() !== null;
  return NextResponse.json({
    ok: true,
    available,
    hosts: available ? split(readEnvVar(KEY)) : [],
    // What this running server enforces (read at start).
    active: split(process.env[KEY]),
    autoRestart: process.env.FLYX_DESKTOP === "true",
  });
}

export async function PUT(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }
  if (!envFilePath()) {
    return NextResponse.json(
      { ok: false, error: "This server has no data folder to save settings in" },
      { status: 400 },
    );
  }

  let body: { hosts?: unknown };
  try {
    body = (await request.json()) ?? {};
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.hosts) || !body.hosts.every((h) => typeof h === "string")) {
    return NextResponse.json(
      { ok: false, error: "hosts must be a list of addresses" },
      { status: 400 },
    );
  }

  const hosts: string[] = [];
  for (const entry of body.hosts as string[]) {
    if (!entry.trim()) continue;
    const host = normalizeHostEntry(entry);
    // "*" turns the check off entirely — not something this form offers.
    if (
      !host ||
      host === "*" ||
      host.length > MAX_HOST_LENGTH ||
      !/^[a-z0-9.\-[\]:]+$/.test(host)
    ) {
      return NextResponse.json(
        { ok: false, error: `"${entry.trim()}" is not a valid address` },
        { status: 400 },
      );
    }
    if (!hosts.includes(host)) hosts.push(host);
  }
  if (hosts.length > MAX_HOSTS) {
    return NextResponse.json(
      { ok: false, error: `At most ${MAX_HOSTS} addresses` },
      { status: 400 },
    );
  }

  setEnvVar(KEY, hosts.length ? hosts.join(",") : null);
  addLog({
    level: "info",
    category: "system",
    message: `Remote access addresses set by "${session.username}": ${hosts.join(", ") || "(none)"}`,
  });

  return NextResponse.json({
    ok: true,
    hosts,
    autoRestart: process.env.FLYX_DESKTOP === "true",
  });
}
