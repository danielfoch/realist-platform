---
children_hash: d40cf109aded1d007115ea86b573b745a12e09d187073a473be29e31c42442c1
compression_ratio: 0.228874337386966
condensation_order: 1
covers: [context.md, qualified_action_gate/_index.md, underwriting_share_lineage.md, underwriting_share_system.md, viral_underwriting_share_loop.md]
covers_token_total: 3207
summary_level: d1
token_count: 734
type: summary
---
# Viral Underwriting Share Loop — Structural Summary

## Overview
Viral growth mechanism where users share deal analyses and earn `google_sheets_export` credits when recipients take qualified actions. Credits awarded only for meaningful engagement, never raw clicks.

## Architecture
**Routes** (`src/underwriting-share-routes.ts`, `src/analysis-routes.ts`):
- `POST /analyses/:id/share` — Create share token (optional auth)
- `GET /underwriting-shares/:token` — Read share, records `unique_open`
- `POST /underwriting-shares/:token/actions` — Record qualified action (optional auth)
- `GET /underwriting-shares/:token/status` — Owner dashboard (required auth)

**Database** (`db/migrations/013_viral_underwriting_shares.sql`, `db/migrations/014_underwriting_share_lineage.sql`):
- `underwriting_shares` — Share records with lineage tracking (`parent_share_id`, `parent_share_action_id`, `share_depth`)
- `underwriting_share_actions` — Action tracking with dedup/cap logic
- `premium_credit_ledger` — Credit awards (type: `google_sheets_export`)
- `deal_analyses` — Cloned on fork/saved_version actions

## Qualified Action Policies
| Action | Credits | Share Cap | Recipient Cap | Payload Required |
|---|---|---|---|---|
| `unique_open` | 1 | 5 | 1 | None |
| `challenge` | 2 | 8 | 2 | Meaningful payload |
| `fork` | 3 | 8 | 2 | Meaningful payload |
| `signup` | 5 | 5 | 1 | None |
| `saved_version` | 4 | 8 | 2 | Meaningful payload |

**Meaningful payload** (`hasMeaningfulChallengePayload`): Requires at least one of `challengedFields` (non-empty array), `assumptions`/`inputs`/`metrics` (non-empty objects), or `comment`/`notes` (≥10 chars).

## Validation & Safeguards
- **Duplicate prevention**: `share_id` + `recipient_hash` + `action` triplet returns original credit, no new award
- **Cap enforcement**: Both daily share cap AND daily recipient cap must pass; overflow actions recorded as `capped` with `credit_amount = 0`
- **Recipient identification**: `SHA256(IP:user-agent)` or explicit recipient hash
- **Token generation**: `crypto.randomBytes(18).toString("base64url")`
- **Privacy**: `recentActions` intentionally excludes `recipientHash`

## Share Lineage (Migration 014)
Authenticated `fork`/`saved_version` actions trigger viral loop continuation:
1. Clone `deal_analyses` record with optional overrides
2. Create onward share with `parent_share_id`, `parent_share_action_id`, `share_depth = parentDepth + 1`
3. Update action metadata with `savedAnalysisId`/`onwardShareId`/`onwardShareToken`
4. CTA: "Challenge my underwriting"
5. Duplicate/capped actions do NOT clone or create onward shares

## Key Relationships
- Parent topic: `growth/viral_sharing`
- Related: `qualified_action_gate` (validation layer), `underwriting_share_system` (core logic), `underwriting_share_lineage` (depth tracking)
- Dependencies: `deal_analyses` table, `authenticateOptional`/`authenticateToken` middleware, `premium_credit_ledger`