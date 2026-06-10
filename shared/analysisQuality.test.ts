import { describe, expect, it } from "vitest";
import { computeAnalysisQualityScore } from "./analysisQuality";

describe("analysis quality scoring", () => {
  it("penalizes mass click-through analyses", () => {
    const score = computeAnalysisQualityScore({
      timeSpentSeconds: 8,
      meaningfulInputChanges: 0,
      openedComparableSections: 0,
      savedNotes: false,
      exportedOrSaved: false,
      hasFinancingAssumptions: false,
      hasRentAssumptions: true,
      hasExpenseAssumptions: false,
      hasRenovationOrCapexAssumptions: false,
      comparableReferenceCount: 0,
      duplicateSimilarity: 0.95,
      analysesLastHour: 25,
      userMedianTimeSeconds: 12,
      metrics: { capRate: 6, cashOnCash: 8, dscr: 1.1 },
    });
    expect(score.spamRiskScore).toBeGreaterThanOrEqual(0.75);
    expect(score.leaderboardEligible).toBe(false);
  });

  it("keeps plausible, complete analyses leaderboard eligible", () => {
    const score = computeAnalysisQualityScore({
      timeSpentSeconds: 210,
      meaningfulInputChanges: 6,
      openedComparableSections: 2,
      savedNotes: true,
      exportedOrSaved: true,
      hasFinancingAssumptions: true,
      hasRentAssumptions: true,
      hasExpenseAssumptions: true,
      hasRenovationOrCapexAssumptions: true,
      comparableReferenceCount: 2,
      duplicateSimilarity: 0.1,
      analysesLastHour: 2,
      userMedianTimeSeconds: 145,
      metrics: { capRate: 5.4, cashOnCash: 7.1, dscr: 1.32, monthlyCashFlow: 240 },
    });
    expect(score.confidenceScore).toBeGreaterThanOrEqual(0.65);
    expect(score.leaderboardEligible).toBe(true);
  });

  it("excludes unrealistic outlier analyses", () => {
    const score = computeAnalysisQualityScore({
      timeSpentSeconds: 120,
      meaningfulInputChanges: 4,
      hasFinancingAssumptions: true,
      hasRentAssumptions: true,
      hasExpenseAssumptions: true,
      hasRenovationOrCapexAssumptions: true,
      comparableReferenceCount: 1,
      metrics: { capRate: 80, cashOnCash: 250, dscr: 12 },
    });
    expect(score.plausibilityScore).toBeLessThan(0.4);
    expect(score.leaderboardEligible).toBe(false);
  });

  it("penalizes duplicate analysis patterns", () => {
    const unique = computeAnalysisQualityScore({ timeSpentSeconds: 120, meaningfulInputChanges: 3, duplicateSimilarity: 0.1 });
    const duplicate = computeAnalysisQualityScore({ timeSpentSeconds: 120, meaningfulInputChanges: 3, duplicateSimilarity: 0.95 });
    expect(duplicate.uniquenessScore).toBeLessThan(unique.uniquenessScore);
    expect(duplicate.confidenceScore).toBeLessThan(unique.confidenceScore);
  });
});
