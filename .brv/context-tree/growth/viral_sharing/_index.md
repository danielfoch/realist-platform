---
children_hash: 636d6c99177c7f0e065a15f0e2a5e9b7be72edf387b06f0dfcd7a8ca2048925c
compression_ratio: 0.16025175502299685
condensation_order: 1
covers: [challenge_share_card_pattern.md, challenge_share_system.md, context.md, credit_preview_system.md, premium_credit_eligibility_rules.md, underwriting_share_rewards.md]
covers_token_total: 4131
summary_level: d1
token_count: 662
type: summary
---
# Viral Sharing System — Structural Summary

## Overview
The viral underwriting share system rewards users with premium credits when recipients engage meaningfully with shared property analyses. Implemented in `src/underwriting-share-routes.ts` with test coverage in `test/underwriting-share-routes.test.ts`.

## Core Architecture
- **Share Creation**: Token generation via `crypto.randomBytes(18).toString("base64url")`, lineage tracking through `parent_share_id`, `parent_share_action_id`, `shareDepth`
- **Recipient Management**: Max 25 recipients per call, keys hashed via `sha256` for privacy, anonymous recipients hashed from IP+user-agent
- **URL Format**: `/underwriting/${token}?recipient=${recipientKey}`
- **Database Tables**: `underwriting_shares`, `underwriting_share_recipients`, `underwriting_share_actions`, `premium_credit_ledger`, `premium_credit_redemptions`

## Qualified Action Types & Credits
| Action | Credits | Daily Share Cap | Daily Recipient Cap |
|--------|---------|-----------------|---------------------|
| `unique_open` | 1 | 5 | 1 |
| `challenge` | 2 | 8 | 2 |
| `fork` | 3 | 8 | 2 |
| `saved_version` | 4 | 8 | 2 |
| `signup` | 5 | 5 | 1 |

Credit type: `google_sheets_export`

## Key Rules & Constraints
- Raw clicks never earn credits — only qualified actions within daily caps
- Signup requires authenticated `req.userId` (anonymous signups excluded)
- Challenge/fork/saved_version require meaningful payload: `challengedFields[]`, `assumptions/inputs/metrics` objects, or 10+ char comment/notes
- Duplicate detection on same share/recipient/action combination
- Health score: `min(100, round(min(opens,5)*8 + min(challenges,4)*10 + min(forkOrSavedVersions,3)*12 + min(signups,2)*12))`

## System Components
- **Credit Preview**: `previewQualifiedShareActionCredit` helper + `POST /underwriting-shares/:token/actions/preview` endpoint — read-only eligibility check without database mutations
- **Analytics Coaching**: Funnel stages (`get_first_qualified_open` → `convert_opens_to_challenges` → `convert_challenges_to_versions` → `convert_versions_to_accounts` → `amplify_working_loop`) with bottleneck thresholds: `openToChallenge < 0.35`, `challengeToVersion < 0.5`, `versionToSignup < 0.4`

## Entry References
- **challenge_share_system.md**: Core share system implementation, qualified action tracking, analytics coaching
- **credit_preview_system.md**: Non-mutating preview endpoint for credit eligibility
- **premium_credit_eligibility_rules.md**: Authentication requirements and payload validation rules
- **underwriting_share_rewards.md**: Reward structure, lineage tracking, credit management functions