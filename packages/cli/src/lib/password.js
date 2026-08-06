/**
 * Flyx CLI — Password hashing.
 *
 * Port of packages/app/src/lib/auth/password.ts
 * Uses the EXACT same scrypt parameters so hashes are interoperable:
 *   - 16-byte random salt (hex)
 *   - 64-byte key (512-bit)
 *   - N=16384, r=8, p=1
 *   - Format: salt:hash (both hex)
 */

const { randomBytes, scrypt, timingSafeEqual } = require("node:crypto");

const KEYLEN = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, SCRYPT_OPTIONS, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const hash = Buffer.from(hashHex, "hex");
  const derived = await new Promise((resolve, reject) => {
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

module.exports = { hashPassword, verifyPassword };
