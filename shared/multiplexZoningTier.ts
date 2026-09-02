/**
 * Plain-English zoning tier for a Toronto multiplex site (pure, unit-tested).
 *
 * Toronto's upzoning has two layers a buyer needs to read at a glance:
 *   - fourplexes are as-of-right citywide (multiplex by-law, Council May 2023),
 *     with a laneway or garden suite on top where the lot qualifies -> "4+1";
 *   - six units are as-of-right only in the By-law 654-2025 wards (plus any
 *     councillor opt-ins) -> "6+1" when a rear suite also fits.
 *
 * The suite thresholds match shared/multiplexFeasibilityReport.ts
 * (laneway: lane access + depth >= 105 ft; garden: no lane, frontage >= 28 ft,
 * depth >= 125 ft) unless the caller passes explicit possibilities.
 */

export type ZoningTierCode = "6+1" | "6" | "4+1" | "4";
export type SuiteKind = "laneway" | "garden";

export interface ZoningTierInput {
  sixplexEligible: boolean;
  sixplexCertainty: "verified" | "inferred";
  wardNumber?: number | null;
  wardName?: string | null;
  laneAccess: boolean;
  lotFrontageFt: number;
  lotDepthFt: number;
  /** Override the geometric laneway test (e.g. the feasibility engine's permission flag). */
  lanewaySuitePossible?: boolean;
  /** Override the geometric garden-suite test. */
  gardenSuitePossible?: boolean;
  /** Ward numbers where six units are as-of-right; defaults to the By-law 654-2025 nine. */
  sixplexWardNumbers?: number[];
}

export interface ZoningTier {
  code: ZoningTierCode;
  principalUnits: 4 | 6;
  suite: SuiteKind | null;
  headline: string;
  basis: string[];
  certainty: "verified" | "inferred";
  /** "Ward 14 (Toronto–Danforth)" or null when the ward is unknown. */
  wardLabel: string | null;
}

export const SIXPLEX_BYLAW = "By-law 654-2025";
export const DEFAULT_SIXPLEX_WARDS = [4, 9, 10, 11, 12, 13, 14, 19, 23];

export const SUITE_THRESHOLDS = {
  lanewayMinDepthFt: 105,
  gardenMinFrontageFt: 28,
  gardenMinDepthFt: 125,
} as const;

export function wardLabelOf(wardNumber?: number | null, wardName?: string | null): string | null {
  if (wardNumber == null || !Number.isFinite(wardNumber)) return null;
  return `Ward ${wardNumber}${wardName ? ` (${wardName})` : ""}`;
}

export function suiteForLot(input: Pick<ZoningTierInput, "laneAccess" | "lotFrontageFt" | "lotDepthFt" | "lanewaySuitePossible" | "gardenSuitePossible">): SuiteKind | null {
  const { laneAccess, lotFrontageFt: f, lotDepthFt: d } = input;
  const lanewayOk = input.lanewaySuitePossible ?? true;
  const gardenOk = input.gardenSuitePossible ?? true;
  if (laneAccess && lanewayOk && d >= SUITE_THRESHOLDS.lanewayMinDepthFt) return "laneway";
  if (!laneAccess && gardenOk && f >= SUITE_THRESHOLDS.gardenMinFrontageFt && d >= SUITE_THRESHOLDS.gardenMinDepthFt) return "garden";
  return null;
}

export function deriveZoningTier(input: ZoningTierInput): ZoningTier {
  const wards = input.sixplexWardNumbers ?? DEFAULT_SIXPLEX_WARDS;
  const wardLabel = wardLabelOf(input.wardNumber, input.wardName);
  const suite = suiteForLot(input);
  const six = input.sixplexEligible;
  const principalUnits: 4 | 6 = six ? 6 : 4;
  const code: ZoningTierCode = six ? (suite ? "6+1" : "6") : suite ? "4+1" : "4";
  const certainty = six ? input.sixplexCertainty : input.wardNumber != null ? "verified" : input.sixplexCertainty;
  const verified = certainty === "verified";

  const f = Math.round(input.lotFrontageFt);
  const d = Math.round(input.lotDepthFt);

  // ── Headline ──────────────────────────────────────────────────────────────
  const siteWord = code.includes("+") ? `${code} site` : `${code}-unit site`;
  let where: string;
  if (six) {
    where = wardLabel
      ? `${wardLabel} is a ${SIXPLEX_BYLAW} sixplex ward`
      : verified
        ? `inside a ${SIXPLEX_BYLAW} sixplex ward`
        : `likely inside a ${SIXPLEX_BYLAW} sixplex ward (ward not confirmed)`;
  } else {
    where = wardLabel
      ? `${wardLabel} is outside the ${SIXPLEX_BYLAW} sixplex wards, so a fourplex is the as-of-right ceiling`
      : `no ${SIXPLEX_BYLAW} sixplex ward confirmed, so a fourplex is the as-of-right ceiling citywide`;
  }
  const suitePhrase =
    suite === "laneway" ? "a laneway suite fits" : suite === "garden" ? "a garden suite fits" : "no rear suite on this lot";
  const headline = `${verified ? "" : "Likely "}${siteWord} — ${where}; ${suitePhrase}`;

  // ── Basis ─────────────────────────────────────────────────────────────────
  const basis: string[] = [
    "Fourplexes are as-of-right citywide under Toronto's multiplex zoning (Zoning By-law 569-2013 as amended, Council May 2023) — no minimum parking.",
  ];
  if (six) {
    basis.push(
      wardLabel
        ? `Six units as-of-right in ${wardLabel} under ${SIXPLEX_BYLAW} (${verified ? "ward verified from boundary polygons" : "ward inferred — confirm before relying on it"}).`
        : `Six units as-of-right under ${SIXPLEX_BYLAW} — ${verified ? "ward verified" : "inferred from the postal area; confirm the ward"}.`,
    );
  } else {
    basis.push(
      wardLabel
        ? `${wardLabel} is not one of the ${SIXPLEX_BYLAW} wards (${wards.join(", ")}) — five or six units would need a councillor opt-in or a minor variance.`
        : `Six units are as-of-right only in the ${SIXPLEX_BYLAW} wards (${wards.join(", ")}); this site was not resolved to one of them.`,
    );
  }
  if (suite === "laneway") {
    basis.push(`Laneway suite: rear lane access and a ${d} ft lot depth clears the ${SUITE_THRESHOLDS.lanewayMinDepthFt} ft depth threshold; the suite does not count against the multiplex unit cap.`);
  } else if (suite === "garden") {
    basis.push(`Garden suite: no lane, but ${f} ft frontage (≥ ${SUITE_THRESHOLDS.gardenMinFrontageFt}) and ${d} ft depth (≥ ${SUITE_THRESHOLDS.gardenMinDepthFt}) leave room for a detached rear suite; it does not count against the unit cap.`);
  } else {
    basis.push(
      input.laneAccess
        ? `No laneway suite: ${d} ft depth is under the ${SUITE_THRESHOLDS.lanewayMinDepthFt} ft the concept engine needs behind the main building.`
        : `No garden suite: needs ≥ ${SUITE_THRESHOLDS.gardenMinFrontageFt} ft frontage and ≥ ${SUITE_THRESHOLDS.gardenMinDepthFt} ft depth without a lane (this lot is ${f} x ${d} ft).`,
    );
  }

  return { code, principalUnits, suite, headline, basis, certainty, wardLabel };
}
