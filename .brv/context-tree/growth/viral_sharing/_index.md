---
children_hash: 197b4d73dacea4052120a5b78de14a9169538e9bbbb09aa3785c54812c094893
compression_ratio: 0.28427279053583854
condensation_order: 1
covers: [context.md, credit_preview_system.md, premium_credit_eligibility_rules.md, underwriting_share_rewards.md]
covers_token_total: 2874
summary_level: d1
token_count: 817
type: summary
---
# Viral Sharing System — Structural Summary

## Overview
The viral underwriting share system rewards users with premium credits when recipients engage meaningfully with shared property analyses. It encompasses share creation, recipient tracking, action qualification, credit management, and growth analytics.

## Core Architecture

### Qualified Share Actions & Credit Rewards
Five action types with escalating credit values and daily caps:
- **unique_open** — 1 credit (share cap: 5, recipient cap: 1)
- **challenge** — 2 credits (share cap: 8, recipient cap: 2)
- **fork** — 3 credits (share cap: 8, recipient cap: 2)
- **saved_version** — 4 credits (share cap: 8, recipient cap: 2)
- **signup** — 5 credits (share cap: 5, recipient cap: 1)

All credits are typed as `google_sheets_export`. Duplicate recipient/share/action combinations are blocked.

### Eligibility & Qualification Rules
- **Signup actions** require authenticated `req.userId`; anonymous signups earn zero credits
- **Challenge/fork/saved_version** require meaningful payload evidence: non-empty `challengedFields` array, changed `assumptions`/`inputs`/`metrics` objects, or 10+ character comment/notes
- Raw clicks alone never qualify — only unique opens, challenges, forks, signups, or saved versions within daily caps

### Share Mechanics
- **Token generation**: `crypto.randomBytes(18).toString("base64url")`
- **Recipient URLs**: `/underwriting/${token}?recipient=${recipientKey}`
- **Recipient hashing**: SHA-256 for privacy
- **Max recipients**: 25 per `createUnderwritingShareRecipientLinks` call
- **Lineage tracking**: `parentShareId`, `parentShareActionId`, `parentShareDepth` enable viral chain attribution (`shareDepth = parentShareId ? Number(parentShareDepth || 0) + 1 : 0`)

### Credit Preview System
The `previewQualifiedShareActionCredit` helper and `POST /underwriting-shares/:token/actions/preview` endpoint provide read-only eligibility checks without mutating `underwriting_share_actions` or `premium_credit_ledger` tables. Returns status (`eligible`/`blocked`/`duplicate`/`capped`), remaining caps, CTA text, and guardrail copy.

### Growth & Analytics
- **Health score**: `min(100, round(min(opens,5)*8 + min(challenges,4)*10 + min(forkOrSavedVersions,3)*12 + min(signups,2)*12))`
- **Nudge stages**: `first_open` → `convert_opens_to_challenges` → `convert_challenges_to_versions` → `convert_versions_to_accounts` → `amplify`
- **Conversion thresholds**: open→challenge <0.35, challenge→version <0.5, version→signup <0.4

## Key Files
- `src/underwriting-share-routes.ts` — Core share routes, credit preview endpoint, reward logic, lineage tracking, and growth analytics with test coverage
- `test/underwriting-share-routes.test.ts` — Viral underwriting reward and preview coverage
- `db/migrations/016_premium_credit_redemptions.sql` — Credit ledger and redemption schema

## Related Topics
- `frontend/realtor_join_flow` — Realtor onboarding flows that may integrate viral sharing
- `frontend/design_system` — UI components for share flows

## Entry References
- **credit_preview_system.md** — Non-mutating preview endpoint, block reason validation, payload evidence checks
- **premium_credit_eligibility_rules.md** — Route-level auth enforcement, anonymous signup exclusion
- **underwriting_share_rewards.md** — Core reward logic, lineage tracking, health scoring, growth nudges