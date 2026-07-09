/**
 * Typed-metric extractor for the `analyses` table.
 *
 * Pure, side-effect-free, zero server/db imports. Given an analysis row's
 * `resultsJson` + `inputsJson` (and `strategyType`), it maps the five
 * canonical metrics into typed `number | null` values that are persisted in
 * the physical `*_num` columns (see shared/schema.ts `analyses`).
 *
 * This is the SINGLE source of truth for the jsonb → number coercion. Both
 * the write path (server/storage.ts createAnalysis) and the backfill
 * (scripts/backfill-analysis-metrics.ts) call it, so historical rows and new
 * writes can never disagree.
 *
 * IMPORTANT — the clamps below match ONE reader family, not all readers.
 * The repo does NOT have a single sane-range convention:
 *   - MATCHES these clamps (so a COALESCE(typed, jsonb) migration agrees to
 *     float32 precision — see the `real`-column note below): the aiDefaults
 *     trainer (cap_rate -10..25, purchasePrice 50k..20M, monthlyCashFlow
 *     regex-only) and the weeklyDigest eligibility predicate (capRate -10..25,
 *     dscr 0..4).
 *   - DIVERGES (so those readers MUST NOT read these columns): the per-city
 *     market-stats aggregator `safeAvgR` in server/routes.ts (capRate -20..100,
 *     dscr 0..20, purchasePrice 0..100M) and routes.ts purchasePrice `> 0`
 *     guards. A typed column clamped to -10..25 would drop rows those readers
 *     legitimately include, shifting their results the moment the backfill
 *     runs. See docs/engineering/ANALYSES-METRICS.md for the full mapping.
 *
 * Precision note: the physical columns are `real` (float32, per the task
 * spec), while the jsonb fallback casts to `numeric`. So a backfilled value
 * agrees with the jsonb expression only to float32 precision (e.g. 5.2 reads
 * back as ~5.19999981). This is immaterial to the migrated reader — cap-rate
 * and cash-flow feed robust median / Tukey-fence aggregation where a
 * sub-epsilon delta never flips a quartile or a BETWEEN boundary — but it is
 * NOT bit-exact, so do not treat the columns as an exact substitute for the
 * raw jsonb in any equality-sensitive context.
 *
 * Key-path notes (confirmed against the 4 write sites):
 *   - capRate / dscr / monthlyCashFlow live in results_json (both web + agent).
 *     Web (calculateBuyHoldAnalysis) and agent (underwriteSimple) use the same
 *     top-level key spellings for these three.
 *   - purchasePrice / monthlyRent are INPUT-side: every write site guarantees
 *     inputs_json.purchasePrice and (web) inputs_json.monthlyRent. Agent rows
 *     additionally mirror them into results_json as `price` / `monthlyRent`,
 *     and the agent custom path may OMIT inputs_json.monthlyRent (optional in
 *     underwriteCustomSchema). So we read inputs_json first and fall back to
 *     results_json (price / monthlyRent) — source-agnostic and maximally
 *     complete. Strategy does not branch the blob shape (the web engine runs
 *     buy&hold for every strategyType), so no per-strategy key differences
 *     exist; strategyType is accepted for forward-compat and parity with the
 *     row shape but does not change the mapping today.
 */

// ---------- sane-range clamps (verbatim from the existing SQL readers) ----------

// Cap rate: signed. weeklyDigest.ts:95, aiDefaults.ts:119, marketIntelligence.ts:127/134/166.
export const CAP_RATE_MIN = -10;
export const CAP_RATE_MAX = 25;

// DSCR: signed (0..4). weeklyDigest.ts:103, marketIntelligence.ts:136/174.
export const DSCR_MIN = 0;
export const DSCR_MAX = 4;

// Monthly cash flow: signed, regex-guarded only in existing code (Tukey-fenced
// downstream per-market in aiDefaults). No hard BETWEEN clamp exists in the
// repo, so we DO NOT invent one — regex/finite guard only (matches aiDefaults
// `cash_flow` CASE). We still fence NaN/Infinity to null.
// (no MIN/MAX constants by design)

