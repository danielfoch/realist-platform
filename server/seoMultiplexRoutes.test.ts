/**
 * Guards the SEO registry for the multiplex surface.
 *
 * Written after /tools/multiplex-underwriter was found serving HTTP 404 with
 * "noindex, nofollow" and a "Page Not Found" title in production while the page
 * itself rendered perfectly. The route existed in client/src/App.tsx and in the
 * sitemap, but nobody had added it to KNOWN_APP_ROUTES — so search engines were
 * invited to crawl it and then told it did not exist.
 *
 * The failure is silent by construction: nothing breaks, the page just quietly
 * stops being findable. These assertions make the next omission fail loudly.
 */
import { describe, expect, it } from "vitest";
import { SHARED_ROUTE_META } from "@shared/routeMeta";
import { isKnownAppRoute } from "./seoMeta";

/** Every route the multiplex funnel depends on. */
const MULTIPLEX_ROUTES = [
  "/tools/multiplex-underwriter",
  "/tools/multiplex-feasibility",
  "/tools/will-it-plex",
  "/multiplex-investor-fit",
  "/masterclass",
];

describe("multiplex route SEO registry", () => {
  it.each(MULTIPLEX_ROUTES)("%s is a known app route", (route) => {
    // An unknown route with no prerendered fallback is served as a hard 404
    // with noindex — see the DEFAULT_META branch in server/static.ts.
    expect(isKnownAppRoute(route)).toBe(true);
  });

  it.each(MULTIPLEX_ROUTES)("%s has its own title and description", (route) => {
    const meta = SHARED_ROUTE_META[route];
    expect(meta, `${route} falls back to the generic site title`).toBeDefined();
    expect(meta.title.length).toBeGreaterThan(20);
    expect(meta.description.length).toBeGreaterThan(60);
  });

  it.each(MULTIPLEX_ROUTES)("%s mentions multiplex in its metadata", (route) => {
    const meta = SHARED_ROUTE_META[route];
    const haystack = `${meta.title} ${meta.description}`.toLowerCase();
    // These pages exist to rank for multiplex intent. A title that never says
    // the word is the generic-fallback bug wearing a costume.
    expect(haystack).toMatch(/multiplex|plex/);
  });

  it("keeps titles inside the length Google will render", () => {
    for (const route of MULTIPLEX_ROUTES) {
      // ~60 chars is the usual truncation point; allow the brand suffix to spill.
      const withoutBrand = SHARED_ROUTE_META[route].title.split("|")[0].trim();
      expect(withoutBrand.length, `${route} title is truncated before the brand`).toBeLessThanOrEqual(65);
    }
  });

  it("does not treat a genuinely unknown path as known", () => {
    // Guards against someone "fixing" this by making isKnownAppRoute permissive,
    // which would 200 every junk URL and invite junk indexing.
    expect(isKnownAppRoute("/tools/multiplex-underwriter-typo")).toBe(false);
    expect(isKnownAppRoute("/definitely/not/a/page")).toBe(false);
  });
});
