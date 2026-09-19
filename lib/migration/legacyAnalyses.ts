/**
 * Carrying v1 deal analyses into the analysis log, so the leaderboard, members'
 * track records and the learned market defaults don't start from zero.
 * Pure — scripts/migrate-users.ts does the I/O.
 *
 * Only buy-and-hold analyses come across: v1's other "strategies" were input
 * forms without an engine behind them, and their numbers mean something else.
 */

import { INVESTMENT_METRIC_DEFAULTS } from "@/lib/underwriting/investmentMetrics";
import { analysisQuality, clampInputs, editedFields, underwrite, type UnderwriterInputs } from "@/lib/underwriting/underwriter";
import { dealKeyFor, fsaOf } from "@/lib/analyses/dealKey";
import { provinceCode } from "@/lib/leads/routing";
import type { LegacyRow } from "./legacyUsers";

/** What v1's analyzer opened with — the baseline a legacy "edit" is measured against. */
const LEGACY_UI_DEFAULTS = {
  downPaymentPercent: 20,
  interestRate: 5.5,
  amortizationYears: 25,
  vacancyPercent: 5,
  maintenancePercent: 5,
  capexReservePercent: 5,
  managementPercent: 5,
  appreciationPercent: 2,
  rentGrowthPercent: 0,
  holdingPeriodYears: 10,
  sellingCostsPercent: 5,
};

const num = (value: unknown, fallback: number): number => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && isFinite(parsed) ? parsed : fallback;
};

function toInputs(source: Record<string, unknown>, price: number, rent: number): UnderwriterInputs | null {
  const d = LEGACY_UI_DEFAULTS;
  return clampInputs({
    price,
    monthlyRent: rent,
    units: Math.max(1, Math.round(num(source.units ?? source.numberOfUnits, 1))),
    downPaymentPercent: num(source.downPaymentPercent, d.downPaymentPercent),
    interestRate: num(source.interestRate, d.interestRate),
    amortizationYears: num(source.amortizationYears, d.amortizationYears),
    vacancyPercent: num(source.vacancyPercent, d.vacancyPercent),
    managementPercent: num(source.managementPercent, d.managementPercent),
    // v1 split upkeep into maintenance and a capex reserve; here it is one line.
    maintenancePercent: num(source.maintenancePercent, d.maintenancePercent) + num(source.capexReservePercent, d.capexReservePercent),
    annualPropertyTax: num(source.propertyTax, 0),
    annualInsurance: num(source.insurance, 0),
    monthlyCondoFees: 0,
    // v1 took utilities and "other" monthly.
    monthlyUtilities: num(source.utilities, 0) + num(source.otherExpenses, 0),
    closingCosts: num(source.closingCosts, 0),
    holdPeriodYears: Math.min(40, Math.max(1, Math.round(num(source.holdingPeriodYears, d.holdingPeriodYears)))),
    annualAppreciationPercent: num(source.appreciationPercent, d.appreciationPercent),
    annualRentGrowthPercent: num(source.rentGrowthPercent, d.rentGrowthPercent),
    sellingCostPercent: num(source.sellingCostsPercent, d.sellingCostsPercent),
  });
}

export interface MappedAnalysis {
  dealKey: string;
  source: "listing" | "manual";
  mlsNumber: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  fsa: string | null;
  units: number;
  price: number;
  inputs: UnderwriterInputs;
  defaults: UnderwriterInputs;
  edited: string[];
  monthlyRent: number;
  capRate: number | null;
  cashOnCash: number | null;
  dscr: number | null;
  monthlyCashFlow: number | null;
  irr: number | null;
  quality: number;
  eligible: boolean;
  engineVersion: string;
  createdAt: Date;
}

export function mapLegacyAnalysis(row: LegacyRow): MappedAnalysis | null {
  if (row.strategy_type != null && row.strategy_type !== "buy_hold") return null;
  const source = (row.inputs_json && typeof row.inputs_json === "object" ? row.inputs_json : {}) as Record<string, unknown>;
  const price = num(source.purchasePrice, num(row.purchase_price_num, 0));
  const rent = num(source.monthlyRent, num(row.monthly_rent_num, 0));
  if (!(price > 0) || !(rent > 0)) return null;

  const inputs = toInputs(source, price, rent);
  // The same deal as v1 would have opened it: their defaults, this price and rent.
  const defaults = toInputs({ propertyTax: source.propertyTax, insurance: source.insurance, closingCosts: source.closingCosts, units: source.units ?? source.numberOfUnits }, price, rent);
  if (!inputs || !defaults) return null;

  const mlsNumber = typeof source.mlsNumber === "string" && source.mlsNumber.trim() ? source.mlsNumber.trim() : null;
  const address = typeof row.address === "string" && row.address.trim() ? row.address.trim() : null;
  // An analysis with no address still happened: it keeps its own key so it counts once.
  const dealKey = dealKeyFor({ mlsNumber, address }) ?? `legacy:${String(row.id)}`;

  const result = underwrite(inputs);
  const edited = editedFields(defaults, inputs);
  const quality = analysisQuality(result, edited);
  const created = row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at ?? ""));

  return {
    dealKey,
    source: mlsNumber ? "listing" : "manual",
    mlsNumber,
    address,
    city: typeof row.city === "string" && row.city.trim() ? row.city.trim() : null,
    province: provinceCode(typeof row.province === "string" ? row.province : null),
    fsa: fsaOf(typeof source.postalCode === "string" ? source.postalCode : null),
    units: inputs.units,
    price,
    inputs,
    defaults,
    edited,
    monthlyRent: rent,
    capRate: result.capRate,
    cashOnCash: result.cashOnCashReturn,
    dscr: result.dscr,
    monthlyCashFlow: result.monthlyCashFlow,
    irr: result.irr,
    quality: quality.score,
    eligible: quality.eligible,
    engineVersion: `${INVESTMENT_METRIC_DEFAULTS.CALCULATION_VERSION}+legacy`,
    createdAt: isNaN(created.getTime()) ? new Date() : created,
  };
}