// Purchase price: unsigned. aiDefaults.ts:121-123 (the only hard range in code).
export const PURCHASE_PRICE_MIN = 50_000;
export const PURCHASE_PRICE_MAX = 20_000_000;

// Monthly rent: no hard BETWEEN range exists in the repo today, and there is
// NO SQL reader of monthlyRent to match. We regex/finite-guard only (garbage
// and non-finite → null); we deliberately do NOT range-guard, so a literal 0
// or negative passes through as a number. No reader depends on this today; a
// future reader must apply its own floor if it wants one.
// (no MIN/MAX constants by design)

/** Whole-string numeric gate — the deliberate replacement for parseFloat.
 * `parseFloat("12abc") === 12`; this requires the ENTIRE string to be numeric,
 * exactly like the Postgres `~ '^-?[0-9]+(\.[0-9]+)?$'` guard the readers use. */
const NUMERIC_RE = /^-?\d+(\.\d+)?$/;

/**
 * Coerce a raw jsonb value (string OR number — node-postgres round-trips jsonb
 * numbers to JS numbers, while SQL `->>'x'` always sees text) to a finite
 * number, or null. When min/max are provided, out-of-range → null. This is the
 * "garbage in → null out" primitive shared with the SQL backfill.
 */
export function coerceMetric(
  raw: unknown,
  min?: number,
  max?: number,
): number | null {
  let n: number;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    n = raw;
  } else {
    const s = raw == null ? "" : String(raw);
    if (!NUMERIC_RE.test(s)) return null;
    n = Number(s);
    if (!Number.isFinite(n)) return null;
  }
  if (min != null && n < min) return null;
  if (max != null && n > max) return null;
  return n;
}

export interface TypedMetrics {
  capRateNum: number | null;
  cashFlowMonthlyNum: number | null;
  dscrNum: number | null;
  purchasePriceNum: number | null;
  monthlyRentNum: number | null;
}

/** The subset of an `analyses` row extractTypedMetrics needs. Accepts the full
 * `Analysis` row (structurally) as well as any producer-built insert payload. */
export interface AnalysisMetricSource {
  resultsJson?: unknown;
  inputsJson?: unknown;
  strategyType?: string | null;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v != null && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

/**
 * Extract the five typed metrics from an analysis row. Never throws — any
 * malformed / missing blob yields nulls for the affected metrics.
 */
export function extractTypedMetrics(row: AnalysisMetricSource): TypedMetrics {
  const results = asRecord(row?.resultsJson);
  const inputs = asRecord(row?.inputsJson);

  // capRate / dscr / monthlyCashFlow — results_json, identical key across sources.
  const capRateNum = coerceMetric(results.capRate, CAP_RATE_MIN, CAP_RATE_MAX);
  const dscrNum = coerceMetric(results.dscr, DSCR_MIN, DSCR_MAX);
  // monthlyCashFlow (NOT `cashFlowMonthly` — that alias never appears in this
  // blob). Regex/finite-guard only, no hard range (parity with aiDefaults).
  const cashFlowMonthlyNum = coerceMetric(results.monthlyCashFlow);

  // purchasePrice — inputs_json.purchasePrice (all sites) with agent-row
  // results_json.price fallback.
  const purchasePriceNum =
    coerceMetric(inputs.purchasePrice, PURCHASE_PRICE_MIN, PURCHASE_PRICE_MAX) ??
    coerceMetric(results.price, PURCHASE_PRICE_MIN, PURCHASE_PRICE_MAX);

  // monthlyRent — inputs_json.monthlyRent (web + agent-listing) with agent
  // results_json.monthlyRent fallback (agent-custom may omit the input). No
  // hard range (parity: regex/finite-guard only).
  const monthlyRentNum =
    coerceMetric(inputs.monthlyRent) ?? coerceMetric(results.monthlyRent);

  return {
    capRateNum,
    cashFlowMonthlyNum,
    dscrNum,
    purchasePriceNum,
    monthlyRentNum,
  };
}
