/**
 * Realist.ca — Toronto Development Charges (DC) engine.
 *
 * The cost stack previously charged a flat single-detached DC on every unit
 * above three — which overstates a small multiplex's DCs by hundreds of
 * thousands. Toronto's rules make small multiplexes nearly DC-free:
 *
 *   • City MM32.5 (adopted 2025-07-24): the 2nd–6th units in an up-to-six-unit
 *     development are reduced to $0 DCs, for building permits through
 *     2027-04-30. So a sixplex pays DC on ONE unit, not six.
 *   • Bill 23 (statutory, permanent): the 2nd + 3rd residential units on a lot
 *     (plus an ancillary/garden/laneway unit) are DC-exempt — the fallback when
 *     MM32.5 doesn't apply (>6 units, or after the window sunsets).
 *   • Community Benefits Charge applies only at 5+ storeys AND 10+ units, so a
 *     low-rise multiplex never pays it.
 *   • Bill 17 defers residential DCs to occupancy — a carry-timing effect, not
 *     an amount change (handled by the cost stack's financing carry, not here).
 *
 * Rates: Toronto DC By-law 1137-2022 schedule effective 2025-06-26 (indexing
 * removed by Council for 2025 and 2026, so these are current as of mid-2026).
 * Pure rules; verified 2026-07-09. Purpose-built rental uses the lower rental
 * schedule. Does NOT model the announced-but-not-yet-enacted 40–60% DCRP cut.
 */

export type DcTenure = "ownership" | "rental";
/** Toronto DC schedule dwelling classes relevant to multiplex units. */
export type DcDwellingClass = "apartment_2plus" | "apartment_lt2" | "multiple_2plus" | "multiple_lt2";

/** Per-unit DC ($) by class, effective 2025-06-26 (By-law 1137-2022). */
const TORONTO_DC_RATES: Record<DcTenure, Record<DcDwellingClass, number>> = {
  ownership: {
    apartment_2plus: 80690,
    apartment_lt2: 52676,
    multiple_2plus: 113938,
    multiple_lt2: 57153,
  },
  rental: {
    // Rental schedule: Apartments 2 Bed $48,299 (3+ Bed $45,280 — we use the
    // 2-Bed figure as the conservative "2+ bed" rate); 1 Bed & Bach $33,497.
    apartment_2plus: 48299,
    apartment_lt2: 33497,
    multiple_2plus: 68199,
    multiple_lt2: 36351,
  },
};

/** MM32.5 up-to-six-unit exemption sunsets for building permits after this date. */
const MM32_5_SUNSET = "2027-04-30";
/** MM32.5 exempts units 2..MAX in an up-to-six-unit development. */
const MM32_5_MAX_UNITS = 6;

export interface DcUnit {
  /** Unit bedroom class: bachelor/1br → "<2 bed"; 2br/3br → "2+ bed". */
  bedrooms: "lt2" | "2plus";
  count: number;
}

export interface DcSource {
  name: string;
  url: string;
}

const DC_SOURCES: DcSource[] = [
  { name: "City of Toronto DC By-law 1137-2022 — rate schedule effective 2025-06-26", url: "https://www.toronto.ca/city-government/budget-finances/city-finance/development-charges/development-charges-bylaws-rates/" },
  { name: "Toronto Council MM32.5 (2025-07-24) — units 2–6 in up-to-six-unit developments reduced to $0 DCs (permits through 2027-04-30)", url: "https://www.toronto.ca/legdocs/mmis/2025/mm/bgrd/backgroundfile-260000.pdf" },
  { name: "Bill 23 (More Homes Built Faster Act, 2022) — 2nd/3rd + ancillary residential units DC-exempt (DC Act s.2(3.1)–(3.3))", url: "https://www.ontario.ca/laws/statute/22m17" },
];

export interface DevelopmentChargeResult {
  /** Total DCs owed ($). */
  total: number;
  /** How many units are actually charged after exemptions. */
  chargedUnits: number;
  /** How many units are exempt. */
  exemptUnits: number;
  exemptionBasis: "toronto_multiplex_mm32_5" | "bill_23_additional_units" | "none";
  ratePerChargedUnit: number;
  tenure: DcTenure;
  notes: string[];
  sources: DcSource[];
}

/** Map a unit's bedroom class to the low-rise-multiplex DC class (apartment). */
function classFor(bedrooms: "lt2" | "2plus"): DcDwellingClass {
  // Units in a low-rise multiplex are treated as apartment-class dwellings.
  return bedrooms === "2plus" ? "apartment_2plus" : "apartment_lt2";
}

