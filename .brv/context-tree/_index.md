---
children_hash: 369515f60120c85f4570c568803445d955eaf41ac55011bfad6989b589bd4c40
compression_ratio: 0.6319444444444444
condensation_order: 3
covers: [frontend/_index.md, growth/_index.md]
covers_token_total: 1296
summary_level: d3
token_count: 819
type: summary
---
# Realist Platform — Structural Summary (d3)

## Frontend Domain

**Design System** (`JoinForm.css`)
- Dark mode glassmorphism theme with `#1a1a2e` → `#16213e` gradient background and indigo/purple accent (`#6366f1` → `#8b5cf6`)
- Component patterns: horizontal step indicators, auto-fill checkbox grids, tiered routing previews, flex action rows
- Responsive breakpoint at 640px; mobile collapses step titles and stacks layouts vertically

**Realtor Join Flow** (`JoinRealtors.tsx` → `POST /api/realtors/join`)
- 5-step wizard: contact info → business details → preferences → referral fee selection → agreement acceptance
- Referral fee tiers drive lead routing: Preferred (≥30%), Standard (≥25%), Introductory (<25%); custom range 10–50%
- Core functions: `getCommittedReferralFee()` for normalization, `getReferralRoutingTier()` for tier messaging
- Data scope: 15 Canadian cities, 9 asset types, 7 deal strategies

## Growth Domain — Viral Underwriting Share System

**Architecture** (`src/underwriting-share-routes.ts`, migrations 013–014)
- 4 endpoints: create share (`POST /analyses/:id/share`), resolve token (`GET /underwriting-shares/:token`), record action (`POST /underwriting-shares/:token/actions`), owner dashboard (`GET /underwriting-shares/:token/status`)
- 3 core tables: `underwriting_shares`, `underwriting_share_actions`, `premium_credit_ledger`

**Qualified Action Credit Matrix**
- 5 action types with escalating credits: `unique_open` (1), `challenge` (2), `fork` (3), `saved_version` (4), `signup` (5)
- Daily caps enforced per share and per recipient; duplicate/capped actions record with `credit_amount = 0`
- Meaningful payload required for challenge/fork/saved_version (modified fields, non-empty inputs, or ≥10 char comments)

**Core Mechanics & Lineage**
- Tokens: `crypto.randomBytes(18).toString('base64url')`; Recipient ID: `SHA-256(IP:user-agent)`
- Migration 014 adds `parent_share_id`, `parent_share_action_id`, `share_depth` for viral loop tracking (`depth = parentDepth + 1`)
- Qualified fork/save actions clone analysis and create onward shares with "Challenge my underwriting" CTA

**Dashboard & Growth Nudge**
- `getShareActionSummary()` aggregates daily qualified counts, remaining caps, unique recipients, and conversion rates (`openToChallenge`, `challengeToForkOrSavedVersion`, `forkOrSavedVersionToSignup`)
- `getShareGrowthNudge()` returns 5 stage-specific copy variations from `get_first_qualified_open` → `amplify_working_loop`

## Cross-Domain Relationships
- Frontend design system styles are shared across realtor join flow and other form components
- Realtor join flow submits to backend lead routing, which prioritizes based on referral fee tier
- Viral share system drives user acquisition that feeds realtor/investor registration pipelines

## Drill-Down References
- **Design system**: `frontend/design_system/join_form_design_system.md`
- **Realtor flow**: `frontend/realtor_join_flow/realtor_join_flow.md`
- **Qualified action gate**: `growth/viral_sharing/qualified_action_gate/qualified_action_gate.md`
- **Share system**: `growth/viral_sharing/underwriting_share_system.md`
- **Share lineage**: `growth/viral_sharing/underwriting_share_lineage.md`
- **Dashboard**: `growth/viral_sharing/share_status_dashboard.md`