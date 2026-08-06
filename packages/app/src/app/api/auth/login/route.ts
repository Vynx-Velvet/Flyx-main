/**
 * POST /api/auth/login
 *
 * Authenticate a user with username + password.
 * Sets an httpOnly JWT cookie on success.
 */

import { NextRequest, NextResponse } from "next/server";
import { findAccountByUsername } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { signJWT } from "@/lib/auth/jwt";
import { addLog } from "@/lib/log-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    const account = findAccountByUsername(username);
    if (!account) {
      addLog({ level: "warn", category: "auth", message: `Login failed: user "${username}" not found` });
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const valid = await verifyPassword(password, account.passwordHash);
    if (!valid) {
      addLog({ level: "warn", category: "auth", message: `Login failed: wrong password for "${username}"` });
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    addLog({ level: "info", category: "auth", message: `User "${username}" logged in` });

    const token = await signJWT({
      sub: account.id,
      username: account.username,
      isAdmin: account.isAdmin,
    });

    const response = NextResponse.json({
      user: {
        id: account.id,
        username: account.username,
        isAdmin: account.isAdmin,
      },
    });

    response.cookies.set("flyx_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
