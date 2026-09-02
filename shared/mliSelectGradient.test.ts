import { describe, expect, it } from "vitest";
import { buildMliSelectGradient, cellStatus } from "./mliSelectGradient";
import { computeMliTakeout, paymentFactorMonthly } from "./mliSelect";

const strongSite = { units: 6, noi: 180_000, lendingValue: 3_000_000, interestRate: 0.045, purpose: "construction" as const };

describe("buildMliSelectGradient", () => {
  it("gates on the 5-unit minimum", () => {
    const g = buildMliSelectGradient({ ...strongSite, units: 4 });
    expect(g.eligible).toBe(false);
    expect(g.rows).toEqual([]);
    expect(g.bestCell).toBeNull();
    expect(g.notes[0]).toMatch(/requires 5\+/);
  });

  it("builds 4 tiers x 7 LTV steps by default", () => {
    const g = buildMliSelectGradient(strongSite);
    expect(g.eligible).toBe(true);
    expect(g.rows.map((r) => r.points)).toEqual([0, 50, 70, 100]);
    expect(g.rows[0].cells).toHaveLength(7);
    expect(g.rows[0].cells.map((c) => c.ltv)).toEqual([0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]);
  });

  it("marks cells above the tier's LTV ceiling as not allowed and the 0-point row entirely", () => {
    const g = buildMliSelectGradient(strongSite);
    const zero = g.rows.find((r) => r.points === 0)!;
    expect(zero.tier).toBeNull();
    expect(zero.cells.every((c) => c.status === "not_allowed")).toBe(true);

    const fifty = g.rows.find((r) => r.points === 50)!;
    expect(fifty.maxLtv).toBe(0.85);
    expect(fifty.maxAmortYears).toBe(40);
    expect(fifty.cells.find((c) => c.ltv === 0.85)!.allowed).toBe(true);
    expect(fifty.cells.find((c) => c.ltv === 0.9)!.status).toBe("not_allowed");

    const hundred = g.rows.find((r) => r.points === 100)!;
    expect(hundred.cells.every((c) => c.allowed)).toBe(true);
  });

  it("agrees with computeMliTakeout on payment math and premium", () => {
    const g = buildMliSelectGradient(strongSite);
    const hundred = g.rows.find((r) => r.points === 100)!;
    const cell = hundred.cells.find((c) => c.ltv === 0.95)!;
    const pf = paymentFactorMonthly(0.045, 50);
    expect(cell.loan).toBe(Math.round(3_000_000 * 0.95));
    expect(cell.annualDebtService).toBe(Math.round(3_000_000 * 0.95 * pf * 12));
    expect(cell.dscr).toBeCloseTo(180_000 / (3_000_000 * 0.95 * pf * 12), 2);
    // construction schedule: (7.00 + 1.25) x 0.70
    expect(cell.premiumPct).toBeCloseTo(5.775, 3);
    expect(cell.cashEquity).toBe(150_000);

    const takeout = computeMliTakeout({ ...strongSite, points: 100 });
    if (takeout.bindingConstraint === "ltv") {
      expect(cell.loan).toBe(takeout.maxLoan);
    }
  });

  it("picks the highest-LTV cell that clears 1.10x as bestCell, preferring more points on ties", () => {
    const g = buildMliSelectGradient(strongSite);
    expect(g.bestCell).not.toBeNull();
    expect(g.bestCell!.dscr).toBeGreaterThanOrEqual(1.1);
    // Every allowed cell with a higher LTV must fail DSCR.
    for (const row of g.rows) {
      for (const c of row.cells) {
        if (c.allowed && c.ltv > g.bestCell!.ltv + 1e-9) expect(c.dscr).toBeLessThan(1.1);
      }
    }
    const sameLtv = g.rows.flatMap((r) => r.cells.filter((c) => c.allowed && c.ltv === g.bestCell!.ltv && c.dscr >= 1.1).map(() => r.points));
    expect(g.bestCell!.points).toBe(Math.max(...sameLtv));
  });

  it("flags DSCR as the binding constraint when coverage runs out before the LTV ceiling", () => {
    // Thin NOI: 4.2% cap on lending value — 95% LTV cannot cover at 4.5%/50yr.
    const g = buildMliSelectGradient({ ...strongSite, noi: 126_000 });
    const hundred = g.rows.find((r) => r.points === 100)!;
    const top = hundred.cells.find((c) => c.ltv === 0.95)!;
    expect(top.allowed).toBe(true);
    expect(top.status).toBe("fails");
    expect(g.bestCell!.ltv).toBeLessThan(0.95);
    expect(g.notes.some((n) => /DSCR is the binding constraint/.test(n))).toBe(true);
  });

  it("reports when no tier clears the floor", () => {
    const g = buildMliSelectGradient({ ...strongSite, noi: 60_000 });
    expect(g.bestCell).toBeNull();
    expect(g.notes.some((n) => /no LTV step clears/.test(n))).toBe(true);
  });

  it("handles a zero NOI without throwing", () => {
    const g = buildMliSelectGradient({ ...strongSite, noi: 0 });
    expect(g.eligible).toBe(true);
    expect(g.rows).toEqual([]);
    expect(g.bestCell).toBeNull();
  });

  it("honours custom LTV steps and tiers", () => {
    const g = buildMliSelectGradient({ ...strongSite, ltvSteps: [0.9, 0.8], tiers: [70] });
    expect(g.rows).toHaveLength(1);
    expect(g.rows[0].cells.map((c) => c.ltv)).toEqual([0.8, 0.9]);
  });
});

describe("cellStatus", () => {
  it("bands DSCR at 1.25 / 1.10", () => {
    expect(cellStatus(true, 1.3)).toBe("strong");
    expect(cellStatus(true, 1.25)).toBe("strong");
    expect(cellStatus(true, 1.15)).toBe("ok");
    expect(cellStatus(true, 1.1)).toBe("ok");
    expect(cellStatus(true, 1.09)).toBe("fails");
    expect(cellStatus(false, 2)).toBe("not_allowed");
  });
});
