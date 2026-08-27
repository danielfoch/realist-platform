import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../shared/schema.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../migrations/0018_distress_listing_observations.sql", import.meta.url), "utf8");
const generator = readFileSync(new URL("./distressReportGenerator.ts", import.meta.url), "utf8");
const hub = readFileSync(new URL("../client/src/pages/InsightsHub.tsx", import.meta.url), "utf8");
const meta = readFileSync(new URL("./seoMeta.ts", import.meta.url), "utf8");
const render = readFileSync(new URL("./seoRender.ts", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("./sitemap.ts", import.meta.url), "utf8");

describe("longitudinal motivated-listing discovery", () => {
  it("defines and migrates a unique listing-per-month observation table", () => {
    expect(schema).toContain('pgTable("distress_listing_observations"');
    expect(schema).toContain('uniqueIndex("distress_observations_month_listing_idx")');
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS distress_listing_observations");
    expect(migration).toContain("UNIQUE INDEX IF NOT EXISTS distress_observations_month_listing_idx");
    expect(migration).not.toContain("public_remarks");
  });

  it("updates generated reports but refuses incomplete national captures", () => {
    expect(generator).toContain("failedProvinces.length > 0");
    expect(generator).toContain("storage.updateBlogPost(existingPost.id, post)");
    expect(generator).toContain('category: "distress-report"');
  });

  it("compounds generated reports into Research and crawler discovery", () => {
    expect(hub).toContain("generatedDistressReports");
    expect(hub).toContain("category=distress-report&limit=12");
    expect(render).toContain('reqPath === "/insights/motivated-report"');
    expect(render).toContain('category: "distress-report"');
    expect(sitemap).toContain('post.category === "distress-report"');
  });

  it("publishes Dataset metadata with the official DDF source", () => {
    expect(meta).toContain('name: "Canadian Motivated Listing Signals"');
    expect(meta).toContain("https://www.crea.ca/technology/realtor-ca-for-realtors/realtor-ca-tools/realtor-ca-ddf/");
    expect(meta).toContain('measurementTechnique: "Monthly point-in-time PublicRemarks query and rules-based signal classification"');
  });
});
