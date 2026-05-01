---
children_hash: 225c22d4159a4820a263c4c1e12f10bada085f19915e5ed920391046d2864939
compression_ratio: 0.19119804400977994
condensation_order: 1
covers: [context.md, qualified_action_gate/_index.md, share_status_dashboard.md, underwriting_share_lineage.md, underwriting_share_system.md, viral_underwriting_share_loop.md]
covers_token_total: 4090
summary_level: d1
token_count: 782
type: summary
---
# Viral Underwriting Share System — Structural Summary

## Overview
Viral growth mechanism where users share deal analyses and earn Google Sheets export credits when recipients perform qualified actions. Implemented across `src/underwriting-share-routes.ts`, `src/analysis-routes.ts`, and `db/migrations/013-014`.

## Architecture
- **4 API Routes:** `POST /analyses/:id/share` (create), `GET /underwriting-shares/:token` (read + auto-record unique_open), `POST /underwriting-shares/:token/actions` (record action), `GET /underwriting-shares/:token/status` (owner dashboard)
- **3 Database Tables:** `underwriting_shares`, `underwriting_share_actions`, `premium_credit_ledger`
- **Auth:** `authenticateOptional` for creation/actions; `authenticateToken` for status; no auth for token resolution

## Qualified Action Policies
| Action | Credits | Share Cap/Day | Recipient Cap/Day | Payload Required |
|---|---|---|---|---|
| `unique_open` | 1 | 5 | 1 | No |
| `challenge` | 2 | 8 | 2 | Yes |
| `fork` | 3 | 8 | 2 | Yes |
| `signup` | 5 | 5 | 1 | No |
| `saved_version` | 4 | 8 | 2 | Yes |

**Meaningful payload** (for challenge/fork/saved_version): at least one of `challengedFields[]` (non-empty), `assumptions{}`/`inputs{}`/`metrics{}` (non-empty objects), or `comment`/`notes` (≥10 chars).

## Core Mechanics
- **Token generation:** `crypto.randomBytes(18).toString('base64url')`
- **Recipient identification:** `SHA-256(IP:user-agent)` or explicit recipient hash
- **Duplicate prevention:** Same `share_id + recipient_hash + action` returns original credit, no new award
- **Cap overflow:** Actions recorded as `capped` with `credit_amount = 0`, no ledger insert
- **Fork/Save behavior:** Authenticated users generate new `deal_analyses` record with optional metric/assumption overrides

## Share Lineage (Migration 014)
- Adds `parent_share_id`, `parent_share_action_id`, `share_depth` to `underwriting_shares`
- `shareDepth = parentShareId ? parentShareDepth + 1 : 0` tracks viral loop depth
- Qualified fork/saved_version actions clone analysis and create onward share with CTA "Challenge my underwriting"
- Duplicate/capped actions do not clone or create onward shares

## Share Status Dashboard
- `getShareActionSummary()` aggregates per-action `dailyQualifiedCount`, `dailyRemainingShareCap`, `uniqueRecipientCount`, `qualifiedRecipientCount`, `conversionRates`
- `getShareGrowthNudge()` returns 5 stage-specific copy variations: `get_first_qualified_open` → `convert_opens_to_challenges` → `convert_challenges_to_versions` → `convert_versions_to_accounts` → `amplify_working_loop`
- Conversion funnel tracks: `openToChallenge`, `challengeToForkOrSavedVersion`, `forkOrSavedVersionToSignup`
- `recentActions` intentionally excludes `recipientHash` for privacy

## Related Entries
- `qualified_action_gate` — Validation layer and payload enforcement details
- `underwriting_share_system` — Full route/schema documentation and fact registry
- `underwriting_share_lineage` — Migration 014 depth tracking and onward share creation
- `share_status_dashboard` — Metrics aggregation, conversion rates, and growth nudge logic