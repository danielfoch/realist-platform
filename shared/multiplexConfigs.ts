/**
 * Build-configuration generator for Toronto multiplex sites (pure).
 *
 * Given an envelope and permissions, emits 2-4 plausible configurations:
 *   A. 4-plex (citywide as-of-right ceiling)
 *   B. 5-6-plex where By-law 654-2025 geography allows
 *   C. best-of-A/B plus a laneway or garden suite where the lot qualifies
 *   D. a "stretch" scenario one step past as-of-right (variance required)
 *
 * Unit mix packing is deterministic: family-friendly bias (2BR-led), greedy
 * fill against net GFA (practical GFA x net-to-gross efficiency).
 */

import {
  type ApprovalPath,
  type Provenance,
  type RiskFlag,
  type UnitMixEntry,
  type UnitType,
  prov,
} from "./multiplexTypes";
import { assessEnvelopeFit, type EnvelopeResult } from "./multiplexEnvelope";

// ─── Defaults (admin-overridable via multiplex_assumptions) ─────────────────

export const UNIT_SIZE_DEFAULTS: Record<UnitType, number> = {
  bachelor: 450,
  "1br": 550,
  "2br": 750,
  "3br": 950,
};

/** Share of gross GFA that becomes net rentable/saleable area. */
export const NET_TO_GROSS_DEFAULT = 0.85;

/** Laneway/garden suite typical build (Toronto by-law caps ~1,290 sqft over 2 storeys). */
export const SUITE_GFA_SQFT = 1000;
export const SUITE_UNIT_TYPE: UnitType = "2br";

// ─── Interface ───────────────────────────────────────────────────────────────

export interface ConfigInput {
  envelope: EnvelopeResult;
  /** As-of-right unit ceiling for this site (4 citywide; 6 in sixplex wards). */
  maxUnitsAsOfRight: number;
  /** Sixplex geography certainty — configs above 4 units inherit it. */
  sixplexCertainty: "verified" | "inferred";
  lanewayEligible: boolean;
  gardenSuiteEligible: boolean;
  unitSizes?: Record<UnitType, number>;
  netToGross?: number;
}

export interface BuildConfiguration {
  key: string;
  label: string;
  units: number;
  unitMix: UnitMixEntry[];
  /** Gross floor area consumed by the main building (excl. suite). */
  grossGfaSqft: number;
  netSqft: number;
  includesSuite: boolean;
  suiteGfaSqft: number;
  /** By-law: no minimum parking for multiplexes. */
  parkingRequired: 0;
  parkingProvided: number;
  approvalPath: ApprovalPath;
  approvalCertainty: "verified" | "inferred";
  envelopeSlackPct: number;
  constraints: string[];
  flags: RiskFlag[];
}

// ─── Mix packing ─────────────────────────────────────────────────────────────

/**
 * Deterministic family-friendly mix for a unit count: lead with 2BRs, one 3BR
 * once the building has 4+ units, 1BRs fill the balance.
 */
export function packUnitMix(
  units: number,
  netBudgetSqft: number,
  sizes: Record<UnitType, number> = UNIT_SIZE_DEFAULTS,
): UnitMixEntry[] | null {
  if (units <= 0) return null;
  const threeBr = units >= 4 ? 1 : 0;
  let twoBr = Math.ceil((units - threeBr) / 2);
  let oneBr = units - threeBr - twoBr;

  const sqftOf = (o: number, t: number, th: number) =>
    o * sizes["1br"] + t * sizes["2br"] + th * sizes["3br"];

  // Downshift 2BR -> 1BR until the mix fits the net budget.
  while (sqftOf(oneBr, twoBr, threeBr) > netBudgetSqft && twoBr > 0) {
    twoBr--;
    oneBr++;
  }
  if (sqftOf(oneBr, twoBr, threeBr) > netBudgetSqft) return null;

  const mix: UnitMixEntry[] = [];
  if (oneBr > 0) mix.push({ type: "1br", count: oneBr, netSqftEach: sizes["1br"] });
  if (twoBr > 0) mix.push({ type: "2br", count: twoBr, netSqftEach: sizes["2br"] });
  if (threeBr > 0) mix.push({ type: "3br", count: threeBr, netSqftEach: sizes["3br"] });
  return mix;
}

export function mixNetSqft(mix: UnitMixEntry[]): number {
  return mix.reduce((s, e) => s + e.count * e.netSqftEach, 0);
}

