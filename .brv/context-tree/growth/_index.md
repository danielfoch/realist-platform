---
children_hash: ea03c396a42d14ed7511668ecea98e2a798729aa8bd0bcb92c4b0d5f32650e47
compression_ratio: 0.7082152974504249
condensation_order: 2
covers: [context.md, viral_sharing/_index.md]
covers_token_total: 1059
summary_level: d2
token_count: 750
type: summary
---
# Growth Domain — Structural Summary

## Domain Scope
Covers viral growth mechanics, referral systems, credit/reward systems, and user acquisition features. Excludes general authentication and database schema details.

---

## Viral Sharing System

**Core Implementation:** `src/underwriting-share-routes.ts` | Tests: `test/underwriting-share-routes.test.ts`

**Database:** `underwriting_shares`, `underwriting_share_recipients`, `underwriting_share_actions`, `premium_credit_ledger`, `premium_credit_redemptions`

### Share Flow
`create share` → `generate recipient links` (max 25/call, sha256-hashed) → `qualified action` → `credit award` → `loop plan` → `growth nudge`

### Credit Reward Tiers

| Action | Credits | Daily Share Cap | Daily Recipient Cap |
|--------|---------|-----------------|---------------------|
| `unique_open` | 1 | 5 | 1 |
| `challenge` | 2 | 8 | 2 |
| `fork` | 3 | 8 | 2 |
| `saved_version` | 4 | 8 | 2 |
| `signup` | 5 | 5 | 1 |

### Anti-Abuse Guards
- Raw clicks excluded; only qualified actions earn credits
- Signup requires `authenticatedUserId` (anonymous excluded)
- Challenge/fork/saved_version require meaningful payloads (`challengedFields[]`, `assumptions`/`inputs`/`metrics`, or 10+ char `comment`/`notes`)
- Duplicate recipient/share/action combinations blocked
- Daily caps enforced per action type

### Component Map

- **`underwriting_share_system_api.md`** — Core API: `createUnderwritingShare`, `createUnderwritingShareRecipientLinks`, `recordQualifiedShareAction`, credit balance/redemption
- **`credit_preview_system.md`** — Non-mutating `previewQualifiedShareActionCredit` helper + `POST /underwriting-shares/:token/actions/preview` endpoint; returns eligibility without inserting rows
- **`premium_credit_eligibility_rules.md`** — Route-level auth enforcement for signup credits; payload validation for challenge/fork/saved_version
- **`challenge_share_system.md`** — Share lineage via `parent_share_id`/`parent_share_action_id`/`shareDepth`; health score formula; growth nudge stages
- **`challenge_share_card_pattern.md`** — `getChallengeShareCard` UI payload generator returning `shareUrl`, `nextQualifiedAction`, instructions, `rewardTeaser`, anti-abuse copy
- **`qualified_share_loop_plan.md`** — `getQualifiedShareLoopPlan` pure helper exposed as `actionSummary.loopPlan`; tracks milestones (first_open → challenge → saved_version → signup); recommends next action based on funnel bottlenecks

### Analytics & Growth Metrics

**Health Score:** `min(100, round(min(opens,5)*8 + min(challenges,4)*10 + min(forkOrSavedVersions,3)*12 + min(signups,2)*12))`

**Bottleneck Thresholds:** `openToChallenge < 0.35` | `challengeToVersion < 0.5` | `versionToSignup < 0.4`

**Growth Nudge Stages:** `first_open` → `convert_opens_to_challenges` → `convert_challenges_to_versions` → `convert_versions_to_accounts` → `amplify`

**Loop Plan Milestones:** Analyze deal → Share underwriting → Recipient challenges/forks → Save account-tied version → Share onward