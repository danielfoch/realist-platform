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
import { multiplexUnderwritings } from "@shared/schema";
import { ensureTorontoGeoTables, getTorontoGeoLayerCounts, resolveSite, type ResolvedSite } from "./torontoGeo";
import { captureDealLead, recordDealIntent, type DealIntentSignal } from "./dealIntent";
import { consumeDailyUsage, grantDailyUnlock, hasDailyUnlock } from "./usageLimits";
import { requireVerified } from "./accountVerification";
import { resolveWard } from "./enrichment";
import { computeMultiplexFeasibility, TORONTO_SIXPLEX_WARDS } from "./multiplexFeasibility";
import { getDdfListing, isDdfConfigured, searchDdfByMlsNumber } from "./creaDdf";
import { parseLotDimensions, type ParsedLotDimensions } from "@shared/lotDimensions";
import { deriveZoningTier, type ZoningTier } from "@shared/multiplexZoningTier";
import { buildMliSelectGradient, type MliSelectGradient } from "@shared/mliSelectGradient";
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

// ─── Seed data ───────────────────────────────────────────────────────────────
// multiplex_assumptions and multiplex_underwritings now live in shared/schema.ts
// and are owned by `npm run db:push`. The boot-time `CREATE TABLE IF NOT EXISTS`
// that used to sit here is why the platform's most valuable dataset had no FK to
// users and no aggregates; a fresh database needs db:push before first boot.

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
  /** Optional when the property comes from the listing feed (mlsNumber / listingUrl). */
  address: z.string().min(5).max(200).optional(),
  /** MLS number, e.g. C1234567 — resolved through the CREA DDF feed. */
  mlsNumber: z.string().trim().min(3).max(20).optional(),
  /** realtor.ca listing URL — the ListingKey segment is resolved through DDF. */
  listingUrl: z.string().trim().url().max(300).optional(),
  postalCode: z.string().max(10).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
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
}).refine((v) => !!(v.address || v.mlsNumber || v.listingUrl), {
  message: "Provide a street address, an MLS number, or a realtor.ca listing URL.",
  path: ["address"],
});

export type UnderwriteRequest = z.infer<typeof underwriteRequestSchema>;

/** After listing resolution the address is always known. */
type ResolvedUnderwriteInput = UnderwriteRequest & { address: string };

/** creaDdf.ts keeps its listing interface private; derive it from the fetcher. */
type DdfListing = NonNullable<Awaited<ReturnType<typeof getDdfListing>>>;

// ─── Listing ingestion (CREA DDF) ────────────────────────────────────────────

/**
 * The subset of a DDF listing the underwriter needs. DDF licensing: raw
 * payloads are never returned to the client — only these fields.
 */
export interface ListingSummary {
  mlsNumber: string | null;
  listingKey: string;
  /** Street line only, e.g. "123 Logan Ave". */
  address: string;
  city: string;
  province: string;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
  listPrice: number | null;
  numberOfUnits: number | null;
  totalActualRent: number | null;
  taxAnnualAmount: number | null;
  lot: ParsedLotDimensions;
  photoUrl: string | null;
  sourceUrl: string;
  publicRemarksExcerpt: string | null;
}

export type ListingRef =
  | { kind: "mls"; mlsNumber: string }
  | { kind: "listingKey"; listingKey: string };

/**
 * Accepts an MLS number ("C1234567", "W5551234", "40512345") or a realtor.ca
 * URL (https://www.realtor.ca/real-estate/<ListingKey>/<slug>). Anything else
 * is rejected before it reaches the feed.
 */
