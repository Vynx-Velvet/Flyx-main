/**
 * GET /api/auth/auto-login
 *
 * Auto-creates the default account on first launch and signs the user in.
 * Only works when there are 0 accounts and default credentials are configured.
 * Redirects to "/" with the auth cookie set.
 *
 * Add ?check=1 to see diagnostic info (JSON) instead of redirecting.
 */

import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { signJWT } from "@/lib/auth/jwt";
import { createAccount, getAccountCount, listAccounts } from "@/lib/db";
import { addLog } from "@/lib/log-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const defaultUser = process.env.DEFAULT_USERNAME;
  const defaultPass = process.env.DEFAULT_PASSWORD;
  const hostKey = process.env.HOST_KEY;
  const landingEnabled = process.env.ENABLE_LANDING_PAGE;
  const accountCount = getAccountCount();

  // Diagnostic mode — return JSON so we can see what's happening
  const { searchParams } = new URL(request.url);
  if (searchParams.get("check") === "1") {
    return NextResponse.json({
      configured: !!(defaultUser && defaultPass),
      hasDefaultUser: !!defaultUser,
      hasDefaultPass: !!defaultPass,
      passLength: defaultPass ? defaultPass.length : 0,
      hasHostKey: !!hostKey,
      landingEnabled,
      accountCount,
      accounts: listAccounts().map((a) => ({ username: a.username, isAdmin: a.isAdmin, createdAt: a.createdAt })),
    });
  }

  // Only auto-create if explicitly configured and no accounts exist
  if (!defaultUser || !defaultPass || accountCount > 0) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3891}`),
    );
  }

  try {
    addLog({
      level: "info",
      category: "auth",
      message: `Auto-creating default account "${defaultUser}"`,
    });

    const passwordHash = await hashPassword(defaultPass);
    const account = createAccount(defaultUser, passwordHash, true);
    const token = await signJWT({
      sub: account.id,
      username: account.username,
      isAdmin: account.isAdmin,
    });

    addLog({
      level: "info",
      category: "auth",
      message: `Default account "${defaultUser}" created and signed in`,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3891}`;
    const response = NextResponse.redirect(new URL("/", baseUrl));
    response.cookies.set("flyx_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    addLog({
      level: "error",
      category: "auth",
      message: `Auto-account creation failed: ${message}`,
      detail: err instanceof Error ? err.stack?.slice(0, 300) : "",
    });
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3891}`),
    );
  }
}
