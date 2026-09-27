/**
 * Tiny in-memory fixed-window rate limiter for the auth endpoints.
 *
 * Per-process and reset on restart — enough to make online password
 * guessing against a self-hosted instance impractical. Keyed by caller IP
 * AND by username: x-forwarded-for is client-controlled on a bare Next
 * server, so the IP key alone is bypassable; the username key isn't.
 */

import type { NextRequest } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function prune(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
  // Still full (a flood of distinct keys): drop the oldest entries.
  if (buckets.size >= MAX_BUCKETS) {
    const excess = buckets.size - MAX_BUCKETS / 2;
    let i = 0;
    for (const key of buckets.keys()) {
      if (i++ >= excess) break;
      buckets.delete(key);
    }
  }
}

/** True if `key` has already used up `limit` hits in the current window. */
export function isRateLimited(key: string, limit: number): boolean {
  const b = buckets.get(key);
  if (!b) return false;
  if (b.resetAt <= Date.now()) {
    buckets.delete(key);
    return false;
  }
  return b.count >= limit;
}

/** Count one hit against `key`. */
export function recordHit(key: string, windowMs: number): void {
  const now = Date.now();
  prune(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    b.count++;
  }
}

export function clearHits(key: string): void {
  buckets.delete(key);
}

/** Test hook. */
export function _resetRateLimits(): void {
  buckets.clear();
}

/** Best-effort caller IP (first x-forwarded-for hop, else x-real-ip). */
export function clientIp(request: NextRequest | Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim().slice(0, 64);
  return "unknown";
}
