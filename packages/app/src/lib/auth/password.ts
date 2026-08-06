/**
 * Password hashing using Node.js built-in scrypt.
 *
 * No external dependencies — scrypt is built into Node 18+.
 * Each hash includes a random 16-byte salt, stored as
 * `salt:hash` (both hex-encoded).
 */

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEYLEN = 64; // 512-bit hash
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 } as const;

/**
 * Hash a password with a random salt.
 * Returns `salt:hash` (hex-encoded).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEYLEN, SCRYPT_OPTIONS, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
  return `${salt}:${hash.toString("hex")}`;
}

/**
 * Verify a password against a stored hash.
 *
 * @param password - Plain text password to check
 * @param stored - The stored `salt:hash` string from hashPassword()
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;

  const hash = Buffer.from(hashHex, "hex");

  const derived = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEYLEN, SCRYPT_OPTIONS, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });

  try {
    return timingSafeEqual(hash, derived);
  } catch {
    return false;
  }
}
