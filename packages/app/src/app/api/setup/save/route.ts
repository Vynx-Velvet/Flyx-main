import { NextRequest, NextResponse } from "next/server";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tmdbKey, username, password, displayName, networkMode } = body;

    // Validate required fields
    if (!tmdbKey || typeof tmdbKey !== "string" || !tmdbKey.trim()) {
      return NextResponse.json({ ok: false, error: "TMDB API key is required" }, { status: 400 });
    }

    // Determine data directory
    const dataDir = process.env.FLYX_DATA_DIR
      || join(
          process.env.LOCALAPPDATA || join(process.env.HOME || "", ".local", "share"),
          "flyx"
        );

    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    // Build .env content
    const lines: string[] = [];
    lines.push(`TMDB_API_KEY=${tmdbKey.trim()}`);
    lines.push("FLYX_DESKTOP=true");

    if (username?.trim()) {
      lines.push(`DEFAULT_USERNAME=${username.trim()}`);
    }
    if (password?.trim()) {
      lines.push(`DEFAULT_PASSWORD=${password.trim()}`);
    }
    if (displayName?.trim()) {
      lines.push(`DEFAULT_DISPLAY_NAME=${displayName.trim()}`);
    }
    if (networkMode === "network") {
      lines.push("HOSTNAME=0.0.0.0");
    } else {
      lines.push("HOSTNAME=127.0.0.1");
    }

    const envPath = join(dataDir, ".env");
    writeFileSync(envPath, lines.join("\n") + "\n", "utf-8");

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
