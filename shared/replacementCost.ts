export const REPLACEMENT_COST_AS_OF_YEAR = 2026;

export const REPLACEMENT_COST_ECONOMIC_LIFE_YEARS = 100;
export const REPLACEMENT_COST_MAX_DEPRECIATION = 0.8;

export type ReplacementCostPropertyClass =
  | "detached"
  | "attached"
  | "multi_residential"
  | "condo_apartment"
  | "other_residential";

interface CostPerSquareFootAssumption {
  label: string;
  low: number;
  high: number;
}

/**
 * 2026 Canadian hard-cost screening assumptions in CAD per square foot.
 *
 * The ranges start with the product's Altus/CHBA-backed 2024-2025
 * construction-cost bands and are rounded after applying the 2.8% Q1 2026
 * annual increase reported by Statistics Canada's residential Building
 * Construction Price Index. They are deliberately broad because location,
 * finish, site conditions, code requirements, and building form vary.
 */
export const REPLACEMENT_COST_PER_SQFT: Record<
  ReplacementCostPropertyClass,
  CostPerSquareFootAssumption
> = {
  detached: { label: "detached", low: 290, high: 465 },
  attached: { label: "attached/townhouse", low: 255, high: 410 },
  multi_residential: { label: "multi-residential", low: 310, high: 515 },
  condo_apartment: { label: "condo/apartment", low: 310, high: 515 },
  other_residential: { label: "residential", low: 290, high: 465 },
};

export interface ReplacementCostEstimate {
  squareFootage: number | null;
  yearBuilt: number | null;
  buildingAge: number | null;
  propertyClass: ReplacementCostPropertyClass;
  propertyClassLabel: string;
  costPerSqft: number;
  costPerSqftLow: number;
  costPerSqftHigh: number;
  replacementCost: number | null;
  replacementCostLow: number | null;
  replacementCostHigh: number | null;
  depreciationRate: number | null;
  depreciatedReplacementCost: number | null;
  depreciatedReplacementCostLow: number | null;
  depreciatedReplacementCostHigh: number | null;
}

const MIN_PLAUSIBLE_SQFT = 150;
const MAX_PLAUSIBLE_SQFT = 100_000;

function isPlausibleSqft(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_PLAUSIBLE_SQFT && value <= MAX_PLAUSIBLE_SQFT;
}

export function parseReplacementCostSqft(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return isPlausibleSqft(value) ? Math.round(value) : null;
  }
  if (!value) return null;

  const normalized = value.toLowerCase().replace(/,/g, "");
  const candidates = Array.from(normalized.matchAll(/\d+(?:\.\d+)?/g))
    .map((match) => Number(match[0]))
    .filter(isPlausibleSqft);

  if (candidates.length === 0) return null;

  const isRange = /(?:-|–|—|\bto\b)/i.test(normalized);
  if (isRange && candidates.length >= 2) {
    return Math.round((candidates[0] + candidates[1]) / 2);
  }

  return Math.round(candidates[0]);
}

export function parseReplacementCostYear(
  value: string | number | null | undefined,
  asOfYear = REPLACEMENT_COST_AS_OF_YEAR,
): number | null {
  if (typeof value === "number") {
    const year = Math.round(value);
    return year >= 1700 && year <= asOfYear + 1 ? year : null;
  }
  if (!value) return null;

  const years = Array.from(value.matchAll(/\b(?:17|18|19|20)\d{2}\b/g))
    .map((match) => Number(match[0]))
    .filter((year) => year >= 1700 && year <= asOfYear + 1);

  if (years.length === 0) return null;
  if (years.length >= 2 && /(?:-|–|—|\bto\b)/i.test(value)) {
    return Math.round((years[0] + years[1]) / 2);
  }
  return years[0];
}

export function classifyReplacementCostProperty(
  propertyType: string | null | undefined,
): ReplacementCostPropertyClass {
  const normalized = (propertyType || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  if (/\b(condo|condominium|apartment|high rise|low rise|loft)\b/.test(normalized)) {
    return "condo_apartment";
  }
  if (/\b(duplex|triplex|fourplex|multiplex|multi family|multi residential|plex)\b/.test(normalized)) {
    return "multi_residential";
  }
  if (/\b(townhouse|townhome|row house|row townhouse|semi detached|linked|attached)\b/.test(normalized)) {
    return "attached";
  }
  if (/\b(detached|single family|house|bungalow|two storey|2 storey|split level)\b/.test(normalized)) {
    return "detached";
  }
  return "other_residential";
}

function roundScreeningValue(value: number): number {
  return Math.round(value / 5_000) * 5_000;
}

export function estimateReplacementCost(input: {
  squareFootage?: string | number | null;
  yearBuilt?: string | number | null;
  propertyType?: string | null;
  asOfYear?: number;
}): ReplacementCostEstimate {
  const asOfYear = input.asOfYear ?? REPLACEMENT_COST_AS_OF_YEAR;
  const squareFootage = parseReplacementCostSqft(input.squareFootage);
  const yearBuilt = parseReplacementCostYear(input.yearBuilt, asOfYear);
  const propertyClass = classifyReplacementCostProperty(input.propertyType);
  const assumption = REPLACEMENT_COST_PER_SQFT[propertyClass];
  const costPerSqft = Math.round((assumption.low + assumption.high) / 2);

  const replacementCostLow = squareFootage == null
    ? null
    : roundScreeningValue(squareFootage * assumption.low);
  const replacementCostHigh = squareFootage == null
    ? null
    : roundScreeningValue(squareFootage * assumption.high);
  const replacementCost = squareFootage == null
    ? null
    : roundScreeningValue(squareFootage * costPerSqft);

  const buildingAge = yearBuilt == null ? null : Math.max(0, asOfYear - yearBuilt);
  const depreciationRate = buildingAge == null
    ? null
    : Math.min(buildingAge / REPLACEMENT_COST_ECONOMIC_LIFE_YEARS, REPLACEMENT_COST_MAX_DEPRECIATION);
  const remainingValueFactor = depreciationRate == null ? null : 1 - depreciationRate;

  return {
    squareFootage,
    yearBuilt,
    buildingAge,
    propertyClass,
    propertyClassLabel: assumption.label,
    costPerSqft,
    costPerSqftLow: assumption.low,
    costPerSqftHigh: assumption.high,
    replacementCost,
    replacementCostLow,
    replacementCostHigh,
    depreciationRate,
    depreciatedReplacementCost: replacementCost == null || remainingValueFactor == null
      ? null
      : roundScreeningValue(replacementCost * remainingValueFactor),
    depreciatedReplacementCostLow: replacementCostLow == null || remainingValueFactor == null
      ? null
      : roundScreeningValue(replacementCostLow * remainingValueFactor),
    depreciatedReplacementCostHigh: replacementCostHigh == null || remainingValueFactor == null
      ? null
      : roundScreeningValue(replacementCostHigh * remainingValueFactor),
  };
}
