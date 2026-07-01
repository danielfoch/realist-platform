/**
 * Minor-variance risk read for a build configuration (v1: rules-based).
 *
 * Deliberately conservative: overlays that trigger agency review (heritage,
 * conservation authority) or an envelope breach push the rating to HIGH.
 * Phase 2+ calibrates these weights against the Committee of Adjustment
 * applications dataset (open.toronto.ca) using actual outcomes.
 */

import type { BuildConfiguration } from "./multiplexConfigs";

export type VarianceRiskLevel = "low" | "medium" | "high";

export interface VarianceFactor {
  key: string;
  weight: number;
  reason: string;
}

export interface VarianceRiskInput {
  config: Pick<BuildConfiguration, "approvalPath" | "envelopeSlackPct" | "approvalCertainty" | "units">;
  heritage: boolean;
  conservationRegulated: boolean;
  cityTreeConflict: boolean;
  narrowLot: boolean;
}

export interface VarianceRiskResult {
  level: VarianceRiskLevel;
  score: number;
  factors: VarianceFactor[];
}

export function assessVarianceRisk(input: VarianceRiskInput): VarianceRiskResult {
  const factors: VarianceFactor[] = [];
  const { config } = input;

  if (config.approvalPath === "rezoning") {
    factors.push({ key: "rezoning", weight: 100, reason: "Proposal exceeds as-of-right permissions far enough to need a rezoning — outcome and timeline are uncertain." });
  } else if (config.approvalPath === "minor_variance") {
    factors.push({ key: "variance_needed", weight: 60, reason: "Proposal exceeds an as-of-right standard — Committee of Adjustment approval required." });
  }

  if (config.envelopeSlackPct >= 0 && config.envelopeSlackPct < 0.1) {
    factors.push({ key: "tight_envelope", weight: 25, reason: `Massing uses ${Math.round((1 - config.envelopeSlackPct) * 100)}% of the practical envelope — small design changes could tip into variance territory.` });
  }
  if (config.envelopeSlackPct < 0) {
    factors.push({ key: "envelope_breach", weight: 60, reason: "Proposed GFA exceeds the by-law envelope." });
  }

  if (input.heritage) {
    factors.push({ key: "heritage", weight: 50, reason: "Heritage-listed/designated property — alterations and additions face Heritage Preservation Services review." });
  }
  if (input.conservationRegulated) {
    factors.push({ key: "conservation", weight: 50, reason: "Within a conservation authority regulated area — TRCA/CA permit required before building permit." });
  }
  if (input.cityTreeConflict) {
    factors.push({ key: "city_tree", weight: 20, reason: "City-owned tree near the frontage — injury/removal permit and hoarding plan add cost and schedule risk." });
  }
  if (input.narrowLot) {
    factors.push({ key: "narrow_lot", weight: 20, reason: "Narrow lot — side-yard and landscaping standards are harder to meet without relief." });
  }
  if (config.units > 4 && config.approvalCertainty === "inferred") {
    factors.push({ key: "sixplex_unverified", weight: 15, reason: "5-6 unit permission inferred from location, not ward-verified." });
  }

  const score = factors.reduce((s, f) => s + f.weight, 0);
  const level: VarianceRiskLevel = score >= 50 ? "high" : score >= 20 ? "medium" : "low";
  return { level, score, factors };
}
