# Analyses convergence — typed metric columns

Task 4 of the Opus task pack. The `analyses` table stored every metric as
untyped jsonb (`results_json` / `inputs_json`), forcing every reader to
regex-parse strings in SQL. This adds five typed, nullable columns and a single
extractor so the store has real numbers, and migrates the AI trainer off the
regex path.

## Schema (the only change — 5 additive nullable columns)

On `analyses`:

| Column | Source jsonb key | Sane-range clamp |
|---|---|---|
| `cap_rate_num` | `results_json.capRate` | −10 .. 25 |
| `cash_flow_monthly_num` | `results_json.monthlyCashFlow` | none (regex/finite only) |
| `dscr_num` | `results_json.dscr` | 0 .. 4 |
| `purchase_price_num` | `inputs_json.purchasePrice`, then `results_json.price` (agent rows) | 50,000 .. 20,000,000 |
| `monthly_rent_num` | `inputs_json.monthlyRent`, then `results_json.monthlyRent` (agent rows) | none (regex/finite only) |

All five are omitted from `insertAnalysisSchema` — they are server-derived, never
client-set. The blob shape does not branch by `strategyType` (the web engine runs
buy&hold math for every strategy), so there are no per-strategy key differences.

## The extractor (single source of truth)

`shared/analysisMetrics.ts` `extractTypedMetrics(row)` is pure, never throws, and
is called by BOTH the write path (`storage.createAnalysis`) and the backfill, so
historical rows and new writes can never diverge. `coerceMetric` applies a
whole-string numeric gate (the JS equivalent of Postgres
`~ '^-?[0-9]+(\.[0-9]+)?$'`) plus the range clamp above.

## Reader migration — scope and the clamp-divergence caveat

The pack assumed one sane-range convention across readers. **The code does not
have one**, so only readers whose clamps match the extractor were migrated:

| Reader | Reads | Clamps | Migrated? |
|---|---|---|---|
| `aiDefaults.ts` trainer | capRate, monthlyCashFlow, purchasePrice | −10..25 / regex / 50k..20M | **Yes** — capRate + cashFlow via `COALESCE(typed, jsonb)`. purchasePrice left on jsonb (the column adds a `results.price` fallback the trainer intentionally excludes). |
| `weeklyDigest.ts` | capRate, cashOnCash, dscr | −10..25 / −50..60 / 0..4 | No — `cashOnCash` has no sanctioned column and the eligibility predicate gates all three metrics at the row level, so a partial migration would entangle. Deferred. |
| `routes.ts` `safeAvgR` (per-city market stats) | capRate, dscr, purchasePrice | **−20..100 / 0..20 / 0..100M** | **No — must not.** Its clamps are wider; reading the −10..25 column would drop rows it legitimately includes and shift results the moment the backfill runs. |
| `marketIntelligence.ts` | capRate, dscr (CTE-local) | (own) | Deferred — verify clamp parity before any future migration. |

The migrated `COALESCE(typed_column, <original jsonb expression>)` is **result-stable
at every backfill state**: before backfill, `typed_column` is NULL for all rows so
`COALESCE` reduces exactly to the original expression; after backfill + new writes,
the typed value equals what the expression would have computed (same clamp, no
fallback mismatch) — to float32 precision, since the columns are `real` while the
jsonb fallback casts to `numeric` (e.g. `5.2` reads back as `~5.19999981`). That
sub-epsilon delta is immaterial to the migrated reader (cap-rate and cash-flow feed
median / Tukey-fence aggregation, where it never flips a quartile or a `BETWEEN`
boundary), but the columns are **not** a bit-exact substitute for the raw jsonb.
The jsonb branch is dead code once fully backfilled.

## Deploy runbook

1. `npm run db:push` — adds 5 nullable `real` columns to `analyses`
   (metadata-only `ADD COLUMN`, no table rewrite/lock). It must show ONLY these
   additions; abort on any drop.
2. `npx tsx scripts/backfill-analysis-metrics.ts --dry-run` — reports counts.
3. `npx tsx scripts/backfill-analysis-metrics.ts` — populates the columns
   (idempotent, batched; re-runnable). Ordering is safe either way thanks to the
   `COALESCE` fallback, but running it promptly retires the jsonb branch and
   lets future readers rely on the columns.

`property_analyses` is a separate table serving the Deal Desk and is intentionally
untouched this phase.
