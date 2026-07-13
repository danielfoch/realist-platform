import { describe, expect, it } from "vitest";
import { DEFAULT_AUTHOR, type ReportContent } from "./reportContent";
import {
  draftStatusFromErrors,
  researchDraftIngestSchema,
  validateResearchArticle,
} from "./researchPublishing";

function article(overrides: Partial<ReportContent> = {}): ReportContent {
  return {
    slug: "test-research-draft",
    title: "Test research draft",
    dek: "A draft article for research publishing tests.",
    author: DEFAULT_AUTHOR,
    publishDate: "2026-07-13",
    kind: "research",
    tags: ["research"],
    sections: [{ type: "narrative", heading: "Summary", body: "A clear research note." }],
    sources: [{ label: "Source", url: "https://example.com" }],
    cta: { toolUrl: "/tools/analyzer", headline: "Underwrite the market", body: "Use Realist tools." },
    ...overrides,
  };
}

describe("research publishing draft validation", () => {
  it("accepts a ReportContent draft with idempotency metadata", () => {
    const parsed = researchDraftIngestSchema.parse({
      sourceId: "agent-run-2026-07-13",
      idempotencyKey: "agent-run-2026-07-13:test-research-draft",
      article: article(),
    });

    const result = validateResearchArticle(parsed.article);
    expect(result.errors).toEqual([]);
    expect(draftStatusFromErrors(result.errors)).toBe("ready_for_review");
  });

  it("keeps malformed drafts in needs_revision instead of publish-ready", () => {
    const result = validateResearchArticle(article({ sections: [] }));

    expect(result.errors).toContain("sections: at least one section required");
    expect(draftStatusFromErrors(result.errors)).toBe("needs_revision");
  });
});
