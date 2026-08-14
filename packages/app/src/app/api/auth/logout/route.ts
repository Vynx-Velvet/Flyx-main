/**
 * POST /api/auth/logout
 *
 * Clear the auth cookie.
 *
 * Also sets a short-lived `flyx_master_logout` marker: without it, the
 * desktop master's next request would be auto-signed-in again and the
 * logout button would appear broken. The marker suppresses master
 * auto-login for an hour so they can deliberately switch accounts;
 * a successful manual login clears it.
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("flyx_token", "", {
    httpOnly: true,
    // Derive from the request protocol (see /api/auth/login for why).
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set("flyx_master_logout", "1", {
    httpOnly: false,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
  return response;
}
