# Implementation Plan — Realist.ca Investor Encyclopedia

## Least-invasive route

The repo currently has `/api/guides` backed by database rows plus demo data, and existing frontend guide pages under `/insights/guides`. This branch does not rewrite that system. It adds portable JSON content and tool metadata under `docs/content/realist-encyclopedia/` so Replit can choose the safest integration path.

## Recommended integration

1. Copy `guides.json`, `tool-specs.json`, and `manifest.json` into an app-consumable content path, e.g. `frontend/src/content/encyclopedia/` or keep them server-side and expose read-only API endpoints.
2. Add routes:
   - `/insights/encyclopedia` — searchable index using `manifest.searchIndex`.
   - `/insights/encyclopedia/:slug` — guide detail using `guides.json`.
   - `/tools/:toolSlug` or embedded widgets — use `tool-specs.json`.
3. Search fields: title, slug, summary, definition, tags, category, searchKeywords, relatedTerms.
4. Render guide sections in this order: summary, definition, formula, example, why it matters, investor interpretation, common mistakes, Realist tie-in, source/caveat notes, related terms.
5. For guides with `toolSpecSlug`, show a calculator CTA near the formula and example.
6. Keep the existing `/insights/guides` route live until the encyclopedia route is verified.
7. Add telemetry for search queries, guide views, calculator opens, saves, and lead form starts.

## Tool implementation notes

Start with static calculators for: capital stack, waterfall structure, cap rate, DSCR, cash-on-cash, IRR, NOI, LTV, GDS/TDS, mortgage stress test, vacancy allowance, break-even occupancy, yield on cost, refinance risk, sensitivity analysis, rent roll/pro forma, and land transfer tax.

Batch 2 adds specs for: development charge estimator, land transfer tax/rebate calculator, rent increase/AGI scenario tool, condo fee/reserve stress test, preconstruction closing cost estimator, construction draw/holdback calculator, after-repair value/sales comp grid, environmental risk checklist, gross-vs-net lease comparison, and property management fee impact calculator.

Show assumptions, units, caveats, and date-stamped rule inputs. Do not produce a black-box investment score.

## Launch checklist

- Validate JSON schema in build.
- Confirm every related slug resolves or is intentionally aliased.
- Confirm tax/legal/lending caveats render.
- Add SEO metadata and canonical URLs.
- Add sitemap entries.
- QA mobile search and long guide pages.
- Verify no calculator returns misleading output when inputs are missing.
