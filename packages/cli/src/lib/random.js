/**
 * Flyx CLI — Random string/password generators.
 *
 * Port of packages/desktop/setup/scripts/validation.js random methods,
 * but using crypto.randomBytes instead of Math.random.
 */

const crypto = require("crypto");

const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
// Unambiguous alphanumerics for human-typed passwords (no 0/O/o, 1/l/I).
const PASSWORD_CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Random string over a 64-char alphabet (256 % 64 === 0, so unbiased). */
function randomString(length) {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARS[bytes[i] % CHARS.length];
  }
  return result;
}

/**
 * Generate a typeable admin password: 4 groups of 5 characters from a
 * 56-symbol unambiguous alphabet, e.g. "k7Qm2-xPw9d-..." — 20 random chars,
 * log2(56^20) ≈ 116 bits. crypto.randomInt is rejection-sampled (unbiased).
 */
function randomPassword() {
  const groups = [];
  for (let g = 0; g < 4; g++) {
    let part = "";
    for (let i = 0; i < 5; i++) {
      part += PASSWORD_CHARS[crypto.randomInt(PASSWORD_CHARS.length)];
    }
    groups.push(part);
  }
  return groups.join("-");
}

module.exports = { randomString, randomPassword };
