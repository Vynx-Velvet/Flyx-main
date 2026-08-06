/**
 * GET  /api/logs        — view recent logs
 * DELETE /api/logs      — clear all logs
 */

import { NextRequest, NextResponse } from "next/server";
import { getLogs, clearLogs, getErrorSummary, type LogEntry } from "@/lib/log-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level") as LogEntry["level"] | null;
  const category = searchParams.get("category") as LogEntry["category"] | null;
  const limit = parseInt(searchParams.get("limit") || "100");

  const logs = getLogs({ level: level || undefined, category: category || undefined, limit });
  return NextResponse.json({ logs, summary: getErrorSummary() });
}

export async function DELETE() {
  clearLogs();
  return NextResponse.json({ ok: true });
}
