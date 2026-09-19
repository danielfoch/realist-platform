/**
 * Agent underwriting — resolves a sparse agent request ("underwrite MLS X at
 * 25% down") into the full BuyHoldInputs assumption set, runs the same buy &
 * hold engine the web analyzer uses, and shapes the result.
 *
 * Replaces the old underwriteSimple(), which fed a single `expenseRatio` into
 * the map-search metrics engine as "maintenance" and then had property tax and
 * insurance added on top — double-counting expenses and understating NOI.
 * Here operating expenses are explicit line items (the website's model); a
 * caller-supplied `expenseRatio` is honoured as the ALL-IN operating expense
 * ratio and distributed across those line items.
 */
import type { AnalysisResults, BuyHoldInputs } from "@shared/schema";
import { calculateBuyHoldAnalysis, calculateStressTest } from "@shared/buyHoldAnalysis";
import type { UnderwritingRentSource } from "@shared/agentViews";

export const AGENT_UNDERWRITING_VERSION = "realist-buy-hold-v2";

/** Web-analyzer defaults (client/src/pages/Home.tsx) — keep in lockstep. */
export const AGENT_UNDERWRITING_DEFAULTS = {
  downPaymentPercent: 20,
  interestRate: 5.5,
  amortizationYears: 25,
  loanTermYears: 5,
  closingCostsPercentOfPrice: 3,
  vacancyPercent: 5,
  propertyTaxPercentOfPrice: 1,
  insurancePerUnitAnnual: 1200,
  maintenancePercent: 5,
  managementPercent: 5,
  capexReservePercent: 5,
  rentGrowthPercent: 0,
  expenseInflationPercent: 2,
  appreciationPercent: 2,
  holdingPeriodYears: 10,
  sellingCostsPercent: 5,
} as const;

/** Last-resort monthly rent per unit by bedroom count when no estimate exists. */
const FALLBACK_RENT_BY_BEDS: Record<number, number> = { 0: 1200, 1: 1500, 2: 1800, 3: 2200, 4: 2600, 5: 3000 };

export interface AgentUnderwriteAssumptions {
  downPaymentPercent?: number;
  interestRate?: number;
  amortizationYears?: number;
  closingCosts?: number;
  /** Vacancy allowance, % of gross rent. */
  vacancyRate?: number;
  /** ALL-IN operating expenses as % of gross rent (excludes vacancy + debt service). */
  expenseRatio?: number;
  annualPropertyTax?: number;
  annualInsurance?: number;
  monthlyUtilities?: number;
  maintenancePercent?: number;
  managementPercent?: number;
  capexReservePercent?: number;
  monthlyOtherExpenses?: number;
  rentGrowthPercent?: number;
  expenseInflationPercent?: number;
  appreciationPercent?: number;
  holdingPeriodYears?: number;
  sellingCostsPercent?: number;
}

export interface ResolvedRent {
  monthlyRent: number;
  source: UnderwritingRentSource;
  detail?: string;
}

export function fallbackMonthlyRent(beds: number | null | undefined, units: number): number {
  const perUnitBeds = perUnitBedrooms(beds, units);
  return (FALLBACK_RENT_BY_BEDS[Math.min(perUnitBeds, 5)] ?? 1800) * Math.max(1, units);
}

