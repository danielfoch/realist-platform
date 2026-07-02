/**
 * Toronto multiplex buildable-envelope engine (pure, unit-tested).
 *
 * Computes the plausible GFA range for a multiplex on a Toronto residential
 * lot from the By-law 569-2013 multiplex standards (as amended by the 2023
 * multiplex by-law and By-law 654-2025 for five/sixplexes):
 *   - FSI does NOT apply to multiplexes — the envelope is the physical box:
 *     height x lot coverage x setbacks.
 *   - Height: 10m (~3 storeys) citywide; 12m (~4 storeys) in sixplex areas.
 *   - Setbacks: rear 7.5m; sides 0.9m (1.5m for 5+ unit buildings); front is
 *     contextual (average of adjacent) — modelled as an assumption.
 *
 * Inputs are in feet (platform convention); by-law constants are metric and
 * converted internally. Every output carries Provenance.
 */

import {
  type ApprovalPath,
  type Provenance,
  type RiskFlag,
  feetToMetres,
  metresToFeet,
  prov,
} from "./multiplexTypes";

// ─── By-law constants (source-tagged; update lastVerified when re-checked) ──

export const TORONTO_ENVELOPE_RULES = {
  source: "Toronto Zoning By-law 569-2013 multiplex standards (2023 amendment; By-law 654-2025 for 5-6 units)",
  lastVerified: "2026-07",
  maxHeightM: 10,
  maxHeightSixplexM: 12,
  maxStoreys: 3,
  maxStoreysSixplex: 4,
  rearSetbackM: 7.5,
  sideSetbackM: 0.9,
  sideSetbackFivePlusM: 1.5,
  /** Front setback is contextual (average of adjacent buildings); typical Toronto residential ~6m. */
  defaultFrontSetbackM: 6.0,
  /** Typical principal-building lot coverage in Toronto residential zones. */
  defaultLotCoverage: 0.35,
} as const;

/**
 * Haircut from theoretical box to practically buildable GFA: stairs/corridors
 * on small plates, angular-plane and daylighting compromises, mechanical,
 * as-built inefficiencies. Matches the server feasibility engine's 22%.
 */
export const PRACTICAL_GFA_HAIRCUT = 0.22;
export const HERITAGE_HAIRCUT = 0.15;
export const CONSERVATION_HAIRCUT = 0.2;
/** Lots narrower than 25 ft build inefficient plates. */
export const NARROW_LOT_THRESHOLD_FT = 25;
export const NARROW_LOT_HAIRCUT = 0.1;

// ─── Interface ───────────────────────────────────────────────────────────────

export interface EnvelopeInput {
  lotFrontageFt: number;
  lotDepthFt: number;
  /** Direct lot area override (sqft); otherwise frontage x depth. */
  lotAreaSqft?: number;
  /** Five/sixplex geography per By-law 654-2025 (ward-verified or inferred). */
  sixplexEligible: boolean;
  /** Building 5+ units? Wider side setbacks apply. */
  fivePlusUnits?: boolean;
  heritage?: boolean;
  conservationConstraint?: boolean;
  /** Overrides (admin/user assumptions). */
  lotCoverage?: number;
  frontSetbackM?: number;
}

