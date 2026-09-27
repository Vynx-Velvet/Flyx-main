/**
 * Server-side session extraction from request cookies.
 *
 * Use in server components and API routes to get the
 * current authenticated user.
 *
 * The JWT only proves "this was issued by us for account X at token version
 * N". Everything else comes from the account store: a deleted account or a
 * bumped tokenVersion (password change/reset) revokes the token, and
 * username/isAdmin are the STORED values — a demoted admin's old token
 * doesn't keep admin rights. Node runtime only (reads store.json); the edge
 * middleware does signature-only checks and defers to handlers.
 */

import { cookies } from "next/headers";
import { verifyJWT, type JWTPayload } from "./jwt";
import { getAccountAuth } from "@/lib/db";

const COOKIE_NAME = "flyx_token";

/** Validate a raw token against the account store. */
export async function sessionFromToken(token: string | undefined | null): Promise<JWTPayload | null> {
  if (!token) return null;
  const claims = await verifyJWT(token);
  if (!claims || typeof claims.sub !== "string") return null;

  const account = getAccountAuth(claims.sub);
  if (!account) return null;
  const tv = typeof claims.tv === "number" ? claims.tv : 0;
  if (tv !== account.tokenVersion) return null;

  return {
    sub: account.id,
    username: account.username,
    isAdmin: account.isAdmin,
    tv: account.tokenVersion,
  };
}

/**
 * Get the current session from the request cookies.
 * Returns null if no valid session exists.
 */
export async function getSession(): Promise<JWTPayload | null> {
  try {
    const cookieStore = await cookies();
    return await sessionFromToken(cookieStore.get(COOKIE_NAME)?.value);
  } catch {
    return null;
  }
}

/**
 * Set the auth cookie in the response.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

/**
 * Clear the auth cookie (logout).
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export { COOKIE_NAME };
