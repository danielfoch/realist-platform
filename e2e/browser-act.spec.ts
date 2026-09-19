import { test } from "@playwright/test";

/**
 * Optional live playbook smoke. CI does not install Playwright browsers
 * for this path; unit tests mock the driver instead.
 *
 * Run locally with browsers installed:
 *   BROWSER_ACT_E2E=1 npx playwright test e2e/browser-act.spec.ts
 */
test.describe("browser.act playbook (optional)", () => {
  test.skip(
    !process.env.BROWSER_ACT_E2E,
    "Skipped in CI without Playwright browsers. Set BROWSER_ACT_E2E=1 to run.",
  );

  test("placeholder — enable with BROWSER_ACT_E2E=1 against a public fixture host", async () => {
    test.skip(true, "No live portal hit in the default pack.");
  });
});
