/**
 * Multiplex Underwriter server module.
 *
 * Phase 1: multiplex_assumptions — admin-editable defaults feeding the pure
 * engines in shared/multiplex*.ts (every row keeps source + last-verified).
 * Phase 3: POST /api/multiplex-underwriter — the orchestrator. Pipeline:
 *   resolveSite (geocode → zoning polygon → tree/heritage/TRCA screens)
 *   → permissions (multiplexFeasibility engine)
 *   → envelope → configurations → pro formas → dual-takeout comparison
 *     (MLI Select hold vs condo termination, shared/multiplexTakeout.ts)
 *   → variance risk → site-level recommended takeout
 *   → persisted to multiplex_underwritings with a share token.
 *
 * Deterministic math computes; the report writer (Phase 5) narrates. Every
 * figure carries provenance so the UI can badge it.
 */

import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { isAdmin } from "./auth";
import { users } from "@shared/models/auth";
import { resolveSite, type ResolvedSite } from "./torontoGeo";
import { resolveWard } from "./enrichment";
import { computeMultiplexFeasibility, TORONTO_SIXPLEX_WARDS } from "./multiplexFeasibility";
import {
  DEV_ASSUMPTION_DEFAULTS,
  computeCondoExit,
  computeCostStack,
  computeRentalHold,
  computeResidualLandValue,
  type DevAssumptions,
} from "@shared/multiplexProForma";
import {
  UNIT_SIZE_DEFAULTS,
  NET_TO_GROSS_DEFAULT,
  generateConfigurations,
  type BuildConfiguration,
} from "@shared/multiplexConfigs";
import { TORONTO_ENVELOPE_RULES, PRACTICAL_GFA_HAIRCUT, computeEnvelope } from "@shared/multiplexEnvelope";
import { computeMliTakeout, scoreMliPoints, type MliTakeoutResult } from "@shared/mliSelect";
import {
  TAKEOUT_ASSUMPTION_DEFAULTS,
  compareTakeouts,
  computeCondoTermination,
  computeMliHold,
  pickRecommendedTakeout,
  type CondoTerminationResult,
  type MliHoldResult,
  type SiteTakeoutRecommendation,
  type TakeoutAssumptions,
  type TakeoutDecision,
} from "@shared/multiplexTakeout";
import { assessVarianceRisk, type VarianceRiskResult } from "@shared/multiplexVarianceRisk";
import type { UnitType } from "@shared/multiplexTypes";

// ─── Tables ──────────────────────────────────────────────────────────────────

