/**
 * Podcast rail smoke — RSS-DEPENDENT, soft-skip policy.
 *
 * The podcast hub and episode pages are fed by an external RSS feed
 * (server-side fetch, cached). CI runners cannot guarantee that feed is
 * reachable, and a third-party outage must not fail the build. Policy
 * (documented in e2e/README.md): probe GET /api/podcast/episodes first —
 * if it errors or returns an empty list, log and skip these tests instead
 * of failing. Tradeoff: a real regression in the podcast pipeline can hide
 * behind a feed outage for one run; the probe result is printed on every
 * run so a persistent skip is visible in CI logs.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";

type Episode = { slug: string; title: string };

async function fetchEpisodesOrNull(request: APIRequestContext): Promise<Episode[] | null> {
  try {
    const res = await request.get("/api/podcast/episodes", { timeout: 20_000 });
    if (!res.ok()) {
      console.warn(`[podcast smoke] /api/podcast/episodes -> HTTP ${res.status()}; feed likely unreachable`);
      return null;
    }
    const episodes = (await res.json()) as Episode[];
    if (!Array.isArray(episodes) || episodes.length === 0) {
      console.warn("[podcast smoke] feed returned no episodes");
      return null;
    }
    console.log(`[podcast smoke] feed OK: ${episodes.length} episodes`);
    return episodes;
  } catch (err) {
    console.warn(`[podcast smoke] episodes probe failed: ${(err as Error).message}`);
    return null;
  }
}

test.describe("podcast", () => {
  test("hub renders with episode list", async ({ page, request }) => {
    const episodes = await fetchEpisodesOrNull(request);
    test.skip(!episodes, "RSS feed unreachable/empty — soft-skip per e2e/README.md policy");

    await page.goto("/insights/podcast");
    await expect(
      page.getByRole("heading", { level: 1, name: /real estate podcast/i }),
    ).toBeVisible();
    await expect(page.getByTestId(/^card-episode-/).first()).toBeVisible();
  });

  test("an episode page renders", async ({ page, request }) => {
    const episodes = await fetchEpisodesOrNull(request);
    test.skip(!episodes, "RSS feed unreachable/empty — soft-skip per e2e/README.md policy");

    const first = episodes![0];
    await page.goto(`/insights/podcast/${first.slug}`);
    const title = page.getByTestId("text-episode-title");
    await expect(title).toBeVisible();
    await expect(title).not.toBeEmpty();
  });
});
