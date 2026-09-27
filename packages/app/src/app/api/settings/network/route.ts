import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from "fs";
import { join } from "path";
import { getSession } from "@/lib/auth/get-session";
import { isMasterRequest } from "@/lib/request-master";

export const runtime = "nodejs";

/**
 * Reject callers that may not re-bind the server (403): an admin session is
 * required, and on desktop also the master window (same rule as
 * settings/env — a LAN admin must not flip the host's network exposure).
 */
async function forbidden(request: NextRequest): Promise<boolean> {
  if (process.env.FLYX_DESKTOP === "true" && !isMasterRequest(request)) return true;
  const session = await getSession();
  return !session?.isAdmin;
}

/**
 * POST /api/settings/network
 *
 * Switch between LAN sharing (HOSTNAME=0.0.0.0) and localhost-only
 * (HOSTNAME=127.0.0.1). Updates the HOSTNAME line in $DATA_DIR/.env.
 *
 * Re-binding the address requires a server restart — in desktop mode the
 * Electron main process watches the .env file and restarts automatically;
 * other hosts must restart manually.
 */
export async function POST(request: NextRequest) {
  if (await forbidden(request)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { mode } = body;

    if (mode !== "localhost" && mode !== "network") {
      return NextResponse.json(
        { ok: false, error: "mode must be 'localhost' or 'network'" },
        { status: 400 },
      );
    }

    const dataDir = process.env.FLYX_DATA_DIR;
    if (!dataDir) {
      return NextResponse.json(
        { ok: false, error: "Network mode changes are only available in desktop mode" },
        { status: 400 },
      );
    }

    const hostname = mode === "network" ? "0.0.0.0" : "127.0.0.1";
    const envPath = join(dataDir, ".env");

    // Rewrite the HOSTNAME line, preserving everything else
    let lines: string[] = [];
    if (existsSync(envPath)) {
      lines = readFileSync(envPath, "utf-8").split("\n");
    }

    let found = false;
    lines = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      const eq = trimmed.indexOf("=");
      if (eq === -1) return line;
      if (trimmed.slice(0, eq) === "HOSTNAME") {
        found = true;
        return `HOSTNAME=${hostname}`;
      }
      return line;
    });
    if (!found) lines.push(`HOSTNAME=${hostname}`);

    // Atomic write (tmp + rename) — the desktop env watcher fires on rename.
    // Owner-only: .env holds JWT_SECRET and the default password.
    const tmpPath = envPath + ".tmp";
    try {
      unlinkSync(tmpPath); // `mode` only applies when the file is created
    } catch {
      /* no stale tmp */
    }
    writeFileSync(tmpPath, lines.join("\n").trimEnd() + "\n", { encoding: "utf-8", mode: 0o600 });
    renameSync(tmpPath, envPath);

    // Keep the running process's view consistent (informational only;
    // the actual re-bind happens on server restart).
    process.env.HOSTNAME = hostname;

    return NextResponse.json({ ok: true, hostname });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
