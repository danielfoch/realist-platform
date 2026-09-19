import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { learnedAssumptions } from "@/lib/db/schema";
import { provinceCode } from "@/lib/leads/routing";
import { PROVEN_MEMBER } from "./community";
import {
  LEARNABLE_BOUNDS,
  LEARNABLE_FIELDS,
  RENT_RATIO_BOUNDS,
  RENT_RATIO_FIELD,
  type LearnableField,
  type LearnedDefaults,
} from "@/lib/underwriting/underwriter";

/**
 * The flywheel. Every worked analysis records what we offered and what the
 * person kept or changed; this rebuilds, per market, what people who MOVED an
 * assumption moved it to. The next person in that market starts from it.
 *
 * What counts as evidence: a field teaches only through analyses where the
 * person changed THAT field — a default left alone is inertia, not judgement,
 * and counting it would just teach us our own defaults back. One exception,
 * and it is what keeps the loop stable: someone who worked a deal and KEPT a
 * value we offered because the market taught it is confirming it. Without
 * that, a good learned default would starve itself of evidence (nobody edits
 * what's already right), revert, get edited again, and oscillate.
 *
 * Rent is learned as a ratio — their rent ÷ our RAW estimate, never the
 * adjusted one, or the ratio would chase its own tail toward 1.0 — and only
 * from listings whose offered rent was an estimate, not a reported rent. A learned value
 * needs MIN_CONTRIBUTORS different people, and those people must be at least
 * MIN_SHARE of everyone who worked a deal in that market: a vocal few don't
 * get to move the starting point for everybody. Members only — an anonymous
 * session costs nothing to mint, so it can't be evidence. Also: eligible analyses only,
 * the last 18 months, values inside sane bounds. No median ever describes an
 * individual.
 */

export const MIN_CONTRIBUTORS = 5;
export const MIN_SHARE = 0.25;
const WINDOW = sql`interval '18 months'`;

const PROVINCE_NAMES: Record<string, string> = {
  ON: "Ontario", QC: "Quebec", BC: "British Columbia", AB: "Alberta", MB: "Manitoba", SK: "Saskatchewan",
  NS: "Nova Scotia", NB: "New Brunswick", NL: "Newfoundland and Labrador", PE: "Prince Edward Island",
  YT: "Yukon", NT: "Northwest Territories", NU: "Nunavut",
};

type Scope = "city" | "province" | "national";

/** Stored beside the learned assumptions, but read separately: they describe decisions, not inputs. */
export const PURSUE_CAP_FIELD = "pursueCapRate";
export const PASS_CAP_FIELD = "passCapRate";

export interface MarketDecisionLine {
  /** Median cap rate of the deals members here said yes to. */
  pursueAt: number;
  /** Median cap rate of the deals they walked away from. */
  passAt: number | null;
  calls: number;
  scopeLabel: string;
}