export interface DevelopmentChargeInput {
  units: DcUnit[];
  tenure?: DcTenure; // default "ownership" (higher/conservative)
  /** Assumed building-permit date (ISO). Defaults to inside the MM32.5 window. */
  permitDateISO?: string;
  /**
   * Does the lot have a pre-existing dwelling that stays (conversion) rather
   * than a full new build? Bill 23 counts existing dwellings toward the cap.
   * Only affects the messaging, not the charge, in this screening model.
   */
  existingDwelling?: boolean;
}

/**
 * Compute Toronto DCs for a multiplex, exemption-aware. Conservative where the
 * rules leave a choice: the single non-exempt unit is charged at the highest
 * applicable rate in the mix (never understates cost).
 */
export function computeTorontoDevelopmentCharges(input: DevelopmentChargeInput): DevelopmentChargeResult {
  const tenure = input.tenure ?? "ownership";
  const rates = TORONTO_DC_RATES[tenure];
  const totalUnits = input.units.reduce((s, u) => s + Math.max(0, u.count), 0);
  const notes: string[] = [];

  if (totalUnits <= 0) {
    return { total: 0, chargedUnits: 0, exemptUnits: 0, exemptionBasis: "none", ratePerChargedUnit: 0, tenure, notes: ["No units to charge."], sources: DC_SOURCES };
  }

  // Highest applicable per-unit rate present in the mix (the conservative rate
  // for the one non-exempt unit under MM32.5, or for any charged unit).
  const has2plus = input.units.some((u) => u.bedrooms === "2plus" && u.count > 0);
  const topRate = has2plus ? rates[classFor("2plus")] : rates[classFor("lt2")];

  // MM32.5: units 2–6 exempt in an up-to-six-unit development, within the window.
  const mm32InWindow = input.permitDateISO ? input.permitDateISO <= MM32_5_SUNSET : true;
  const mm32Applies = totalUnits <= MM32_5_MAX_UNITS && mm32InWindow;

  let chargedUnits: number;
  let exemptionBasis: DevelopmentChargeResult["exemptionBasis"];
  if (mm32Applies) {
    // Units 2..6 → $0; only the first unit is charged.
    chargedUnits = 1;
    exemptionBasis = "toronto_multiplex_mm32_5";
    notes.push(`Toronto MM32.5: units 2–${Math.min(totalUnits, MM32_5_MAX_UNITS)} in this up-to-six-unit development are exempt from DCs ($0). Only one unit is charged.`);
    if (!input.permitDateISO) notes.push(`MM32.5 applies to building permits through ${MM32_5_SUNSET} — confirm the permit falls in the window.`);
    if (input.existingDwelling) notes.push("With a retained existing dwelling as the base unit, the remaining added units are typically fully DC-exempt — verify with the City.");
  } else {
    // Bill 23 fallback: 2 additional units (2nd + 3rd) exempt.
    const exemptByBill23 = Math.min(2, Math.max(0, totalUnits - 1));
    chargedUnits = Math.max(0, totalUnits - exemptByBill23);
    exemptionBasis = totalUnits > 1 ? "bill_23_additional_units" : "none";
    if (totalUnits > MM32_5_MAX_UNITS) notes.push(`Development exceeds six units — Toronto's up-to-six-unit ($0) exemption does not apply; Bill 23 exempts the 2nd and 3rd units only.`);
    if (input.permitDateISO && !mm32InWindow) notes.push(`Building permit after ${MM32_5_SUNSET}: the MM32.5 multiplex exemption has sunset; Bill 23 (2nd + 3rd units) applies.`);
  }

  const total = chargedUnits * topRate;
  notes.push(`Community Benefits Charge does not apply (only at 5+ storeys and 10+ units).`);
  notes.push(`Under Bill 17, residential DCs are deferred to occupancy (interest-free) — a carry-timing benefit.`);
  if (tenure === "rental") notes.push("Purpose-built rental DC rates applied (lower than ownership).");

  return {
    total: Math.round(total),
    chargedUnits,
    exemptUnits: totalUnits - chargedUnits,
    exemptionBasis,
    ratePerChargedUnit: topRate,
    tenure,
    notes,
    sources: DC_SOURCES,
  };
}

/** Convenience: build DcUnit[] from a unit mix keyed by bedroom type. */
export function dcUnitsFromMix(mix: Array<{ type: string; count: number }>): DcUnit[] {
  const lt2 = mix.filter((m) => m.type === "bachelor" || m.type === "1br").reduce((s, m) => s + m.count, 0);
  const twoPlus = mix.filter((m) => m.type === "2br" || m.type === "3br").reduce((s, m) => s + m.count, 0);
  const out: DcUnit[] = [];
  if (lt2 > 0) out.push({ bedrooms: "lt2", count: lt2 });
  if (twoPlus > 0) out.push({ bedrooms: "2plus", count: twoPlus });
  return out;
}
