export const HST_RATE = 0.13;
export const FULL_RELIEF_MAX_PRICE = 1000000;
export const MAX_REBATE_PRICE_CAP = 1500000;
export const TAPER_END_PRICE = 1850000;
export const MAX_REBATE = 130000;
export const FLOOR_REBATE = 24000;

export type PriceMode = "includes_hst" | "excludes_hst";
export type RebateCollector = "buyer" | "builder";
export type PolicyBand =
  | "Full 13% HST relief band"
  | "Max rebate band"
  | "Tapered rebate band"
  | "Floor rebate band";

export interface HstRebateResult {
  enteredPrice: number;
  priceMode: PriceMode;
  fullPrice: number;
  basePrice: number;
  estimatedHst: number;
  rebate: number;
  effectivePurchaserPrice: number;
  policyBand: PolicyBand;
}

// Policy assumptions are based on the public March 30, 2026 announcement.
// Keep these thresholds centralized because final legislation and CRA/Ontario
// implementation guidance may alter eligibility, tapering, or process details.
export function calculateRebate(basePrice: number) {
  if (basePrice <= FULL_RELIEF_MAX_PRICE) return basePrice * HST_RATE;
  if (basePrice <= MAX_REBATE_PRICE_CAP) return MAX_REBATE;
  if (basePrice < TAPER_END_PRICE) {
    const ratio =
      (basePrice - MAX_REBATE_PRICE_CAP) /
      (TAPER_END_PRICE - MAX_REBATE_PRICE_CAP);
    return MAX_REBATE - ratio * (MAX_REBATE - FLOOR_REBATE);
  }
  return FLOOR_REBATE;
}

export function getPolicyBand(basePrice: number): PolicyBand {
  if (basePrice <= FULL_RELIEF_MAX_PRICE) return "Full 13% HST relief band";
  if (basePrice <= MAX_REBATE_PRICE_CAP) return "Max rebate band";
  if (basePrice < TAPER_END_PRICE) return "Tapered rebate band";
  return "Floor rebate band";
}

export function calculateHstRebate(
  enteredPrice: number,
  priceMode: PriceMode,
): HstRebateResult {
  const safePrice = Number.isFinite(enteredPrice) ? Math.max(enteredPrice, 0) : 0;
  const basePrice =
    priceMode === "includes_hst" ? safePrice / (1 + HST_RATE) : safePrice;
  const estimatedHst =
    priceMode === "includes_hst" ? safePrice - basePrice : basePrice * HST_RATE;
  const fullPrice = priceMode === "includes_hst" ? safePrice : basePrice + estimatedHst;
  const rebate = calculateRebate(basePrice);

  return {
    enteredPrice: safePrice,
    priceMode,
    fullPrice,
    basePrice,
    estimatedHst,
    rebate,
    effectivePurchaserPrice: fullPrice - rebate,
    policyBand: getPolicyBand(basePrice),
  };
}

export function formatCad(value: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}
