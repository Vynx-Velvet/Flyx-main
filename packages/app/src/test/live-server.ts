/**
 * Helpers for "live" integration tests that talk to a running Flyx server.
 *
 * These suites are skipped (not failed) when no server is reachable, so a
 * plain `vitest run` stays green. Set FLYX_TEST_REQUIRE_LIVE=1 to turn a
 * missing server into a hard failure instead (CI / pre-release checks).
 *
 * Env:
 *   FLYX_TEST_BASE_URL     server origin (default http://127.0.0.1:3000 —
 *                          not "localhost", which Node may resolve to ::1)
 *   FLYX_TEST_USER         account used for session-protected routes
 *   FLYX_TEST_PASSWORD     that account's password
 *   FLYX_TEST_REQUIRE_LIVE "1" → fail instead of skipping when the server is down
 */

export const LIVE_BASE_URL = (process.env.FLYX_TEST_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/+$/,
  "",
);

const LIVE_ORIGIN = new URL(LIVE_BASE_URL).origin;

function liveUrl(path: string): string {
  return /^https?:\/\//i.test(path) ? path : `${LIVE_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** True when a Flyx server answers GET /api/health with { status: "ok" }. */
export async function isServerUp(timeoutMs = 1500): Promise<boolean> {
  try {
    const res = await fetch(liveUrl("/api/health"), {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "manual",
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: unknown };
    return body?.status === "ok";
  } catch {
    return false;
  }
}

/**
 * Decide whether a live suite should run. Returns false (→ skip) when the
 * server is down, unless FLYX_TEST_REQUIRE_LIVE=1, in which case it throws so
 * the test file fails loudly.
 */
export async function liveSuiteEnabled(): Promise<boolean> {
  const up = await isServerUp();
  if (!up && process.env.FLYX_TEST_REQUIRE_LIVE === "1") {
    throw new Error(
      `FLYX_TEST_REQUIRE_LIVE=1 but no Flyx server answered at ${LIVE_BASE_URL}/api/health ` +
        `(set FLYX_TEST_BASE_URL if it runs elsewhere).`,
    );
  }
  return up;
}

let sessionCookie: Promise<string> | null = null;

async function login(): Promise<string> {
  const username = process.env.FLYX_TEST_USER;
  const password = process.env.FLYX_TEST_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "Live tests for session-protected routes need FLYX_TEST_USER and FLYX_TEST_PASSWORD " +
        "(an account on the server under test).",
    );
  }

  const res = await fetch(liveUrl("/api/auth/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Same-origin, so the middleware's CSRF check passes deterministically.
      Origin: LIVE_ORIGIN,
    },
    body: JSON.stringify({ username, password }),
    redirect: "manual",
  });
  if (res.status !== 200) {
    const text = await res.text().catch(() => "");
    throw new Error(`Login as ${JSON.stringify(username)} failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }

  const setCookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : (res.headers.get("set-cookie") ?? "").split(/,(?=\s*[A-Za-z0-9_-]+=)/);
  for (const c of setCookies) {
    const pair = c.split(";")[0]!.trim();
    if (pair.startsWith("flyx_token=") && pair.length > "flyx_token=".length) return pair;
  }
  throw new Error("Login succeeded but no flyx_token cookie was set");
}

/** `flyx_token=…` for the test account (logged in once per test file, then cached). */
export function getSessionCookie(): Promise<string> {
  if (!sessionCookie) {
    sessionCookie = login().catch((err) => {
      sessionCookie = null;
      throw err;
    });
  }
  return sessionCookie;
}

/**
 * fetch() against the live server with the test account's session cookie.
 * Redirects are not followed by default, so an auth bounce to /login shows
 * up as a 3xx instead of an HTML page.
 */
export async function liveFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const cookie = await getSessionCookie();
  const existing = headers.get("cookie");
  headers.set("cookie", existing ? `${existing}; ${cookie}` : cookie);
  return fetch(liveUrl(path), { redirect: "manual", ...init, headers });
}

/** fetch() against the live server with no session (for 401 / public-route checks). */
export function anonFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(liveUrl(path), { redirect: "manual", ...init });
}
