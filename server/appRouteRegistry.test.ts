/**
 * Keeps server/seoMeta.ts's KNOWN_APP_ROUTES in sync with client/src/App.tsx.
 *
 * That table's own comment says it "mirrors the routes declared in
 * client/src/App.tsx", and by July 2026 it had drifted by 28 routes — including
 * /book-a-call (the nav's primary revenue CTA), /work-with-realist, and
 * /tools/financing-readiness (a nav item badged "New"). Every one of them served
 * HTTP 404 with "noindex, nofollow" while rendering perfectly, so they were
 * invisible to search and previewed as dead pages when shared.
 *
 * The failure mode is silent — nothing errors, pages just stop being findable —
 * which is exactly why it needs a test rather than diligence. Reading both files
 * from disk is deliberate: the point is to compare what the router actually
 * declares against what the server actually registers.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isKnownAppRoute } from "./seoMeta";

const REPO_ROOT = join(__dirname, "..");

/**
 * Static route paths declared in the SPA router.
 *
 * Parameterised and splat routes are excluded on purpose: their slugs are
 * validated by getMetaForPath / renderSeoFallback, so an unknown slug should
 * still 404. See the KNOWN_APP_ROUTES comment block.
 */
function routesDeclaredInApp(): string[] {
  const app = readFileSync(join(REPO_ROOT, "client/src/App.tsx"), "utf8");
  const found = [...app.matchAll(/<Route\s+path="(\/[^"]*)"/g)].map((m) => m[1]);
  return [...new Set(
    found
      .filter((r) => !r.includes(":") && !r.includes("*"))
      .map((r) => (r.length > 1 ? r.replace(/\/+$/, "") : r)),
  )].sort();
}

describe("KNOWN_APP_ROUTES mirrors the SPA router", () => {
  const declared = routesDeclaredInApp();

  it("finds a plausible number of routes to check", () => {
    // Guards the regex itself: if App.tsx is restructured and this stops
    // matching, the suite would otherwise pass vacuously.
    expect(declared.length).toBeGreaterThan(100);
  });

  it("registers every static route the router declares", () => {
    const missing = declared.filter((r) => !isKnownAppRoute(r));
    expect(
      missing,
      `These routes render but serve HTTP 404 + noindex. Add them to KNOWN_APP_ROUTES in server/seoMeta.ts:\n  ${missing.join("\n  ")}`,
    ).toEqual([]);
  });

  it("keeps the conversion pages registered", () => {
    // Named explicitly so a regression on the revenue path is unmistakable in
    // the failure output rather than one line in a list of 28.
    for (const route of [
      "/book-a-call",
      "/work-with-realist",
      "/tools/financing-readiness",
      "/tools/multiplex-underwriter",
      "/join/mortgage-brokers",
      "/verify-email",
    ]) {
      expect(isKnownAppRoute(route), `${route} must not 404`).toBe(true);
    }
  });

  it("still rejects junk URLs", () => {
    // The fix must not become "treat everything as known", which would 200 every
    // junk path and invite junk indexing.
    expect(isKnownAppRoute("/book-a-call-typo")).toBe(false);
    expect(isKnownAppRoute("/wp-admin")).toBe(false);
    expect(isKnownAppRoute("/definitely/not/real")).toBe(false);
  });
});
