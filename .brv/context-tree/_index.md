---
children_hash: 2822d6acfe2c85a957641302a30351b0f549a0ca51ab94637104e354f47a727b
compression_ratio: 0.5098572399728076
condensation_order: 3
covers: [frontend/_index.md, growth/_index.md]
covers_token_total: 1471
summary_level: d3
token_count: 750
type: summary
---
# Platform Knowledge — Structural Summary (d3)

## Frontend Domain

Covers React UI architecture, design system, and realtor onboarding flows.

**Design System** (`design_system/`)
- Dark glassmorphism theme (`#1a1a2e` → `#16213e` background, indigo/purple accent `#6366f1` → `#8b5cf6`)
- Shared stylesheet: `client/pages/JoinForm.css`
- Responsive breakpoint at `640px`; mobile collapses step titles and stacks layouts
- Component patterns: `.step-indicator`, `.checkbox-grid`, `.agreement-box`, `.routing-preview`

**Realtor Join Flow** (`realtor_join_flow/`)
- 5-step wizard in `client/pages/JoinRealtors.tsx` → `POST /api/realtors/join`
- Steps: Contact → Business Info → Preferences → Referral Fee → Agreement
- Referral fee tiers: Standard options 20–40%, custom 10–50% (0.5% increments)
- Routing tiers: Preferred (≥30%), Standard (≥25%), Introductory (<25%)
- Data scope: 15 Canadian cities, 9 asset types, 7 deal strategies

**Relationship**: Design system styles are shared across join flows; realtor submission triggers backend lead routing based on fee tier.

---

## Growth Domain

Covers viral sharing mechanics, credit rewards, and user acquisition loops.

**Viral Sharing System** (`viral_sharing/`)
- Core route: `src/underwriting-share-routes.ts`
- Rewards Google Sheets export credits for qualified recipient actions (raw clicks excluded)

| Action | Credits | Daily Cap | Qualification |
|--------|---------|-----------|---------------|
| `unique_open` | 1 | 5 | First distinct open |
| `challenge` | 2 | 8 | Modified fields/assumptions or 10+ char comment |
| `fork` | 3 | 8 | Forked with changed assumptions |
| `saved_version` | 4 | 8 | Saved with meaningful payload changes |
| `signup` | 5 | 5 | Authenticated account creation |

- **Anti-abuse**: SHA-256 hashed recipient keys, duplicate prevention, auth-required signups, payload validation, 25-recipient cap per creation call
- **Token format**: `crypto.randomBytes(18).base64url` (share), `crypto.randomBytes(12).base64url` (recipient)
- **URL**: `/underwriting/${token}?recipient=${recipientKey}`
- **Lineage tracking**: `parent_share_id`, `parent_share_action_id`, `shareDepth` for viral chain depth
- **Health score**: Weighted formula capping at 100; conversion thresholds: open→challenge <0.35, challenge→version <0.5, version→signup <0.4
- **Nudge stages**: `get_first_qualified_open` → `convert_opens_to_challenges` → `convert_challenges_to_versions` → `convert_versions_to_accounts` → `amplify_working_loop`

**Database**: `underwriting_shares`, `underwriting_share_recipients`, `underwriting_share_actions`, `premium_credit_ledger`, `premium_credit_redemptions`

**Entry References**: `challenge_share_system.md` (architecture/schema), `underwriting_share_rewards.md` (credits/analytics), `qualified_share_loop_plan.md` (milestones/hashing), `credit_preview_system.md` (read-only preview), `premium_credit_eligibility_rules.md` (auth enforcement), `challenge_share_card_pattern.md` (UI payload/anti-abuse copy)