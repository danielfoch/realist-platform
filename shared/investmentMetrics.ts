export type InvestmentMetricKey =
  | "price"
  | "gross_yield"
  | "cap_rate"
  | "cash_on_cash"
  | "irr"
  | "monthly_cash_flow"
  | "community_consensus";

export type InvestmentMetricSource = "realist_estimate" | "community_median" | "my_saved_analyses";
export type MetricConfidence = "low" | "medium" | "high";
export type ConsensusLabel = "bullish" | "neutral" | "bearish";

export interface MetricFeatureFlags {
  ENABLE_METRIC_BASED_MAP_SEARCH: boolean;
  ENABLE_CAP_RATE_SEARCH: boolean;
  ENABLE_IRR_SEARCH: boolean;
  ENABLE_COMMUNITY_METRIC_SEARCH: boolean;
  ENABLE_MY_ANALYSIS_SEARCH: boolean;
}

function readFlag(name: string, fallback: boolean): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })?.process?.env;
  const raw = env?.[name];
  if (raw == null) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

function readNumber(name: string, fallback: number): number {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } })?.process?.env;
  const raw = env?.[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const INVESTMENT_METRIC_FLAGS: MetricFeatureFlags = {
  ENABLE_METRIC_BASED_MAP_SEARCH: readFlag("ENABLE_METRIC_BASED_MAP_SEARCH", true),
  ENABLE_CAP_RATE_SEARCH: readFlag("ENABLE_CAP_RATE_SEARCH", true),
  ENABLE_IRR_SEARCH: readFlag("ENABLE_IRR_SEARCH", false),
  ENABLE_COMMUNITY_METRIC_SEARCH: readFlag("ENABLE_COMMUNITY_METRIC_SEARCH", true),
  ENABLE_MY_ANALYSIS_SEARCH: readFlag("ENABLE_MY_ANALYSIS_SEARCH", true),
};

export const INVESTMENT_METRIC_DEFAULTS = {
  CALCULATION_VERSION: "realist-investment-metrics-v1",
  DEFAULT_VACANCY_PERCENT: readNumber("DEFAULT_VACANCY_PERCENT", 5),
  DEFAULT_MAINTENANCE_PERCENT: readNumber("DEFAULT_MAINTENANCE_PERCENT", 5),
  DEFAULT_MANAGEMENT_PERCENT: readNumber("DEFAULT_MANAGEMENT_PERCENT", 8),
  DEFAULT_PROPERTY_TAX_PERCENT: readNumber("DEFAULT_PROPERTY_TAX_PERCENT", 1),
  DEFAULT_INSURANCE_PER_UNIT_ANNUAL: readNumber("DEFAULT_INSURANCE_PER_UNIT_ANNUAL", 1200),
  DEFAULT_HOLD_PERIOD_YEARS: readNumber("DEFAULT_HOLD_PERIOD_YEARS", 5),
  DEFAULT_APPRECIATION_PERCENT: readNumber("DEFAULT_APPRECIATION_PERCENT", 3),
  DEFAULT_SELLING_COST_PERCENT: readNumber("DEFAULT_SELLING_COST_PERCENT", 5),
};

export interface InvestmentMetricAssumptions {
  monthlyRent: number;
  unitCount?: number | null;
  vacancyPercent?: number | null;
  maintenancePercent?: number | null;
  managementPercent?: number | null;
  annualPropertyTax?: number | null;
  annualInsurance?: number | null;
  annualCondoFees?: number | null;
  annualUtilities?: number | null;
  annualRepairs?: number | null;
  annualOtherRecurringExpenses?: number | null;
  downPaymentPercent?: number | null;
  interestRate?: number | null;
  amortizationYears?: number | null;
  holdPeriodYears?: number | null;
  annualAppreciationPercent?: number | null;
  sellingCostPercent?: number | null;
  rentSource?: string | null;
  taxSource?: string | null;
}

export interface CalculatedInvestmentMetrics {
  calculationVersion: string;
  grossYield: number | null;
  capRate: number | null;
  cashOnCashReturn: number | null;
  irr: number | null;
  noi: number | null;
  annualGrossRent: number | null;
  annualOperatingExpenses: number | null;
  monthlyCashFlow: number | null;
  dscr: number | null;
  expenseRatio: number | null;
  assumptionsComplete: boolean;
  capRateConfidence: MetricConfidence;
  irrConfidence: MetricConfidence;
  calculationWarnings: string[];
  assumptionsUsed: Required<Omit<InvestmentMetricAssumptions, "rentSource" | "taxSource">> & {
    rentSource: string | null;
    taxSource: string | null;
  };
}

export function roundMetric(value: number | null | undefined, decimals = 2): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function metricLabel(metric: InvestmentMetricKey): string {
  switch (metric) {
    case "price":
      return "Price";
    case "gross_yield":
      return "Estimated gross yield";
    case "cap_rate":
      return "Estimated cap rate";
    case "cash_on_cash":
      return "Estimated cash-on-cash";
    case "irr":
      return "Estimated IRR";
    case "monthly_cash_flow":
      return "Estimated monthly cash flow";
    case "community_consensus":
      return "Community consensus";
  }
}

export function metricHigherIsBetter(metric: InvestmentMetricKey): boolean {
  return metric !== "price";
}

function normalizeAssumptions(assumptions: InvestmentMetricAssumptions): CalculatedInvestmentMetrics["assumptionsUsed"] {
  const unitCount = Math.max(1, Math.round(assumptions.unitCount || 1));
  return {
    monthlyRent: Math.max(0, assumptions.monthlyRent || 0),
    unitCount,
    vacancyPercent: assumptions.vacancyPercent ?? INVESTMENT_METRIC_DEFAULTS.DEFAULT_VACANCY_PERCENT,
    maintenancePercent: assumptions.maintenancePercent ?? INVESTMENT_METRIC_DEFAULTS.DEFAULT_MAINTENANCE_PERCENT,
    managementPercent: assumptions.managementPercent ?? INVESTMENT_METRIC_DEFAULTS.DEFAULT_MANAGEMENT_PERCENT,
    annualPropertyTax: assumptions.annualPropertyTax ?? null,
    annualInsurance: assumptions.annualInsurance ?? (INVESTMENT_METRIC_DEFAULTS.DEFAULT_INSURANCE_PER_UNIT_ANNUAL * unitCount),
    annualCondoFees: assumptions.annualCondoFees ?? 0,
    annualUtilities: assumptions.annualUtilities ?? 0,
    annualRepairs: assumptions.annualRepairs ?? 0,
    annualOtherRecurringExpenses: assumptions.annualOtherRecurringExpenses ?? 0,
    downPaymentPercent: assumptions.downPaymentPercent ?? 20,
    interestRate: assumptions.interestRate ?? 5.5,
    amortizationYears: assumptions.amortizationYears ?? 25,
    holdPeriodYears: assumptions.holdPeriodYears ?? INVESTMENT_METRIC_DEFAULTS.DEFAULT_HOLD_PERIOD_YEARS,
    annualAppreciationPercent: assumptions.annualAppreciationPercent ?? INVESTMENT_METRIC_DEFAULTS.DEFAULT_APPRECIATION_PERCENT,
    sellingCostPercent: assumptions.sellingCostPercent ?? INVESTMENT_METRIC_DEFAULTS.DEFAULT_SELLING_COST_PERCENT,
    rentSource: assumptions.rentSource ?? null,
    taxSource: assumptions.taxSource ?? null,
  };
}

export function calculateGrossYield(price: number, assumptions: InvestmentMetricAssumptions): number | null {
  const monthlyRent = assumptions.monthlyRent || 0;
  if (!(price > 0) || !(monthlyRent > 0)) return null;
  return roundMetric(((monthlyRent * 12) / price) * 100, 2);
}

function calculateMonthlyDebtService(loanAmount: number, annualInterestRatePercent: number, amortizationYears: number): number {
  if (loanAmount <= 0) return 0;
  const monthlyRate = annualInterestRatePercent / 100 / 12;
  const months = Math.max(1, Math.round(amortizationYears * 12));
  if (monthlyRate <= 0) return loanAmount / months;
  return loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
}

function calculateRemainingLoanBalance(loanAmount: number, annualInterestRatePercent: number, amortizationYears: number, elapsedYears: number): number {
  if (loanAmount <= 0) return 0;
  const monthlyRate = annualInterestRatePercent / 100 / 12;
  const totalMonths = Math.max(1, Math.round(amortizationYears * 12));
  const elapsedMonths = Math.max(0, Math.min(totalMonths, Math.round(elapsedYears * 12)));
  if (monthlyRate <= 0) {
    return Math.max(0, loanAmount * (1 - (elapsedMonths / totalMonths)));
  }
  const payment = calculateMonthlyDebtService(loanAmount, annualInterestRatePercent, amortizationYears);
  const remaining = loanAmount * Math.pow(1 + monthlyRate, elapsedMonths) - payment * ((Math.pow(1 + monthlyRate, elapsedMonths) - 1) / monthlyRate);
  return Math.max(0, remaining);
}

function calculateIrrFromCashFlows(cashFlows: number[]): number | null {
  if (cashFlows.length < 2) return null;
  const hasPositive = cashFlows.some((value) => value > 0);
  const hasNegative = cashFlows.some((value) => value < 0);
  if (!hasPositive || !hasNegative) return null;

  const npv = (rate: number) =>
    cashFlows.reduce((sum, value, index) => sum + (value / Math.pow(1 + rate, index)), 0);

  let low = -0.99;
  let high = 5;
  let lowValue = npv(low);
  let highValue = npv(high);
  let attempts = 0;

  while (lowValue * highValue > 0 && attempts < 12) {
    high *= 2;
    highValue = npv(high);
    attempts += 1;
  }

  if (lowValue * highValue > 0) return null;

  for (let i = 0; i < 100; i += 1) {
    const mid = (low + high) / 2;
    const value = npv(mid);
    if (Math.abs(value) < 0.000001) return roundMetric(mid * 100, 2);
    if (lowValue * value <= 0) {
      high = mid;
      highValue = value;
    } else {
      low = mid;
      lowValue = value;
    }
  }

  return roundMetric(((low + high) / 2) * 100, 2);
}

export function calculateInvestmentMetrics(price: number, rawAssumptions: InvestmentMetricAssumptions): CalculatedInvestmentMetrics {
  const assumptions = normalizeAssumptions(rawAssumptions);
  const warnings: string[] = [];

  if (!(price > 0)) {
    warnings.push("Missing purchase price.");
  }
  if (!(assumptions.monthlyRent > 0)) {
    warnings.push("Missing rent assumption.");
  }
  if (assumptions.annualPropertyTax == null) {
    warnings.push("Property tax is inferred or unavailable.");
  }

  const annualGrossRent = assumptions.monthlyRent > 0 ? assumptions.monthlyRent * 12 : null;
  const vacancyAllowance = annualGrossRent != null ? annualGrossRent * (assumptions.vacancyPercent / 100) : null;
  const maintenance = annualGrossRent != null ? annualGrossRent * (assumptions.maintenancePercent / 100) : null;
  const management = annualGrossRent != null ? annualGrossRent * (assumptions.managementPercent / 100) : null;
  const propertyTax = assumptions.annualPropertyTax ?? (price > 0 ? price * (INVESTMENT_METRIC_DEFAULTS.DEFAULT_PROPERTY_TAX_PERCENT / 100) : 0);
  const annualOperatingExpenses = annualGrossRent == null
    ? null
    : (vacancyAllowance || 0)
      + (maintenance || 0)
      + (management || 0)
      + (assumptions.annualInsurance || 0)
      + propertyTax
      + (assumptions.annualCondoFees || 0)
      + (assumptions.annualUtilities || 0)
      + (assumptions.annualRepairs || 0)
      + (assumptions.annualOtherRecurringExpenses || 0);

  const noi = annualGrossRent != null && annualOperatingExpenses != null ? annualGrossRent - annualOperatingExpenses : null;
  const grossYield = calculateGrossYield(price, assumptions);
  const capRate = price > 0 && noi != null ? roundMetric((noi / price) * 100, 2) : null;
  const expenseRatio = annualGrossRent != null && annualOperatingExpenses != null && annualGrossRent > 0
    ? roundMetric((annualOperatingExpenses / annualGrossRent) * 100, 2)
    : null;

  const equityInvested = price > 0 ? price * (assumptions.downPaymentPercent / 100) : 0;
  const loanAmount = price > 0 ? Math.max(0, price - equityInvested) : 0;
  const monthlyDebtService = calculateMonthlyDebtService(loanAmount, assumptions.interestRate, assumptions.amortizationYears);
  const annualDebtService = monthlyDebtService * 12;
  const monthlyCashFlow = noi != null ? roundMetric((noi - annualDebtService) / 12, 2) : null;
  const dscr = noi != null && annualDebtService > 0 ? roundMetric(noi / annualDebtService, 2) : null;
  const cashOnCashReturn = noi != null && equityInvested > 0 ? roundMetric(((noi - annualDebtService) / equityInvested) * 100, 2) : null;

  let irr: number | null = null;
  const irrInputsComplete = price > 0
    && assumptions.monthlyRent > 0
    && equityInvested > 0
    && assumptions.holdPeriodYears > 0
    && assumptions.sellingCostPercent >= 0;
  if (irrInputsComplete && noi != null) {
    const annualCashFlow = noi - annualDebtService;
    const projectedSalePrice = price * Math.pow(1 + (assumptions.annualAppreciationPercent / 100), assumptions.holdPeriodYears);
    const sellingCosts = projectedSalePrice * (assumptions.sellingCostPercent / 100);
    const remainingBalance = calculateRemainingLoanBalance(loanAmount, assumptions.interestRate, assumptions.amortizationYears, assumptions.holdPeriodYears);
    const cashFlows = [-equityInvested];
    for (let year = 1; year <= assumptions.holdPeriodYears; year += 1) {
      cashFlows.push(year === assumptions.holdPeriodYears
        ? annualCashFlow + projectedSalePrice - sellingCosts - remainingBalance
        : annualCashFlow);
    }
    irr = calculateIrrFromCashFlows(cashFlows);
    if (irr == null) {
      warnings.push("IRR unavailable due to incomplete or unstable exit assumptions.");
    }
  } else {
    warnings.push("IRR unavailable — missing assumptions.");
  }

  const assumptionsComplete = price > 0 && assumptions.monthlyRent > 0;
  const capRateConfidence: MetricConfidence =
    assumptions.rentSource === "actual" && assumptions.annualPropertyTax != null
      ? "high"
      : assumptions.monthlyRent > 0
        ? "medium"
        : "low";
  const irrConfidence: MetricConfidence =
    irr != null && capRateConfidence !== "low" && assumptions.holdPeriodYears >= 5
      ? capRateConfidence
      : "low";

  return {
    calculationVersion: INVESTMENT_METRIC_DEFAULTS.CALCULATION_VERSION,
    grossYield,
    capRate,
    cashOnCashReturn,
    irr: INVESTMENT_METRIC_FLAGS.ENABLE_IRR_SEARCH ? irr : null,
    noi: roundMetric(noi, 0),
    annualGrossRent: roundMetric(annualGrossRent, 0),
    annualOperatingExpenses: roundMetric(annualOperatingExpenses, 0),
    monthlyCashFlow,
    dscr,
    expenseRatio,
    assumptionsComplete,
    capRateConfidence,
    irrConfidence,
    calculationWarnings: warnings,
    assumptionsUsed: assumptions,
  };
}
