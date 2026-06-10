---
children_hash: 5611f79eed0b04464f783eba513590cf526fbf032e1c33f6f3daa4bf845b5c61
compression_ratio: 0.5559284116331096
condensation_order: 0
covers: [context.md, qualified_action_gate.md]
covers_token_total: 894
summary_level: d0
token_count: 497
type: summary
---
# Qualified Action Gate — Structural Summary

## Overview
Validation layer within the viral underwriting share loop that prevents empty CTA/button clicks from earning Google Sheets export credits. Implemented via `hasMeaningfulChallengePayload()` in `src/underwriting-share-routes.ts`.

## Architecture
- **Location:** `src/underwriting-share-routes.ts` (enforced in `POST /underwriting-shares/:token/actions`)
- **Position in flow:** Between action type validation and credit recording; returns `400` if metadata insufficient
- **Dependencies:** `underwriting_shares`, `underwriting_share_actions`, `premium_credit_ledger`, `deal_analyses` tables
- **Auth:** `authenticateOptional` for share creation/actions; `authenticateToken` for share status

## Qualification Rules
| Action Type | Qualification | Credits |
|---|---|---|
| `unique_open` | Always qualifies | 1 |
| `signup` | Always qualifies | 5 |
| `challenge` | Requires meaningful payload | 2 |
| `fork` | Requires meaningful payload | 3 |
| `saved_version` | Requires meaningful payload | 4 |

**Meaningful payload requires at least one:** `challengedFields` (non-empty array), `assumptions`/`inputs`/`metrics` (non-empty objects), or `comment`/`notes` (10+ chars).

## Caps & Safeguards
- **Daily share caps:** `unique_open`/`signup` = 5; `challenge`/`fork`/`saved_version` = 8
- **Daily recipient caps:** `unique_open`/`signup` = 1; others = 2
- **Duplicate protection:** Same `share_id` + `recipient_hash` + `action` returns original credit amount, no new credits awarded
- **Cap overflow:** Actions recorded as `capped` with `credit_amount = 0`, no ledger insert

## Fork/Save Behavior
Authenticated users creating `fork` or `saved_version` actions generate a new `deal_analyses` record copying source fields, with optional overrides for `metrics`, `inputs`, `verdictCheck`, and `notes`. The `savedAnalysisId` is tracked for these actions.

## Related
- Parent topic: `growth/viral_sharing/viral_underwriting_share_loop.md`