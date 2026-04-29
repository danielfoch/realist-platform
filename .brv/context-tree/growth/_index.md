---
children_hash: 1984c92362e878ae9733d8b12ee9403c15e86f662f3813e7cac42b404929c3d1
compression_ratio: 0.7777777777777778
condensation_order: 2
covers: [viral_sharing/_index.md]
covers_token_total: 702
summary_level: d2
token_count: 546
type: summary
---
# Viral Sharing — Structural Summary (d2)

## System Architecture
Deal analysis distribution with credit-reward loop tied to qualified recipient actions. Core implementation spans `src/underwriting-share-routes.ts`, `src/analysis-routes.ts`, `db/schema.ts`, and migration `013_viral_underwriting_shares.sql`. Three database tables: `underwriting_shares`, `underwriting_share_actions`, `premium_credit_ledger` (all credits typed as `google_sheets_export`). API chain: `POST /analyses/:id/share` → `GET /underwriting-shares/:token` → `POST /underwriting-shares/:token/actions` → `GET /underwriting-shares/:token/status`. Auth uses `authenticateOptional` for creation/actions, `authenticateToken` for status (inviter-only).

## Qualified Action Policies
Five action types with credit awards and daily caps:

| Action | Credits | Share Cap | Recipient Cap | Payload |
|---|---|---|---|---|
| `unique_open` | 1 | 5 | 1 | None |
| `signup` | 5 | 5 | 1 | None |
| `challenge` | 2 | 8 | 2 | Meaningful |
| `fork` | 3 | 8 | 2 | Meaningful |
| `saved_version` | 4 | 8 | 2 | Meaningful |

Meaningful payload requires at least one: `challengedFields` (non-empty array), `assumptions`/`inputs`/`metrics` (non-empty objects), or `comment`/`notes` (≥10 chars).

## Safeguards & Mechanics
- **Duplicate prevention:** Triplet key `(share_id + recipient_hash + action)` returns original credit without re-awarding
- **Cap enforcement:** Overflow actions recorded as `capped` with `credit_amount = 0`, no ledger insert
- **Recipient identification:** `sha256(IP:UA)` or explicit identifier
- **Token format:** `crypto.randomBytes(18).toString('base64url')`
- **Fork/Save:** Authenticated users clone `deal_analyses` rows with optional metric/input overrides; `savedAnalysisId` tracked
- **Privacy:** `recentActions` excludes `recipientHash`

## Drill-Down References
- **qualified_action_gate** — `hasMeaningfulChallengePayload()` validation layer between action validation and credit recording
- **underwriting_share_system** — Complete system documentation: API routes, schema, credit logic
- **viral_underwriting_share_loop** — High-level flow: analyze → share → challenge/fork → save → share onward