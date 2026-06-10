import { describe, expect, it } from "vitest";
import { buildAnalysisCompletedPayload, buildSavedSearchMatchPayload } from "./notifications";

describe("notification payload builders", () => {
  it("builds a saved search payload with finalized copy", async () => {
    const payload = await buildSavedSearchMatchPayload({
      email: "jane@example.com",
      firstName: "Jane",
      searchArea: "Hamilton",
      propertyType: "duplex",
      matchCount: 4,
      ctaUrl: "https://realist.ca/tools/cap-rates?q=duplex+hamilton",
    });

    expect(payload.eventType).toBe("saved_search_match");
    expect(payload.subjectLine).toContain("Hamilton");
    expect(payload.emailBody).toContain("4 new duplex listings");
    expect(payload.ctaUrl).toContain("cap-rates");
  });

  it("builds an analysis completed payload with the chosen next step", async () => {
    const payload = await buildAnalysisCompletedPayload({
      email: "jane@example.com",
      firstName: "Jane",
      strategyType: "buy_hold",
      listingCity: "Hamilton",
      capRate: 5.4,
      cashOnCash: 8.1,
      monthlyCashFlow: 327,
      ctaUrl: "https://realist.ca/compare",
      reasonText: "Your next best step is to compare this deal against your recent analyses.",
    });

    expect(payload.eventType).toBe("analyzer_completed");
    expect(payload.subjectLine).toContain("analysis");
    expect(payload.emailBody).toContain("compare this deal");
    expect(payload.leadScoreDelta).toBe(8);
  });
});
