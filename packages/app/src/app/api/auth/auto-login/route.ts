/**
 * GET /api/auth/auto-login
 *
 * Two flows, distinguished by the master token (see request-master.ts):
 *
 * 1. Master (the desktop window): signed in without credentials as the
 *    DEFAULT_USERNAME account, or by auto-creating it when no accounts
 *    exist yet. If that account is gone (deleted, store restored from a
 *    backup…) the master is sent to /login — it is never silently signed in
 *    as some other admin.
 * 2. Everyone else: auto-creates the default account on genuine first
 *    launch only ("Just me" mode, CLI/hosted) — a store that has never held
 *    an account and wasn't rebuilt after corruption (isStorePristine). A
 *    wiped/recovered store must not hand the admin account to whoever on
 *    the LAN visits first. On desktop this is master-only.
 *
 * Redirects to "/" (or /setup) with the auth cookie set.
 * Add ?check=1 (master or admin session) to see diagnostic info (JSON).
 */

import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { signSessionFor } from "@/lib/auth/jwt";
import { getSession } from "@/lib/auth/get-session";
import {
  createAccount,
  findAccountByUsername,
  getAccountCount,
  isStorePristine,
  listAccounts,
  withAccountLock,
} from "@/lib/db";
import { addLog } from "@/lib/log-store";
import { requestOrigin } from "@/lib/request-origin";
import { isMasterRequest } from "@/lib/request-master";
import { postLoginPath } from "@/lib/auth/redirect-target";

export const runtime = "nodejs";

function withSessionCookie(
  request: NextRequest,
  response: NextResponse,
  token: string,
): NextResponse {
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

export async function GET(request: NextRequest) {
  const defaultUser = process.env.DEFAULT_USERNAME;
  const defaultPass = process.env.DEFAULT_PASSWORD;
  const master = isMasterRequest(request);
  const isDesktop = process.env.FLYX_DESKTOP === "true";
  const setupComplete = process.env.SETUP_COMPLETE === "true";

  // Redirect target: the origin the client actually used (see request-origin.ts —
  // Next standalone builds request.url from HOSTNAME, not the Host header).
  const baseUrl = requestOrigin(request);

  const { searchParams } = new URL(request.url);
  // Page the middleware sent us back to (master re-auth mid-session).
  const backTo = postLoginPath(searchParams.get("redirect"));

  let accountCount: number;
  try {
    accountCount = getAccountCount();
  } catch (err) {
    addLog({
      level: "error",
      category: "auth",
      message: `Auto-login: account store unreadable: ${err instanceof Error ? err.message : String(err)}`,
    });
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  // Diagnostic mode — account info is sensitive: master or admin only.
  if (searchParams.get("check") === "1") {
    if (!master && !(await getSession())?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({
      configured: !!(defaultUser && defaultPass),
      hasDefaultUser: !!defaultUser,
      hasDefaultPass: !!defaultPass,
      hasHostKey: !!process.env.HOST_KEY,
      hasTmdbKey: !!(process.env.TMDB_API_KEY && process.env.TMDB_API_KEY.trim()),
      setupComplete,
      accountCount,
      storePristine: isStorePristine(),
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
    const account = defaultUser ? findAccountByUsername(defaultUser) : null;
    if (!account) {
      addLog({
        level: "warn",
        category: "auth",
        message: `Master auto-login: default account ${JSON.stringify(defaultUser ?? "")} not found — sign in manually`,
      });
      return NextResponse.redirect(new URL("/login", baseUrl));
    }

    const token = await signSessionFor(account);
    addLog({
      level: "info",
      category: "auth",
      message: `Master auto-login as "${account.username}" (desktop window)`,
    });
    return withSessionCookie(
      request,
      NextResponse.redirect(new URL(backTo ?? "/", baseUrl)),
      token,
    );
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
  // keeps the "first visitor claims it" first-boot behavior — but only on a
  // pristine store, see the header comment.)
  if (!master && (isDesktop || !isStorePristine())) {
    if (!isDesktop) {
      addLog({
        level: "warn",
        category: "auth",
        message:
          "Auto-login: the account store is empty but not fresh (accounts were removed or " +
          "store.json was recovered from corruption) — not auto-creating the default admin. " +
          "Restore store.json, or remove SETUP_COMPLETE from .env and re-run /setup.",
      });
    }
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  try {
    const account = await withAccountLock(async () => {
      addLog({
        level: "info",
        category: "auth",
        message: `Auto-creating default account "${defaultUser}"`,
      });
      const passwordHash = await hashPassword(defaultPass);
      // onlyIfEmpty: a concurrent first-boot request may have won the race.
      return createAccount(defaultUser, passwordHash, true, { onlyIfEmpty: true });
    });
    const token = await signSessionFor(account);

    addLog({
      level: "info",
      category: "auth",
      message: `Default account "${defaultUser}" created and signed in`,
    });

    return withSessionCookie(
      request,
      NextResponse.redirect(new URL(backTo ?? "/", baseUrl)),
      token,
    );
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
