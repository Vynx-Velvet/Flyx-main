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
 *
 * Before any of that, every request is checked against a Host allowlist
 * (DNS rebinding) and state-changing /api requests must be same-origin JSON
 * (CSRF) — see lib/request-origin.ts.
 *
 * This runs in the edge runtime and only verifies the JWT signature; route
 * handlers call getSession(), which re-checks the account store and is the
 * authority for who the user is and whether they're an admin.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import {
  hasNonJsonBody,
  isAllowedHost,
  isCrossSiteMutation,
  requestOrigin,
} from "@/lib/request-origin";
import { isMasterRequest } from "@/lib/request-master";

// Matched per path segment ("/setup" covers "/setup/x", not "/setupx").
// Several API prefixes here (stream, livetv, subtitles, tmdb, manga image…)
// do their own session-or-signature checks inside the handler.
const PUBLIC_PREFIXES = [
  "/setup",
  "/api/setup",
  "/login",
  "/_next",
  "/api/auth",
  "/api/health",
  "/api/anime",
  "/api/manga",
  "/api/stream",
  "/api/content",
  "/api/livetv",
  "/api/tmdb",
  "/api/providers",
  "/api/subtitles",
];

// Real top-level files from /public (favicon.svg, robots.txt…). Only the top
// level — "/details/1.png" is a page route, not an asset.
const PUBLIC_ASSET_RE = /^\/[^/]+\.(png|svg|ico|webp|jpg|jpeg|gif|txt|webmanifest|json)$/i;

function isPublic(pathname: string): boolean {
  if (PUBLIC_ASSET_RE.test(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

async function getTokenPayload(request: NextRequest) {
  const token = request.cookies.get("flyx_token")?.value;
  if (!token) return null;

  // No secret configured → no token can be valid (never fall back to a
  // hard-coded key anyone could sign with).
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return null;

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}

function forbiddenResponse(pathname: string, message: string): NextResponse {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  return new NextResponse(message, {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // DNS rebinding: refuse Host names this server isn't known by.
  if (!isAllowedHost(request.headers.get("host"))) {
    return forbiddenResponse(
      pathname,
      "Flyx doesn't recognize this address. A Flyx admin can allow it under " +
        "Settings → Security → Remote access addresses.",
    );
  }

  // CSRF: state-changing API calls must come from this origin, as JSON.
  if (pathname.startsWith("/api/")) {
    if (isCrossSiteMutation(request)) {
      return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
    }
    if (hasNonJsonBody(request)) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 415 },
      );
    }
  }

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
  // oldest admin) — no login screen unless no admin exists. A short-lived logout marker lets
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
  // Only build output and the favicon skip the middleware entirely; every
  // other path (including "*.png" page URLs) gets the auth check, with real
  // /public files let through by PUBLIC_ASSET_RE above.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
