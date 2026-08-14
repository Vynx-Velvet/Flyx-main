/**
 * GET /api/auth/auto-login
 *
 * Two flows, distinguished by the master token (see request-master.ts):
 *
 * 1. Master (the desktop window): signed in without credentials — as the
 *    default account, or the first admin, or by auto-creating the default
 *    account when none exist yet. The instance master never sees /login.
 * 2. Everyone else: auto-creates the default account on first launch only
 *    ("Just me" mode, CLI/hosted). On desktop this is master-only — a LAN
 *    visitor at 0 accounts is sent to /login instead of claiming the admin
 *    account.
 *
 * Redirects to "/" (or /setup) with the auth cookie set.
 * Add ?check=1 to see diagnostic info (JSON) instead of redirecting.
 */

import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { signJWT } from "@/lib/auth/jwt";
import { createAccount, findAccountByUsername, getAccountCount, listAccounts } from "@/lib/db";
import { addLog } from "@/lib/log-store";
import { requestOrigin } from "@/lib/request-origin";
import { isMasterRequest } from "@/lib/request-master";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const defaultUser = process.env.DEFAULT_USERNAME;
  const defaultPass = process.env.DEFAULT_PASSWORD;
  const hostKey = process.env.HOST_KEY;
  const accountCount = getAccountCount();
  const master = isMasterRequest(request);
  const isDesktop = process.env.FLYX_DESKTOP === "true";
  const setupComplete = process.env.SETUP_COMPLETE === "true";

  // Redirect target: the origin the client actually used (see request-origin.ts —
  // Next standalone builds request.url from HOSTNAME, not the Host header).
  const baseUrl = requestOrigin(request);

  // Page the middleware sent us back to (master re-auth mid-session).
  // Only same-origin page paths; never API/setup/login targets.
  const redirectParam = new URL(request.url).searchParams.get("redirect");
  const backTo =
    redirectParam &&
    redirectParam.startsWith("/") &&
    !redirectParam.startsWith("//") &&
    !redirectParam.startsWith("/api") &&
    !redirectParam.startsWith("/setup") &&
    !redirectParam.startsWith("/login")
      ? redirectParam
      : null;

  // Diagnostic mode — account info is sensitive; master-only on desktop.
  const { searchParams } = new URL(request.url);
  if (searchParams.get("check") === "1") {
    if (isDesktop && !master) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({
      configured: !!(defaultUser && defaultPass),
      hasDefaultUser: !!defaultUser,
      hasDefaultPass: !!defaultPass,
      passLength: defaultPass ? defaultPass.length : 0,
      hasHostKey: !!hostKey,
      hasTmdbKey: !!(process.env.TMDB_API_KEY && process.env.TMDB_API_KEY.trim()),
      setupComplete,
      accountCount,
      isMaster: master,
      accounts: listAccounts().map((a) => ({ username: a.username, isAdmin: a.isAdmin, createdAt: a.createdAt })),
    });
  }

  // ── Master sign-in (no credentials needed) ─────────────────
  // Until setup completes, the master must finish the wizard (TMDB key,
  // network mode, account) — even if an account already exists.
  if (master && !setupComplete) {
    return NextResponse.redirect(new URL("/setup", baseUrl));
  }

  if (master && accountCount > 0) {
    // Default account first, else the oldest admin account.
    const accounts = listAccounts();
    const account =
      (defaultUser ? findAccountByUsername(defaultUser) : null) ??
      [...accounts].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).find((a) => a.isAdmin) ??
      null;

    if (account) {
      const token = await signJWT({
        sub: account.id,
        username: account.username,
        isAdmin: account.isAdmin,
      });

      addLog({
        level: "info",
        category: "auth",
        message: `Master auto-login as "${account.username}" (desktop window)`,
      });

      const response = NextResponse.redirect(new URL(backTo ?? "/", baseUrl));
      response.cookies.set("flyx_token", token, {
        httpOnly: true,
        // Derive from the request protocol (see /api/auth/login for why).
        secure: request.nextUrl.protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return response;
    }
    // No usable account — fall through; the master ends up at /setup or
    // /login below.
  }

  // Only auto-create if explicitly configured and no accounts exist
  if (!defaultUser || !defaultPass || accountCount > 0) {
    // Desktop first run without an account yet: send the master to the
    // setup wizard instead of a dead-end /login (LAN visitors can't get
    // past /login until the master creates an account — by design).
    if (master && accountCount === 0) {
      return NextResponse.redirect(new URL("/setup", baseUrl));
    }
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  // Desktop: creating the default admin account is master-only. (CLI/hosted
  // keeps the "first visitor claims it" first-boot behavior.)
  if (isDesktop && !master) {
    return NextResponse.redirect(new URL("/login", baseUrl));
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

    const response = NextResponse.redirect(new URL(backTo ?? "/", baseUrl));
    response.cookies.set("flyx_token", token, {
      httpOnly: true,
      // Derive from the request protocol (see /api/auth/login for why).
      secure: request.nextUrl.protocol === "https:",
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
    return NextResponse.redirect(new URL("/login", baseUrl));
  }
}
