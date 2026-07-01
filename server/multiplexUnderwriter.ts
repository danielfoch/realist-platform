/**
 * Multiplex Underwriter server module — Phase 1: assumptions store.
 *
 * multiplex_assumptions holds the admin-editable defaults that feed the pure
 * engines in shared/multiplex*.ts. Every row keeps its source and
 * last-verified date so the UI can badge figures and the report writer can
 * cite them. Seeded from the engine defaults; admin edits win thereafter.
 *
 * Phase 3 adds the POST /api/multiplex-underwriter orchestrator here.
 */

import type { Express, Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { isAdmin } from "./auth";
import { DEV_ASSUMPTION_DEFAULTS } from "@shared/multiplexProForma";
import { UNIT_SIZE_DEFAULTS, NET_TO_GROSS_DEFAULT } from "@shared/multiplexConfigs";
import { TORONTO_ENVELOPE_RULES, PRACTICAL_GFA_HAIRCUT } from "@shared/multiplexEnvelope";

// ─── Table ───────────────────────────────────────────────────────────────────

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

// ─── Access ──────────────────────────────────────────────────────────────────

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

// ─── Routes ──────────────────────────────────────────────────────────────────

export function registerMultiplexUnderwriterRoutes(app: Express): void {
  ensureMultiplexTables()
    .then(seedAssumptions)
    .catch((err) => console.error("[multiplex] failed to ensure/seed assumptions:", err.message));

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
}
