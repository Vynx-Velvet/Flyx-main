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
}

export async function signJWT(payload: JWTPayload): Promise<string> {
  const secret = getSecret();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}
