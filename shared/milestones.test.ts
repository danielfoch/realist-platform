import { describe, it, expect } from "vitest";
import {
  ANALYST_BADGES,
  computeMilestoneProgress,
} from "./milestones";

describe("computeMilestoneProgress", () => {
  it("returns no current badge and the first badge as next for a brand-new user", () => {
    const p = computeMilestoneProgress(0);
    expect(p.currentBadge).toBeNull();
    expect(p.nextBadge?.name).toBe("Analyst");
    expect(p.nextBadge?.threshold).toBe(10);
    expect(p.dealsToNext).toBe(10);
    expect(p.progressPercent).toBe(0);
  });

  it("measures progress from zero to the first badge", () => {
    const p = computeMilestoneProgress(5);
    expect(p.currentBadge).toBeNull();
    expect(p.nextBadge?.threshold).toBe(10);
    expect(p.dealsToNext).toBe(5);
    // 5 of the 10-deal span => 50%
    expect(p.progressPercent).toBe(50);
  });

  it("reads near the start of the next span just after crossing a threshold", () => {
    // Just earned Analyst (10). Next is Power User (50). Span 10->50 = 40.
    const p = computeMilestoneProgress(10);
    expect(p.currentBadge?.name).toBe("Analyst");
    expect(p.nextBadge?.name).toBe("Power User");
    expect(p.dealsToNext).toBe(40);
    expect(p.progressPercent).toBe(0);
  });

  it("computes mid-span progress between two badges", () => {
    // 30 deals: current Analyst(10), next Power User(50). (30-10)/(50-10)=50%.
    const p = computeMilestoneProgress(30);
    expect(p.currentBadge?.name).toBe("Analyst");
    expect(p.nextBadge?.name).toBe("Power User");
    expect(p.dealsToNext).toBe(20);
    expect(p.progressPercent).toBe(50);
  });

  it("caps out once the top badge is earned", () => {
    const p = computeMilestoneProgress(600);
    expect(p.currentBadge?.name).toBe("Legend");
    expect(p.nextBadge).toBeNull();
    expect(p.dealsToNext).toBe(0);
    expect(p.progressPercent).toBe(100);
  });

  it("treats non-finite and negative counts as zero", () => {
    for (const bad of [NaN, Infinity, -5, -1]) {
      const p = computeMilestoneProgress(bad as number);
      expect(p.totalDeals).toBe(0);
      expect(p.currentBadge).toBeNull();
      expect(p.nextBadge?.name).toBe("Analyst");
    }
  });

  it("floors fractional counts", () => {
    const p = computeMilestoneProgress(49.9);
    expect(p.totalDeals).toBe(49);
    expect(p.nextBadge?.name).toBe("Power User");
    expect(p.dealsToNext).toBe(1);
  });

  it("exposes an ascending, well-formed badge ladder", () => {
    expect(ANALYST_BADGES.length).toBeGreaterThan(0);
    for (let i = 1; i < ANALYST_BADGES.length; i++) {
      expect(ANALYST_BADGES[i].threshold).toBeGreaterThan(ANALYST_BADGES[i - 1].threshold);
    }
    for (const b of ANALYST_BADGES) {
      expect(b.name.length).toBeGreaterThan(0);
      expect(b.icon.length).toBeGreaterThan(0);
    }
  });
});