export async function rebuildLearnedAssumptions(): Promise<{ written: number }> {
  const db = getDb();
  const fields = sql.join(LEARNABLE_FIELDS.map((field) => sql`${field}`), sql`, `);
  const rows: Array<typeof learnedAssumptions.$inferInsert> = [];

  for (const scope of ["city", "province", "national"] as Scope[]) {
    // k1/k2 identify the market at this scope; '' stands in where a level doesn't apply.
    const k1 = scope === "national" ? sql`'CA'::text` : sql`a.province`;
    const k2 = scope === "city" ? sql`lower(a.city)` : sql`''::text`;
    const present = scope === "city" ? sql`AND a.province IS NOT NULL AND a.city IS NOT NULL` : scope === "province" ? sql`AND a.province IS NOT NULL` : sql``;

    const result = await db.execute(sql`
      WITH base AS (
        SELECT ${k1} AS k1, ${k2} AS k2, a.actor_key, a.edited, a.inputs,
          coalesce(a.learned_applied, '[]'::jsonb) AS kept, a.source, a.rent_source, a.rent_estimate, a.verdict, a.cap_rate
        FROM deal_analyses a
        JOIN users u ON u.id = a.user_id
        WHERE a.eligible AND ${PROVEN_MEMBER} AND a.updated_at > (now() AT TIME ZONE 'utc') - ${WINDOW} ${present}
      ),
      engaged AS (
        -- everyone who worked a deal in this market, whatever they changed
        SELECT k1, k2, count(DISTINCT actor_key)::int AS engaged
        FROM base WHERE jsonb_array_length(edited) > 0 GROUP BY k1, k2
      ),
      moved AS (
        SELECT b.k1, b.k2, f.field,
          percentile_cont(0.25) WITHIN GROUP (ORDER BY (b.inputs ->> f.field)::float) AS p25,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY (b.inputs ->> f.field)::float) AS median,
          percentile_cont(0.75) WITHIN GROUP (ORDER BY (b.inputs ->> f.field)::float) AS p75,
          count(*)::int AS sample_size,
          count(DISTINCT b.actor_key)::int AS contributors
        FROM base b
        JOIN unnest(ARRAY[${fields}]::text[]) AS f(field)
          ON jsonb_exists(b.edited, f.field) OR (jsonb_exists(b.kept, f.field) AND jsonb_array_length(b.edited) > 0)
        WHERE (b.inputs ->> f.field) ~ '^-?[0-9]+([.][0-9]+)?$'
        GROUP BY b.k1, b.k2, f.field
        HAVING count(DISTINCT b.actor_key) >= ${MIN_CONTRIBUTORS}
      ),
      rent AS (
        SELECT b.k1, b.k2, ${RENT_RATIO_FIELD}::text AS field,
          percentile_cont(0.25) WITHIN GROUP (ORDER BY r.ratio) AS p25,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY r.ratio) AS median,
          percentile_cont(0.75) WITHIN GROUP (ORDER BY r.ratio) AS p75,
          count(*)::int AS sample_size,
          count(DISTINCT b.actor_key)::int AS contributors
        FROM base b
        CROSS JOIN LATERAL (SELECT (b.inputs ->> 'monthlyRent')::float / b.rent_estimate AS ratio) r
        WHERE b.source = 'listing' AND b.rent_estimate > 0
          AND b.rent_source IS DISTINCT FROM 'Actual rent'
          AND (b.inputs ->> 'monthlyRent') ~ '^[0-9]+([.][0-9]+)?$'
          AND (jsonb_exists(b.edited, 'monthlyRent') OR (jsonb_exists(b.kept, ${RENT_RATIO_FIELD}) AND jsonb_array_length(b.edited) > 0))
          AND r.ratio BETWEEN 0.4 AND 2.5
        GROUP BY b.k1, b.k2
        HAVING count(DISTINCT b.actor_key) >= ${MIN_CONTRIBUTORS}
      )
      SELECT m.k1 AS province, m.k2 AS city, m.field, m.p25, m.median, m.p75, m.sample_size, m.contributors, e.engaged
      FROM (SELECT * FROM moved UNION ALL SELECT * FROM rent) m
      JOIN engaged e ON e.k1 = m.k1 AND e.k2 = m.k2
      UNION ALL
      -- The market's decision line: the cap rate members say yes at, and the one they walk away from.
      -- A call is its own evidence (nobody makes one by accident), so every calling member is "engaged".
      SELECT b.k1, b.k2, CASE b.verdict WHEN 'pursue' THEN ${PURSUE_CAP_FIELD}::text ELSE ${PASS_CAP_FIELD}::text END,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY b.cap_rate),
        percentile_cont(0.5) WITHIN GROUP (ORDER BY b.cap_rate),
        percentile_cont(0.75) WITHIN GROUP (ORDER BY b.cap_rate),
        count(*)::int, count(DISTINCT b.actor_key)::int, count(DISTINCT b.actor_key)::int
      FROM base b
      WHERE b.verdict IN ('pursue', 'pass') AND b.cap_rate IS NOT NULL AND b.source <> 'multiplex'
      GROUP BY b.k1, b.k2, b.verdict
      HAVING count(DISTINCT b.actor_key) >= ${MIN_CONTRIBUTORS}
    `);

    for (const row of result.rows as Array<Record<string, unknown>>) {
      const field = String(row.field) as LearnableField | typeof RENT_RATIO_FIELD;
      const median = Number(row.median);
      const isDecisionLine = String(row.field) === PURSUE_CAP_FIELD || String(row.field) === PASS_CAP_FIELD;
      const [low, high] = isDecisionLine ? [-5, 25] : field === RENT_RATIO_FIELD ? RENT_RATIO_BOUNDS : (LEARNABLE_BOUNDS[field] ?? [-Infinity, Infinity]);
      if (!isFinite(median) || median < low || median > high) continue;
      const contributors = Number(row.contributors);
      const engaged = Math.max(Number(row.engaged), contributors);
      if (contributors / engaged < MIN_SHARE) continue;
      rows.push({
        scope,
        scopeKey: scope === "national" ? "CA" : scope === "province" ? String(row.province) : `${row.province}|${row.city}`,
        field,
        median: Math.round(median * 100) / 100,
        p25: Number(row.p25),
        p75: Number(row.p75),
        sampleSize: Number(row.sample_size),
        contributors,
      });
    }
  }

  // Replace wholesale: a market that lost its evidence should lose its learned value too.
  await db.delete(learnedAssumptions);
  for (let i = 0; i < rows.length; i += 200) await db.insert(learnedAssumptions).values(rows.slice(i, i + 200));
  return { written: rows.length };
}

