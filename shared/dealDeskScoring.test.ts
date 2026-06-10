import { describe, expect, it } from "vitest";
import {
  computeIntentScore,
  intentBand,
  suggestedNextAction,
  computeDealScore,
  dealVerdict,
  computeUnderwriting,
} from "./dealDeskScoring";

const NOW = new Date("2026-06-10T12:00:00Z");

function event(name: string, daysAgo = 0, dealId?: number | string) {
  return {
    event: name,
    created_at: new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000),
    deal_id: dealId ?? null,
  };
}

describe("computeIntentScore", () => {
  it("returns 0 for no events and empty profile", () => {
    expect(computeIntentScore([], {}, NOW)).toBe(0);
  });

  it("scores a fresh deal submission at 40", () => {
    expect(computeIntentScore([event("deal_submitted")], {}, NOW)).toBe(40);
  });

  it("stacks events and profile bonuses into the hot band", () => {
    const score = computeIntentScore(
      [event("deal_submitted"), event("deal_desk_cta_clicked"), event("report_exported")],
      { hasPhone: true, financingHelp: true },
      NOW,
    );
    // 40 + 20 + 15 + 10 + 15 = 100
    expect(score).toBe(100);
    expect(intentBand(score)).toBe("hot");
  });

  it("decays old events ~10% per week", () => {
    const fresh = computeIntentScore([event("deal_submitted", 0)], {}, NOW);
    const stale = computeIntentScore([event("deal_submitted", 28)], {}, NOW);
    expect(stale).toBeLessThan(fresh);
    // 4 weeks: 40 * 0.9^4 ≈ 26
    expect(stale).toBe(26);
  });

  it("does not decay profile bonuses", () => {
    expect(computeIntentScore([], { hasPhone: true, buyingHelp: true }, NOW)).toBe(25);
  });

  it("caps assumption edits at 20 points per deal", () => {
    const edits = Array.from({ length: 10 }, () => event("assumption_edited", 0, 7));
    expect(computeIntentScore(edits, {}, NOW)).toBe(20);
  });

  it("counts assumption-edit caps per deal separately", () => {
    const edits = [
      ...Array.from({ length: 6 }, () => event("assumption_edited", 0, 1)),
      ...Array.from({ length: 6 }, () => event("assumption_edited", 0, 2)),
    ];
    expect(computeIntentScore(edits, {}, NOW)).toBe(40);
  });

  it("caps assumption edits per deal with string (UUID) deal ids", () => {
    const edits = [
      ...Array.from({ length: 6 }, () => event("assumption_edited", 0, "analysis-a")),
      ...Array.from({ length: 6 }, () => event("assumption_edited", 0, "analysis-b")),
    ];
    expect(computeIntentScore(edits, {}, NOW)).toBe(40);
  });

  it("awards repeat-search bonus only at 3+ market searches", () => {
    expect(computeIntentScore([event("market_researched"), event("market_researched")], {}, NOW)).toBe(0);
    expect(
      computeIntentScore(
        [event("market_researched"), event("market_researched"), event("market_researched")],
        {},
        NOW,
      ),
    ).toBe(10);
  });

  it("treats deal rejection as engagement, not disinterest", () => {
    expect(computeIntentScore([event("deal_rejected")], {}, NOW)).toBe(5);
  });

  it("ignores unknown event types", () => {
    expect(computeIntentScore([event("page_view"), event("mystery_event")], {}, NOW)).toBe(0);
  });
});

describe("intentBand / suggestedNextAction", () => {
  it("maps scores to bands at the documented boundaries", () => {
    expect(intentBand(80)).toBe("hot");
    expect(intentBand(79)).toBe("warm");
    expect(intentBand(50)).toBe("warm");
    expect(intentBand(49)).toBe("nurture");
    expect(intentBand(20)).toBe("nurture");
    expect(intentBand(19)).toBe("audience");
  });

  it("returns an action for every band", () => {
    expect(suggestedNextAction("hot")).toMatch(/5 minutes/);
    expect(suggestedNextAction("warm")).toMatch(/24 hours/);
    expect(suggestedNextAction("nurture")).toMatch(/education/);
    expect(suggestedNextAction("audience")).toMatch(/Newsletter/);
  });
});

