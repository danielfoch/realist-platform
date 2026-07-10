/**
 * Realist.ca — Small-multiplex operating-cost engine (Toronto).
 *
 * Replaces the pro forma's opaque flat "28% of EGI" with a transparent, sourced,
 * itemised annual operating budget. The point is not more precision for its own
 * sake — it's that a flat ratio misfires on high-value / lower-rent deals, where
 * PROPERTY TAX alone can be 15%+ of EGI. Itemising surfaces what actually drives
 * the number.
 *
 * Toronto specifics (verified 2026-07-09):
 *   • Residential property-tax rate 0.767311% (City 0.605295 + Education 0.153000
 *     + City Building Fund 0.009016). A multiplex of ≤6 self-contained units is
 *     RESIDENTIAL class; 7+ units flips to MULTI-RESIDENTIAL (legacy rate
 *     1.208792%, though newly-built rental gets the "New Multi-Residential"
 *     rate = the residential 0.767311%).
 *   • MPAC assessments are frozen at the Jan 1 2016 valuation date; a new build's
 *     supplementary/omitted assessment is set at 2016-equivalent value, NOT
 *     current cost/market — so tax is estimated off a 2016-base proxy, not the
 *     $-of-today cost, and flagged as needing confirmation.
 *
 * Pure logic; no data import.
 */

export interface OpexSource {
  name: string;
  url: string;
}

// ─── Toronto 2026 constants (verified 2026-07-09) ────────────────────────────

/** Residential total property-tax rate (≤6 units), fraction of assessed value. */
export const TORONTO_RESIDENTIAL_TAX_RATE = 0.00767311;
/** Multi-residential total rate (7+ units, legacy class). */
export const TORONTO_MULTIRES_TAX_RATE = 0.01208792;
/** Newly-built rental of 7+ units is taxed in the New Multi-Residential class = residential rate. */
export const TORONTO_NEW_MULTIRES_TAX_RATE = 0.00767311;
/** ≥ this many self-contained units → multi-residential class. */
export const MULTI_RES_UNIT_THRESHOLD = 7;

/**
 * MPAC's Jan-1-2016 assessed value for a NEW Toronto build, as a fraction of its
 * current all-in cost/market value. Toronto values roughly doubled 2016→2026, so
 * the 2016-equivalent assessment of a just-built property is well below its cost.
 * A documented, overridable screening estimate — the single biggest lever on the
 * property-tax line, so it is surfaced and flagged, not buried.
 */
export const MPAC_2016_BASE_RATIO = 0.6;

const INSURANCE_PER_UNIT = 650;      // 2-4 unit landlord policy midpoint; 4+ = commercial (higher)
const RESERVE_PER_UNIT = 250;        // capital/replacement reserve, newer build (lender minimum)
const UTILITIES_PER_UNIT = 300;      // landlord-paid common-area utilities
const MAINTENANCE_PCT_OF_GPR = 0.08; // routine R&M, lower end (10-15% range) for newer stock
const MANAGEMENT_PCT_OF_EGI = 0.08;  // Toronto small-multi (6-10% range)

const SOURCES: OpexSource[] = [
  { name: "City of Toronto 2026 Property Tax Rates (residential 0.767311%, multi-residential 1.208792%)", url: "https://www.toronto.ca/services-payments/property-taxes-utilities/property-tax/property-tax-rates-and-fees/" },
  { name: "MPAC — property classes (≤6 units residential; 7+ multi-residential) + Jan-1-2016 valuation basis / supplementary assessment", url: "https://www.mpac.ca/en/PropertyTypes/MultiResidentialPropertyAssessments" },
];

export type OpexTenure = "rental" | "ownership";

export interface OperatingCostInput {
  units: number;
  /** Annual gross potential rent (before vacancy). */
  grossPotentialRent: number;
  /** Effective gross income (after vacancy). */
  effectiveGrossIncome: number;
  /**
   * Current all-in value of the finished property (e.g. total dev cost or
   * stabilized value). Property tax is estimated from its 2016-base proxy.
   * When the true MPAC assessed value is known, pass it as `assessedValueOverride`.
   */
  currentValue: number;
  assessedValueOverride?: number;
  /** Newly built (drives the New Multi-Residential rate at 7+ units). */
  isNewBuild?: boolean;
}

