import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHARED_ROUTE_META } from "@shared/routeMeta";
import { isKnownAppRoute } from "./seoMeta";
import { renderSeoFallback } from "./seoRender";
import { buildPagesSitemap } from "./sitemap";

describe("Meetups route consolidation and SEO", () => {
  it("registers /meetups as the canonical community calendar", () => {
    expect(isKnownAppRoute("/meetups")).toBe(true);
    expect(SHARED_ROUTE_META["/meetups"].title).toContain("Meetups & Events");
    expect(SHARED_ROUTE_META["/meetups"].description).toContain("RSVP on Realist");
  });

  it("renders a useful calendar and account boundary for crawlers", async () => {
    const html = await renderSeoFallback("/meetups");
    expect(html).toContain("Canadian Real Estate Investor Meetups & Events");
    expect(html).toContain("Meetup distributes the network");
    expect(html).toContain("One RSVP, one useful account");
    expect(html).toContain("/community/meetups/new");
  });

  it("publishes only the canonical calendar in the page sitemap", async () => {
    const sitemap = await buildPagesSitemap();
    expect(sitemap).toContain("https://realist.ca/meetups");
    expect(sitemap).not.toContain("https://realist.ca/community/events</loc>");
    expect(sitemap).not.toContain("https://realist.ca/community</loc>");
  });

  it("publishes /meetups as the event sitemap hub", async () => {
    const { buildEventsSitemap } = await import("./sitemap");
    const sitemap = await buildEventsSitemap();
    expect(sitemap).toContain("https://realist.ca/meetups");
    expect(sitemap).not.toContain("https://realist.ca/community/events</loc>");
  });

  it("301s legacy event hubs at the Express layer", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(source).toContain('"/events": "/meetups"');
    expect(source).toContain('"/community": "/meetups"');
    expect(source).toContain('"/community/events": "/meetups"');
  });
});