function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

/** Best evidence wins per field: the city if it has enough, else the province, else the country. */
export async function getLearnedDefaults(city: string | null | undefined, province: string | null | undefined): Promise<LearnedDefaults> {
  const code = provinceCode(province);
  const cityKey = code && city?.trim() ? `${code}|${city.trim().toLowerCase()}` : null;
  const keys = [cityKey, code, "CA"].filter((key): key is string => Boolean(key));
  let rows: Array<typeof learnedAssumptions.$inferSelect> = [];
  try {
    rows = await getDb().select().from(learnedAssumptions).where(inArray(learnedAssumptions.scopeKey, keys));
  } catch {
    return {}; // No database, no learning — house defaults still work.
  }

  const rank = { city: 0, province: 1, national: 2 } as const;
  const learned: LearnedDefaults = {};
  for (const row of [...rows].sort((a, b) => rank[a.scope] - rank[b.scope])) {
    const field = row.field as LearnableField | typeof RENT_RATIO_FIELD;
    if ((field !== RENT_RATIO_FIELD && !LEARNABLE_FIELDS.includes(field)) || learned[field]) continue;
    learned[field] = {
      value: row.median,
      sampleSize: row.sampleSize,
      scopeLabel: row.scope === "city" ? titleCase(row.scopeKey.split("|")[1] ?? "") : row.scope === "province" ? (PROVINCE_NAMES[row.scopeKey] ?? row.scopeKey) : "Canada",
    };
  }
  return learned;
}

export async function learnedAssumptionCount(): Promise<number> {
  const [row] = await getDb().select({ count: sql<number>`count(*)::int` }).from(learnedAssumptions).where(and(eq(learnedAssumptions.scope, "city")));
  return row?.count ?? 0;
}

/** Where this market's members draw the line. The most local scope with evidence wins. */
export async function getMarketDecisionLine(city: string | null | undefined, province: string | null | undefined): Promise<MarketDecisionLine | null> {
  const code = provinceCode(province);
  const cityKey = code && city?.trim() ? `${code}|${city.trim().toLowerCase()}` : null;
  const keys = [cityKey, code, "CA"].filter((key): key is string => Boolean(key));
  let rows: Array<typeof learnedAssumptions.$inferSelect> = [];
  try {
    rows = await getDb()
      .select()
      .from(learnedAssumptions)
      .where(and(inArray(learnedAssumptions.scopeKey, keys), inArray(learnedAssumptions.field, [PURSUE_CAP_FIELD, PASS_CAP_FIELD])));
  } catch {
    return null;
  }
  for (const key of keys) {
    const pursue = rows.find((row) => row.scopeKey === key && row.field === PURSUE_CAP_FIELD);
    if (!pursue) continue;
    const pass = rows.find((row) => row.scopeKey === key && row.field === PASS_CAP_FIELD);
    return {
      pursueAt: pursue.median,
      passAt: pass?.median ?? null,
      calls: pursue.sampleSize + (pass?.sampleSize ?? 0),
      scopeLabel: pursue.scope === "city" ? titleCase(key.split("|")[1] ?? "") : pursue.scope === "province" ? (PROVINCE_NAMES[key] ?? key) : "Canada",
    };
  }
  return null;
}
