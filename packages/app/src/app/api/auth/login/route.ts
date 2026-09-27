/**
 * POST /api/auth/login
 *
 * Authenticate a user with username + password.
 * Sets an httpOnly JWT cookie on success.
 *
 * Failures are deliberately indistinguishable: one message in the response
 * AND the log, and a dummy scrypt verify when the user doesn't exist, so
 * neither content nor timing reveals which usernames exist. Failed attempts
 * are rate-limited per IP and per username.
 */

import { NextRequest, NextResponse } from "next/server";
import { findAccountByUsername } from "@/lib/db";
import { dummyVerifyPassword, verifyPassword } from "@/lib/auth/password";
import { signSessionFor } from "@/lib/auth/jwt";
import { addLog } from "@/lib/log-store";
import { clearHits, clientIp, isRateLimited, recordHit } from "@/lib/auth/rate-limit";

export const runtime = "nodejs";

const INVALID = "Invalid username or password";
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_IP = 30;
const MAX_FAILS_PER_USER = 10;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body ?? {};

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    const ipKey = `login:ip:${clientIp(request)}`;
    const userKey = `login:user:${username.toLowerCase()}`;
    if (isRateLimited(ipKey, MAX_FAILS_PER_IP) || isRateLimited(userKey, MAX_FAILS_PER_USER)) {
      return NextResponse.json(
        { error: "Too many failed sign-in attempts. Try again in a few minutes." },
        { status: 429 },
      );
    }

    const account = findAccountByUsername(username);
    const valid = account
      ? await verifyPassword(password, account.passwordHash)
      : (await dummyVerifyPassword(password), false);

    if (!account || !valid) {
      recordHit(ipKey, WINDOW_MS);
      recordHit(userKey, WINDOW_MS);
      addLog({
        level: "warn",
        category: "auth",
        message: `Login failed for ${JSON.stringify(username.slice(0, 64))}: invalid username or password`,
      });
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    clearHits(userKey);
    addLog({ level: "info", category: "auth", message: `User "${account.username}" logged in` });

    const token = await signSessionFor(account);

    const response = NextResponse.json({
      user: {
        id: account.id,
        username: account.username,
        isAdmin: account.isAdmin,
      },
    });

    response.cookies.set("flyx_token", token, {
      httpOnly: true,
      // Derive from the request protocol, not NODE_ENV: the desktop server
      // runs NODE_ENV=production over plain http on the LAN, and browsers
      // reject Secure cookies over http.
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    // A manual login re-arms master auto-login (see /api/auth/logout).
    response.cookies.set("flyx_master_logout", "", {
      httpOnly: false,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
