/**
 * 404 smoke: junk URLs must return a real HTTP 404 (with noindex), never a
 * soft 200 — a 200 + self-canonical on junk paths invites junk indexing.
 * The SPA shell still renders for humans (soft recovery), which is why the
 * assertion is on the HTTP status, not the visible page.
 */
import { test, expect } from "@playwright/test";

const JUNK_PATH = "/definitely-not-a-real-page-e2e-smoke-9f3a";

test.describe("not found", () => {
  test("junk URL returns HTTP 404 with noindex", async ({ page, request }) => {
    const res = await request.get(JUNK_PATH, { headers: { accept: "text/html" } });
    expect(res.status()).toBe(404);
    expect(await res.text()).toContain("noindex");

    // Same status through a real browser navigation.
    const nav = await page.goto(JUNK_PATH);
    expect(nav?.status()).toBe(404);
  });
});
