import { describe, expect, it } from "vitest";
import {
  EXPERT_CATEGORIES,
  categoryFromPartnerType,
  computeRank,
  isExpertCategory,
  RANK_TIERS,
  reputationFromStats,
} from "./contributorReputation";

describe("expert categories", () => {
  it("maps partner types to categories", () => {
    expect(categoryFromPartnerType("architect")).toBe("architecture");
    expect(categoryFromPartnerType("urban_planner")).toBe("urban_planning");
    expect(categoryFromPartnerType("mortgage_broker")).toBe("mortgage");
    expect(categoryFromPartnerType("lawyer")).toBe("legal");
    expect(categoryFromPartnerType(null)).toBe("other");
    expect(categoryFromPartnerType("something_new")).toBe("other");
  });

  it("guards category values", () => {
    expect(isExpertCategory("architecture")).toBe(true);
    expect(isExpertCategory("urban_planning")).toBe(true);
    expect(isExpertCategory("astrology")).toBe(false);
    expect(EXPERT_CATEGORIES).toContain("mortgage");
  });
});

describe("computeRank", () => {
  it("starts at Contributor and clamps negatives", () => {
    expect(computeRank(0).tier.key).toBe("contributor");
    expect(computeRank(-50).tier.key).toBe("contributor");
    expect(computeRank(24).tier.key).toBe("contributor");
  });

  it("promotes at each threshold", () => {
    expect(computeRank(25).tier.key).toBe("established");
    expect(computeRank(100).tier.key).toBe("expert");
    expect(computeRank(300).tier.key).toBe("authority");
    expect(computeRank(750).tier.key).toBe("luminary");
    expect(computeRank(5000).tier.key).toBe("luminary");
  });

  it("reports progress and points to next tier", () => {
    // 50 pts: in Established (25) heading to Expert (100) → 25/75 = 33%
    const r = computeRank(50);
    expect(r.nextTier?.key).toBe("expert");
    expect(r.pointsToNext).toBe(50);
    expect(r.progressPct).toBe(33);
  });

  it("caps progress at the top tier", () => {
    const top = computeRank(1200);
    expect(top.nextTier).toBeNull();
    expect(top.pointsToNext).toBeNull();
    expect(top.progressPct).toBe(100);
  });

  it("tiers are strictly ascending", () => {
    for (let i = 1; i < RANK_TIERS.length; i++) {
      expect(RANK_TIERS[i].minPoints).toBeGreaterThan(RANK_TIERS[i - 1].minPoints);
    }
  });
});

describe("reputationFromStats", () => {
  it("weights notes and net upvotes, floors at zero", () => {
    expect(reputationFromStats({ fieldNotesCount: 10, netUpvotes: 20, dealsContributed: 6 })).toBe(70);
    expect(reputationFromStats({ fieldNotesCount: 0, netUpvotes: 0, dealsContributed: 0 })).toBe(0);
    // heavy downvotes can't push a contributor negative
    expect(reputationFromStats({ fieldNotesCount: 1, netUpvotes: -100, dealsContributed: 1 })).toBe(0);
  });
});
