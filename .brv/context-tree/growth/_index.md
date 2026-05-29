---
children_hash: 3a59289295df593d345c27f27599ceec8426d685d0385e570754e0fc64423310
compression_ratio: 0.6376496191512514
condensation_order: 2
covers: [context.md, viral_sharing/_index.md]
covers_token_total: 919
summary_level: d2
token_count: 586
type: summary
---
# Growth Domain — Structural Summary (d2)

## Domain Scope
Covers viral growth mechanics, referral systems, credit/reward systems, and user acquisition features. Excludes authentication and database schema details.

## Viral Sharing System Architecture

**Implementation**: `src/underwriting-share-routes.ts` | **Tests**: `test/underwriting-share-routes.test.ts`

### Core Mechanics
- **Token Generation**: `crypto.randomBytes(18).toString("base64url")` with lineage tracking (`parent_share_id`, `parent_share_action_id`, `shareDepth`)
- **Recipient Management**: Max 25/call, SHA-256 hashed keys, anonymous recipients hashed from IP+user-agent
- **URL Pattern**: `/underwriting/${token}?recipient=${recipientKey}`
- **Database**: `underwriting_shares`, `underwriting_share_recipients`, `underwriting_share_actions`, `premium_credit_ledger`, `premium_credit_redemptions`

### Credit Reward Structure
| Qualified Action | Credits | Share Cap | Recipient Cap |
|------------------|---------|-----------|---------------|
| `unique_open` | 1 | 5 | 1 |
| `challenge` | 2 | 8 | 2 |
| `fork` | 3 | 8 | 2 |
| `saved_version` | 4 | 8 | 2 |
| `signup` | 5 | 5 | 1 |

Credit type: `google_sheets_export`

### Validation Rules
- Raw clicks excluded; only qualified actions within daily caps earn credits
- Signup requires authenticated `req.userId`
- Challenge/fork/saved_version require meaningful payloads (`challengedFields[]`, `assumptions/inputs/metrics`, or 10+ char comment)
- Duplicate detection on share/recipient/action combination
- Health score: `min(100, round(min(opens,5)*8 + min(challenges,4)*10 + min(forkOrSavedVersions,3)*12 + min(signups,2)*12))`

### System Components
- **Credit Preview**: `previewQualifiedShareActionCredit` helper + `POST /underwriting-shares/:token/actions/preview` (read-only eligibility check)
- **Analytics Coaching**: Funnel stages with bottleneck thresholds: `openToChallenge < 0.35`, `challengeToVersion < 0.5`, `versionToSignup < 0.4`

## Child Entry References
- **challenge_share_system.md**: Core implementation, qualified action tracking, analytics coaching
- **credit_preview_system.md**: Non-mutating preview endpoint
- **premium_credit_eligibility_rules.md**: Authentication requirements, payload validation
- **underwriting_share_rewards.md**: Reward structure, lineage tracking, credit management