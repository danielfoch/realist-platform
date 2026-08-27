import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const metaSource = readFileSync(new URL("./seoMeta.ts", import.meta.url), "utf8");
const renderSource = readFileSync(new URL("./seoRender.ts", import.meta.url), "utf8");
const sitemapSource = readFileSync(new URL("./sitemap.ts", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("published research discovery", () => {
  it("resolves DB research in metadata and crawlable rendering", () => {
    expect(metaSource).toContain("getPublishedResearchArticleBySlug");
    expect(renderSource).toContain("getPublishedResearchArticleBySlug");
    expect(renderSource).toContain("chartToTableRows(section)");
  });

  it("adds published DB research to the report sitemap", () => {
    expect(sitemapSource).toContain("getPublishedResearchSummaries");
    expect(sitemapSource).toContain("report.route");
    expect(sitemapSource).not.toContain('{ path: "/reports",');
  });

  it("301s the retired report archive to the canonical Research hub", () => {
    expect(indexSource).toContain('"/reports": "/insights"');
  });
});
