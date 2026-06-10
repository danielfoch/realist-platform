import { computeUnderwriting } from '../src/underwriting';

describe('computeUnderwriting', () => {
  const base = {
    listPrice: 500000,
    monthlyRent: 2800,
    annualInterestRate: 0.05,
    downPaymentRatio: 0.2,
    amortizationYears: 25,
  };

  it('throws on non-positive price or rent', () => {
    expect(() => computeUnderwriting({ ...base, listPrice: 0 })).toThrow();
    expect(() => computeUnderwriting({ ...base, monthlyRent: -1 })).toThrow();
  });

  it('matches the existing metrics engine for cap rate and gross yield', () => {
    const out = computeUnderwriting(base);
    // NOI = 2800*12*0.6 = 20160; cap = 20160/500000 = 4.03%
    expect(out.capRate).toBeCloseTo(4.03, 1);
    expect(out.grossYield).toBeCloseTo((2800 * 12 / 500000) * 100, 1);
  });

  it('computes DSCR as NOI over annual debt service', () => {
    const out = computeUnderwriting(base);
    const annualDebt = out.monthlyMortgage * 12;
    expect(out.dscr).toBeCloseTo((2800 * 12 * 0.6) / annualDebt, 1);
  });

  it('computes cash required as down payment + closing costs', () => {
    const out = computeUnderwriting(base);
    expect(out.downPayment).toBe(100000);
    expect(out.closingCosts).toBe(7500);
    expect(out.cashRequired).toBe(107500);
  });

  it('finds a max offer price that satisfies DSCR >= 1.2 and CF >= 0', () => {
    const out = computeUnderwriting(base);
    expect(out.maxOfferPrice).not.toBeNull();
    const atMax = computeUnderwriting({ ...base, listPrice: out.maxOfferPrice! });
    expect(atMax.dscr).toBeGreaterThanOrEqual(1.19);
    expect(atMax.cashFlowMonthly).toBeGreaterThanOrEqual(-1);
    // One percent above the max should fail at least one constraint
    const above = computeUnderwriting({ ...base, listPrice: out.maxOfferPrice! * 1.01 });
    expect(above.dscr < 1.2 || above.cashFlowMonthly < 0).toBe(true);
  });

  it('max offer exceeds asking when the deal is underpriced for its rent', () => {
    const out = computeUnderwriting({ ...base, listPrice: 250000, monthlyRent: 3500 });
    expect(out.maxOfferPrice).toBeGreaterThan(250000);
  });

  it('computes break-even rent that zeroes cash flow', () => {
    const out = computeUnderwriting(base);
    const atBreakEven = computeUnderwriting({ ...base, monthlyRent: out.breakEvenRent });
    expect(Math.abs(atBreakEven.cashFlowMonthly)).toBeLessThan(1);
  });

  it('produces a sensitivity grid where worse scenarios have worse cash flow', () => {
    const out = computeUnderwriting(base);
    const byLabel = Object.fromEntries(out.sensitivity.map((s) => [s.label, s]));
    expect(byLabel['rent -10%'].cashFlowMonthly).toBeLessThan(byLabel['base'].cashFlowMonthly);
    expect(byLabel['rent +10%'].cashFlowMonthly).toBeGreaterThan(byLabel['base'].cashFlowMonthly);
    expect(byLabel['rate +1%'].cashFlowMonthly).toBeLessThan(byLabel['base'].cashFlowMonthly);
    expect(byLabel['expenses +25%'].cashFlowMonthly).toBeLessThan(byLabel['base'].cashFlowMonthly);
  });
});