export interface OperatingCostLine {
  key: "property_tax" | "insurance" | "maintenance" | "reserve" | "management" | "utilities";
  label: string;
  annual: number;
  basis: string;
}

export interface OperatingCostResult {
  lines: OperatingCostLine[];
  total: number;
  /** Total opex as a fraction of EGI — comparable to the old flat ratio. */
  totalPctOfEgi: number;
  propertyTaxClass: "residential" | "multi_residential" | "new_multi_residential";
  assessedValueUsed: number;
  notes: string[];
  sources: OpexSource[];
}

/** MPAC 2016-base assessed-value estimate for a new Toronto build. */
export function estimateTorontoAssessedValue(currentValue: number): number {
  return Math.round(currentValue * MPAC_2016_BASE_RATIO);
}

export function computeOperatingCosts(input: OperatingCostInput): OperatingCostResult {
  const units = Math.max(0, input.units);
  const gpr = Math.max(0, input.grossPotentialRent);
  const egi = Math.max(0, input.effectiveGrossIncome);

  // Property-tax class + rate.
  let rate: number;
  let propertyTaxClass: OperatingCostResult["propertyTaxClass"];
  if (units >= MULTI_RES_UNIT_THRESHOLD) {
    if (input.isNewBuild) { rate = TORONTO_NEW_MULTIRES_TAX_RATE; propertyTaxClass = "new_multi_residential"; }
    else { rate = TORONTO_MULTIRES_TAX_RATE; propertyTaxClass = "multi_residential"; }
  } else {
    rate = TORONTO_RESIDENTIAL_TAX_RATE; propertyTaxClass = "residential";
  }

  const assessedValue = input.assessedValueOverride ?? estimateTorontoAssessedValue(input.currentValue);
  const propertyTax = Math.round(assessedValue * rate);
  const insurance = Math.round(units * INSURANCE_PER_UNIT);
  const maintenance = Math.round(gpr * MAINTENANCE_PCT_OF_GPR);
  const reserve = Math.round(units * RESERVE_PER_UNIT);
  const management = Math.round(egi * MANAGEMENT_PCT_OF_EGI);
  const utilities = Math.round(units * UTILITIES_PER_UNIT);

  const lines: OperatingCostLine[] = [
    { key: "property_tax", label: "Property tax", annual: propertyTax, basis: `${(rate * 100).toFixed(4)}% (${propertyTaxClass.replace(/_/g, " ")}) × $${assessedValue.toLocaleString()} assessed` },
    { key: "insurance", label: "Insurance", annual: insurance, basis: `$${INSURANCE_PER_UNIT}/unit × ${units}` },
    { key: "maintenance", label: "Repairs & maintenance", annual: maintenance, basis: `${(MAINTENANCE_PCT_OF_GPR * 100).toFixed(0)}% of gross rent` },
    { key: "reserve", label: "Capital reserve", annual: reserve, basis: `$${RESERVE_PER_UNIT}/unit × ${units}` },
    { key: "management", label: "Management", annual: management, basis: `${(MANAGEMENT_PCT_OF_EGI * 100).toFixed(0)}% of EGI` },
    { key: "utilities", label: "Common-area utilities", annual: utilities, basis: `$${UTILITIES_PER_UNIT}/unit × ${units}` },
  ];
  const total = lines.reduce((s, l) => s + l.annual, 0);

  const notes: string[] = [
    `Property tax is class "${propertyTaxClass.replace(/_/g, " ")}" (${units <= 6 ? "≤6 units → residential" : "7+ units → multi-residential"}) at ${(rate * 100).toFixed(4)}%.`,
    input.assessedValueOverride == null
      ? `Assessed value estimated at ${Math.round(MPAC_2016_BASE_RATIO * 100)}% of current value (MPAC's Jan-1-2016 basis is well below today's cost) — confirm the actual assessment, the largest swing factor in this budget.`
      : `Assessed value provided directly.`,
    `Management assumes a third-party manager at ${(MANAGEMENT_PCT_OF_EGI * 100).toFixed(0)}% — self-managing removes this line.`,
  ];

  return {
    lines,
    total,
    totalPctOfEgi: egi > 0 ? Math.round((total / egi) * 10000) / 10000 : 0,
    propertyTaxClass,
    assessedValueUsed: assessedValue,
    notes,
    sources: SOURCES,
  };
}
