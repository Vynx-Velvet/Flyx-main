import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * Playwright E2E config for manga reader and browse tests.
 *
 * Targets the Next.js dev server. Uses single-worker sequential
 * execution to avoid hammering the manga API with parallel
 * requests.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "../../coverage/e2e-report" }],
  ],
  timeout: 120_000,
  expect: {
    timeout: 30_000,
  },
  // Pages require a session: sign in once (FLYX_TEST_USER / FLYX_TEST_PASSWORD)
  // and reuse the cookie in every spec.
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    storageState: path.join(__dirname, "e2e", ".auth-state.json"),
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Don't wait for all network to be idle — the API polling can keep connections open
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    cwd: "../..",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