describe("computeDealScore", () => {
  it("returns neutral 50 with no inputs", () => {
    expect(computeDealScore({})).toBe(50);
  });

  it("scores a strong cash-flowing deal as submit", () => {
    const score = computeDealScore({
      cashFlowMonthly: 350,
      dscr: 1.35,
      capRate: 6.1,
      cityMedianCapRate: 5.2,
      askingPrice: 480000,
      maxOfferPrice: 510000,
      rentSource: "user_edited",
    });
    expect(score).toBeGreaterThanOrEqual(75);
    expect(dealVerdict(score)).toBe("submit");
  });

  it("penalizes negative cash flow and weak DSCR", () => {
    const score = computeDealScore({
      cashFlowMonthly: -400,
      dscr: 0.85,
      askingPrice: 800000,
      maxOfferPrice: 600000,
      rentSource: "default",
    });
    expect(score).toBeLessThan(25);
    expect(dealVerdict(score)).toBe("pass");
  });

  it("clamps to the 0-100 range", () => {
    const high = computeDealScore({
      cashFlowMonthly: 1000,
      dscr: 2,
      capRate: 9,
      cityMedianCapRate: 4,
      askingPrice: 100,
      maxOfferPrice: 1000,
      rentSource: "comp_derived",
      marketListingCount: 500,
    });
    expect(high).toBeLessThanOrEqual(100);

    const low = computeDealScore({
      cashFlowMonthly: -2000,
      dscr: 0.4,
      askingPrice: 1000000,
      maxOfferPrice: 400000,
      rentSource: "default",
    });
    expect(low).toBeGreaterThanOrEqual(0);
  });
});

describe("computeUnderwriting", () => {
  const base = {
    listPrice: 500000,
    monthlyRent: 2800,
    annualInterestRate: 0.05,
    downPaymentRatio: 0.2,
    amortizationYears: 25,
  };

  it("throws on non-positive price or rent", () => {
    expect(() => computeUnderwriting({ ...base, listPrice: 0 })).toThrow();
    expect(() => computeUnderwriting({ ...base, monthlyRent: -1 })).toThrow();
  });

  it("matches the existing metrics engine for cap rate and gross yield", () => {
    const out = computeUnderwriting(base);
    // NOI = 2800*12*0.6 = 20160; cap = 20160/500000 = 4.03%
    expect(out.capRate).toBeCloseTo(4.03, 1);
    expect(out.grossYield).toBeCloseTo((2800 * 12 / 500000) * 100, 1);
  });

  it("computes DSCR as NOI over annual debt service", () => {
    const out = computeUnderwriting(base);
    const annualDebt = out.monthlyMortgage * 12;
    expect(out.dscr).toBeCloseTo((2800 * 12 * 0.6) / annualDebt, 1);
  });

  it("computes cash required as down payment + closing costs", () => {
    const out = computeUnderwriting(base);
    expect(out.downPayment).toBe(100000);
    expect(out.closingCosts).toBe(7500);
    expect(out.cashRequired).toBe(107500);
  });

  it("finds a max offer price that satisfies DSCR >= 1.2 and CF >= 0", () => {
    const out = computeUnderwriting(base);
    expect(out.maxOfferPrice).not.toBeNull();
    const atMax = computeUnderwriting({ ...base, listPrice: out.maxOfferPrice! });
    expect(atMax.dscr).toBeGreaterThanOrEqual(1.19);
    expect(atMax.cashFlowMonthly).toBeGreaterThanOrEqual(-1);
    // One percent above the max should fail at least one constraint
    const above = computeUnderwriting({ ...base, listPrice: out.maxOfferPrice! * 1.01 });
    expect(above.dscr < 1.2 || above.cashFlowMonthly < 0).toBe(true);
  });

  it("max offer exceeds asking when the deal is underpriced for its rent", () => {
    const out = computeUnderwriting({ ...base, listPrice: 250000, monthlyRent: 3500 });
    expect(out.maxOfferPrice).toBeGreaterThan(250000);
  });

  it("computes break-even rent that zeroes cash flow", () => {
    const out = computeUnderwriting(base);
    const atBreakEven = computeUnderwriting({ ...base, monthlyRent: out.breakEvenRent });
    expect(Math.abs(atBreakEven.cashFlowMonthly)).toBeLessThan(1);
  });

  it("produces a sensitivity grid where worse scenarios have worse cash flow", () => {
    const out = computeUnderwriting(base);
    const byLabel = Object.fromEntries(out.sensitivity.map((s) => [s.label, s]));
    expect(byLabel["rent -10%"].cashFlowMonthly).toBeLessThan(byLabel["base"].cashFlowMonthly);
    expect(byLabel["rent +10%"].cashFlowMonthly).toBeGreaterThan(byLabel["base"].cashFlowMonthly);
    expect(byLabel["rate +1%"].cashFlowMonthly).toBeLessThan(byLabel["base"].cashFlowMonthly);
    expect(byLabel["expenses +25%"].cashFlowMonthly).toBeLessThan(byLabel["base"].cashFlowMonthly);
  });
});
