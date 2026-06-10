# Realist.ca Encyclopedia Guide Pack — Batch 2 Report

Date: 2026-05-21
Branch: `content/realist-encyclopedia-guide-pack-batch-2-2026-05-21`
Pushed: yes
Commit: `b249448` (`content: add realist encyclopedia batch 2`)
Remote: `origin https://github.com/danielfoch/realist-platform.git`
PR URL: https://github.com/danielfoch/realist-platform/pull/new/content/realist-encyclopedia-guide-pack-batch-2-2026-05-21

## Counts

- Previous guides: 74
- Added guides: 75
- Total guides: 149
- Previous tool specs: 18
- Added tool specs: 10
- Total tool specs: 28
- Categories now indexed: Analysis, Development, Financing, Legal, Markets, Operations, Strategy, Structures, Tax

## Added content focus

Batch 2 adds investor-heavy searchable entries across:

- Transaction law and purchase conditions
- Planning, zoning, entitlement, environmental, and development risk
- Ontario landlord/tenant operations and rent-control concepts
- Canadian tax and ownership structures
- Appraisal and valuation methods
- Construction lending, draw schedules, holdbacks, liens, preconstruction closing math
- Condo diligence and reserve risk
- Commercial lease / property-management economics

## Added tool specs

1. `development-charge-estimator`
2. `land-transfer-tax-rebate-calculator`
3. `rent-increase-agi-scenario-tool`
4. `condo-fee-reserve-stress-test`
5. `preconstruction-closing-cost-estimator`
6. `construction-draw-holdback-calculator`
7. `after-repair-value-sales-comp-grid`
8. `environmental-risk-checklist`
9. `lease-comparison-gross-vs-net`
10. `property-management-fee-impact-calculator`

## Changed files in commit

- `docs/content/realist-encyclopedia/guides.json`
- `docs/content/realist-encyclopedia/tool-specs.json`
- `docs/content/realist-encyclopedia/manifest.json`
- `docs/content/realist-encyclopedia/README.md`
- `docs/content/realist-encyclopedia/IMPLEMENTATION_PLAN.md`

Note: repo had pre-existing untracked files before this task (`REPLIT_HANDOFF_CONTRACT.md`, `REPLIT_PULL_TEMPLATE.md`, `scripts/`). I did not stage or modify them.

## Validation

Passed:

```bash
python3 - <<'PY'
# JSON sanity validation: counts, duplicate slugs, schema fields, tool refs, related term refs
PY
npm run type-check
```

Validation result:

- JSON parsed successfully
- `guides.json`: 149 entries
- `tool-specs.json`: 28 entries
- No duplicate guide slugs
- No duplicate tool slugs
- Manifest counts match source files
- All guide `toolSpecSlug` values resolve to tool specs
- All tool `guideSlug` values resolve to guides
- All guide `relatedTerms` resolve to guide slugs or tool slugs
- `npm run type-check` passed (`tsc --noEmit`)

## Exact Replit/Codex prompt

```text
You are working in https://github.com/danielfoch/realist-platform on branch content/realist-encyclopedia-guide-pack-batch-2-2026-05-21.

Goal: wire the Realist.ca Investor Encyclopedia content pack into the app with the least risky implementation path.

Content files:
- docs/content/realist-encyclopedia/guides.json
- docs/content/realist-encyclopedia/tool-specs.json
- docs/content/realist-encyclopedia/manifest.json
- docs/content/realist-encyclopedia/README.md
- docs/content/realist-encyclopedia/IMPLEMENTATION_PLAN.md

Current content totals:
- 149 guide entries
- 28 tool specs
- Categories: Analysis, Development, Financing, Legal, Markets, Operations, Strategy, Structures, Tax

Implementation requirements:
1. Preserve the existing /insights/guides experience until the encyclopedia route is verified.
2. Add a searchable encyclopedia index route at /insights/encyclopedia using manifest.searchIndex.
3. Add guide detail pages at /insights/encyclopedia/:slug using guides.json.
4. Render guide sections in this order: summary, definition, formula, example, whyItMatters, investorInterpretation, commonMistakes, realistTieIn, sourceCaveatNotes, relatedTerms.
5. Add calculator/tool CTAs when a guide has toolSpecSlug.
6. Add tool routes or embedded widgets using tool-specs.json where low-risk; if a full calculator is too much for this pass, render a spec-backed placeholder/lead capture CTA without fake calculations.
7. Search should cover title, slug, summary, definition, category, tags, searchKeywords, and relatedTerms.
8. Add SEO metadata and canonical paths from each guide.canonicalPath.
9. Add validation in build/test to catch duplicate slugs, invalid toolSpecSlug refs, invalid guideSlug refs, and manifest count mismatches.
10. Keep all tax/legal/lending content caveated as educational; do not present outputs as advice.

Quality bar:
- No database migration unless clearly necessary.
- No large frontend rewrite.
- Prefer static JSON import or server-side read-only API.
- Run npm run type-check and any existing tests before final.
- Report changed files, validation results, and any routes/components added.
```
