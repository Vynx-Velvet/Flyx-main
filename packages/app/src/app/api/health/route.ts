/**
 * GET /api/health
 *
 * Health check endpoint for monitoring and load balancers.
 *
 * Desktop boot check: the Electron shell spawns this server with a random
 * per-launch FLYX_BOOT_NONCE and polls this route with the header
 * `x-flyx-boot-check: <nonce>`. Only when the header matches do we answer
 * `bootOk: true` — proving to the shell that the process on the port is the
 * server it just spawned (not another local process squatting on it) before
 * it hands the window the master cookie. The nonce itself is never echoed.
 */

import { NextResponse, type NextRequest } from "next/server";
import { APP_VERSION } from "@/lib/version";
import { providerRegistry } from "@flyx/providers";
import "@flyx/providers/providers";

/** Constant-time compare for equal-length strings (no Node imports). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bootCheckPassed(request: NextRequest): boolean {
  const expected = process.env.FLYX_BOOT_NONCE;
  if (!expected) return false;
  const provided = request.headers.get("x-flyx-boot-check");
  return typeof provided === "string" && safeEqual(provided, expected);
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      status: "ok",
      version: APP_VERSION,
      timestamp: Date.now(),
      providers: providerRegistry.size,
      uptime: process.uptime(),
      ...(bootCheckPassed(request) ? { bootOk: true } : {}),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
