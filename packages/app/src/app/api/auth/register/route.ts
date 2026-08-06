/**
 * POST /api/auth/register
 *
 * Create a new account. Protected by HOST_KEY — only the
 * person running the instance can generate accounts.
 *
 * Request headers:
 *   x-host-key: <HOST_KEY from .env>
 *
 * Request body:
 *   { username: string, password: string, isAdmin?: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAccount, getAccountCount } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

export async function POST(request: NextRequest) {
  try {
    // Only allow if HOST_KEY is configured
    const configuredHostKey = process.env.HOST_KEY;
    if (!configuredHostKey) {
      return NextResponse.json(
        { error: "Account registration is not enabled. Set HOST_KEY in .env to enable." },
        { status: 403 },
      );
    }

    const providedKey = request.headers.get("x-host-key");
    if (!providedKey || providedKey !== configuredHostKey) {
      return NextResponse.json({ error: "Invalid host key" }, { status: 403 });
    }

    const body = await request.json();
    const { username, password, isAdmin } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    if (typeof username !== "string" || username.length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters" },
        { status: 400 },
      );
    }

    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    // First account is always admin
    const existingCount = getAccountCount();
    const isFirstAccount = existingCount === 0;
    const admin = isFirstAccount ? true : Boolean(isAdmin);

    const passwordHash = await hashPassword(password);
    const account = createAccount(username, passwordHash, admin);

    return NextResponse.json(
      {
        account: {
          id: account.id,
          username: account.username,
          isAdmin: account.isAdmin,
          createdAt: account.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";

    if (message.includes("already exists")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    console.error("[auth/register]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