// ─── Generator ───────────────────────────────────────────────────────────────

export function generateConfigurations(input: ConfigInput): BuildConfiguration[] {
  const sizes = input.unitSizes ?? UNIT_SIZE_DEFAULTS;
  const ntg = input.netToGross ?? NET_TO_GROSS_DEFAULT;
  const practical = input.envelope.practicalGfaSqft.value;
  const netBudget = practical * ntg;
  const configs: BuildConfiguration[] = [];

  const build = (
    key: string,
    label: string,
    units: number,
    opts: { suite?: boolean } = {},
  ): BuildConfiguration | null => {
    const mix = packUnitMix(units, netBudget, sizes);
    if (!mix) return null;
    const net = mixNetSqft(mix);
    const gross = Math.round(net / ntg);
    const suite = opts.suite ? SUITE_GFA_SQFT : 0;
    const totalUnits = units + (opts.suite ? 1 : 0);

    const fit = assessEnvelopeFit({
      proposedGfaSqft: gross,
      envelope: input.envelope,
      // Laneway/garden suites don't count against the multiplex unit maximum.
      proposedUnits: units,
      maxUnitsAsOfRight: input.maxUnitsAsOfRight,
    });

    const constraints = [...fit.reasons];
    const flags: RiskFlag[] = [];
    if (units > 4 && input.sixplexCertainty === "inferred") {
      constraints.push("5-6 unit permission inferred from location — verify the ward against By-law 654-2025");
      flags.push({ key: "sixplex_unverified", severity: "caution", message: "Sixplex geography is inferred, not ward-verified." });
    }
    if (opts.suite) {
      constraints.push("suite subject to laneway/garden suite by-law standards (separation, height, access)");
    }

    const suiteMix: UnitMixEntry[] = opts.suite
      ? [...mix, { type: SUITE_UNIT_TYPE, count: 1, netSqftEach: Math.round(SUITE_GFA_SQFT * ntg) }]
      : mix;

    return {
      key,
      label,
      units: totalUnits,
      unitMix: suiteMix,
      grossGfaSqft: gross,
      netSqft: net + (opts.suite ? Math.round(SUITE_GFA_SQFT * ntg) : 0),
      includesSuite: !!opts.suite,
      suiteGfaSqft: suite,
      parkingRequired: 0,
      parkingProvided: 0,
      approvalPath: fit.path,
      approvalCertainty: units > 4 ? input.sixplexCertainty : "verified",
      envelopeSlackPct: fit.slackPct,
      constraints,
      flags,
    };
  };

  // A: 4-plex (or the largest count <= 4 that fits)
  for (let u = Math.min(4, input.maxUnitsAsOfRight); u >= 2; u--) {
    const c = build("fourplex", `${u}-unit multiplex`, u);
    if (c && c.approvalPath === "as_of_right") {
      configs.push(c);
      break;
    }
  }

  // B: sixplex where geography allows
  if (input.maxUnitsAsOfRight >= 5) {
    for (let u = Math.min(6, input.maxUnitsAsOfRight); u >= 5; u--) {
      const c = build("sixplex", `${u}-unit multiplex`, u);
      if (c && c.approvalPath === "as_of_right") {
        configs.push(c);
        break;
      }
    }
  }

  // C: best config + laneway/garden suite
  if ((input.lanewayEligible || input.gardenSuiteEligible) && configs.length > 0) {
    const base = configs[configs.length - 1];
    const baseUnits = base.unitMix.reduce((s, e) => s + e.count, 0);
    const suiteKind = input.lanewayEligible ? "laneway suite" : "garden suite";
    const c = build("plus_suite", `${base.label} + ${suiteKind}`, baseUnits, { suite: true });
    if (c) configs.push(c);
  }

  // D: stretch one step past as-of-right (variance/rezoning read)
  const stretchUnits = input.maxUnitsAsOfRight + 2;
  const d = build("stretch", `${stretchUnits}-unit stretch (variance required)`, stretchUnits);
  if (d && d.approvalPath !== "as_of_right") {
    d.flags.push({
      key: "stretch_variance",
      severity: "high",
      message: `${stretchUnits} units exceeds as-of-right permissions — requires ${d.approvalPath === "rezoning" ? "a rezoning application" : "minor variance(s)"} with uncertain outcome.`,
    });
    configs.push(d);
  }

  return configs;
}
