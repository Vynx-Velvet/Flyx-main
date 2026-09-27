/**
 * GET /api/auth/accounts — List all accounts (admin only)
 * DELETE /api/auth/accounts — Delete an account (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { listAccounts, deleteAccount } from "@/lib/db";
import { addLog } from "@/lib/log-store";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const accounts = listAccounts();
  return NextResponse.json({ accounts });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let id: unknown;
  try {
    ({ id } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Account ID is required" }, { status: 400 });
  }

  // Don't allow deleting your own account
  if (id === session.sub) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const accounts = listAccounts();
  const target = accounts.find((a) => a.id === id);
  if (!target) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // The default account is the one the desktop master (and CLI first-boot
  // auto-login) signs in as — deleting it would strand the instance owner.
  const defaultUser = process.env.DEFAULT_USERNAME;
  if (defaultUser && target.username === defaultUser) {
    return NextResponse.json(
      { error: "The default (host) account cannot be deleted" },
      { status: 400 },
    );
  }

  if (target.isAdmin && accounts.filter((a) => a.isAdmin).length <= 1) {
    return NextResponse.json(
      { error: "Cannot delete the last admin account" },
      { status: 400 },
    );
  }

  const deleted = deleteAccount(id);
  if (!deleted) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  addLog({
    level: "info",
    category: "auth",
    message: `Account "${target.username}" deleted by admin "${session.username}"`,
  });

  return NextResponse.json({ ok: true });
}
