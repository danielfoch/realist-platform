import { describe, expect, it } from "vitest";
import {
  ANALYSIS_MILESTONES,
  RETENTION_WEEKLY_CAP,
  decideRetentionSend,
  newlyCrossedMilestone,
} from "./retentionPolicy";

describe("decideRetentionSend (trySend semantics)", () => {
  it("sends when the dedupe row is fresh and under the cap", () => {
    expect(decideRetentionSend({ dedupeRowInserted: true, recentLogCount: 1 })).toBe("send");
  });

  it("never resends when the dedupe row already exists", () => {
    expect(decideRetentionSend({ dedupeRowInserted: false, recentLogCount: 0 })).toBe("duplicate");
  });

  it("dedupe takes precedence over the cap check", () => {
    expect(
      decideRetentionSend({ dedupeRowInserted: false, recentLogCount: RETENTION_WEEKLY_CAP + 5 }),
    ).toBe("duplicate");
  });

  it("allows exactly the weekly cap (count includes the just-claimed row)", () => {
    // 2 prior sends + this claim = 3 = cap → still sends (the 3rd email).
    expect(
      decideRetentionSend({ dedupeRowInserted: true, recentLogCount: RETENTION_WEEKLY_CAP }),
    ).toBe("send");
  });

  it("suppresses past the weekly cap and burns the trigger (acknowledged behavior)", () => {
    // 3 prior sends + this claim = 4 > cap → suppressed. The dedupe row is
    // kept by the caller, so this exact trigger is never retried later.
    expect(
      decideRetentionSend({ dedupeRowInserted: true, recentLogCount: RETENTION_WEEKLY_CAP + 1 }),
    ).toBe("capped");
  });

  it("honours a custom weekly cap", () => {
    expect(decideRetentionSend({ dedupeRowInserted: true, recentLogCount: 2, weeklyCap: 1 })).toBe("capped");
    expect(decideRetentionSend({ dedupeRowInserted: true, recentLogCount: 1, weeklyCap: 1 })).toBe("send");
  });
});

describe("newlyCrossedMilestone (retroactive-blast guard)", () => {
  it("exports the production milestone ladder", () => {
    expect([...ANALYSIS_MILESTONES]).toEqual([5, 10, 25, 50, 100]);
  });

  it("fires when a milestone is crossed within the sweep window", () => {
    expect(newlyCrossedMilestone(5, 1)).toBe(5); // 4 → 5
    expect(newlyCrossedMilestone(11, 3)).toBe(10); // 8 → 11 crosses 10
    expect(newlyCrossedMilestone(100, 1)).toBe(100);
  });

  it("does NOT fire for milestones passed before the window (first-deploy guard)", () => {
    // A user with 40 lifetime analyses who did 2 in the last 24h crossed 5/10/25
    // long ago — no email. This is the retroactive-blast scenario.
    expect(newlyCrossedMilestone(40, 2)).toBeNull();
    // Active user, but their lifetime total just sits past a milestone.
    expect(newlyCrossedMilestone(6, 1)).toBeNull(); // 5 → 6
  });

  it("does not fire when activity stays between milestones", () => {
    expect(newlyCrossedMilestone(4, 4)).toBeNull(); // below first milestone
    expect(newlyCrossedMilestone(12, 1)).toBeNull(); // 11 → 12
    expect(newlyCrossedMilestone(24, 10)).toBeNull(); // 14 → 24
  });

  it("returns the HIGHEST milestone when several are crossed in one window", () => {
    expect(newlyCrossedMilestone(26, 25)).toBe(25); // 1 → 26 crosses 5, 10, 25
    expect(newlyCrossedMilestone(12, 12)).toBe(10); // 0 → 12 crosses 5, 10
  });

  it("fires when the count lands exactly on the milestone", () => {
    expect(newlyCrossedMilestone(25, 1)).toBe(25); // 24 → 25
    expect(newlyCrossedMilestone(50, 50)).toBe(50);
  });

  it("handles zero, negative, and out-of-range inputs without firing spuriously", () => {
    expect(newlyCrossedMilestone(0, 0)).toBeNull();
    expect(newlyCrossedMilestone(-3, 1)).toBeNull();
    expect(newlyCrossedMilestone(6, -1)).toBeNull(); // negative window clamps to 0
    expect(newlyCrossedMilestone(7, 100)).toBe(5); // window count clamps to lifetime
    expect(newlyCrossedMilestone(Number.NaN, 1)).toBeNull();
  });

  it("supports a custom milestone ladder", () => {
    expect(newlyCrossedMilestone(3, 1, [3, 6])).toBe(3);
    expect(newlyCrossedMilestone(4, 1, [3, 6])).toBeNull();
  });
});
