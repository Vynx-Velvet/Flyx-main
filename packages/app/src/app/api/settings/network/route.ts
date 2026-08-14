import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, writeFileSync, renameSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";

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

    // Atomic write (tmp + rename) — the desktop env watcher fires on rename
    const tmpPath = envPath + ".tmp";
    writeFileSync(tmpPath, lines.join("\n").trimEnd() + "\n", "utf-8");
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
