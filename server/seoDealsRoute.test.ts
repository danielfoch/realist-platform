import { describe, expect, it } from "vitest";
import { SHARED_ROUTE_META } from "@shared/routeMeta";
import { isKnownAppRoute } from "./seoMeta";
import { renderSeoFallback } from "./seoRender";
import { buildPagesSitemap } from "./sitemap";

describe("Deals route SEO contract", () => {
  it("registers /deals as the canonical public listing surface", () => {
    expect(isKnownAppRoute("/deals")).toBe(true);
    expect(SHARED_ROUTE_META["/deals"].title).toContain("Underwritten Canadian");
    expect(SHARED_ROUTE_META["/deals"].description).toContain("CREA DDF");
  });

  it("renders useful crawler content for the Deals product", async () => {
    const html = await renderSeoFallback("/deals");
    expect(html).toContain("Underwritten Canadian Investment Properties");
    expect(html).toContain("CREA DDF");
    expect(html).toContain("vendor take-back");
    expect(html).toContain("/multiplex");
  });

  it("publishes /deals in the pages sitemap", async () => {
    const sitemap = await buildPagesSitemap();
    expect(sitemap).toContain("https://realist.ca/deals");
  });
});
