/**
 * Playwright auth setup — ensures the test user is authenticated
 * before tests run. Auto-creates the default account via the
 * auto-login endpoint configured in .env.
 *
 * Run before tests via playwright.config.ts → globalSetup.
 */
import { chromium } from "@playwright/test";
import path from "path";

export default async function globalSetup() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to any protected page — the middleware will redirect
    // to /api/auth/auto-login, which creates the account and sets the cookie
    await page.goto(`${baseURL}/manga`);

    // Wait for the redirect chain to complete (auto-login → / → then we
    // navigate back to /manga). The page should eventually render.
    await page.waitForLoadState("domcontentloaded");

    // If we're on the landing page, auto-login may have failed.
    // Check the diagnostic endpoint.
    const currentUrl = page.url();
    console.log(`[Auth Setup] Current URL after redirect: ${currentUrl}`);

    if (currentUrl.includes("/login")) {
      console.warn("[Auth Setup] Redirected to login — auto-login may have failed");
      // Try checking the auto-login diagnostic
      await page.goto(`${baseURL}/api/auth/auto-login?check=1`);
      const body = await page.textContent();
      console.log(`[Auth Setup] Auto-login diagnostic: ${body}`);
    }

    // Save the auth state (cookies) for reuse across tests
    await context.storageState({
      path: path.join(__dirname, ".auth-state.json"),
    });
    console.log("[Auth Setup] Auth state saved");
  } catch (err) {
    console.error("[Auth Setup] Failed:", (err as Error).message);
  } finally {
    await browser.close();
  }
}
