/**
 * GET /api/auth/accounts — List all accounts (admin only)
 * DELETE /api/auth/accounts — Delete an account (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { listAccounts, deleteAccount } from "@/lib/db";

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

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Account ID is required" }, { status: 400 });
  }

  // Don't allow deleting your own account
  if (id === session.sub) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const deleted = deleteAccount(id);
  if (!deleted) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
