---
children_hash: c4d318b09836af496d692be9fc0cf2c4ddf296a1cdb805fd94449f07e0688633
compression_ratio: 0.7074829931972789
condensation_order: 2
covers: [viral_sharing/_index.md]
covers_token_total: 882
summary_level: d2
token_count: 624
type: summary
---
# Viral Underwriting Share System — d2 Structural Summary

## System Architecture
Viral growth engine implemented in `src/underwriting-share-routes.ts`, `src/analysis-routes.ts`, and migrations `013-014`. Users share deal analyses and earn Google Sheets export credits when recipients perform qualified actions.

**4 API Endpoints:**
- `POST /analyses/:id/share` — create share
- `GET /underwriting-shares/:token` — resolve token + auto-record `unique_open`
- `POST /underwriting-shares/:token/actions` — record qualified action
- `GET /underwriting-shares/:token/status` — owner dashboard (auth required)

**3 Core Tables:** `underwriting_shares`, `underwriting_share_actions`, `premium_credit_ledger`

## Qualified Action Credit Matrix
| Action | Credits | Share Cap/Day | Recipient Cap/Day |
|---|---|---|---|
| `unique_open` | 1 | 5 | 1 |
| `challenge` | 2 | 8 | 2 |
| `fork` | 3 | 8 | 2 |
| `saved_version` | 4 | 8 | 2 |
| `signup` | 5 | 5 | 1 |

Actions for `challenge`/`fork`/`saved_version` require meaningful payload (modified fields, non-empty assumptions/inputs/metrics, or ≥10 char comment). Duplicate actions return original credit; capped actions record with `credit_amount = 0`.

## Core Mechanics
- **Tokens:** `crypto.randomBytes(18).toString('base64url')`
- **Recipient ID:** `SHA-256(IP:user-agent)` or explicit hash
- **Fork/Save:** Authenticated users create new `deal_analyses` record with optional overrides

## Share Lineage (Migration 014)
Adds `parent_share_id`, `parent_share_action_id`, `share_depth` to track viral loop depth (`depth = parentDepth + 1`). Qualified fork/saved_version actions clone analysis and create onward share with CTA "Challenge my underwriting". Capped/duplicate actions do not propagate.

## Dashboard & Growth Nudge
`getShareActionSummary()` aggregates daily qualified counts, remaining caps, unique recipients, and conversion rates (`openToChallenge`, `challengeToForkOrSavedVersion`, `forkOrSavedVersionToSignup`). `getShareGrowthNudge()` returns 5 stage-specific copy variations from `get_first_qualified_open` → `amplify_working_loop`. `recentActions` excludes `recipientHash` for privacy.

## Child Entries for Drill-Down
- **qualified_action_gate** — Validation layer and payload enforcement
- **underwriting_share_system** — Full route/schema documentation
- **underwriting_share_lineage** — Migration 014 depth tracking and onward share creation
- **share_status_dashboard** — Metrics aggregation, conversion rates, growth nudge logic