export interface EnvelopeResult {
  lotAreaSqft: Provenance<number>;
  /** Setback-derived buildable plate dimensions. */
  buildableWidthFt: Provenance<number>;
  buildableDepthFt: Provenance<number>;
  /** Footprint = min(coverage x lot area, buildable plate). */
  footprintSqft: Provenance<number>;
  footprintBasis: "coverage" | "setbacks";
  storeys: Provenance<number>;
  maxHeightM: Provenance<number>;
  theoreticalGfaSqft: Provenance<number>;
  practicalGfaSqft: Provenance<number>;
  haircutsApplied: Array<{ key: string; pct: number; reason: string }>;
  flags: RiskFlag[];
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export function computeEnvelope(input: EnvelopeInput): EnvelopeResult {
  const flags: RiskFlag[] = [];
  const rules = TORONTO_ENVELOPE_RULES;

  const frontage = Math.max(0, input.lotFrontageFt);
  const depth = Math.max(0, input.lotDepthFt);
  const lotArea = input.lotAreaSqft && input.lotAreaSqft > 0
    ? input.lotAreaSqft
    : frontage * depth;

  const lotAreaProv = prov(
    Math.round(lotArea),
    input.lotAreaSqft ? "user-provided lot area" : "frontage x depth",
    input.lotAreaSqft ? "assumption" : "inferred",
  );

  // Setback plate (metric rules, imperial result)
  const sideM = input.fivePlusUnits ? rules.sideSetbackFivePlusM : rules.sideSetbackM;
  const frontM = input.frontSetbackM ?? rules.defaultFrontSetbackM;
  const buildableWidthFt = Math.max(0, frontage - 2 * metresToFeet(sideM));
  const buildableDepthFt = Math.max(0, depth - metresToFeet(frontM) - metresToFeet(rules.rearSetbackM));
  const plateSqft = buildableWidthFt * buildableDepthFt;

  // Coverage cap
  const coverage = input.lotCoverage ?? rules.defaultLotCoverage;
  const coverageSqft = lotArea * coverage;

  const footprint = Math.min(plateSqft, coverageSqft);
  const footprintBasis: EnvelopeResult["footprintBasis"] =
    plateSqft <= coverageSqft ? "setbacks" : "coverage";

  const storeys = input.sixplexEligible ? rules.maxStoreysSixplex : rules.maxStoreys;
  const heightM = input.sixplexEligible ? rules.maxHeightSixplexM : rules.maxHeightM;

  const theoretical = footprint * storeys;

  // Haircuts, applied multiplicatively
  const haircuts: EnvelopeResult["haircutsApplied"] = [
    { key: "practical", pct: PRACTICAL_GFA_HAIRCUT, reason: "circulation, mechanical, plate inefficiency" },
  ];
  if (input.heritage) {
    haircuts.push({ key: "heritage", pct: HERITAGE_HAIRCUT, reason: "heritage massing/alteration constraints" });
    flags.push({ key: "heritage", severity: "high", message: "Heritage constraint reduces plausible massing and adds approval risk." });
  }
  if (input.conservationConstraint) {
    haircuts.push({ key: "conservation", pct: CONSERVATION_HAIRCUT, reason: "conservation authority setback/regrading limits" });
    flags.push({ key: "conservation", severity: "high", message: "Conservation authority regulation limits site coverage and grading." });
  }
  if (frontage > 0 && frontage < NARROW_LOT_THRESHOLD_FT) {
    haircuts.push({ key: "narrow_lot", pct: NARROW_LOT_HAIRCUT, reason: `frontage under ${NARROW_LOT_THRESHOLD_FT} ft builds an inefficient plate` });
    flags.push({ key: "narrow_lot", severity: "caution", message: `Narrow frontage (${frontage} ft) constrains unit layouts and may need side-yard variances.` });
  }

  const practical = haircuts.reduce((gfa, h) => gfa * (1 - h.pct), theoretical);

  if (buildableWidthFt <= 0 || buildableDepthFt <= 0) {
    flags.push({ key: "no_buildable_plate", severity: "high", message: "Setbacks consume the entire lot — the by-law envelope leaves no buildable plate. Any build requires variances." });
  }

  const envelopeSource = `${rules.source} (verified ${rules.lastVerified})`;

  return {
    lotAreaSqft: lotAreaProv,
    buildableWidthFt: prov(round1(buildableWidthFt), `frontage − 2 × ${sideM}m side setback`, "inferred"),
    buildableDepthFt: prov(round1(buildableDepthFt), `depth − ${frontM}m front − ${rules.rearSetbackM}m rear setback`, input.frontSetbackM ? "assumption" : "inferred"),
    footprintSqft: prov(Math.round(footprint), footprintBasis === "coverage" ? `${Math.round(coverage * 100)}% lot coverage` : "setback plate", "inferred"),
    footprintBasis,
    storeys: prov(storeys, envelopeSource, input.sixplexEligible ? "inferred" : "verified"),
    maxHeightM: prov(heightM, envelopeSource, input.sixplexEligible ? "inferred" : "verified"),
    theoreticalGfaSqft: prov(Math.round(theoretical), "footprint × storeys", "inferred"),
    practicalGfaSqft: prov(Math.round(practical), `theoretical − ${haircuts.map((h) => `${Math.round(h.pct * 100)}% ${h.key}`).join(" − ")}`, "estimate"),
    haircutsApplied: haircuts,
    flags,
  };
}

/**
 * Approval-path read for a proposed GFA/unit count against the envelope.
 * "Slack" is how much of the practical envelope the proposal leaves unused.
 */
export function assessEnvelopeFit(params: {
  proposedGfaSqft: number;
  envelope: EnvelopeResult;
  proposedUnits: number;
  maxUnitsAsOfRight: number;
}): { path: ApprovalPath; slackPct: number; reasons: string[] } {
  const { proposedGfaSqft, envelope, proposedUnits, maxUnitsAsOfRight } = params;
  const practical = envelope.practicalGfaSqft.value;
  const reasons: string[] = [];

  if (proposedUnits > maxUnitsAsOfRight) {
    reasons.push(`${proposedUnits} units exceeds the ${maxUnitsAsOfRight}-unit as-of-right maximum`);
  }
  const slackPct = practical > 0 ? (practical - proposedGfaSqft) / practical : -1;
  if (slackPct < 0) {
    reasons.push("proposed GFA exceeds the practical envelope");
  } else if (slackPct < 0.1) {
    reasons.push("proposed GFA uses >90% of the practical envelope — tight massing");
  }

  let path: ApprovalPath;
  if (proposedUnits > maxUnitsAsOfRight + 2) {
    path = "rezoning";
  } else if (proposedUnits > maxUnitsAsOfRight || slackPct < 0) {
    path = "minor_variance";
  } else {
    path = "as_of_right";
  }
  return { path, slackPct: round3(slackPct), reasons };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
