# PR Notes: Map, Community Analysis, Comments, and Metric Search

## Recommended PR Title

`Add community analysis, listing comments, and metric-based map discovery`

## Summary

This PR moves the map and listing workflow further away from a location-only search tool and toward an investment discovery product.

It adds a community underwriting foundation for listings, including versioned saved analyses, visibility and consent controls, listing comments/private notes, and community aggregates. It also upgrades the map to support metric-driven sorting and filtering across gross yield, cap rate, cash-on-cash, monthly cash flow, and community consensus, while keeping IRR gated behind completeness and feature flags.

The map interaction model was also tightened so marker clicks behave more predictably, quick listing context appears directly on the map, and invalid `$0/$1` listings are filtered out before they can pollute metrics or deal selection.

## Product Changes

- Added versioned community property analyses tied to listing MLS numbers.
- Added per-analysis public/private visibility controls.
- Added per-analysis data-use consent capture and consent audit records.
- Added community analysis history, feedback, duplication, and listing-level aggregate metrics.
- Added listing comments, private notes, replies, helpful/report actions, and moderation-ready structure.
- Upgraded listing cards and map markers with community signals.
- Upgraded the map into a metric-search surface:
  - gross yield
  - cap rate
  - cash-on-cash
  - IRR
  - monthly cash flow
  - community consensus
- Added metric source modes:
  - Realist estimate
  - Community median
  - My saved analyses
- Added metric filters and URL persistence for map state.
- Added metric confidence messaging and assumption transparency.
- Removed the old analyzer-side listing import UI from `Property details` so the calculator leans on the map flow instead.

## Backend / Database Changes

### New community-analysis tables

- `property_analyses`
- `analysis_assumption_changes`
- `analysis_feedback`
- `analysis_consent_events`
- `analysis_events`
- `underwriting_assumption_snapshots`
- `ai_prompt_versions`
- `ai_output_versions`
- `community_metric_snapshots`

### New investment-metrics table

- `property_investment_metrics`

Search-oriented indexes were added for:

- `gross_yield`
- `cap_rate`
- `cash_on_cash_return`
- `irr`
- `monthly_cash_flow`
- listing/property lookup

### Expanded existing tables

- `listing_comments`
  - replies
  - private/public/admin-hidden visibility
  - moderation state
  - helpful/report counts
  - edit/delete metadata
- `listing_analysis_aggregates`
  - analysis counts
  - comment counts
  - medians
  - consensus
  - confidence
  - latest activity

## Key API Additions / Changes

- `POST /api/community/analyses`
- `PATCH /api/community/analyses/:id`
- `GET /api/community/analyses/:mlsNumber`
- `GET /api/community/my-analyses/:mlsNumber`
- `POST /api/community/analyses/:id/duplicate`
- `POST /api/community/analyses/:id/feedback`
- `GET /api/community/ai-context/:mlsNumber`
- `POST /api/community/comments`
- `GET /api/community/comments/:mlsNumber`
- `GET /api/community/private-notes/:mlsNumber`
- `PATCH /api/community/comments/:id`
- `DELETE /api/community/comments/:id`
- `POST /api/community/comments/:id/helpful`
- `POST /api/community/comments/:id/report`
- `GET /api/community/comment-count/:mlsNumber`
- `POST /api/community/my-analysis-metrics`

Map/listing search responses now also filter out invalid `$0/$1` listings before they are shown or scored.

## Frontend Areas Touched

- `client/src/pages/CapRates.tsx`
- `client/src/pages/Home.tsx`
- community analysis components under `client/src/components/`

## Shared Logic Added

- `shared/community.ts`
- `shared/investmentMetrics.ts`

## Privacy / Safety Notes

- Public visibility is not treated as training or commercial-data consent.
- Consent is stored separately in `analysis_consent_events`.
- Private analyses are only available via owner-scoped endpoints.
- Private notes are not exposed through public comment APIs.
- Public user-facing analysis/comment payloads use display-safe identity formatting.
- User-generated comment text is sanitized server-side.
- Community AI context excludes private analyses unless owner-scoped access is explicitly used.

## Feature Flags

### Community

- `ENABLE_COMMUNITY_ANALYSIS`
- `ENABLE_PUBLIC_ANALYSIS_DEFAULT`
- `ENABLE_COMMUNITY_MAP_MARKERS`
- `ENABLE_COMMUNITY_CONTEXT_FOR_AI_ANALYSIS`
- `ENABLE_ANALYSIS_DATA_EXPORTS`
- `ENABLE_LISTING_COMMENTS`
- `ENABLE_COMMENT_REPLIES`
- `ENABLE_PRIVATE_LISTING_NOTES`
- `ENABLE_COMMENT_REPORTING`

### Metric Search

- `ENABLE_METRIC_BASED_MAP_SEARCH`
- `ENABLE_CAP_RATE_SEARCH`
- `ENABLE_IRR_SEARCH`
- `ENABLE_COMMUNITY_METRIC_SEARCH`
- `ENABLE_MY_ANALYSIS_SEARCH`

Recommended production default:

- keep `ENABLE_IRR_SEARCH=false` until exit assumptions and data quality are considered reliable enough

## Metric Logic

### Exposed now

- Gross yield
  - `annual gross rent / purchase price`
- Cap rate
  - `NOI / purchase price`
- Cash-on-cash
  - `(annual cash flow after debt service) / equity invested`
- DSCR
  - `NOI / annual debt service`
- Monthly cash flow
  - based on NOI and debt-service assumptions

### IRR policy

IRR should only be shown when assumptions are complete enough. If assumptions are missing, the UI should show:

`IRR unavailable — missing assumptions`

The calculation helper supports IRR when hold/exit inputs exist, but the recommended production posture is to keep user-facing IRR search disabled until confidence is higher.

## Testing

### Verified

- `npm run build`
- `npx vitest run /home/runner/workspace/shared/investmentMetrics.test.ts /home/runner/workspace/shared/community.test.ts --root /home/runner/workspace`

### Manual QA Checklist

- Open `/tools/cap-rates`
- Change `Search by` between gross yield, cap rate, cash-on-cash, monthly cash flow, and community consensus
- Confirm listing cards reorder and emphasize the selected metric
- Confirm markers/clusters show the selected metric
- Click a marker and verify:
  - no page jump
  - quick card opens beside the marker
  - quick card actions work
- Confirm right-rail results scroll independently of the page
- Confirm `$0/$1` listings do not appear on the map or in results
- Open a listing and save:
  - a public analysis
  - a private analysis
  - a public comment
  - a private note
- Confirm public/community views exclude private records

## Follow-Up Work

- Admin moderation views for analyses/comments
- Historical backfill/cleanup for any old `$0/$1` snapshot records already stored downstream
- Wire community context into any future live AI deal-analysis prompt path
- Consider deleting the now-unused `ListingImport` component and any unneeded import endpoints if they are no longer used elsewhere
- Evaluate code-splitting on the map page because the client bundle is large

## Legal / Privacy Review Needed

- Final consent copy and consent versioning language
- Whether public comments can ever be included in training/export datasets
- Commercial data licensing defaults and disclosures
- Formal deletion/anonymization request handling for user-contributed analyses/comments

## Suggested Git Workflow

If this work is not already in a PR:

1. Create a feature branch from current `main`
2. Push the branch
3. Open a PR
4. Paste this file into the PR description
5. Link any follow-up issues for legal/admin/backfill work
