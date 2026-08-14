/**
 * Flyx Desktop — Random string/password generators.
 *
 * Verbatim port of packages/cli/src/lib/random.js (which is itself a port
 * of the Flyx 2.x desktop validation module, crypto.randomBytes edition).
 */

const crypto = require("crypto");

const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
const CONSONANTS = "bcdfghjklmnpqrstvwxyz";
const VOWELS = "aeiou";
const DIGITS = "23456789"; // no 0/1 to avoid confusion

function randomString(length) {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARS[bytes[i] % CHARS.length];
  }
  return result;
}

/** Generate a pronounceable password: CVC-CVC-dd */
function randomPassword() {
  const pick = (set) => set[crypto.randomInt(set.length)];
  const part1 = pick(CONSONANTS) + pick(VOWELS) + pick(CONSONANTS);
  const part2 = pick(CONSONANTS) + pick(VOWELS) + pick(CONSONANTS);
  const part3 = pick(DIGITS) + pick(DIGITS);
  return `${part1}-${part2}-${part3}`;
}

module.exports = { randomString, randomPassword };
