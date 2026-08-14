/**
 * Master-request detection for the desktop app.
 *
 * The Electron main process generates a random FLYX_MASTER_TOKEN on first
 * boot (stored in $DATA_DIR/.env, next to JWT_SECRET) and injects it into
 * the Electron window's cookie jar as `flyx_master_token` before the window
 * loads. Only the instance master's window carries this cookie — LAN
 * browsers never do.
 *
 * Identifying the master by cookie possession (a secret shared only between
 * the main process and the server) rather than by IP/Host is deliberate:
 * request headers like Host and x-forwarded-for are client-controlled, and
 * on a self-hosted Next.js server there is no reverse proxy to sanitize
 * them — a LAN client could trivially spoof "127.0.0.1" and bypass a
 * header-based loopback check.
 *
 * NOTE: this module is bundled into BOTH the edge middleware and the Node
 * route handlers. The edge runtime stubs node:crypto (importing
 * createHash/timingSafeEqual here would 500 every master request), so the
 * comparison is a plain constant-time XOR fold — no crypto imports.
 */

import type { NextRequest } from "next/server";

const MIN_TOKEN_LENGTH = 32;

/** Constant-time string comparison (XOR fold) — edge-safe. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function isMasterRequest(request: NextRequest): boolean {
  const expected = process.env.FLYX_MASTER_TOKEN;
  if (!expected || expected.length < MIN_TOKEN_LENGTH) return false;

  const cookie = request.cookies.get("flyx_master_token")?.value;
  if (!cookie) return false;

  return safeEqual(expected, cookie);
}
