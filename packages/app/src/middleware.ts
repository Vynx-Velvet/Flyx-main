/**
 * Flyx 3.0 — Auth Middleware
 *
 * Protects all content routes from unauthenticated access.
 * Auto-creates the default account on first launch ("Just me" mode).
 *
 * Desktop mode (FLYX_DESKTOP=true) never shows the instance master a login
 * screen: the Electron window carries the master token cookie (see
 * request-master.ts) and is auto-signed-in. LAN visitors are ordinary
 * clients — they always go through /login, and the setup wizard is
 * master-only.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { requestOrigin } from "@/lib/request-origin";
import { isMasterRequest } from "@/lib/request-master";

const PUBLIC_PREFIXES = [
  "/setup",
  "/api/setup",
  "/login",
  "/debug",
  "/_next",
  "/favicon",
  "/api/auth",
  "/api/health",
  "/api/logs",
  "/api/anime",
  "/api/manga",
  "/api/stream",
  "/api/content",
  "/api/livetv",
  "/api/tmdb",
  "/api/providers",
  "/api/subtitles",
  "/api/network",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

async function getTokenPayload(request: NextRequest) {
  const token = request.cookies.get("flyx_token")?.value;
  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? "fallback-dev-secret-not-for-production",
    );
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const master = isMasterRequest(request);
  const isDesktop = process.env.FLYX_DESKTOP === "true";

  // The setup wizard is master-only on desktop: it writes the master's TMDB
  // key and credentials to .env, so a LAN visitor must never reach it.
  if (
    isDesktop &&
    !master &&
    (pathname === "/setup" || pathname.startsWith("/setup/") || pathname.startsWith("/api/setup"))
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/login", requestOrigin(request)));
  }

  // NOTE: the unconfigured-master pin to /setup lives in
  // api/auth/auto-login (Node runtime — sees setup/save's in-memory env
  // mutations) and in the client-side SetupGate (catches an already-authed
  // master with a stale session). It must NOT live here: this middleware
  // runs in the edge runtime, which never sees process.env mutations from
  // Node route handlers — a pin here would keep redirecting to /setup even
  // after the wizard saved SETUP_COMPLETE=true.

  // Allow public paths
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const user = await getTokenPayload(request);

  // Authenticated — allow through
  if (user) {
    return NextResponse.next();
  }

  // ── Not authenticated ──────────────────────────────────────

  const defaultUser = process.env.DEFAULT_USERNAME;

  // Desktop master: auto-login signs them in as the default account (or the
  // first admin) — no login screen, ever. A short-lived logout marker lets
  // them deliberately sign out to switch accounts (cleared on manual login).
  if (master && !request.cookies.get("flyx_master_logout")) {
    // Carry the requested page so auto-login can land back on it — without
    // this, an expired session mid-browse silently dumps the master on "/".
    const login = new URL("/api/auth/auto-login", requestOrigin(request));
    if (pathname !== "/") login.searchParams.set("redirect", pathname);
    return NextResponse.redirect(login);
  }

  // CLI/hosted first boot ("Just me"): if default credentials exist, the
  // auto-login endpoint creates the default account and signs in. Desktop
  // LAN visitors skip this — they get /login and can't get in until the
  // master creates an account.
  if (defaultUser && !isDesktop) {
    return NextResponse.redirect(new URL("/api/auth/auto-login", requestOrigin(request)));
  }

  // Redirect unauthenticated visitors to the sign-in page
  if (pathname !== "/login") {
    return NextResponse.redirect(
      new URL(`/login?redirect=${encodeURIComponent(pathname)}`, requestOrigin(request)),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.svg$|.*\\.png$|.*\\.ico$).*)",
  ],
};
