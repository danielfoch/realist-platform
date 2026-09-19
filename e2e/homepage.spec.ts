/**
 * Homepage smoke: the multiplex journey opens immediately, chapter navigation
 * reaches the offer flow, and the analysis statistics API remains available.
 */
import { test, expect } from "@playwright/test";

test.describe("homepage", () => {
  test("opens the multiplex journey and navigates to making an offer", async ({
    page,
  }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "The multiplex journey",
        exact: true,
      }),
    ).toBeInViewport();

    const listen = page.getByRole("link", {
      name: "Start listening",
      exact: true,
    });
    await expect(listen).toBeVisible();
    await expect(listen).toHaveAttribute("href", "/insights/podcast");

    const chapters = page.getByRole("navigation", {
      name: "Jump to a journey chapter",
    });
    await expect(chapters.getByRole("button")).toHaveCount(10);
    for (const chapter of [
      "Learn",
      "Education",
      "Connect",
      "Analyze",
      "Find",
      "Design",
      "Offer",
      "Finance",
      "Build",
      "Own",
    ]) {
      await expect(
        chapters.getByRole("button", { name: new RegExp(`${chapter}$`) }),
      ).toBeVisible();
    }

    const offerChapter = chapters.getByRole("button", { name: /Offer/ });
    await offerChapter.click();
    await expect(offerChapter).toHaveAttribute("aria-current", "step");
    await expect(
      page.getByRole("heading", {
        name: /Make your move\.\s*Keep more capital\./,
      }),
    ).toBeInViewport();
    const makeOffer = page.getByRole("link", {
      name: "Make an offer",
      exact: true,
    });
    await expect(makeOffer).toBeVisible();
    await expect(makeOffer).toHaveAttribute("href", "/offer");
  });

  test("analysis statistics endpoint remains available", async ({
    request,
  }) => {
    const res = await request.get("/api/stats/analyses-count");
    expect(res.status()).toBe(200);
    const stats = await res.json();
    expect(typeof stats.total).toBe("number");
    expect(typeof stats.thisWeek).toBe("number");
  });
});
