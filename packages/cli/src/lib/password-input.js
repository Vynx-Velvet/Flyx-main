/**
 * Flyx CLI — Where a password comes from, in order of preference:
 *
 *   1. --password <pw>  (kept for scripting compatibility, but it lands in
 *                        shell history and is visible in the process list,
 *                        so we print a warning)
 *   2. FLYX_PASSWORD    (environment variable — not in argv)
 *   3. hidden interactive prompt, when stdin is a TTY
 *
 * Returns null when none is available (non-interactive, nothing supplied).
 */

const { askPassword } = require("./prompts");

let warned = false;

function warnPasswordFlag() {
  if (warned) return;
  warned = true;
  console.error(
    "⚠️  --password exposes the password in your shell history and the process list.\n" +
      "   Prefer the FLYX_PASSWORD environment variable or the interactive prompt.",
  );
}

async function resolvePassword(options = {}, promptText = "Password (min 8 chars)", { prompt = true } = {}) {
  if (options.password) {
    warnPasswordFlag();
    return String(options.password);
  }
  if (process.env.FLYX_PASSWORD) {
    return process.env.FLYX_PASSWORD;
  }
  if (prompt && process.stdin.isTTY) {
    return askPassword(promptText);
  }
  return null;
}

module.exports = { resolvePassword, warnPasswordFlag };
