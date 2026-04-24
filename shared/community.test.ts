import { describe, expect, it } from "vitest";
import { computeConsensusLabel, sanitizeUserText, summarizeCommunityMetrics, truncateText } from "./community";

describe("community helpers", () => {
  it("computes bullish consensus when cash flow is positive and cash-on-cash is above threshold", () => {
    expect(computeConsensusLabel({
      medianMonthlyCashFlow: 250,
      medianCashOnCash: 9,
      medianDscr: 1.2,
    })).toBe("bullish");
  });

  it("computes bearish consensus when cash flow is negative", () => {
    expect(computeConsensusLabel({
      medianMonthlyCashFlow: -25,
      medianCashOnCash: 12,
      medianDscr: 1.3,
    })).toBe("bearish");
  });

  it("excludes private analyses from public aggregate metrics when summarizing", () => {
    const summary = summarizeCommunityMetrics(
      3,
      ["u1", "u2"],
      [
        { capRate: 5.2, cashOnCash: 6.1, projectedRent: 2200, monthlyCashFlow: 150, expenseRatio: 35, dscr: 1.1, sentiment: "neutral" },
        { capRate: 6.0, cashOnCash: 9.5, projectedRent: 2400, monthlyCashFlow: 275, expenseRatio: 32, dscr: 1.25, sentiment: "bullish" },
      ],
    );

    expect(summary.totalAnalysisCount).toBe(3);
    expect(summary.publicAnalysisCount).toBe(2);
    expect(summary.uniquePublicUserCount).toBe(2);
    expect(summary.medianCapRate).toBe(5.6);
  });

  it("sanitizes script content", () => {
    expect(sanitizeUserText(`<script>alert("x")</script><b>Hello</b>`)).toBe("Hello");
  });

  it("truncates previews safely", () => {
    expect(truncateText("123456", 4)).toBe("123…");
  });
});
