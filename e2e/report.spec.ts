/**
 * Config-report smoke: one representative report from shared/reports renders
 * through ConfigReportPage/ReportRenderer with its title and at least one
 * chart. Report content ships in the bundle (no database dependency).
 */
import { test, expect } from "@playwright/test";

const REPORT_PATH = "/insights/reports/interprovincial-migration-fraser-1995-2024";

test.describe("config report page", () => {
  test("renders H1 and at least one chart (or its table fallback)", async ({ page }) => {
    const response = await page.goto(REPORT_PATH);
    expect(response?.status()).toBe(200);

    const title = page.getByTestId("report-title");
    await expect(title).toBeVisible();
    await expect(title).toContainText(/interprovincial migration/i);

    // At least one chart section exists...
    await expect(page.getByTestId("report-chart-section").first()).toBeVisible();
    // ...and it contains either a live recharts SVG or a plain <table>
    // fallback (recharts needs layout to mount; poll to allow it).
    const chartOrTable = page.locator(
      '[data-testid="report-chart-section"] svg.recharts-surface, [data-testid="report-chart-section"] table',
    );
    await expect(chartOrTable.first()).toBeVisible({ timeout: 15_000 });
  });
});
