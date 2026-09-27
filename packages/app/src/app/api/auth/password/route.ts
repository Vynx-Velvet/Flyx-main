/**
 * PATCH /api/auth/password — Change own password or reset another user's (admin)
 *
 * Body: { currentPassword?, newPassword, userId? }
 * - Without userId (or userId = self): changes the caller's password.
 *   Requires currentPassword — for admins too, except the desktop master
 *   window (it is the instance owner and may not know an auto-generated pw).
 * - With another user's userId (admin only): resets that user's password.
 *
 * Every change bumps the account's tokenVersion, signing out all of its
 * other sessions; a self-change re-issues the caller's own cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth/password";
import { signSessionFor } from "@/lib/auth/jwt";
import { getAccountAuth, getPasswordHash, setAccountPassword } from "@/lib/db";
import { isMasterRequest } from "@/lib/request-master";
import { addLog } from "@/lib/log-store";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword, userId } = (await request.json()) ?? {};

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 },
      );
    }

    // Resetting another user's password (by ID)
    if (userId && userId !== session.sub) {
      if (!session.isAdmin) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
      if (typeof userId !== "string" || !getAccountAuth(userId)) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      setAccountPassword(userId, await hashPassword(newPassword));
      addLog({
        level: "info",
        category: "auth",
        message: `Password reset for account ${userId} by admin "${session.username}"`,
      });
      return NextResponse.json({ ok: true });
    }

    // Changing own password
    const storedHash = getPasswordHash(session.sub);
    if (!storedHash) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (!isMasterRequest(request)) {
      if (!currentPassword || typeof currentPassword !== "string") {
        return NextResponse.json({ error: "Current password is required" }, { status: 400 });
      }
      const valid = await verifyPassword(currentPassword, storedHash);
      if (!valid) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
      }
    }

    setAccountPassword(session.sub, await hashPassword(newPassword));

    // The bump above revoked this session too — hand the caller a new one.
    const response = NextResponse.json({ ok: true });
    const account = getAccountAuth(session.sub);
    if (account) {
      response.cookies.set("flyx_token", await signSessionFor(account), {
        httpOnly: true,
        // Derive from the request protocol (see /api/auth/login for why).
        secure: request.nextUrl.protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return response;
  } catch (err) {
    console.error("[auth/password]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
