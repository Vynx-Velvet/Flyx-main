/**
 * Playwright auth setup — signs the test user in once and saves the
 * session cookie for every spec (playwright.config.ts → globalSetup +
 * use.storageState).
 *
 * Pages require a session, and anonymous visitors are never auto-signed
 * into an existing account, so the suite logs in with a real account:
 *   FLYX_TEST_USER / FLYX_TEST_PASSWORD   (same vars as the live vitest suites)
 */
import { request } from "@playwright/test";
import path from "path";

export const AUTH_STATE_PATH = path.join(__dirname, ".auth-state.json");

export default async function globalSetup() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
  const username = process.env.FLYX_TEST_USER;
  const password = process.env.FLYX_TEST_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "[Auth Setup] Set FLYX_TEST_USER and FLYX_TEST_PASSWORD to an account on the server under test.",
    );
  }

  const ctx = await request.newContext({ baseURL });
  try {
    const res = await ctx.post("/api/auth/login", {
      data: { username, password },
      headers: { Origin: new URL(baseURL).origin },
    });
    if (!res.ok()) {
      throw new Error(`[Auth Setup] Login failed: HTTP ${res.status()} ${await res.text()}`);
    }
    await ctx.storageState({ path: AUTH_STATE_PATH });
    console.log(`[Auth Setup] Signed in as ${username}; auth state saved`);
  } finally {
    await ctx.dispose();
  }
}
