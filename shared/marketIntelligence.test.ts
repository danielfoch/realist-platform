import { describe, expect, it } from "vitest";
import {
  calculateRankChanges,
  confidenceWeightedDealCount,
  hasEnoughLeaderboardHistory,
  isLowSampleProvisional,
  safeNullableDelta,
} from "./marketIntelligence";

describe("market intelligence helpers", () => {
  it("calculates previous rank and rank movement", () => {
    expect(calculateRankChanges(
      [{ userId: "a", rank: 1 }, { userId: "b", rank: 3 }],
      [{ userId: "a", rank: 2 }, { userId: "b", rank: 1 }],
    )).toEqual([
      { userId: "a", rank: 1, previousRank: 2, rankChange: 1 },
      { userId: "b", rank: 3, previousRank: 1, rankChange: -2 },
    ]);
  });

  it("keeps ranking charts provisional until two finalized months exist", () => {
    expect(hasEnoughLeaderboardHistory(["2026-03"])).toBe(false);
    expect(hasEnoughLeaderboardHistory(["2026-03", "2026-04"])).toBe(true);
  });

  it("flags low sample market metrics as provisional", () => {
    expect(isLowSampleProvisional(4, 5)).toBe(true);
    expect(isLowSampleProvisional(5, 5)).toBe(false);
  });

  it("does not convert missing user-vs-auto metrics to zero", () => {
    expect(safeNullableDelta(null, 5)).toBeNull();
    expect(safeNullableDelta(7, undefined)).toBeNull();
    expect(safeNullableDelta(7, 5)).toBe(2);
  });

  it("weights eligible deals by confidence and excludes click-through analyses", () => {
    expect(confidenceWeightedDealCount([
      { confidenceScore: 0.9, leaderboardEligible: true },
      { confidenceScore: 0.4, leaderboardEligible: true },
      { confidenceScore: 0.9, leaderboardEligible: false },
      { leaderboardEligible: null },
    ])).toBeCloseTo(1.95);
  });
});
