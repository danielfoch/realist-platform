---
children_hash: 6d48cde8e2f4edb3feb306f8b68242f42c59af452b7524d7671256df60b877a7
compression_ratio: 0.26166242578456317
condensation_order: 1
covers: [context.md, qualified_action_gate/_index.md, underwriting_share_system.md, viral_underwriting_share_loop.md]
covers_token_total: 2358
summary_level: d1
token_count: 617
type: summary
---
# Viral Sharing — Structural Summary (d1)

## Overview
The viral sharing system enables deal analysis distribution with a credit-reward loop tied to qualified recipient actions. It comprises five action types, cap enforcement, duplicate prevention, and a validation gate to ensure meaningful engagement before credits are awarded.

## Architecture
- **Core files:** `src/underwriting-share-routes.ts`, `src/analysis-routes.ts`, `db/schema.ts`, `db/migrations/013_viral_underwriting_shares.sql`
- **Database:** Three tables — `underwriting_shares`, `underwriting_share_actions`, `premium_credit_ledger` (all credits use type `google_sheets_export`)
- **API Flow:** `POST /analyses/:id/share` → `GET /underwriting-shares/:token` → `POST /underwriting-shares/:token/actions` → `GET /underwriting-shares/:token/status`
- **Auth:** `authenticateOptional` for share creation/actions; `authenticateToken` for status (restricted to inviter)

## Qualified Action Policies
| Action | Credits | Daily Share Cap | Daily Recipient Cap | Payload Required |
|---|---|---|---|---|
| `unique_open` | 1 | 5 | 1 | None |
| `signup` | 5 | 5 | 1 | None |
| `challenge` | 2 | 8 | 2 | Meaningful payload |
| `fork` | 3 | 8 | 2 | Meaningful payload |
| `saved_version` | 4 | 8 | 2 | Meaningful payload |

**Meaningful payload** requires at least one: `challengedFields` (non-empty array), `assumptions`/`inputs`/`metrics` (non-empty objects), or `comment`/`notes` (≥10 chars).

## Safeguards & Mechanics
- **Duplicate prevention:** Triplet key `(share_id + recipient_hash + action)` — returns original credit, no new award
- **Cap overflow:** Actions recorded as `capped` with `credit_amount = 0`, no ledger insert
- **Recipient hashing:** `sha256(IP:UA)` or explicit recipient identifier
- **Token generation:** `crypto.randomBytes(18).toString('base64url')`
- **Fork/Save behavior:** Authenticated users trigger `deal_analyses` row cloning with optional metric/input overrides; `savedAnalysisId` tracked
- **Privacy:** `recentActions` in status response intentionally excludes `recipientHash`

## Related Entries
- **qualified_action_gate** — Validation layer (`hasMeaningfulChallengePayload()`) enforcing payload requirements between action validation and credit recording
- **underwriting_share_system** — Full system documentation including API routes, schema, and credit logic
- **viral_underwriting_share_loop** — High-level flow: analyze → share → challenge/fork → save → share onward