/**
 * Flyx 3.0 — Auth Middleware
 *
 * Protects all content routes from unauthenticated access.
 * Auto-creates the default account on first launch ("Just me" mode).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

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

  const landingEnabled = process.env.ENABLE_LANDING_PAGE !== "false";
  const defaultUser = process.env.DEFAULT_USERNAME;

  // Auto-login: if default credentials exist, redirect to auto-setup endpoint.
  // The endpoint checks if accounts exist — if 0 accounts, it creates one and
  // signs in. If accounts already exist, it redirects to /login.
  if (defaultUser) {
    return NextResponse.redirect(new URL("/api/auth/auto-login", request.url));
  }

  // No default credentials configured
  // Landing page enabled — show it to unauthenticated visitors
  if (landingEnabled) {
    if (pathname === "/") {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Landing page disabled — redirect to login
  if (pathname !== "/") {
    return NextResponse.redirect(
      new URL(`/login?redirect=${encodeURIComponent(pathname)}`, request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.svg$|.*\\.png$|.*\\.ico$).*)",
  ],
};
