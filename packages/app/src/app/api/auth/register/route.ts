/**
 * POST /api/auth/register
 *
 * Create a new account. Protected by HOST_KEY — only the
 * person running the instance can generate accounts.
 *
 * Request headers:
 *   x-host-key: <HOST_KEY from .env>   (not needed with an admin session)
 *
 * Request body:
 *   { username: string, password: string, isAdmin?: boolean }
 *
 * The host key is shared with guests so they can make their own accounts,
 * so it only ever creates ordinary accounts: `isAdmin` is honored solely
 * when the caller already has an admin session. The very first account is
 * never created here — that is the setup wizard's / default account's job
 * (otherwise anyone holding the key could claim admin on an empty store).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAccount, getAccountCount } from "@/lib/db";
import { hashPassword, MIN_PASSWORD_LENGTH, safeEqualStrings } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/get-session";
import { clientIp, isRateLimited, recordHit } from "@/lib/auth/rate-limit";
import { addLog } from "@/lib/log-store";

export const runtime = "nodejs";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 20;
const MAX_PER_USER = 10;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

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

    const ipKey = `register:ip:${clientIp(request)}`;
    if (isRateLimited(ipKey, MAX_PER_IP)) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in a few minutes." },
        { status: 429 },
      );
    }
    recordHit(ipKey, WINDOW_MS);

    const session = await getSession();
    const adminSession = session?.isAdmin === true;

    if (!adminSession) {
      const providedKey = request.headers.get("x-host-key");
      if (!providedKey || !safeEqualStrings(providedKey, configuredHostKey)) {
        return NextResponse.json({ error: "Invalid host key" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { username, password, isAdmin } = body ?? {};

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    if (typeof username !== "string" || username.length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters" },
        { status: 400 },
      );
    }
    if (username.length > 64 || CONTROL_RE.test(username)) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }

    const userKey = `register:user:${username.toLowerCase()}`;
    if (isRateLimited(userKey, MAX_PER_USER)) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in a few minutes." },
        { status: 429 },
      );
    }
    recordHit(userKey, WINDOW_MS);

    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 },
      );
    }

    if (getAccountCount() === 0) {
      return NextResponse.json(
        { error: "No accounts exist yet. Finish setup first (open /setup on the host)." },
        { status: 409 },
      );
    }

    const admin = adminSession && isAdmin === true;

    const passwordHash = await hashPassword(password);
    const account = createAccount(username, passwordHash, admin);

    addLog({
      level: "info",
      category: "auth",
      message: `Account "${account.username}" created${admin ? " (admin)" : ""} by ${
        adminSession ? `admin "${session!.username}"` : "host key"
      }`,
    });

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
