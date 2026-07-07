/**
 * THE DRIFT GUARD — pins the crawler document to the human document.
 *
 * realist.ca serves two renderings of every page: the React SPA (humans)
 * and the server-side #seo-static-fallback block from server/seoRender.ts
 * (crawlers / plain GETs, no JS). Nothing else in CI verifies that these two
 * documents describe the same page. This test renders /tools/analyzer in a
 * real browser, reads the H1 a human sees, then fetches the same URL as a
 * bot (plain GET, bot UA, no JS) and asserts the raw HTML contains that
 * exact H1 server-side. If someone edits the client H1 without updating
 * seoRender.ts (or vice versa), this fails.
 */
import { test, expect } from "@playwright/test";

const CRAWLER_HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  accept: "text/html",
};

test.describe("crawler fallback (seoRender drift guard)", () => {
  test("plain GET of /tools/analyzer contains the client H1 server-side", async ({
    page,
    request,
  }) => {
    // 1. What a human's browser renders after hydration.
    await page.goto("/tools/analyzer");
    const clientH1 = (
      await page.getByRole("heading", { level: 1 }).first().textContent()
    )?.trim();
    expect(clientH1, "client page must render an H1").toBeTruthy();

    // 2. What a crawler receives from a plain GET — no JavaScript executed.
    const res = await request.get("/tools/analyzer", { headers: CRAWLER_HEADERS });
    expect(res.status()).toBe(200);
    const html = await res.text();

    // The static fallback block must exist and be populated...
    expect(html).toContain('id="seo-static-fallback"');
    // ...contain an H1 naming the analyzer (static anchor)...
    expect(html).toMatch(/<h1[^>]*>[^<]*Real Estate Deal Analyzer/i);
    // ...and contain the exact H1 the client rendered (dynamic anchor —
    // this is the assertion that catches drift in either direction).
    expect(html).toContain(clientH1!);
  });
});