export async function ensureMultiplexTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS multiplex_assumptions (
      key           text PRIMARY KEY,
      value         jsonb NOT NULL,
      label         text NOT NULL,
      unit          text,
      source        text NOT NULL,
      last_verified text,
      updated_by    varchar,
      updated_at    timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS multiplex_underwritings (
      id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     varchar,
      session_id  varchar,
      address     text NOT NULL,
      lat         double precision,
      lng         double precision,
      postal_fsa  varchar(3),
      inputs_json jsonb NOT NULL,
      site_json   jsonb NOT NULL,
      result_json jsonb,
      share_token varchar UNIQUE,
      created_at  timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS multiplex_underwritings_user_idx
    ON multiplex_underwritings (user_id, created_at)
  `);
}

// ─── Seed data ───────────────────────────────────────────────────────────────

interface AssumptionSeed {
  key: string;
  value: unknown;
  label: string;
  unit?: string;
  source: string;
  lastVerified?: string;
}

const d = DEV_ASSUMPTION_DEFAULTS;
const t = TAKEOUT_ASSUMPTION_DEFAULTS;

const ASSUMPTION_SEEDS: AssumptionSeed[] = [
  { key: "hard_cost_psf", value: d.hardCostPsf, label: "Hard cost per gross sqft (new-build multiplex, Toronto)", unit: "$/sqft", source: d.source, lastVerified: d.lastVerified },
  { key: "soft_cost_pct_of_hard", value: d.softCostPctOfHard, label: "Soft costs as % of hard cost", unit: "fraction", source: d.source, lastVerified: d.lastVerified },
  { key: "contingency_pct", value: d.contingencyPct, label: "Contingency on hard + soft", unit: "fraction", source: d.source, lastVerified: d.lastVerified },
  { key: "dc_per_unit", value: d.dcPerUnit, label: "Development charge per unit (Toronto)", unit: "$", source: "City of Toronto DC schedule 2024", lastVerified: d.lastVerified },
  { key: "dc_exempt_units", value: d.dcExemptUnits, label: "DC-exempt units per project (Bill 23 ARU baseline — verify per project)", unit: "units", source: "Ontario Bill 23; City incentive programs vary", lastVerified: d.lastVerified },
  { key: "construction_rate", value: d.constructionRate, label: "Construction loan rate (annual)", unit: "fraction", source: d.source, lastVerified: d.lastVerified },
  { key: "construction_months", value: d.constructionMonths, label: "Construction duration", unit: "months", source: d.source, lastVerified: d.lastVerified },
  { key: "loan_to_cost", value: d.loanToCost, label: "Construction loan-to-cost", unit: "fraction", source: d.source, lastVerified: d.lastVerified },
  { key: "vacancy_pct", value: d.vacancyPct, label: "Stabilized vacancy allowance", unit: "fraction", source: d.source, lastVerified: d.lastVerified },
  { key: "opex_pct_of_egi", value: d.opexPctOfEgi, label: "Operating expenses as % of EGI", unit: "fraction", source: d.source, lastVerified: d.lastVerified },
  { key: "exit_cap_rate", value: d.exitCapRate, label: "Exit/stabilized cap rate", unit: "fraction", source: d.source, lastVerified: d.lastVerified },
  { key: "condo_selling_cost_pct", value: d.condoSellingCostPct, label: "Condo selling costs (commission, legal, marketing)", unit: "fraction", source: d.source, lastVerified: d.lastVerified },
  { key: "target_condo_margin_on_cost", value: d.targetCondoMarginOnCost, label: "Target condo margin on cost (residual land value)", unit: "fraction", source: d.source, lastVerified: d.lastVerified },
  { key: "target_yield_on_cost", value: d.targetYieldOnCost, label: "Target yield-on-cost (residual land value, rental)", unit: "fraction", source: d.source, lastVerified: d.lastVerified },
  { key: "monthly_rents", value: d.monthlyRents, label: "Toronto market rents by unit type", unit: "$/month", source: "CMHC Toronto rents (shared/cmhcRents.ts) — estimate", lastVerified: d.lastVerified },
  { key: "condo_psf", value: d.condoPsf, label: "Condo sale price per net sqft (assumption — no comps feed yet)", unit: "$/sqft", source: "Assumption pending comps integration", lastVerified: d.lastVerified },
  { key: "unit_sizes", value: UNIT_SIZE_DEFAULTS, label: "Net unit sizes by type", unit: "sqft", source: "Realist unit-mix packing defaults", lastVerified: d.lastVerified },
  { key: "net_to_gross", value: NET_TO_GROSS_DEFAULT, label: "Net-to-gross efficiency", unit: "fraction", source: "Realist massing default", lastVerified: d.lastVerified },
  { key: "lot_coverage", value: TORONTO_ENVELOPE_RULES.defaultLotCoverage, label: "Default lot coverage (Toronto residential)", unit: "fraction", source: TORONTO_ENVELOPE_RULES.source, lastVerified: TORONTO_ENVELOPE_RULES.lastVerified },
  { key: "front_setback_m", value: TORONTO_ENVELOPE_RULES.defaultFrontSetbackM, label: "Default front setback (contextual)", unit: "m", source: TORONTO_ENVELOPE_RULES.source, lastVerified: TORONTO_ENVELOPE_RULES.lastVerified },
  { key: "practical_gfa_haircut", value: PRACTICAL_GFA_HAIRCUT, label: "Theoretical→practical GFA haircut", unit: "fraction", source: "Realist massing default (matches feasibility engine)", lastVerified: d.lastVerified },
  { key: "mli_interest_rate", value: 0.045, label: "MLI Select takeout interest rate (annual)", unit: "fraction", source: "Assumption — CMHC-insured multi pricing varies with bond yields", lastVerified: d.lastVerified },
  { key: "sixplex_opt_in_wards", value: [], label: "Toronto sixplex councillor opt-in wards (beyond the 654-2025 nine)", unit: "ward numbers", source: "By-law 654-2025 opt-in mechanism — update as councillors opt in", lastVerified: "2026-07" },
  // Dual-takeout exit comparator (shared/multiplexTakeout.ts) — UNVERIFIED
  // defaults are flagged in their labels for calibration.
  { key: "condo_town_psf", value: t.condoTownPsf, label: "Condo-townhouse sale price per net sqft (UNVERIFIED — calibrate to comps)", unit: "$/sqft", source: t.source, lastVerified: t.lastVerified },
  { key: "condo_apt_psf", value: t.condoAptPsf, label: "Condo-apartment sale price per net sqft (UNVERIFIED — TRREB Q1-2026 resale avg ~$859/sf)", unit: "$/sqft", source: t.source, lastVerified: t.lastVerified },
  { key: "condo_apt_illiquidity_discount", value: t.condoAptIlliquidityDiscountPct, label: "Apartment-form clearance discount (UNVERIFIED — mid-2026 illiquidity)", unit: "fraction", source: t.source, lastVerified: t.lastVerified },
  { key: "max_condo_town_units", value: t.maxCondoTownUnits, label: "Max units marketable as condo towns (UNVERIFIED judgement)", unit: "units", source: t.source, lastVerified: t.lastVerified },
  { key: "min_condo_town_avg_sqft", value: t.minCondoTownAvgSqft, label: "Min average unit size for condo-town form (UNVERIFIED judgement)", unit: "sqft", source: t.source, lastVerified: t.lastVerified },
  { key: "condo_registration_fixed_cost", value: t.condoRegistrationFixedCost, label: "Plan-of-condominium fixed cost: draft plan application + legal + OLS survey (UNVERIFIED)", unit: "$", source: t.source, lastVerified: t.lastVerified },
  { key: "condo_registration_per_unit_cost", value: t.condoRegistrationPerUnitCost, label: "Condo registration extras per unit (UNVERIFIED)", unit: "$", source: t.source, lastVerified: t.lastVerified },
  { key: "condo_registration_months", value: t.condoRegistrationMonths, label: "Completion → condo registration (UNVERIFIED — approvals lapse after 5 years)", unit: "months", source: t.source, lastVerified: t.lastVerified },
  { key: "condo_town_absorption_months", value: t.condoTownAbsorptionMonths, label: "Sell-out period, condo-town form (UNVERIFIED)", unit: "months", source: t.source, lastVerified: t.lastVerified },
  { key: "condo_apt_absorption_months", value: t.condoAptAbsorptionMonths, label: "Sell-out period, condo-apartment form (UNVERIFIED — 35-year sales low)", unit: "months", source: t.source, lastVerified: t.lastVerified },
  { key: "capitalize_mli_premium", value: t.capitalizeMliPremium, label: "Capitalize the CMHC premium into the MLI loan", unit: "boolean", source: t.source, lastVerified: t.lastVerified },
  { key: "hold_horizon_years", value: t.holdHorizonYears, label: "Hold-vs-condo comparison horizon (UNVERIFIED preference)", unit: "years", source: t.source, lastVerified: t.lastVerified },
  { key: "form_preference_tolerance_pct", value: t.formPreferenceTolerancePct, label: "Town-form preference tolerance vs top score (UNVERIFIED preference)", unit: "fraction", source: t.source, lastVerified: t.lastVerified },
];

async function seedAssumptions(): Promise<void> {
  for (const seed of ASSUMPTION_SEEDS) {
    await db.execute(sql`
      INSERT INTO multiplex_assumptions (key, value, label, unit, source, last_verified)
      VALUES (${seed.key}, ${JSON.stringify(seed.value)}::jsonb, ${seed.label}, ${seed.unit ?? null}, ${seed.source}, ${seed.lastVerified ?? null})
      ON CONFLICT (key) DO NOTHING
    `);
  }
}

// ─── Assumptions access ──────────────────────────────────────────────────────

export interface AssumptionRow {
  key: string;
  value: unknown;
  label: string;
  unit: string | null;
  source: string;
  lastVerified: string | null;
  updatedAt: string;
}

export async function getAssumptions(): Promise<AssumptionRow[]> {
  const result = await db.execute(sql`
    SELECT key, value, label, unit, source, last_verified, updated_at
    FROM multiplex_assumptions ORDER BY key
  `);
  return (result.rows as Array<Record<string, unknown>>).map((r) => ({
    key: String(r.key),
    value: r.value,
    label: String(r.label),
    unit: r.unit == null ? null : String(r.unit),
    source: String(r.source),
    lastVerified: r.last_verified == null ? null : String(r.last_verified),
    updatedAt: String(r.updated_at),
  }));
}

/** Assumptions as a key->value map for feeding the engines. */
export async function getAssumptionValues(): Promise<Record<string, unknown>> {
  const rows = await getAssumptions();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

export const underwriteRequestSchema = z.object({
  address: z.string().min(5).max(200),
  postalCode: z.string().max(10).optional(),
  lotFrontageFt: z.number().positive().max(500).optional(),
  lotDepthFt: z.number().positive().max(1000).optional(),
  lotAreaSqft: z.number().positive().max(200000).optional(),
  purchasePrice: z.number().min(0).max(50_000_000).optional(),
  laneAccess: z.boolean().optional(),
  goal: z.enum(["flip", "hold"]).optional(),
  mliCommitments: z
    .object({
      affordabilityLevel: z.number().int().min(0).max(3),
      energyLevel: z.number().int().min(0).max(3),
      accessibilityLevel: z.number().int().min(0).max(2),
    })
    .optional(),
  assumptionOverrides: z.record(z.string(), z.unknown()).optional(),
});

export type UnderwriteRequest = z.infer<typeof underwriteRequestSchema>;

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/** defaults <- admin-edited values <- per-request overrides. */
function buildAssumptions(
  admin: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
): { dev: DevAssumptions; takeout: TakeoutAssumptions; unitSizes: Record<UnitType, number>; netToGross: number; lotCoverage: number; frontSetbackM: number; mliRate: number } {
  const pick = (key: string): unknown => (overrides[key] !== undefined ? overrides[key] : admin[key]);

  const rentsRaw = pick("monthly_rents");
  const monthlyRents: Record<UnitType, number> = {
    ...d.monthlyRents,
    ...(typeof rentsRaw === "object" && rentsRaw !== null ? (rentsRaw as Record<UnitType, number>) : {}),
  };
  const sizesRaw = pick("unit_sizes");
  const unitSizes: Record<UnitType, number> = {
    ...UNIT_SIZE_DEFAULTS,
    ...(typeof sizesRaw === "object" && sizesRaw !== null ? (sizesRaw as Record<UnitType, number>) : {}),
  };

  const dev: DevAssumptions = {
    source: d.source,
    lastVerified: d.lastVerified,
    hardCostPsf: num(pick("hard_cost_psf"), d.hardCostPsf),
    softCostPctOfHard: num(pick("soft_cost_pct_of_hard"), d.softCostPctOfHard),
    contingencyPct: num(pick("contingency_pct"), d.contingencyPct),
    dcPerUnit: num(pick("dc_per_unit"), d.dcPerUnit),
    dcExemptUnits: num(pick("dc_exempt_units"), d.dcExemptUnits),
    constructionRate: num(pick("construction_rate"), d.constructionRate),
    constructionMonths: num(pick("construction_months"), d.constructionMonths),
    loanToCost: num(pick("loan_to_cost"), d.loanToCost),
    vacancyPct: num(pick("vacancy_pct"), d.vacancyPct),
    opexPctOfEgi: num(pick("opex_pct_of_egi"), d.opexPctOfEgi),
    exitCapRate: num(pick("exit_cap_rate"), d.exitCapRate),
    condoSellingCostPct: num(pick("condo_selling_cost_pct"), d.condoSellingCostPct),
    targetCondoMarginOnCost: num(pick("target_condo_margin_on_cost"), d.targetCondoMarginOnCost),
    targetYieldOnCost: num(pick("target_yield_on_cost"), d.targetYieldOnCost),
    monthlyRents,
    condoPsf: num(pick("condo_psf"), d.condoPsf),
  };

  const takeout: TakeoutAssumptions = {
    source: t.source,
    lastVerified: t.lastVerified,
    condoTownPsf: num(pick("condo_town_psf"), t.condoTownPsf),
    condoAptPsf: num(pick("condo_apt_psf"), t.condoAptPsf),
    condoAptIlliquidityDiscountPct: num(pick("condo_apt_illiquidity_discount"), t.condoAptIlliquidityDiscountPct),
    maxCondoTownUnits: num(pick("max_condo_town_units"), t.maxCondoTownUnits),
    minCondoTownAvgSqft: num(pick("min_condo_town_avg_sqft"), t.minCondoTownAvgSqft),
    condoRegistrationFixedCost: num(pick("condo_registration_fixed_cost"), t.condoRegistrationFixedCost),
    condoRegistrationPerUnitCost: num(pick("condo_registration_per_unit_cost"), t.condoRegistrationPerUnitCost),
    condoRegistrationMonths: num(pick("condo_registration_months"), t.condoRegistrationMonths),
    condoTownAbsorptionMonths: num(pick("condo_town_absorption_months"), t.condoTownAbsorptionMonths),
    condoAptAbsorptionMonths: num(pick("condo_apt_absorption_months"), t.condoAptAbsorptionMonths),
    capitalizeMliPremium: bool(pick("capitalize_mli_premium"), t.capitalizeMliPremium),
    holdHorizonYears: num(pick("hold_horizon_years"), t.holdHorizonYears),
    formPreferenceTolerancePct: num(pick("form_preference_tolerance_pct"), t.formPreferenceTolerancePct),
  };

  return {
    dev,
    takeout,
    unitSizes,
    netToGross: num(pick("net_to_gross"), NET_TO_GROSS_DEFAULT),
    lotCoverage: num(pick("lot_coverage"), TORONTO_ENVELOPE_RULES.defaultLotCoverage),
    frontSetbackM: num(pick("front_setback_m"), TORONTO_ENVELOPE_RULES.defaultFrontSetbackM),
    mliRate: num(pick("mli_interest_rate"), 0.045),
  };
}

function extractFsa(input: UnderwriteRequest): string | null {
  const fromInput = (input.postalCode || "").toUpperCase().replace(/\s+/g, "").slice(0, 3);
  if (/^[A-Z]\d[A-Z]$/.test(fromInput)) return fromInput;
  return null;
}

interface ConfigUnderwrite {
  config: BuildConfiguration;
  varianceRisk: VarianceRiskResult;
  costs: ReturnType<typeof computeCostStack>;
  condoExit: ReturnType<typeof computeCondoExit>;
  rentalHold: ReturnType<typeof computeRentalHold>;
  residualLandValue: ReturnType<typeof computeResidualLandValue>;
  mli: MliTakeoutResult;
  comparison: {
    condoProfit: number;
    holdEquityLeft: number;
    holdAnnualCashFlow: number;
    holdCashOnCash: number | null;
    recommendedExit: "condo" | "hold" | "neither";
  };
  /** Dual-takeout exit comparator: MLI Select hold vs condo termination. */
  takeout: {
    condo: CondoTerminationResult;
    hold: MliHoldResult;
    decision: TakeoutDecision;
  };
}

async function runUnderwrite(input: UnderwriteRequest, site: ResolvedSite): Promise<{
  sixplex: { eligible: boolean; status: string; certainty: "verified" | "inferred" };
  maxUnitsAsOfRight: number;
  envelope: ReturnType<typeof computeEnvelope>;
  configs: ConfigUnderwrite[];
  winner: { flip: string | null; hold: string | null };
  recommendedTakeout: SiteTakeoutRecommendation;
  assumptionNotes: string[];
}> {
  const admin = await getAssumptionValues();
  const a = buildAssumptions(admin, input.assumptionOverrides);
  const assumptionNotes: string[] = [];

  // Permissions via the mature feasibility engine (rules + sources + status)
  const feasibility = computeMultiplexFeasibility({
    address: input.address,
    city: "Toronto",
    province: "ON",
    postalCode: input.postalCode,
    zoneCode: site.zoning?.zoneCode,
    lotFrontage: input.lotFrontageFt,
    lotDepth: input.lotDepthFt,
    lotArea: input.lotAreaSqft,
    laneAccess: input.laneAccess,
    heritageFlag: site.heritage.listed,
    floodplainFlag: site.trca.regulated,
  });

  const fsaSixStatus = feasibility.permissions.six_unit_area_status;
  const optInWards = Array.isArray(admin["sixplex_opt_in_wards"]) ? (admin["sixplex_opt_in_wards"] as number[]) : [];

  // Prefer the ACTUAL ward (point-in-polygon against municipal_wards) over the
  // FSA-prefix heuristic baked into the feasibility engine. By-law 654-2025
  // makes six units as-of-right in nine named wards (plus councillor opt-ins),
  // so a resolved ward is a verified determination, not a guess. Fall back to
  // the FSA inference when the point can't be resolved to a ward (no geocode,
  // wards layer not imported, or the point lands outside every ward polygon).
  const eligibleWardNumbers = new Set<number>([
    ...TORONTO_SIXPLEX_WARDS.asOfRightWards.map((w) => w.ward),
    ...TORONTO_SIXPLEX_WARDS.optInWards.map((w) => w.ward),
    ...optInWards,
  ]);
  let resolvedWard: Awaited<ReturnType<typeof resolveWard>> = null;
  if (fsaSixStatus !== "not_applicable" && typeof site.lat === "number" && typeof site.lng === "number") {
    try {
      resolvedWard = await resolveWard(site.lat, site.lng, "Toronto");
    } catch (err) {
      console.error("[multiplex-underwriter] ward resolution failed:", (err as Error).message);
    }
  }
  const resolvedWardNumber = resolvedWard ? Number.parseInt(resolvedWard.code, 10) : NaN;
  const wardResolved = resolvedWard != null && Number.isFinite(resolvedWardNumber);

  let sixStatus = fsaSixStatus;
  let sixplexCertainty: "verified" | "inferred" = "inferred";
  if (wardResolved) {
    // Ward is known: verified as-of-right if it's a 654-2025 ward, otherwise a
    // verified "not as-of-right here" (six units would need opt-in / variance).
    sixplexCertainty = "verified";
    sixStatus = eligibleWardNumbers.has(resolvedWardNumber) ? "more_likely_area" : "possible_unverified";
  }

  const sixplexEligible = sixStatus === "more_likely_area";
  const maxUnitsAsOfRight = sixplexEligible ? 6 : Math.max(4, feasibility.permissions.effective_baseline_units);

  if (wardResolved) {
    const wardLabel = `Ward ${resolvedWardNumber}${resolvedWard!.name ? ` (${resolvedWard!.name})` : ""}`;
    assumptionNotes.push(
      sixplexEligible
        ? `${wardLabel} is a By-law 654-2025 six-unit ward — six units modelled as-of-right (ward verified from boundary polygons).`
        : `${wardLabel} is not a By-law 654-2025 six-unit ward — modelled at ${maxUnitsAsOfRight} units (ward verified; six units would need a councillor opt-in or minor variance).`,
    );
  } else if (sixStatus === "possible_unverified") {
    assumptionNotes.push(
      `Five/six-unit permission not inferred for this location — modelled at ${maxUnitsAsOfRight} units. If the property is in Wards ${TORONTO_SIXPLEX_WARDS.asOfRightWards.map((w) => w.ward).join(", ")}${optInWards.length ? ` or opt-in wards ${optInWards.join(", ")}` : ""}, six units may be as-of-right — verify the ward.`,
    );
  }
  if (!input.purchasePrice) {
    assumptionNotes.push("No purchase price provided — cost stack excludes land; residual land value is the guide to what the site is worth.");
  }

  const envelope = computeEnvelope({
    lotFrontageFt: input.lotFrontageFt!,
    lotDepthFt: input.lotDepthFt!,
    lotAreaSqft: input.lotAreaSqft,
    sixplexEligible,
    fivePlusUnits: maxUnitsAsOfRight >= 5,
    heritage: site.heritage.listed,
    conservationConstraint: site.trca.regulated,
    lotCoverage: a.lotCoverage,
    frontSetbackM: a.frontSetbackM,
  });

  const configs = generateConfigurations({
    envelope,
    maxUnitsAsOfRight,
    sixplexCertainty,
    lanewayEligible: !!input.laneAccess && feasibility.permissions.laneway_suite_possible,
    gardenSuiteEligible: feasibility.permissions.garden_suite_possible,
    unitSizes: a.unitSizes,
    netToGross: a.netToGross,
  });

  // zod already constrains the levels to the valid integer ranges
  const points = scoreMliPoints(
    (input.mliCommitments ?? { affordabilityLevel: 1, energyLevel: 1, accessibilityLevel: 0 }) as import("@shared/mliSelect").MliCommitments,
  );
  if (!input.mliCommitments) {
    assumptionNotes.push("MLI Select modelled at 70 points (10% affordable units + 20% energy improvement) — adjust commitments to see other tiers.");
  }

  const narrowLot = envelope.flags.some((f) => f.key === "narrow_lot");
  const underwrites: ConfigUnderwrite[] = configs.map((config) => {
    const costs = computeCostStack(config, input.purchasePrice ?? 0, a.dev);
    const condoExit = computeCondoExit(config, costs, a.dev);
    const rentalHold = computeRentalHold(config, costs, a.dev);
    const residualLandValue = computeResidualLandValue(config, a.dev);
    const mli = computeMliTakeout({
      units: config.units,
      noi: rentalHold.noi,
      lendingValue: rentalHold.stabilizedValue,
      points,
      purpose: "other",
      interestRate: a.mliRate,
    });
    const varianceRisk = assessVarianceRisk({
      config,
      heritage: site.heritage.listed,
      conservationRegulated: site.trca.regulated,
      cityTreeConflict: site.trees.cityTreeConflict,
      narrowLot,
    });

    const holdEquityLeft = mli.eligible ? Math.max(0, costs.totalDevCost - mli.maxLoan) : costs.totalDevCost;
    const holdAnnualCashFlow = mli.eligible ? rentalHold.noi - mli.annualDebtService : rentalHold.noi;
    const holdCashOnCash = mli.eligible && holdEquityLeft > 0 ? Math.round((holdAnnualCashFlow / holdEquityLeft) * 10000) / 10000 : null;
    const recommendedExit: ConfigUnderwrite["comparison"]["recommendedExit"] =
      condoExit.profit <= 0 && holdAnnualCashFlow <= 0
        ? "neither"
        : condoExit.marginOnCost >= (holdCashOnCash ?? -Infinity)
          ? "condo"
          : "hold";

    // Dual-takeout comparator: form-aware condo termination vs MLI Select hold
    // in comparable dollars (shared/multiplexTakeout.ts).
    const condoTermination = computeCondoTermination(config, costs, a.dev, a.takeout);
    const mliHold = computeMliHold(
      { config, costs, rentalHold, points, interestRate: a.mliRate },
      a.takeout,
    );
    const takeoutDecision = compareTakeouts(condoTermination, mliHold, config);

    return {
      config,
      varianceRisk,
      costs,
      condoExit,
      rentalHold,
      residualLandValue,
      mli,
      comparison: { condoProfit: condoExit.profit, holdEquityLeft, holdAnnualCashFlow, holdCashOnCash, recommendedExit },
      takeout: { condo: condoTermination, hold: mliHold, decision: takeoutDecision },
    };
  });

  const flipWinner = underwrites
    .filter((u) => u.comparison.condoProfit > 0)
    .sort((x, y) => y.comparison.condoProfit - x.comparison.condoProfit)[0];
  const holdWinner =
    underwrites
      .filter((u) => u.mli.eligible && (u.comparison.holdCashOnCash ?? -1) > 0)
      .sort((x, y) => (y.comparison.holdCashOnCash ?? 0) - (x.comparison.holdCashOnCash ?? 0))[0] ??
    underwrites
      .filter((u) => u.comparison.holdAnnualCashFlow > 0)
      .sort((x, y) => y.rentalHold.yieldOnCost - x.rentalHold.yieldOnCost)[0];

  const recommendedTakeout = pickRecommendedTakeout(
    underwrites.map((u) => ({
      configKey: u.config.key,
      configLabel: u.config.label,
      units: u.config.units,
      condo: u.takeout.condo,
      hold: u.takeout.hold,
      decision: u.takeout.decision,
    })),
    a.takeout,
  );

  return {
    sixplex: { eligible: sixplexEligible, status: sixStatus, certainty: sixplexCertainty },
    maxUnitsAsOfRight,
    envelope,
    configs: underwrites,
    winner: { flip: flipWinner?.config.key ?? null, hold: holdWinner?.config.key ?? null },
    recommendedTakeout,
    assumptionNotes,
  };
}

// ─── Rate limiting (in-memory, per day) ──────────────────────────────────────

const usage = new Map<string, { day: string; count: number }>();

function checkRateLimit(req: Request): { ok: boolean; limit: number } {
  const userId = (req as any).session?.userId as string | undefined;
  const key = userId || (req as any).sessionID || req.ip || "anon";
  const limit = userId ? 20 : 3;
  const day = new Date().toISOString().slice(0, 10);
  const entry = usage.get(key);
  if (!entry || entry.day !== day) {
    usage.set(key, { day, count: 1 });
    return { ok: true, limit };
  }
  if (entry.count >= limit) return { ok: false, limit };
  entry.count++;
  return { ok: true, limit };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

const DISCLAIMER =
  "Preliminary screening only — not planning, legal, financial, or architectural advice. Zoning permissions, envelope figures, costs, rents, and financing terms are estimates that must be verified with the City of Toronto, a registered planner or architect, and your lender before acting.";

export async function executeMultiplexUnderwriter(input: UnderwriteRequest, opts: {
  userId?: string | null;
  sessionId?: string | null;
  persist?: boolean;
} = {}) {
  const workingInput = { ...input };
  const site = await resolveSite(workingInput.address);

  const hasDims = !!(workingInput.lotFrontageFt && workingInput.lotDepthFt) || !!workingInput.lotAreaSqft;
  if (!hasDims) {
    return {
      status: "needs_lot_dimensions" as const,
      site,
      message: "Site resolved. Provide lotFrontageFt + lotDepthFt (or lotAreaSqft) to run the full underwrite.",
      disclaimer: DISCLAIMER,
    };
  }

  if (!workingInput.lotFrontageFt || !workingInput.lotDepthFt) {
    const side = Math.sqrt(workingInput.lotAreaSqft!);
    workingInput.lotFrontageFt = workingInput.lotFrontageFt ?? Math.round(side * 0.6);
    workingInput.lotDepthFt = workingInput.lotDepthFt ?? Math.round(workingInput.lotAreaSqft! / workingInput.lotFrontageFt);
  }

  const underwrite = await runUnderwrite(workingInput, site);
  if (!input.lotFrontageFt || !input.lotDepthFt) {
    underwrite.assumptionNotes.push("Lot frontage/depth back-filled from area — confirm actual dimensions.");
  }

  const { writeMultiplexReport } = await import("./multiplexReportWriter");
  const { report, source: reportSource } = await writeMultiplexReport({
    address: workingInput.address,
    site,
    underwrite,
  });
  const result = { ...underwrite, report, reportSource };

  if (opts.persist === false) {
    return { status: "complete" as const, site, underwrite: result, disclaimer: DISCLAIMER };
  }

  const shareToken = crypto.randomBytes(12).toString("hex");
  const inserted = await db.execute(sql`
    INSERT INTO multiplex_underwritings (user_id, session_id, address, lat, lng, postal_fsa, inputs_json, site_json, result_json, share_token)
    VALUES (
      ${opts.userId ?? null}, ${opts.sessionId ?? null}, ${workingInput.address}, ${site.lat}, ${site.lng},
      ${extractFsa(workingInput)}, ${JSON.stringify(workingInput)}::jsonb,
      ${JSON.stringify(site)}::jsonb, ${JSON.stringify(result)}::jsonb, ${shareToken}
    )
    RETURNING id
  `);
  const id = (inserted.rows[0] as { id: string }).id;
  return { status: "complete" as const, id, shareToken, site, underwrite: result, disclaimer: DISCLAIMER };
}

export function registerMultiplexUnderwriterRoutes(app: Express): void {
  ensureMultiplexTables()
    .then(seedAssumptions)
    .catch((err) => console.error("[multiplex] failed to ensure/seed tables:", err.message));

  // Public read — the analyzer UI shows defaults with their sources.
  app.get("/api/multiplex-assumptions", async (_req: Request, res: Response) => {
    try {
      res.json({ assumptions: await getAssumptions() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin write.
  app.put("/api/admin/multiplex-assumptions/:key", isAdmin, async (req: any, res: Response) => {
    try {
      const key = String(req.params.key);
      const { value, source, lastVerified } = req.body ?? {};
      if (value === undefined) return res.status(400).json({ error: "value is required" });

      const result = await db.execute(sql`
        UPDATE multiplex_assumptions
        SET value = ${JSON.stringify(value)}::jsonb,
            source = COALESCE(${source ?? null}, source),
            last_verified = COALESCE(${lastVerified ?? null}, last_verified),
            updated_by = ${req.session?.userId ?? null},
            updated_at = now()
        WHERE key = ${key}
        RETURNING key
      `);
      if (!result.rows.length) return res.status(404).json({ error: `unknown assumption key: ${key}` });
      res.json({ success: true, key });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // The underwriter. Without lot dimensions it resolves the site and stops
  // (the UI's confirm step); with dimensions it runs the full pipeline.
  app.post("/api/multiplex-underwriter", async (req: any, res: Response) => {
    try {
      const rate = checkRateLimit(req);
      if (!rate.ok) {
        return res.status(429).json({ error: `Daily underwrite limit reached (${rate.limit}/day). Sign in for a higher limit.` });
      }

      const parsed = underwriteRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      }
      res.json(await executeMultiplexUnderwriter(parsed.data, {
        userId: req.session?.userId ?? null,
        sessionId: req.sessionID ?? null,
      }));
    } catch (err: any) {
      console.error("[multiplex] underwrite failed:", err);
      res.status(500).json({ error: "Underwrite failed — please try again." });
    }
  });

  app.get("/api/multiplex-underwriter/shared/:token", async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token);
      if (!/^[a-f0-9]{24}$/.test(token)) return res.status(400).json({ error: "invalid token" });
      const rows = await db.execute(sql`
        SELECT id, address, site_json, result_json, created_at
        FROM multiplex_underwritings WHERE share_token = ${token} LIMIT 1
      `);
      if (!rows.rows.length) return res.status(404).json({ error: "not found" });
      const r = rows.rows[0] as Record<string, unknown>;
      res.json({ id: r.id, address: r.address, site: r.site_json, underwrite: r.result_json, createdAt: r.created_at, disclaimer: DISCLAIMER });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/multiplex-underwriter/:id", async (req: any, res: Response) => {
    try {
      const id = String(req.params.id);
      const rows = await db.execute(sql`
        SELECT id, user_id, session_id, address, inputs_json, site_json, result_json, share_token, created_at
        FROM multiplex_underwritings WHERE id = ${id} LIMIT 1
      `);
      if (!rows.rows.length) return res.status(404).json({ error: "not found" });
      const r = rows.rows[0] as Record<string, unknown>;
      const isOwner =
        (r.user_id && r.user_id === req.session?.userId) ||
        (!r.user_id && r.session_id && r.session_id === req.sessionID);
      if (!isOwner) {
        let isSessionAdmin = false;
        if (req.session?.userId) {
          const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, req.session.userId)).limit(1);
          isSessionAdmin = user?.role === "admin";
        }
        if (!isSessionAdmin) return res.status(403).json({ error: "forbidden" });
      }
      res.json({
        id: r.id,
        address: r.address,
        inputs: r.inputs_json,
        site: r.site_json,
        underwrite: r.result_json,
        shareToken: r.share_token,
        createdAt: r.created_at,
        disclaimer: DISCLAIMER,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
