---
children_hash: 8e718a2ef6c0ee5eef3b8d5df76418c3c0cad0db5aeb24d3cf41fc4b7707f992
compression_ratio: 0.1340258855585831
condensation_order: 1
covers: [challenge_share_card_pattern.md, challenge_share_system.md, context.md, credit_preview_system.md, premium_credit_eligibility_rules.md, qualified_share_loop_plan.md, underwriting_share_rewards.md, underwriting_share_system_api.md]
covers_token_total: 5872
summary_level: d1
token_count: 787
type: summary
---
# Viral Sharing — Structural Summary

## Overview
The viral underwriting share system rewards users with **Google Sheets export credits** when recipients perform qualified actions on shared property analyses. The system enforces anti-abuse guards, daily caps, and meaningful engagement requirements.

## Core Architecture

**Implementation:** `src/underwriting-share-routes.ts` with tests in `test/underwriting-share-routes.test.ts`

**Database Tables:** `underwriting_shares`, `underwriting_share_recipients`, `underwriting_share_actions`, `premium_credit_ledger`, `premium_credit_redemptions`

**Share Flow:** create share → generate recipient links (max 25/call, sha256-hashed keys) → qualified action → credit award → loop plan → growth nudge

## Qualified Actions & Credits

| Action | Credits | Daily Share Cap | Daily Recipient Cap |
|--------|---------|-----------------|---------------------|
| `unique_open` | 1 | 5 | 1 |
| `challenge` | 2 | 8 | 2 |
| `fork` | 3 | 8 | 2 |
| `saved_version` | 4 | 8 | 2 |
| `signup` | 5 | 5 | 1 |

## Anti-Abuse Rules
- **Raw clicks never earn credits** — only qualified actions count
- **Signup** requires `authenticatedUserId` (anonymous signups excluded)
- **Challenge/fork/saved_version** require meaningful payload: `challengedFields[]`, `assumptions`/`inputs`/`metrics` objects, or 10+ char `comment`/`notes`
- Duplicate recipient/share/action combinations blocked
- Daily share and recipient caps enforced per action type

## Key Components

- **`underwriting_share_system_api.md`** — Core API: `createUnderwritingShare`, `createUnderwritingShareRecipientLinks`, `recordQualifiedShareAction`, credit balance/redemption
- **`credit_preview_system.md`** — Non-mutating `previewQualifiedShareActionCredit` helper + `POST /underwriting-shares/:token/actions/preview` endpoint; returns eligibility status without inserting rows
- **`premium_credit_eligibility_rules.md`** — Route-level auth enforcement for signup credits; payload validation for challenge/fork/saved_version
- **`challenge_share_system.md`** — Share lineage tracking via `parent_share_id`/`parent_share_action_id`/`shareDepth`; health score formula; growth nudge stages
- **`challenge_share_card_pattern.md`** — `getChallengeShareCard` UI payload generator returning `shareUrl`, `nextQualifiedAction`, instructions, `rewardTeaser`, anti-abuse copy
- **`qualified_share_loop_plan.md`** — `getQualifiedShareLoopPlan` pure helper exposed as `actionSummary.loopPlan`; tracks milestones (first_open → challenge → saved_version → signup); recommends next qualified action based on funnel bottlenecks

## Analytics & Growth

**Health Score:** `min(100, round(min(opens,5)*8 + min(challenges,4)*10 + min(forkOrSavedVersions,3)*12 + min(signups,2)*12))`

**Bottleneck Thresholds:** `openToChallenge < 0.35`, `challengeToVersion < 0.5`, `versionToSignup < 0.4`

**Growth Nudge Stages:** `first_open` → `convert_opens_to_challenges` → `convert_challenges_to_versions` → `convert_versions_to_accounts` → `amplify`

**Loop Plan Milestones:** Analyze deal → Share underwriting → Recipient challenges/forks → Save account-tied version → Share onward