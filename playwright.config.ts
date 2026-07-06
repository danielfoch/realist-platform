/**
 * Playwright E2E smoke-pack configuration.
 *
 * Design goals (see e2e/README.md):
 *  - MINIMAL and FAST: one browser (chromium), <15 tests, <5 min wall clock.
 *  - DETERMINISTIC on a fresh database: e2e/global-setup.ts pushes the
 *    drizzle schema and boots the production bundle (dist/index.cjs) unless
 *    something is already listening on baseURL, in which case both steps are
 *    skipped and the running server is reused (handy for local dev).
 *  - Resilient selectors only: roles, headings, and data-testid attributes.
 */
import { defineConfig, devices } from "@playwright/test";

export const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5000";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  // The whole pack shares one app server; two workers keeps runs fast without
  // hammering a cold database.
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
