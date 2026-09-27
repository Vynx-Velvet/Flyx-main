/**
 * GET  /api/logs        — view recent logs (admin only)
 * DELETE /api/logs      — clear all logs (admin only)
 *
 * Logs carry usernames, provider URLs and error details — never public.
 */

import { NextRequest, NextResponse } from "next/server";
import { getLogs, clearLogs, getErrorSummary, type LogEntry } from "@/lib/log-store";
import { getSession } from "@/lib/auth/get-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAdmin(): Promise<boolean> {
  return (await getSession())?.isAdmin === true;
}

export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level") as LogEntry["level"] | null;
  const category = searchParams.get("category") as LogEntry["category"] | null;
  const limit = parseInt(searchParams.get("limit") || "100");

  const logs = getLogs({ level: level || undefined, category: category || undefined, limit });
  return NextResponse.json({ logs, summary: getErrorSummary() });
}

export async function DELETE() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  clearLogs();
  return NextResponse.json({ ok: true });
}