/** Listing feeds report TOTAL bedrooms; the rent engine wants bedrooms per unit. */
export function perUnitBedrooms(beds: number | null | undefined, units: number): number {
  const total = Number.isFinite(beds as number) && (beds as number) >= 0 ? (beds as number) : 2;
  const unitCount = Math.max(1, units);
  return unitCount > 1 ? Math.max(0, Math.round(total / unitCount)) : total;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Build the full assumption set. Every defaulted or estimated value gets a
 * plain-language note so the agent (and the hosted view) can say what was
 * assumed rather than presenting guesses as facts.
 */
export function resolveBuyHoldInputs(
  base: { price: number; units: number; rent: ResolvedRent; knownAnnualPropertyTax?: number | null },
  a: AgentUnderwriteAssumptions = {},
): { inputs: BuyHoldInputs; notes: string[] } {
  const d = AGENT_UNDERWRITING_DEFAULTS;
  const notes: string[] = [];
  const price = base.price;
  const units = Math.max(1, base.units);
  const monthlyRent = base.rent.monthlyRent;
  const annualRent = monthlyRent * 12;

  if (base.rent.source === "realist_estimate") {
    notes.push(`Rent is a Realist estimate${base.rent.detail ? ` (${base.rent.detail})` : ""} — replace with actual or market-verified rent.`);
  } else if (base.rent.source === "fallback_table") {
    notes.push("No rent data for this market: rent is a rough bedroom-count placeholder. Supply monthlyRent for a meaningful result.");
  } else if (base.rent.source === "actual") {
    notes.push("Rent is the actual rent reported on the listing — verify against leases.");
  }

  let propertyTax = a.annualPropertyTax ?? base.knownAnnualPropertyTax ?? null;
  if (propertyTax == null) {
    propertyTax = Math.round(price * (d.propertyTaxPercentOfPrice / 100));
    notes.push(`Property tax estimated at ${d.propertyTaxPercentOfPrice}% of price — confirm with the municipality.`);
  } else if (a.annualPropertyTax == null) {
    notes.push("Property tax taken from the listing feed.");
  }
  let insurance = a.annualInsurance ?? null;
  if (insurance == null) {
    insurance = d.insurancePerUnitAnnual * units;
    notes.push(`Insurance estimated at $${d.insurancePerUnitAnnual.toLocaleString("en-CA")}/unit/year.`);
  }

  let utilities = a.monthlyUtilities ?? 0;
  let otherExpenses = a.monthlyOtherExpenses ?? 0;
  let maintenancePercent = a.maintenancePercent ?? d.maintenancePercent;
  let managementPercent = a.managementPercent ?? d.managementPercent;
  let capexReservePercent = a.capexReservePercent ?? d.capexReservePercent;

  if (a.expenseRatio != null && annualRent > 0) {
    // All-in ratio: total operating expenses must equal ratio × gross rent.
    const target = annualRent * (a.expenseRatio / 100);
    const fixed = propertyTax + insurance + utilities * 12 + otherExpenses * 12;
    if (fixed <= target) {
      // Spread what is left over maintenance / management / capex, keeping
      // their relative weights.
      const remainderPercent = ((target - fixed) / annualRent) * 100;
      const weight = maintenancePercent + managementPercent + capexReservePercent;
      const share = (part: number) => (weight > 0 ? (part / weight) * remainderPercent : remainderPercent / 3);
      const maintenanceShare = round2(share(maintenancePercent));
      const managementShare = round2(share(managementPercent));
      // The last share absorbs the rounding so the three still sum to the remainder.
      const capexShare = Math.max(0, round2(remainderPercent - maintenanceShare - managementShare));
      [maintenancePercent, managementPercent, capexReservePercent] = [maintenanceShare, managementShare, capexShare];
    } else {
      // The ratio cannot even cover the fixed line items: scale them down so
      // the caller's all-in figure is honoured exactly, and say so.
      const scale = fixed > 0 ? target / fixed : 0;
      propertyTax = Math.round(propertyTax * scale);
      insurance = Math.round(insurance * scale);
      utilities = round2(utilities * scale);
      otherExpenses = round2(otherExpenses * scale);
      maintenancePercent = 0;
      managementPercent = 0;
      capexReservePercent = 0;
      notes.push(`An all-in expense ratio of ${a.expenseRatio}% is below estimated property tax + insurance alone; line items were scaled down to match it. Treat this NOI as optimistic.`);
    }
    notes.push(`Operating expenses set to an all-in ${a.expenseRatio}% of gross rent (caller-supplied expenseRatio).`);
  }

  let closingCosts = a.closingCosts ?? null;
  if (closingCosts == null) {
    closingCosts = Math.round(price * (d.closingCostsPercentOfPrice / 100));
    notes.push(`Closing costs estimated at ${d.closingCostsPercentOfPrice}% of price (land transfer tax, legal, inspection).`);
  }

  const inputs: BuyHoldInputs = {
    purchasePrice: price,
    closingCosts,
    downPaymentPercent: a.downPaymentPercent ?? d.downPaymentPercent,
    interestRate: a.interestRate ?? d.interestRate,
    amortizationYears: a.amortizationYears ?? d.amortizationYears,
    loanTermYears: d.loanTermYears,
    monthlyRent,
    vacancyPercent: a.vacancyRate ?? d.vacancyPercent,
    propertyTax,
    insurance,
    utilities,
    maintenancePercent,
    managementPercent,
    capexReservePercent,
    otherExpenses,
    rentGrowthPercent: a.rentGrowthPercent ?? d.rentGrowthPercent,
    expenseInflationPercent: a.expenseInflationPercent ?? d.expenseInflationPercent,
    appreciationPercent: a.appreciationPercent ?? d.appreciationPercent,
    holdingPeriodYears: Math.round(a.holdingPeriodYears ?? d.holdingPeriodYears),
    sellingCostsPercent: a.sellingCostsPercent ?? d.sellingCostsPercent,
    isCmhcMliSelect: false,
    cmhcMliPoints: 0,
  };
  return { inputs, notes };
}

const money = (value: number) => Math.round(value);
const finiteOrNull = (value: number | null | undefined, decimals = 2) =>
  typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(decimals)) : null;

