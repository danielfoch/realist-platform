import { calculateInvestmentMetrics } from '../src/investment-metrics';

describe('calculateInvestmentMetrics', () => {
  it('calculates cap rate, yield and cash flow', () => {
    const result = calculateInvestmentMetrics({
      listPrice: 500000,
      monthlyRent: 2500,
      maintenanceFee: 400,
    });

    expect(result.estimated_monthly_rent).toBe(2500);
    expect(result.cap_rate).toBeGreaterThan(0);
    expect(result.gross_yield).toBeCloseTo(6, 1);
    expect(Number.isFinite(result.cash_flow_monthly)).toBe(true);
  });

  it('throws on invalid inputs', () => {
    expect(() =>
      calculateInvestmentMetrics({
        listPrice: 0,
        monthlyRent: 2500,
      }),
    ).toThrow('listPrice and monthlyRent must be greater than 0');
  });
});
