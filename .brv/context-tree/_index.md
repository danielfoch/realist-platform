---
children_hash: 23cadb9e59a92cc5e0fbe252e9917688aa769da05929f0148cae07a20eeb9727
compression_ratio: 0.7242105263157895
condensation_order: 3
covers: [frontend/_index.md, growth/_index.md]
covers_token_total: 1425
summary_level: d3
token_count: 1032
type: summary
---
# Realist Platform — Structural Summary (d3)

## Domain Overview

### Frontend Domain
Covers React UI architecture, design system implementation, and user onboarding flows. Backend routes and database schemas are excluded.

**Design System** (`design_system/_index.md`)
- **Theme**: Dark mode glassmorphism (`#1a1a2e` → `#16213e` gradient, `backdrop-filter: blur(10px)`)
- **Accent Palette**: Indigo/purple (`#6366f1` → `#8b5cf6`), success green, error red
- **Component Patterns**: `.step-indicator` (horizontal progress), `.checkbox-grid` (auto-fill responsive), `.agreement-box`, `.routing-preview`, `.form-actions`
- **Responsive**: Breakpoint at `640px`; mobile collapses step titles, single-column layout, stacked buttons

**Realtor Join Flow** (`realtor_join_flow/_index.md`)
- **Component**: `client/pages/JoinRealtors.tsx` → `POST /api/realtors/join`
- **5-Step Wizard**: Contact Info → Business Info → Preferences → Referral Fee → Agreement
- **Referral Fee Structure**: Standard tiers (20%, 25%, 30%, 35%, 40%) or custom (10%–50%, 0.5% increments)
- **Routing Tiers**: Preferred (≥30%), Standard (≥25%), Introductory (<25%)
- **Data Scope**: 15 Canadian cities, 9 asset types, 7 deal strategies
- **Key Functions**: `getCommittedReferralFee()`, `getReferralRoutingTier()`

---

### Growth Domain
Covers viral mechanics, referral credit systems, and user acquisition loops. Excludes general auth and database schema details.

**Viral Sharing System** (`viral_sharing/_index.md`)
- **Core API**: `src/underwriting-share-routes.ts` | Tables: `underwriting_shares`, `underwriting_share_recipients`, `underwriting_share_actions`, `premium_credit_ledger`, `premium_credit_redemptions`
- **Share Flow**: `create share` → `generate recipient links` (max 25/call, sha256-hashed) → `qualified action` → `credit award` → `loop plan` → `growth nudge`

**Credit Reward Tiers**
| Action | Credits | Daily Share Cap | Daily Recipient Cap |
|--------|---------|-----------------|---------------------|
| `unique_open` | 1 | 5 | 1 |
| `challenge` | 2 | 8 | 2 |
| `fork` | 3 | 8 | 2 |
| `saved_version` | 4 | 8 | 2 |
| `signup` | 5 | 5 | 1 |

**Anti-Abuse Guards**: Raw clicks excluded; signup requires `authenticatedUserId`; challenge/fork/saved_version require meaningful payloads; duplicate combinations blocked; daily caps enforced per action type.

**Component Architecture**
- `underwriting_share_system_api.md` — Core API: share creation, recipient links, action recording, credit balance/redemption
- `credit_preview_system.md` — Non-mutating `previewQualifiedShareActionCredit` + `POST /underwriting-shares/:token/actions/preview`
- `premium_credit_eligibility_rules.md` — Route-level auth enforcement, payload validation
- `challenge_share_system.md` — Share lineage via `parent_share_id`/`parent_share_action_id`/`shareDepth`; health score formula; growth nudge stages
- `challenge_share_card_pattern.md` — `getChallengeShareCard` UI payload: `shareUrl`, `nextQualifiedAction`, `rewardTeaser`, anti-abuse copy
- `qualified_share_loop_plan.md` — `getQualifiedShareLoopPlan` pure helper; tracks milestones (first_open → challenge → saved_version → signup); recommends next action based on funnel bottlenecks

**Analytics & Growth Metrics**
- **Health Score**: `min(100, round(min(opens,5)*8 + min(challenges,4)*10 + min(forkOrSavedVersions,3)*12 + min(signups,2)*12))`
- **Bottleneck Thresholds**: `openToChallenge < 0.35` | `challengeToVersion < 0.5` | `versionToSignup < 0.4`
- **Growth Nudge Stages**: `first_open` → `convert_opens_to_challenges` → `convert_challenges_to_versions` → `convert_versions_to_accounts` → `amplify`
- **Loop Milestones**: Analyze deal → Share underwriting → Recipient challenges/forks → Save account-tied version → Share onward

---

## Cross-Domain Relationships
- Design system styles (`JoinForm.css`) are shared across realtor join flow and other form components
- Realtor join flow submits to backend `POST /api/realtors/join`, which handles lead routing based on referral fee tier
- Viral sharing system integrates with premium credit ledger for reward distribution and redemption tracking