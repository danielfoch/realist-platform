import { describe, expect, it } from "vitest";
import { contributionScore, rankByTrade, type TradeAggRow } from "./tradeLeaderboard";

describe("contributionScore", () => {
  it("weights notes at 3 and clamps negative endorsements to 0", () => {
    expect(contributionScore(2, 5)).toBe(11); // 2*3 + 5
    expect(contributionScore(3, -4)).toBe(9); // negative net votes don't subtract
  });
});

describe("rankByTrade", () => {
  const rows: TradeAggRow[] = [
    { category: "architecture", userId: "a", notes: 5, endorsements: 10 },
    { category: "architecture", userId: "b", notes: 5, endorsements: 2 },
    { category: "urban_planning", userId: "c", notes: 1, endorsements: 0 },
    { category: "architecture", userId: "ghost", notes: 3, endorsements: 1 }, // no name → dropped
  ];
  const nameById = new Map([
    ["a", "Ada"],
    ["b", "Ben"],
    ["c", "Cora"],
  ]);
  const statusById = new Map<string, any>([["a", "verified"]]);

  it("groups by trade, ranks by score, drops the unnamed, and badges", () => {
    const out = rankByTrade(rows, { nameById, statusById });
    expect(Object.keys(out).sort()).toEqual(["architecture", "urban_planning"]);
    expect(out.architecture.map((l) => l.name)).toEqual(["Ada", "Ben"]); // Ada 25 > Ben 17
    expect(out.architecture[0].verificationStatus).toBe("verified");
    expect(out.architecture[1].verificationStatus).toBeNull();
    expect(out.urban_planning[0].name).toBe("Cora");
  });

  it("honours topN and omits empty categories", () => {
    const out = rankByTrade(rows, { nameById, topN: 1 });
    expect(out.architecture).toHaveLength(1);
    expect(out.architecture[0].name).toBe("Ada");
  });

  it("drops rows with zero notes", () => {
    const out = rankByTrade([{ category: "mortgage", userId: "a", notes: 0, endorsements: 9 }], { nameById });
    expect(out.mortgage).toBeUndefined();
  });
});
