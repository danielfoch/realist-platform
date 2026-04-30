---
children_hash: c30783e7d6ccad986d597f74b20b2ed2dbf7de2b0b0256db7d3c69ce5f9865d8
compression_ratio: 0.6420798065296252
condensation_order: 2
covers: [viral_sharing/_index.md]
covers_token_total: 827
summary_level: d2
token_count: 531
type: summary
---
# Viral Underwriting Share Loop — d2 Structural Summary

## Core Mechanism
Users share deal analyses and earn `google_sheets_export` credits when recipients perform qualified actions. Credits awarded only for meaningful engagement, not raw clicks.

## API Surface (`src/underwriting-share-routes.ts`, `src/analysis-routes.ts`)
- `POST /analyses/:id/share` — Create share token (optional auth)
- `GET /underwriting-shares/:token` — Read share, records `unique_open`
- `POST /underwriting-shares/:token/actions` — Record qualified action
- `GET /underwriting-shares/:token/status` — Owner dashboard (auth required)

## Database Schema (`db/migrations/013_*`, `014_*`)
- `underwriting_shares` — Lineage tracking via `parent_share_id`, `parent_share_action_id`, `share_depth`
- `underwriting_share_actions` — Dedup/cap logic with `share_id` + `recipient_hash` + `action` triplet
- `premium_credit_ledger` — Credit awards (type: `google_sheets_export`)
- `deal_analyses` — Cloned on fork/saved_version actions

## Credit Policy (see `qualified_action_gate`)
| Action | Credits | Share Cap | Recipient Cap |
|---|---|---|---|
| `unique_open` | 1 | 5 | 1 |
| `challenge` | 2 | 8 | 2 |
| `fork` | 3 | 8 | 2 |
| `signup` | 5 | 5 | 1 |
| `saved_version` | 4 | 8 | 2 |

**Meaningful payload** required for challenge/fork/saved_version: non-empty `challengedFields`, `assumptions`/`inputs`/`metrics`, or ≥10 char `comment`/`notes`.

## Safeguards (see `underwriting_share_system`)
- Duplicate triplets return original credit, no new award
- Both share cap AND recipient cap must pass; overflow recorded as `capped` with `credit_amount = 0`
- Recipient ID: `SHA256(IP:user-agent)` or explicit hash
- Token: `crypto.randomBytes(18).toString("base64url")`

## Viral Lineage (see `underwriting_share_lineage`)
Authenticated `fork`/`saved_version` actions trigger loop continuation:
1. Clone `deal_analyses` with optional overrides
2. Create onward share with `share_depth = parentDepth + 1`
3. Update action metadata with `savedAnalysisId`/`onwardShareToken`
4. CTA: "Challenge my underwriting"
5. Capped/duplicate actions do NOT propagate