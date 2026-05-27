---
children_hash: 6aa8d450e6635677ed73b2e373dc899bf0dd8b63f0056829bf932d970cc1526c
compression_ratio: 0.7374881964117092
condensation_order: 2
covers: [context.md, viral_sharing/_index.md]
covers_token_total: 1059
summary_level: d2
token_count: 781
type: summary
---
# Growth Domain — Structural Summary

## Domain Scope
The **growth** domain covers viral growth mechanics, referral systems, and user acquisition features driving platform adoption. Includes viral sharing, credit/reward systems, growth analytics, and conversion optimization. Excludes authentication and database schema details.

---

## Viral Sharing System (`viral_sharing/`)

### Core Reward Architecture
Five qualified share actions with escalating credit values and daily caps (all typed as `google_sheets_export`):

| Action | Credits | Share Cap | Recipient Cap |
|--------|---------|-----------|---------------|
| `unique_open` | 1 | 5 | 1 |
| `challenge` | 2 | 8 | 2 |
| `fork` | 3 | 8 | 2 |
| `saved_version` | 4 | 8 | 2 |
| `signup` | 5 | 5 | 1 |

Duplicate recipient/share/action combinations are blocked. Raw clicks never qualify.

### Eligibility & Qualification
- **Signup actions**: Require authenticated `req.userId`; anonymous signups earn zero credits
- **Challenge/fork/saved_version**: Require meaningful payload evidence (non-empty `challengedFields`, changed `assumptions`/`inputs`/`metrics`, or 10+ char comment)
- See **premium_credit_eligibility_rules.md** for route-level auth enforcement details

### Share Mechanics & Lineage
- **Token generation**: `crypto.randomBytes(18).toString("base64url")`
- **Recipient URLs**: `/underwriting/${token}?recipient=${recipientKey}`
- **Privacy**: SHA-256 hashing for recipient identifiers
- **Batch limit**: Max 25 recipients per `createUnderwritingShareRecipientLinks` call
- **Viral chain attribution**: `parentShareId`, `parentShareActionId`, `parentShareDepth` track lineage (`shareDepth = parentShareId ? Number(parentShareDepth || 0) + 1 : 0`)

### Credit Preview System
- **Helper**: `previewQualifiedShareActionCredit`
- **Endpoint**: `POST /underwriting-shares/:token/actions/preview`
- Read-only eligibility checks without mutating `underwriting_share_actions` or `premium_credit_ledger`
- Returns: status (`eligible`/`blocked`/`duplicate`/`capped`), remaining caps, CTA text, guardrail copy
- See **credit_preview_system.md** for block reason validation and payload evidence checks

### Growth Analytics & Nudges
- **Health score**: `min(100, round(min(opens,5)*8 + min(challenges,4)*10 + min(forkOrSavedVersions,3)*12 + min(signups,2)*12))`
- **Nudge progression**: `first_open` → `convert_opens_to_challenges` → `convert_challenges_to_versions` → `convert_versions_to_accounts` → `amplify`
- **Conversion thresholds**: open→challenge <0.35, challenge→version <0.5, version→signup <0.4
- See **underwriting_share_rewards.md** for core reward logic, lineage tracking, and growth nudge implementation

---

## Key Implementation Files
- `src/flywheel-routes.ts` — Preview endpoint and credit helpers
- `src/underwriting-share-routes.ts` — Core share routes with test coverage
- `db/migrations/016_premium_credit_redemptions.sql` — Credit ledger and redemption schema

## Related Domains
- **frontend/realtor_join_flow** — Realtor onboarding flows with potential viral sharing integration
- **frontend/design_system** — UI components for share flows