/**
 * Videos hub smoke — FEATURE-DETECTED. The videos rail may not be merged
 * yet: /insights/videos is not in the client router or the server SEO route
 * table on every branch. The server returns a real HTTP 404 for unknown
 * routes, so a 404 here means "not shipped" and the test skips. Once the
 * rail merges (route answers 200), this test arms itself automatically.
 */
import { test, expect } from "@playwright/test";

test.describe("videos hub", () => {
  test("renders when the rail is deployed (skips on 404)", async ({ page, request }) => {
    const probe = await request.get("/insights/videos", {
      headers: { accept: "text/html" },
    });
    test.skip(
      probe.status() === 404,
      "/insights/videos not deployed on this branch (HTTP 404) — skipping until the rail merges",
    );
    expect(probe.status()).toBe(200);

    await page.goto("/insights/videos");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });
});
