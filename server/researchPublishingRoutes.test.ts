import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const serverSource = readFileSync(new URL("./researchPublishing.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/ConfigReportPage.tsx", import.meta.url), "utf8");
const hubSource = readFileSync(new URL("../client/src/pages/InsightsHub.tsx", import.meta.url), "utf8");

describe("research publication contract", () => {
  it("serves only published research through public endpoints", () => {
    expect(serverSource).toContain('app.get("/api/research/articles"');
    expect(serverSource).toContain('app.get("/api/research/articles/:slug"');
    expect(serverSource).toContain('eq(researchArticles.status, "published")');
    expect(serverSource).toContain('"Cache-Control", "public, max-age=300');
  });

  it("publishes valid reports atomically and records the outcome", () => {
    expect(serverSource).toContain("validateResearchArticle(article.articleJson)");
    expect(serverSource).toContain("getConfigReport(normalized.slug)");
    expect(serverSource).toContain("await db.transaction(async (tx)");
    expect(serverSource).toContain('status: "published"');
    expect(serverSource).toContain('outcome: "already_published"');
    expect(serverSource).toContain('outcome: "published"');
    expect(serverSource).not.toContain("public publishing is intentionally disabled");
  });

  it("renders both published and signed-preview reports through the shared interactive page", () => {
    expect(pageSource).toContain("/api/research/articles/");
    expect(pageSource).toContain("/api/research/preview/");
    expect(pageSource).toContain("<ReportRenderer report={report} noIndex={isPreview} />");
    expect(pageSource).toContain("isPreview ? dynamicReport : staticReport || dynamicReport");
  });

  it("merges DB-published research into the canonical hub", () => {
    expect(hubSource).toContain('queryKey: ["/api/research/articles"]');
    expect(hubSource).toContain("publishedResearch");
    expect(hubSource).toContain("Canadian Real Estate Research");
  });
});