export function parseListingRef(raw: string): ListingRef | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  if (/realtor\.ca/i.test(s) || /^https?:\/\//i.test(s)) {
    const m = s.match(/\/real-estate\/(\d{5,})(?:[/?#]|$)/i);
    return m ? { kind: "listingKey", listingKey: m[1] } : null;
  }
  const mls = s.toUpperCase().replace(/\s+/g, "");
  if (/^[A-Z]{0,2}\d{5,12}$/.test(mls)) return { kind: "mls", mlsNumber: mls };
  return null;
}

/** The City of Toronto, including its pre-amalgamation municipality names as DDF still uses them. */
const TORONTO_CITY_NAMES = ["toronto", "etobicoke", "scarborough", "north york", "east york", "york"];

export function isTorontoCity(city: string | null | undefined): boolean {
  const c = (city ?? "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (!c) return false;
  if (c.startsWith("toronto")) return true;
  return TORONTO_CITY_NAMES.some((name) => c === name || c.startsWith(`${name} `));
}

function streetLine(ddf: DdfListing): string {
  const parts = [ddf.StreetNumber, ddf.StreetDirPrefix, ddf.StreetName, ddf.StreetSuffix, ddf.StreetDirSuffix]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts.join(" ");
  const unparsed = (ddf.UnparsedAddress ?? "").trim();
  // "123 Logan Ave, Toronto, ON M4M 2N2" -> "123 Logan Ave"
  return unparsed.split(",")[0]?.trim() || unparsed;
}

export function summarizeDdfListing(ddf: DdfListing): ListingSummary {
  const photo = (ddf.Media ?? [])
    .filter((m) => m.MediaURL)
    .sort((a, b) => Number(!!b.PreferredPhotoYN) - Number(!!a.PreferredPhotoYN) || (a.Order ?? 0) - (b.Order ?? 0))[0];
  const remarks = (ddf.PublicRemarks ?? "").replace(/\s+/g, " ").trim();
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  return {
    mlsNumber: ddf.ListingId ?? null,
    listingKey: ddf.ListingKey,
    address: streetLine(ddf),
    city: (ddf.City ?? "").trim(),
    province: (ddf.StateOrProvince ?? "").trim(),
    postalCode: (ddf.PostalCode ?? "").trim() || null,
    lat: typeof ddf.Latitude === "number" ? ddf.Latitude : null,
    lng: typeof ddf.Longitude === "number" ? ddf.Longitude : null,
    listPrice: num(ddf.ListPrice),
    numberOfUnits: num(ddf.NumberOfUnitsTotal),
    totalActualRent: num(ddf.TotalActualRent),
    taxAnnualAmount: num(ddf.TaxAnnualAmount),
    lot: parseLotDimensions({
      lotFrontage: ddf.LotFrontage,
      lotDepth: ddf.LotDepth,
      lotSizeDimensions: ddf.LotSizeDimensions,
      lotSizeArea: ddf.LotSizeArea,
      lotSizeAreaUnits: ddf.LotSizeAreaUnits,
    }),
    photoUrl: photo?.MediaURL ?? null,
    sourceUrl: `https://www.realtor.ca/real-estate/${ddf.ListingKey}`,
    publicRemarksExcerpt: remarks ? (remarks.length > 300 ? `${remarks.slice(0, 297).trimEnd()}…` : remarks) : null,
  };
}

function typedError(name: string, message: string): Error {
  const err = new Error(message);
  err.name = name;
  return err;
}

/**
 * Resolve an MLS number or realtor.ca URL to a compact ListingSummary.
 * Throws typed errors the route maps to status codes:
 *   ListingSourceUnavailable (503), ListingRefInvalid (400), ListingNotFound (404).
 */
export async function resolveListingForUnderwrite(raw: string): Promise<ListingSummary> {
  if (!isDdfConfigured()) {
    throw typedError("ListingSourceUnavailable", "The listing feed is not connected on this server — enter the address and lot dimensions manually.");
  }
  const ref = parseListingRef(raw);
  if (!ref) {
    throw typedError("ListingRefInvalid", "Enter an MLS number (e.g. C1234567) or a realtor.ca listing URL.");
  }
  const ddf = ref.kind === "mls" ? await searchDdfByMlsNumber(ref.mlsNumber) : await getDdfListing(ref.listingKey);
  if (!ddf) {
    throw typedError("ListingNotFound", ref.kind === "mls"
      ? `MLS ${ref.mlsNumber} was not found in the listing feed — it may be off-market or on a board the feed does not carry.`
      : "That realtor.ca listing was not found in the feed — it may be off-market.");
  }
  return summarizeDdfListing(ddf);
}

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

function extractFsa(input: Pick<UnderwriteRequest, "postalCode">): string | null {
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

export interface UnderwriteOutput {
  sixplex: { eligible: boolean; status: string; certainty: "verified" | "inferred" };
  /** Ward resolved by point-in-polygon; null when the wards layer could not place the point. */
  ward: { number: number; name: string | null } | null;
  /** Plain-English "6+1" / "4+1" read of the site. */
  zoningTier: ZoningTier;
  maxUnitsAsOfRight: number;
  envelope: ReturnType<typeof computeEnvelope>;
  configs: ConfigUnderwrite[];
  winner: { flip: string | null; hold: string | null };
  recommendedTakeout: SiteTakeoutRecommendation;
  /** MLI Select DSCR/LTV surface for the configuration the gradient was built on. */
  mliGradient: (MliSelectGradient & { configKey: string; configLabel: string }) | null;
  assumptionNotes: string[];
}

/**
 * Which configuration the MLI gradient should describe: the site-level
 * recommendation, else the best hold, else the largest as-of-right config —
 * the one a lender would actually be asked to size.
 */
function pickGradientConfig(
  underwrites: ConfigUnderwrite[],
  recommended: SiteTakeoutRecommendation,
  holdWinnerKey: string | null,
): ConfigUnderwrite | null {
  const byKey = (key: string | null | undefined) => (key ? underwrites.find((u) => u.config.key === key) ?? null : null);
  return (
    byKey(recommended?.configKey) ??
    byKey(holdWinnerKey) ??
    underwrites
      .filter((u) => u.config.approvalPath === "as_of_right")
      .sort((x, y) => y.config.units - x.config.units)[0] ??
    underwrites[0] ??
    null
  );
}

async function runUnderwrite(input: ResolvedUnderwriteInput, site: ResolvedSite): Promise<UnderwriteOutput> {
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

  const ward = wardResolved ? { number: resolvedWardNumber, name: resolvedWard!.name ?? null } : null;

  const zoningTier = deriveZoningTier({
    sixplexEligible,
    sixplexCertainty,
    wardNumber: ward?.number ?? null,
    wardName: ward?.name ?? null,
    laneAccess: !!input.laneAccess,
    lotFrontageFt: input.lotFrontageFt!,
    lotDepthFt: input.lotDepthFt!,
    lanewaySuitePossible: feasibility.permissions.laneway_suite_possible,
    gardenSuitePossible: feasibility.permissions.garden_suite_possible,
    sixplexWardNumbers: [...eligibleWardNumbers].sort((x, y) => x - y),
  });

  // The gradient is built on the same lending value computeMliTakeout was
  // given for that config (rentalHold.stabilizedValue) so the two agree; the
  // premium schedule is "construction" because this is a new build.
  const gradientConfig = pickGradientConfig(underwrites, recommendedTakeout, holdWinner?.config.key ?? null);
  const mliGradient = gradientConfig
    ? {
        ...buildMliSelectGradient({
          units: gradientConfig.config.units,
          noi: gradientConfig.rentalHold.noi,
          lendingValue: gradientConfig.rentalHold.stabilizedValue,
          interestRate: a.mliRate,
          purpose: "construction",
        }),
        configKey: gradientConfig.config.key,
        configLabel: gradientConfig.config.label,
      }
    : null;

  return {
    sixplex: { eligible: sixplexEligible, status: sixStatus, certainty: sixplexCertainty },
    ward,
    zoningTier,
    maxUnitsAsOfRight,
    envelope,
    configs: underwrites,
    winner: { flip: flipWinner?.config.key ?? null, hold: holdWinner?.config.key ?? null },
    recommendedTakeout,
    mliGradient,
    assumptionNotes,
  };
}

// ─── Rate limiting (durable, per day) ────────────────────────────────────────

/** Hitting this is the platform's main reason to create an account. */
const UNDERWRITE_LIMITS = { anonymous: 3, identified: 20 };

const UNDERWRITE_SCOPE = "multiplex_underwrite";

// ─── Routes ──────────────────────────────────────────────────────────────────

const DISCLAIMER =
  "Preliminary screening only — not planning, legal, financial, or architectural advice. Zoning permissions, envelope figures, costs, rents, and financing terms are estimates that must be verified with the City of Toronto, a registered planner or architect, and your lender before acting.";

export async function executeMultiplexUnderwriter(input: UnderwriteRequest, opts: {
  userId?: string | null;
  sessionId?: string | null;
  persist?: boolean;
  /** Passed through to the intent capture for IP/user-agent attribution. */
  req?: Request | null;
} = {}) {
  // Listing-first path: an MLS number or realtor.ca URL fills in everything
  // the feed knows (address, coordinates, price, lot) before the site resolves.
  // Errors here are typed (ListingSourceUnavailable / ListingRefInvalid /
  // ListingNotFound) and mapped to status codes by the route.
  let listing: ListingSummary | null = null;
  const listingNotes: string[] = [];
  if (input.mlsNumber || input.listingUrl) {
    listing = await resolveListingForUnderwrite(input.listingUrl ?? input.mlsNumber!);
    if (!isTorontoCity(listing.city)) {
      return {
        status: "outside_coverage" as const,
        listing,
        message: `${listing.address}, ${listing.city || "unknown city"} is outside the City of Toronto. The AI underwriter models Toronto's multiplex and sixplex by-laws only — use the manual feasibility screener for ${listing.city || "this municipality"}.`,
        disclaimer: DISCLAIMER,
      };
    }
    if (!input.address) input = { ...input, address: listing.address };
    if (input.postalCode == null && listing.postalCode) input = { ...input, postalCode: listing.postalCode };
    if ((input.lat == null || input.lng == null) && listing.lat != null && listing.lng != null) {
      input = { ...input, lat: listing.lat, lng: listing.lng };
    }
    if (input.purchasePrice == null && listing.listPrice != null) input = { ...input, purchasePrice: listing.listPrice };
    const lotFromListing = !(input.lotFrontageFt && input.lotDepthFt) && !input.lotAreaSqft;
    if (lotFromListing) {
      if (listing.lot.frontageFt && listing.lot.depthFt) {
        input = { ...input, lotFrontageFt: listing.lot.frontageFt, lotDepthFt: listing.lot.depthFt };
        listingNotes.push(`Lot dimensions taken from the listing feed — ${listing.lot.note ?? `${listing.lot.frontageFt} x ${listing.lot.depthFt} ft`} Confirm against the survey.`);
      } else if (listing.lot.areaSqft) {
        input = { ...input, lotAreaSqft: listing.lot.areaSqft };
        listingNotes.push(`Lot area taken from the listing feed (${listing.lot.areaSqft.toLocaleString()} sqft) — frontage/depth not stated; confirm against the survey.`);
      }
    }
    if (input.purchasePrice === listing.listPrice && listing.listPrice != null) {
      listingNotes.push(`Purchase price set to the ${listing.mlsNumber ? `MLS ${listing.mlsNumber}` : "listing"} asking price of $${listing.listPrice.toLocaleString()}.`);
    }
  }
  if (!input.address) {
    throw typedError("SiteResolutionError", "No address to underwrite — provide a street address, MLS number, or realtor.ca URL.");
  }

  const workingInput: ResolvedUnderwriteInput = { ...input, address: input.address };
  const site = await resolveSite(
    workingInput.address,
    workingInput.lat != null && workingInput.lng != null
      ? { lat: workingInput.lat, lng: workingInput.lng }
      : null,
  );
  if (site.lat == null || site.lng == null) {
    const error = new Error(
      "We could not find that Toronto address. Check the street type and spelling, then try again.",
    );
    error.name = "SiteResolutionError";
    throw error;
  }

  const hasDims = !!(workingInput.lotFrontageFt && workingInput.lotDepthFt) || !!workingInput.lotAreaSqft;
  if (!hasDims) {
    return {
      status: "needs_lot_dimensions" as const,
      site,
      listing,
      message: listing
        ? "Listing found but it does not state lot dimensions. Provide lotFrontageFt + lotDepthFt (or lotAreaSqft) to run the full underwrite."
        : "Site resolved. Provide lotFrontageFt + lotDepthFt (or lotAreaSqft) to run the full underwrite.",
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
  underwrite.assumptionNotes.push(...listingNotes);

  const { writeMultiplexReport } = await import("./multiplexReportWriter");
  const { report, source: reportSource } = await writeMultiplexReport({
    address: workingInput.address,
    site,
    underwrite,
  });
  // `listing` rides inside resultJson so shared links and /:id reads carry it
  // without a schema change.
  const result = { ...underwrite, report, reportSource, listing };

  if (opts.persist === false) {
    return { status: "complete" as const, site, listing, underwrite: result, disclaimer: DISCLAIMER };
  }

  const shareToken = crypto.randomBytes(12).toString("hex");
  const [inserted] = await db.insert(multiplexUnderwritings).values({
    userId: opts.userId ?? null,
    sessionId: opts.sessionId ?? null,
    address: workingInput.address,
    lat: site.lat,
    lng: site.lng,
    postalFsa: extractFsa(workingInput),
    inputsJson: { ...workingInput, listing },
    siteJson: site,
    resultJson: result,
    shareToken,
  }).returning({ id: multiplexUnderwritings.id });
  const id = inserted.id;

  // Feed the intent engine. This is the highest-intent act on the platform — a
  // confirmed-dimension underwrite on a real address — so it must not dead-end
  // in this table the way it used to. recordDealIntent is anonymous-safe and
  // never throws; captureDealLead only runs once we actually know who this is.
  const intentSignal = buildIntentSignal(workingInput, result, id, opts);
  await recordDealIntent(opts.req ?? null, intentSignal);

  if (opts.userId) {
    try {
      const [account] = await db
        .select({ email: users.email, firstName: users.firstName, lastName: users.lastName, phone: users.phone })
        .from(users)
        .where(eq(users.id, opts.userId))
        .limit(1);
      if (account?.email) {
        await captureDealLead(
          opts.req ?? null,
          intentSignal,
          {
            name: `${account.firstName || ""} ${account.lastName || ""}`.trim() || account.email,
            email: account.email,
            phone: account.phone ?? null,
            // A signed-in account already carries its own consent state; the
            // underwrite is not itself a consent event, so nothing is asserted
            // here. The email governor is the gate on what actually sends.
            consentEmail: false,
            consentSms: false,
          },
          { intent: workingInput.goal === "hold" ? "financing" : "purchase" },
        );
      }
    } catch (err) {
      console.error("[multiplex] lead capture failed (underwrite still returned):", err);
    }
  }

  return { status: "complete" as const, id, shareToken, site, listing, underwrite: result, disclaimer: DISCLAIMER };
}

// ─── Data health ─────────────────────────────────────────────────────────────

export interface MultiplexDataHealth {
  zoningPolygons: number;
  wards: number;
  streetTrees: number;
  heritageProperties: number;
  /** "verified" when the wards layer is loaded (point-in-polygon), else the FSA heuristic. */
  wardDetection: "verified" | "inferred_fsa_fallback";
  sixplexWards: number[];
  ddfIngestion: boolean;
  checkedAt: string;
}

const HEALTH_TTL_MS = 5 * 60 * 1000;
let healthCache: { at: number; value: MultiplexDataHealth } | null = null;

export async function getMultiplexDataHealth(opts: { force?: boolean } = {}): Promise<MultiplexDataHealth> {
  if (!opts.force && healthCache && Date.now() - healthCache.at < HEALTH_TTL_MS) return healthCache.value;

  const [counts, admin] = await Promise.all([
    getTorontoGeoLayerCounts(),
    getAssumptionValues().catch(() => ({} as Record<string, unknown>)),
  ]);
  const optIn = Array.isArray(admin["sixplex_opt_in_wards"]) ? (admin["sixplex_opt_in_wards"] as number[]) : [];
  const sixplexWards = [...new Set<number>([
    ...TORONTO_SIXPLEX_WARDS.asOfRightWards.map((w) => w.ward),
    ...TORONTO_SIXPLEX_WARDS.optInWards.map((w) => w.ward),
    ...optIn.filter((n) => Number.isFinite(n)),
  ])].sort((x, y) => x - y);

  const value: MultiplexDataHealth = {
    ...counts,
    wardDetection: counts.wards > 0 ? "verified" : "inferred_fsa_fallback",
    sixplexWards,
    ddfIngestion: isDdfConfigured(),
    checkedAt: new Date().toISOString(),
  };
  healthCache = { at: Date.now(), value };
  return value;
}

/** Lightweight cap on feed lookups — a preview, not an underwrite. */
const LISTING_LOOKUP_LIMITS = { anonymous: 30, identified: 120 };
const LISTING_LOOKUP_SCOPE = "multiplex_listing_lookup";

function listingErrorStatus(err: unknown): number | null {
  const name = (err as { name?: string })?.name;
  if (name === "ListingSourceUnavailable") return 503;
  if (name === "ListingRefInvalid") return 400;
  if (name === "ListingNotFound") return 404;
  return null;
}

/**
 * Map an underwrite into the shared intent signal. City/region are hardcoded
 * because the whole pipeline is Toronto-only (server/torontoGeo.ts) — that also
 * means getLeadRoutingChannel puts these in the "valery" lane by design.
 */
function buildIntentSignal(
  input: ResolvedUnderwriteInput,
  result: UnderwriteOutput,
  underwritingId: string,
  opts: { userId?: string | null; sessionId?: string | null },
): DealIntentSignal {
  const recommendedKey = result.winner.hold ?? result.winner.flip;
  const recommended = result.configs.find((c) => c.config.key === recommendedKey);
  return {
    surface: "multiplex_underwriter",
    eventName: "underwriting_completed",
    userId: opts.userId ?? null,
    sessionId: opts.sessionId ?? null,
    address: input.address,
    city: "Toronto",
    region: "Ontario",
    propertyType: "multiplex",
    strategyType: input.goal === "hold" ? "buy_and_hold" : "flip",
    purchasePrice: input.purchasePrice ?? null,
    // Monthly, to match opportunities.estimated_rent everywhere else. Summed
    // from the rent roll rather than dividing the annual GPR, so vacancy and
    // other-income adjustments upstream cannot skew it.
    estimatedRent: recommended
      ? recommended.rentalHold.monthlyRentRoll.reduce((sum, r) => sum + r.count * r.rentEach, 0)
      : null,
    underwritingId,
    metadata: {
      maxUnitsAsOfRight: result.maxUnitsAsOfRight,
      sixplexEligible: result.sixplex.eligible,
      sixplexCertainty: result.sixplex.certainty,
      recommendedConfig: recommendedKey,
      recommendedExit: recommended?.comparison?.recommendedExit ?? null,
      takeoutDecision: result.recommendedTakeout?.takeout ?? null,
      lotAreaSqft: input.lotAreaSqft ?? null,
      goal: input.goal ?? null,
      zoningTier: result.zoningTier?.code ?? null,
      ward: result.ward?.number ?? null,
      mlsNumber: input.mlsNumber ?? null,
    },
  };
}

export function registerMultiplexUnderwriterRoutes(app: Express): void {
  // ensureTorontoGeoTables was exported and called from nowhere, so on any
  // database where scripts/import-toronto-*.ts had never run, the zoning, tree
  // and heritage tables did not exist — and the screens querying them threw,
  // 500ing the underwriter for every address. Creating them empty is enough:
  // resolveSite already reports "layer not imported yet" for an empty table,
  // which is the honest answer until the import runs.
  ensureTorontoGeoTables()
    .catch((err) => console.error("[multiplex] failed to ensure geo tables:", err.message));

  seedAssumptions()
    .catch((err) => console.error("[multiplex] failed to seed assumptions:", err.message));

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
  // requireVerified gates signed-in-but-unverified accounts only; anonymous
  // callers pass through to the usage cap below, which is the separate concern.
  app.post("/api/multiplex-underwriter", requireVerified, async (req: any, res: Response) => {
    try {
      // An anonymous visitor who already traded their email today gets the
      // signed-in allowance. The first few underwrites stay completely
      // frictionless — gating a first impression would cost more in reach than
      // it gains in captured addresses.
      const unlocked = req.session?.userId
        ? false
        : await hasDailyUnlock(UNDERWRITE_SCOPE, req);
      const limits = unlocked
        ? { anonymous: UNDERWRITE_LIMITS.identified, identified: UNDERWRITE_LIMITS.identified }
        : UNDERWRITE_LIMITS;

      const rate = await consumeDailyUsage(UNDERWRITE_SCOPE, req, limits);
      if (!rate.allowed) {
        return res.status(429).json({
          error: `Daily underwrite limit reached (${rate.limit}/day).`,
          limit: rate.limit,
          remaining: 0,
          // Drives the client's capture card. Once they have already unlocked,
          // there is nothing left to offer and the wall is honest.
          canUnlock: !req.session?.userId && !unlocked,
        });
      }

      const parsed = underwriteRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
      }
      res.json(await executeMultiplexUnderwriter(parsed.data, {
        userId: req.session?.userId ?? null,
        sessionId: req.sessionID ?? null,
        req,
      }));
    } catch (err: any) {
      console.error("[multiplex] underwrite failed:", err);
      if (err?.name === "SiteResolutionError") {
        return res.status(422).json({ error: err.message });
      }
      const listingStatus = listingErrorStatus(err);
      if (listingStatus) {
        return res.status(listingStatus).json({ error: err.message, code: err.name });
      }
      res.status(500).json({ error: "Underwrite failed — please try again." });
    }
  });

  // Data coverage for the page footnote — public, cached five minutes.
  // Registered before /:id so "health" is never read as an underwriting id.
  app.get("/api/multiplex-underwriter/health", async (_req: Request, res: Response) => {
    try {
      res.setHeader("Cache-Control", "public, max-age=300");
      res.json(await getMultiplexDataHealth());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Listing preview: MLS number or realtor.ca URL -> compact ListingSummary so
  // the input step can show what the feed knows before spending an underwrite.
  app.get("/api/multiplex-underwriter/listing/:ref", async (req: any, res: Response) => {
    try {
      const rate = await consumeDailyUsage(LISTING_LOOKUP_SCOPE, req, LISTING_LOOKUP_LIMITS);
      if (!rate.allowed) {
        return res.status(429).json({ error: `Daily listing lookup limit reached (${rate.limit}/day).`, limit: rate.limit });
      }
      const raw = String(req.params.ref ?? "").slice(0, 300);
      const listing = await resolveListingForUnderwrite(raw);
      res.json({ listing, inCoverage: isTorontoCity(listing.city) });
    } catch (err: any) {
      const status = listingErrorStatus(err);
      if (status) return res.status(status).json({ error: err.message, code: err.name });
      console.error("[multiplex] listing lookup failed:", err);
      res.status(502).json({ error: "The listing feed did not respond — try again or enter the address manually." });
    }
  });

  /**
   * Trade an email for the rest of today's underwrites.
   *
   * The daily cap used to end in a red error banner — a dead end at the exact
   * moment someone had proven they were working a real site. It is now the
   * capture point: the lead goes through the same genesis every other surface
   * uses (score, routing, CRM, team alert), and the allowance lifts to the
   * signed-in limit for the rest of the day.
   */
  app.post("/api/multiplex-underwriter/unlock", async (req: any, res: Response) => {
    try {
      const parsed = z
        .object({
          name: z.string().trim().min(1).max(120),
          email: z.string().trim().email().max(200),
          phone: z.string().trim().max(40).optional(),
          consentEmail: z.boolean().optional(),
          address: z.string().trim().max(200).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Enter a name and a valid email." });
      }

      const { name, email, phone, consentEmail, address } = parsed.data;

      await captureDealLead(
        req,
        {
          surface: "multiplex_underwriter",
          eventName: "underwriting_completed",
          userId: req.session?.userId ?? null,
          sessionId: req.sessionID ?? null,
          address: address ?? null,
          city: "Toronto",
          region: "Ontario",
          propertyType: "multiplex",
          metadata: { capturedAt: "daily_limit_unlock" },
        },
        { name, email, phone: phone ?? null, consentEmail: consentEmail ?? false },
      );

      await grantDailyUnlock(UNDERWRITE_SCOPE, req);

      res.json({ unlocked: true, limit: UNDERWRITE_LIMITS.identified });
    } catch (err: any) {
      console.error("[multiplex] unlock failed:", err);
      res.status(500).json({ error: "Could not unlock — please try again." });
    }
  });

  app.get("/api/multiplex-underwriter/shared/:token", async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token);
      if (!/^[a-f0-9]{24}$/.test(token)) return res.status(400).json({ error: "invalid token" });
      const [r] = await db.select({
        id: multiplexUnderwritings.id,
        address: multiplexUnderwritings.address,
        siteJson: multiplexUnderwritings.siteJson,
        resultJson: multiplexUnderwritings.resultJson,
        createdAt: multiplexUnderwritings.createdAt,
      }).from(multiplexUnderwritings).where(eq(multiplexUnderwritings.shareToken, token)).limit(1);
      if (!r) return res.status(404).json({ error: "not found" });
      res.json({ id: r.id, address: r.address, site: r.siteJson, underwrite: r.resultJson, createdAt: r.createdAt, disclaimer: DISCLAIMER });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/multiplex-underwriter/:id", async (req: any, res: Response) => {
    try {
      const id = String(req.params.id);
      const [r] = await db.select()
        .from(multiplexUnderwritings)
        .where(eq(multiplexUnderwritings.id, id))
        .limit(1);
      if (!r) return res.status(404).json({ error: "not found" });
      const isOwner =
        (r.userId && r.userId === req.session?.userId) ||
        (!r.userId && r.sessionId && r.sessionId === req.sessionID);
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
        inputs: r.inputsJson,
        site: r.siteJson,
        underwrite: r.resultJson,
        shareToken: r.shareToken,
        createdAt: r.createdAt,
        disclaimer: DISCLAIMER,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
