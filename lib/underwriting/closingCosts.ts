/**
 * What it costs to close, by province: the land transfer tax (or its local
 * equivalent) plus the fixed costs every purchase carries. A flat percentage is
 * badly wrong in both directions — Toronto charges the Ontario tax twice, and
 * Alberta charges almost nothing — and cash-on-cash is only as honest as the
 * cash it divides by.
 *
 * Brackets are the standard purchaser rates (no first-time-buyer rebates, no
 * non-resident surcharges: an investor gets neither). An estimate the person
 * can overwrite, and the underwriter says so.
 */

import { provinceCode } from "@/lib/leads/routing";

/** Legal fees and disbursements, title insurance, inspection, appraisal. */
export const FIXED_CLOSING_COSTS = 2_500;

type Bracket = [upTo: number, rate: number];

function marginal(price: number, brackets: Bracket[]): number {
  let tax = 0;
  let floor = 0;
  for (const [upTo, rate] of brackets) {
    if (price <= floor) break;
    tax += (Math.min(price, upTo) - floor) * rate;
    floor = upTo;
  }
  return tax;
}

const ONTARIO: Bracket[] = [[55_000, 0.005], [250_000, 0.01], [400_000, 0.015], [2_000_000, 0.02], [Infinity, 0.025]];
// Toronto's municipal tax mirrors Ontario's to $2M, then climbs through its luxury tiers.
const TORONTO: Bracket[] = [[55_000, 0.005], [250_000, 0.01], [400_000, 0.015], [2_000_000, 0.02], [3_000_000, 0.025], [4_000_000, 0.035], [5_000_000, 0.045], [10_000_000, 0.055], [20_000_000, 0.065], [Infinity, 0.075]];
const BRITISH_COLUMBIA: Bracket[] = [[200_000, 0.01], [2_000_000, 0.02], [3_000_000, 0.03], [Infinity, 0.05]];
const MANITOBA: Bracket[] = [[30_000, 0], [90_000, 0.005], [150_000, 0.01], [200_000, 0.015], [Infinity, 0.02]];
const QUEBEC: Bracket[] = [[61_500, 0.005], [307_800, 0.01], [Infinity, 0.015]];
const MONTREAL: Bracket[] = [[61_500, 0.005], [307_800, 0.01], [552_300, 0.015], [1_104_700, 0.02], [2_136_500, 0.025], [3_113_000, 0.035], [Infinity, 0.04]];

const TORONTO_NAMES = new Set(["toronto", "etobicoke", "scarborough", "north york", "york", "east york"]);
const MONTREAL_NAMES = new Set(["montreal", "montréal"]);

export function landTransferTax(price: number, province: string | null | undefined, city?: string | null): number {
  if (!(price > 0)) return 0;
  const where = (city ?? "").trim().toLowerCase();
  switch (provinceCode(province)) {
    case "ON":
      return marginal(price, ONTARIO) + (TORONTO_NAMES.has(where) ? marginal(price, TORONTO) : 0);
    case "BC":
      return marginal(price, BRITISH_COLUMBIA);
    case "QC":
      return marginal(price, MONTREAL_NAMES.has(where) ? MONTREAL : QUEBEC);
    case "MB":
      return marginal(price, MANITOBA);
    case "NB":
      return price * 0.01;
    case "PE":
      return price * 0.01;
    case "NS":
      // Set by each municipality, 0.5%–1.5%; Halifax is at the top of the range.
      return price * (where === "halifax" || where === "dartmouth" ? 0.015 : 0.0125);
    case "NL":
      return 100 + Math.max(0, price - 500) * 0.004;
    case "SK":
      return Math.max(0, price - 6_300) * 0.004;
    case "AB":
      // No transfer tax: a land-title registration fee.
      return 50 + Math.ceil(price / 5_000) * 5;
    case "YT":
    case "NT":
    case "NU":
      return price * 0.0015;
    default:
      return price * 0.015;
  }
}

/** Dollars to close. Without a province we fall back to the engine's flat rate rather than guess a jurisdiction. */
export function estimateClosingCosts(price: number, province: string | null | undefined, city?: string | null, flatRatePercent = 2): number {
  if (!(price > 0)) return 0;
  if (!provinceCode(province)) return Math.round(price * (flatRatePercent / 100));
  return Math.round(landTransferTax(price, province, city) + FIXED_CLOSING_COSTS);
}

/** "Ontario + Toronto land transfer tax, plus about $2,500 in legal and inspection." */
export function closingCostsNote(province: string | null | undefined, city?: string | null): string {
  const code = provinceCode(province);
  if (!code) return "Land transfer tax, legal, inspection — estimated at 2% until you pick a province.";
  const where = (city ?? "").trim().toLowerCase();
  const tax =
    code === "ON" ? (TORONTO_NAMES.has(where) ? "Ontario + Toronto land transfer tax" : "Ontario land transfer tax")
    : code === "BC" ? "B.C. property transfer tax"
    : code === "QC" ? (MONTREAL_NAMES.has(where) ? "Montréal welcome tax" : "Québec welcome tax")
    : code === "AB" || code === "SK" ? "Land title fees (no transfer tax here)"
    : "Land transfer tax";
  return `${tax}, plus about $${FIXED_CLOSING_COSTS.toLocaleString("en-CA")} in legal and inspection.`;
}