/** JSON-safe copy of the engine output (DSCR is Infinity on an all-cash deal). */
export function serializableResults(results: AnalysisResults): AnalysisResults {
  return { ...results, dscr: Number.isFinite(results.dscr) ? results.dscr : 0 };
}

export function runAgentUnderwriting(
  inputs: BuyHoldInputs,
  meta: { units: number; rent: ResolvedRent; notes: string[] },
) {
  const results = calculateBuyHoldAnalysis(inputs);
  const stress = calculateStressTest(inputs);
  const holdYear = results.yearlyProjections.find((p) => p.year === inputs.holdingPeriodYears)
    ?? results.yearlyProjections[results.yearlyProjections.length - 1];
  const annualRent = inputs.monthlyRent * 12;
  const annualOpex = results.monthlyExpenses * 12;
  const downPayment = (inputs.purchasePrice * inputs.downPaymentPercent) / 100;

  const stressCase = (s: (typeof stress)["base"]) => ({
    capRate: finiteOrNull(s.capRate),
    cashOnCash: finiteOrNull(s.cashOnCash),
    dscr: finiteOrNull(s.dscr),
    annualCashFlow: money(s.annualCashFlow),
    monthlyRent: money(s.monthlyRent),
    vacancyPercent: finiteOrNull(s.vacancyPercent),
    interestRate: finiteOrNull(s.interestRate),
  });

  const underwriting = {
    // Keys below predate the registry — kept stable for existing consumers.
    price: inputs.purchasePrice,
    monthlyRent: money(inputs.monthlyRent),
    rentSource: meta.rent.source,
    units: meta.units,
    annualRent: money(annualRent),
    noi: money(results.annualNoi),
    capRate: finiteOrNull(results.capRate) ?? 0,
    downPayment: money(downPayment),
    mortgageAmount: money(results.loanAmount),
    monthlyMortgage: money(results.monthlyMortgagePayment),
    monthlyCashFlow: money(results.monthlyCashFlow),
    annualCashFlow: money(results.annualCashFlow),
    cashOnCash: finiteOrNull(results.cashOnCash) ?? 0,
    dscr: finiteOrNull(results.dscr),
    // Added with the buy & hold engine.
    irr: finiteOrNull(results.irr),
    closingCosts: money(inputs.closingCosts),
    totalCashInvested: money(results.totalCashInvested),
    annualOperatingExpenses: money(annualOpex),
    expenseBreakdownAnnual: {
      propertyTax: money(inputs.propertyTax),
      insurance: money(inputs.insurance),
      utilities: money(inputs.utilities * 12),
      maintenance: money(results.expenseBreakdown.maintenance * 12),
      management: money(results.expenseBreakdown.management * 12),
      capexReserve: money(results.expenseBreakdown.capexReserve * 12),
      other: money(inputs.otherExpenses * 12),
    },
    exit: holdYear
      ? {
          holdingPeriodYears: inputs.holdingPeriodYears,
          propertyValue: money(holdYear.propertyValue),
          loanBalance: money(holdYear.loanBalance),
          equity: money(holdYear.equity),
          cumulativeCashFlow: money(holdYear.cumulativeCashFlow),
          totalReturn: money(holdYear.totalReturn),
        }
      : null,
    stressTest: { base: stressCase(stress.base), bear: stressCase(stress.bear), bull: stressCase(stress.bull) },
    assumptions: {
      downPaymentPercent: inputs.downPaymentPercent,
      interestRate: inputs.interestRate,
      vacancyRate: inputs.vacancyPercent,
      expenseRatio: annualRent > 0 ? finiteOrNull((annualOpex / annualRent) * 100) : null,
      amortizationYears: inputs.amortizationYears,
      maintenancePercent: inputs.maintenancePercent,
      managementPercent: inputs.managementPercent,
      capexReservePercent: inputs.capexReservePercent,
      rentGrowthPercent: inputs.rentGrowthPercent,
      expenseInflationPercent: inputs.expenseInflationPercent,
      appreciationPercent: inputs.appreciationPercent,
      sellingCostsPercent: inputs.sellingCostsPercent,
    },
    calculationVersion: AGENT_UNDERWRITING_VERSION,
    warnings: meta.notes,
  };

  return { underwriting, results: serializableResults(results) };
}
