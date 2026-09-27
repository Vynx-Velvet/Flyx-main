/**
 * JWT utilities for Flyx 3.0 auth.
 *
 * Uses `jose` (Edge-compatible, no native deps) to sign and verify
 * JWTs. Tokens are stored as httpOnly cookies.
 */

import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set. Add it to your .env file (min 32 chars).");
  }
  return new TextEncoder().encode(secret);
}

export interface JWTPayload {
  sub: string; // account id
  username: string;
  isAdmin: boolean;
  /** Account token version at issue time (see lib/db tokenVersion). */
  tv?: number;
}

export async function signJWT(payload: JWTPayload): Promise<string> {
  const secret = getSecret();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

/** Sign a session token for a stored account (carries its token version). */
export function signSessionFor(account: {
  id: string;
  username: string;
  isAdmin: boolean;
  tokenVersion?: number;
}): Promise<string> {
  return signJWT({
    sub: account.id,
    username: account.username,
    isAdmin: account.isAdmin,
    tv: account.tokenVersion ?? 0,
  });
}

/**
 * Signature/expiry check only. The claims are NOT authoritative — use
 * getSession() (which re-checks the account store) for authorization.
 */
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}
