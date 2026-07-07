/**
 * Homepage smoke: the front door renders and its social-proof counter is
 * wired to the live stats API.
 */
import { test, expect } from "@playwright/test";

test.describe("homepage", () => {
  test("renders the investing hero H1", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: /canadian real estate investing/i }),
    ).toBeVisible();
  });

  test("deals-analyzed counter is wired to the stats API", async ({ page, request }) => {
    const res = await request.get("/api/stats/analyses-count");
    expect(res.status()).toBe(200);
    const stats = await res.json();
    expect(typeof stats.total).toBe("number");
    expect(typeof stats.thisWeek).toBe("number");

    await page.goto("/");
    const counter = page.getByTestId("analyses-counter");
    if (stats.total > 0) {
      await expect(counter.first()).toBeVisible();
      await expect(counter.first()).toContainText(/deals analyzed/i);
    } else {
      // Fresh database: AnalysesCounter intentionally renders nothing rather
      // than flashing "0 deals analyzed", so on a clean CI database the
      // element must be ABSENT. The API assertion above is the deterministic
      // part of this test.
      await expect(counter).toHaveCount(0);
    }
  });
});
