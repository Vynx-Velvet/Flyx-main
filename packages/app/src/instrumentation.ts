/**
 * Next.js Instrumentation Hook — runs once when the server starts.
 *
 * Flyx 3.0 no longer needs a keygen scheduler since we've moved to
 * providers that don't require auth token management (AnimeX, WeebCentral).
 *
 * This hook is kept as a no-op for future instrumentation needs.
 *
 * This file is registered in next.config.ts via the
 * experimental.instrumentationHook flag.
 */

export async function register(): Promise<void> {
  // Only run in Node.js server runtime (skip edge/browser)
  if (typeof process === "undefined" || process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  console.log("[Flyx Boot] Server started. Providers: AnimeX (anime), WeebCentral (manga)");
}
