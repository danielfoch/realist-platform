/**
 * Auth smoke: the login page offers the magic-link path, and the magic-link
 * endpoint answers with the generic 200 (no user enumeration) for an email
 * that certainly has no account. Uses a fresh random email each run so the
 * per-email rate limit (3/hour) can never bite consecutive CI runs.
 */
import { test, expect } from "@playwright/test";

test.describe("auth", () => {
  test("/login renders with the magic-link option visible", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome Back")).toBeVisible();
    const magicLinkButton = page.getByTestId("button-email-login-link");
    await expect(magicLinkButton).toBeVisible();
    await expect(magicLinkButton).toContainText(/email me a sign-in link/i);
  });

  test("magic-link request returns generic 200 for an unknown email", async ({ request }) => {
    const email = `e2e-smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const res = await request.post("/api/auth/email-login-link", {
      data: { email },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // The anti-enumeration contract: same body whether or not the account exists.
    expect(String(body.message)).toMatch(/if an account exists/i);
  });
});
