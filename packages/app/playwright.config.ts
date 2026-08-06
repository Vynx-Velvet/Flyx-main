import { defineConfig, devices } from "@playwright/test";

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
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
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
