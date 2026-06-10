export interface YieldCompressionInputs {
  annualNoi: number;
  requiredYieldPct: number;
  mortgageRatePct: number;
  loanToValuePct: number;
  annualAppreciationPct: number;
  holdingPeriodYears: number;
}

export interface YieldCompressionOutputs {
  impliedPropertyValue: number;
  loanAmount: number;
  equityInvested: number;
  monthlyInterestCost: number;
  annualInterestCost: number;
  annualCashFlowBeforeTax: number;
  cashOnCashYieldPct: number | null;
  priceToRentRatio: number | null;
  endingValue: number;
  appreciationGain: number;
  totalReturnEstimate: number;
  annualizedEquityMultiple: number | null;
  appreciationDominanceSharePct: number | null;
  appreciationDominanceWarning: boolean;
}

export interface YieldCurvePoint {
  requiredYieldPct: number;
  impliedPropertyValue: number;
}

export const DEFAULT_NOI = 30_000;

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function calculateYieldCompression(inputs: YieldCompressionInputs): YieldCompressionOutputs {
  const annualNoi = Math.max(inputs.annualNoi, 0);
  const requiredYield = Math.max(inputs.requiredYieldPct, 0.01) / 100;
  const mortgageRate = Math.max(inputs.mortgageRatePct, 0) / 100;
  const loanToValue = clampNumber(inputs.loanToValuePct, 0, 95) / 100;
  const annualAppreciation = inputs.annualAppreciationPct / 100;
  const holdingPeriodYears = Math.max(inputs.holdingPeriodYears, 1);

  const impliedPropertyValue = annualNoi / requiredYield;
  const loanAmount = impliedPropertyValue * loanToValue;
  const equityInvested = impliedPropertyValue - loanAmount;
  const annualInterestCost = loanAmount * mortgageRate;
  const monthlyInterestCost = annualInterestCost / 12;
  const annualCashFlowBeforeTax = annualNoi - annualInterestCost;
  const cashOnCashYieldPct =
    equityInvested > 0 ? (annualCashFlowBeforeTax / equityInvested) * 100 : null;
  const priceToRentRatio = annualNoi > 0 ? impliedPropertyValue / annualNoi : null;
  const endingValue = impliedPropertyValue * (1 + annualAppreciation) ** holdingPeriodYears;
  const appreciationGain = endingValue - impliedPropertyValue;
  const totalReturnEstimate =
    annualCashFlowBeforeTax * holdingPeriodYears + appreciationGain;
  const annualizedEquityMultiple =
    equityInvested > 0 ? (equityInvested + totalReturnEstimate) / equityInvested : null;
  const appreciationDominanceSharePct =
    totalReturnEstimate > 0 ? (appreciationGain / totalReturnEstimate) * 100 : null;

  return {
    impliedPropertyValue,
    loanAmount,
    equityInvested,
    monthlyInterestCost,
    annualInterestCost,
    annualCashFlowBeforeTax,
    cashOnCashYieldPct,
    priceToRentRatio,
    endingValue,
    appreciationGain,
    totalReturnEstimate,
    annualizedEquityMultiple,
    appreciationDominanceSharePct,
    appreciationDominanceWarning:
      appreciationDominanceSharePct != null && appreciationDominanceSharePct >= 60,
  };
}

export function generateYieldCurve(
  annualNoi: number,
  minYieldPct = 2,
  maxYieldPct = 7,
  stepPct = 0.25,
): YieldCurvePoint[] {
  const points: YieldCurvePoint[] = [];
  for (let yieldPct = minYieldPct; yieldPct <= maxYieldPct + 0.0001; yieldPct += stepPct) {
    points.push({
      requiredYieldPct: Number(yieldPct.toFixed(2)),
      impliedPropertyValue: annualNoi / (yieldPct / 100),
    });
  }
  return points;
}

export function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatCurrency(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}
