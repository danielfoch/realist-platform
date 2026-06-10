/**
 * Underwriting engine v1 — deterministic financial model for long-term rentals.
 *
 * Builds on calculateInvestmentMetrics and adds the numbers investors actually
 * decide with: DSCR, total cash required, max offer price, and a sensitivity
 * grid. All arithmetic lives here; the LLM layer only narrates these outputs.
 */

import { calculateInvestmentMetrics } from './investment-metrics';

export interface UnderwritingInput {
  listPrice: number;
  monthlyRent: number;
  maintenanceFee?: number;
  noiRatio?: number;          // share of rent that becomes NOI (default 0.6)
  downPaymentRatio?: number;  // default 0.2
  annualInterestRate?: number; // default 0.05
  amortizationYears?: number; // default 25
  closingCostRatio?: number;  // default 0.015 (land transfer varies by province)
}

export interface SensitivityCell {
  label: string;
  cashFlowMonthly: number;
  dscr: number;
}

export interface UnderwritingOutput {
  capRate: number;
  grossYield: number;
  cashFlowMonthly: number;
  dscr: number;
  monthlyMortgage: number;
  downPayment: number;
  closingCosts: number;
  cashRequired: number;
  /** Highest price at which DSCR >= 1.2 AND monthly cash flow >= 0. Null if unreachable. */
  maxOfferPrice: number | null;
  breakEvenRent: number;
  sensitivity: SensitivityCell[];
}

const TARGET_DSCR = 1.2;

function round2(value: number): number {
  return Number.parseFloat(value.toFixed(2));
}

function monthlyMortgagePayment(loanAmount: number, annualRate: number, years: number): number {
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return loanAmount / n;
  return (loanAmount * (r * (1 + r) ** n)) / ((1 + r) ** n - 1);
}

interface CoreNumbers {
  cashFlowMonthly: number;
  dscr: number;
  monthlyMortgage: number;
}

function core(input: Required<Omit<UnderwritingInput, 'closingCostRatio' | 'maintenanceFee'>> & { maintenanceFee: number }): CoreNumbers {
  const { listPrice, monthlyRent, maintenanceFee, noiRatio, downPaymentRatio, annualInterestRate, amortizationYears } = input;

  const annualRent = monthlyRent * 12;
  const noi = annualRent * noiRatio - maintenanceFee * 12;
  const loanAmount = listPrice * (1 - downPaymentRatio);
  const monthlyMortgage = monthlyMortgagePayment(loanAmount, annualInterestRate, amortizationYears);
  const annualDebtService = monthlyMortgage * 12;

  const operatingExpensesMonthly = (annualRent - annualRent * noiRatio) / 12 + maintenanceFee;
  const cashFlowMonthly = monthlyRent - operatingExpensesMonthly - monthlyMortgage;
  const dscr = annualDebtService > 0 ? noi / annualDebtService : Infinity;

  return { cashFlowMonthly, dscr, monthlyMortgage };
}

export function computeUnderwriting(input: UnderwritingInput): UnderwritingOutput {
  const {
    listPrice,
    monthlyRent,
    maintenanceFee = 0,
    noiRatio = 0.6,
    downPaymentRatio = 0.2,
    annualInterestRate = 0.05,
    amortizationYears = 25,
    closingCostRatio = 0.015,
  } = input;

  if (listPrice <= 0 || monthlyRent <= 0) {
    throw new Error('listPrice and monthlyRent must be greater than 0');
  }

  const base = { listPrice, monthlyRent, maintenanceFee, noiRatio, downPaymentRatio, annualInterestRate, amortizationYears };
  const metrics = calculateInvestmentMetrics(base);
  const { cashFlowMonthly, dscr, monthlyMortgage } = core(base);

  const downPayment = listPrice * downPaymentRatio;
  const closingCosts = listPrice * closingCostRatio;

  // Max offer: binary-search the highest price meeting DSCR >= 1.2 and CF >= 0
  const meets = (price: number): boolean => {
    const c = core({ ...base, listPrice: price });
    return c.dscr >= TARGET_DSCR && c.cashFlowMonthly >= 0;
  };

  let maxOfferPrice: number | null = null;
  let lo = 1;
  let hi = listPrice * 2;
  if (meets(lo)) {
    while (meets(hi)) hi *= 2; // rent supports more than 2x asking — expand
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (meets(mid)) lo = mid;
      else hi = mid;
    }
    maxOfferPrice = Math.round(lo);
  }

  // Break-even rent: solve monthlyRent for cash flow == 0 at asking price.
  // CF = rent*noiRatio - maintenanceFee - mortgage  =>  rent = (mortgage + fee) / noiRatio
  const breakEvenRent = (monthlyMortgage + maintenanceFee) / noiRatio;

  const scenario = (label: string, overrides: Partial<typeof base>): SensitivityCell => {
    const c = core({ ...base, ...overrides });
    return { label, cashFlowMonthly: round2(c.cashFlowMonthly), dscr: round2(c.dscr) };
  };

  const sensitivity: SensitivityCell[] = [
    scenario('base', {}),
    scenario('rent -10%', { monthlyRent: monthlyRent * 0.9 }),
    scenario('rent +10%', { monthlyRent: monthlyRent * 1.1 }),
    scenario('rate +1%', { annualInterestRate: annualInterestRate + 0.01 }),
    scenario('rate -1%', { annualInterestRate: Math.max(0.001, annualInterestRate - 0.01) }),
    scenario('expenses +25%', { noiRatio: Math.max(0.05, 1 - (1 - noiRatio) * 1.25) }),
  ];

  return {
    capRate: metrics.cap_rate,
    grossYield: metrics.gross_yield,
    cashFlowMonthly: round2(cashFlowMonthly),
    dscr: round2(dscr),
    monthlyMortgage: round2(monthlyMortgage),
    downPayment: round2(downPayment),
    closingCosts: round2(closingCosts),
    cashRequired: round2(downPayment + closingCosts),
    maxOfferPrice,
    breakEvenRent: round2(breakEvenRent),
    sensitivity,
  };
}
