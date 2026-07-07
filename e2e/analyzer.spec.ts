/**
 * Deal analyzer smoke — the flagship money path. Loads /tools/analyzer,
 * enters a price and rent, calculates, and expects real metric output.
 * Calculation is fully client-side (no API dependency), so this is
 * deterministic on a fresh database.
 */
import { test, expect } from "@playwright/test";

test.describe("deal analyzer", () => {
  test("loads with heading and inputs", async ({ page }) => {
    await page.goto("/tools/analyzer");
    await expect(
      page.getByRole("heading", { level: 1, name: /real estate deal analyzer/i }),
    ).toBeVisible();
    await expect(page.getByTestId("input-purchase-price")).toBeVisible();
    await expect(page.getByTestId("input-monthly-rent")).toBeVisible();
    await expect(page.getByTestId("button-calculate")).toBeVisible();
  });

  test("entering price and rent then calculating shows cap rate", async ({ page }) => {
    await page.goto("/tools/analyzer");
    await page.getByTestId("input-purchase-price").fill("600000");
    await page.getByTestId("input-monthly-rent").fill("3200");
    await page.getByTestId("button-calculate").click();

    // Results section appears with the metric cards.
    await expect(page.getByRole("heading", { name: /analysis results/i })).toBeVisible();
    const capRateCard = page.getByTestId("metric-cap-rate");
    await expect(capRateCard).toBeVisible();
    await expect(capRateCard).toContainText(/cap rate/i);
    await expect(capRateCard).toContainText("%");
  });
});
