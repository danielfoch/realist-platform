---
children_hash: fe5991804e843e9d4049c6b73d14a1192c80c227f6ac2b5afdee59c1b7f2edca
compression_ratio: 0.6607142857142857
condensation_order: 3
covers: [frontend/_index.md, growth/_index.md]
covers_token_total: 1456
summary_level: d3
token_count: 962
type: summary
---
# Platform Knowledge — Structural Overview (d3)

## Domain Architecture

The Realist Platform knowledge base spans two primary domains: **frontend** (UI/UX implementation) and **growth** (viral mechanics & user acquisition). Both domains intersect at user onboarding and sharing flows.

---

## Frontend Domain

**Scope**: React components, form implementations, CSS/design systems, and user flows. Excludes backend routes and database schemas.

### Design System (`design_system/`)
- **Visual Theme**: Dark mode with glassmorphism (`backdrop-filter: blur(10px)`), gradient background `#1a1a2e` → `#16213e`, indigo/purple accents (`#6366f1` → `#8b5cf6`)
- **Component Patterns**: Step indicators, checkbox grids (`minmax(150px, 1fr)`), agreement boxes, routing previews, flex action rows
- **Responsive**: Breakpoint at `640px`; mobile collapses to single-column, hides step titles, stacks buttons
- **Source**: `client/pages/JoinForm.css` — shared across all form components

### Realtor Join Flow (`realtor_join_flow/`)
- **5-Step Wizard**: Contact Info → Business Info → Preferences → Referral Fee → Agreement
- **Referral Fee Structure**: Standard tiers (20%, 25%, 30%, 35%, 40%) or custom (10%–50% in 0.5% increments)
- **Routing Tiers**: Preferred (≥30%), Standard (≥25%), Introductory (<25%) — determines lead routing priority
- **Key Functions**: `getCommittedReferralFee()`, `getReferralRoutingTier()`
- **Data Scope**: 15 Canadian cities, 9 asset types, 7 deal strategies
- **API**: `POST /api/realtors/join` handles submission and tier-based routing

---

## Growth Domain

**Scope**: Viral sharing mechanics, credit/reward systems, growth analytics, and conversion optimization. Excludes authentication and database schema details.

### Viral Sharing System (`viral_sharing/`)
- **Reward Architecture**: 5 qualified actions with escalating credits — `unique_open` (1), `challenge` (2), `fork` (3), `saved_version` (4), `signup` (5) — each with daily share/recipient caps
- **Eligibility Rules**: Signup actions require authenticated `req.userId`; challenge/fork/saved_version require meaningful payload evidence (non-empty fields, changed assumptions, or 10+ char comments)
- **Share Mechanics**: Token via `crypto.randomBytes(18).toString("base64url")`, recipient URLs `/underwriting/${token}?recipient=${recipientKey}`, SHA-256 hashed identifiers, max 25 recipients per batch
- **Lineage Tracking**: `parentShareId`, `parentShareActionId`, `parentShareDepth` enable viral chain attribution (`shareDepth = parentShareId ? Number(parentShareDepth || 0) + 1 : 0`)
- **Credit Preview**: `POST /underwriting-shares/:token/actions/preview` — read-only eligibility checks returning status (`eligible`/`blocked`/`duplicate`/`capped`), remaining caps, CTA text
- **Growth Analytics**: Health score formula `min(100, round(min(opens,5)*8 + min(challenges,4)*10 + min(forkOrSavedVersions,3)*12 + min(signups,2)*12))`; nudge progression `first_open` → `convert_opens_to_challenges` → `convert_challenges_to_versions` → `convert_versions_to_accounts` → `amplify`
- **Conversion Thresholds**: open→challenge <0.35, challenge→version <0.5, version→signup <0.4

### Key Implementation Files
- `src/flywheel-routes.ts` — Preview endpoint and credit helpers
- `src/underwriting-share-routes.ts` — Core share routes with test coverage
- `db/migrations/016_premium_credit_redemptions.sql` — Credit ledger and redemption schema

---

## Cross-Domain Relationships

- **Design System → Realtor Join Flow**: `JoinForm.css` styles are shared across the realtor wizard and other form components
- **Realtor Join Flow → Growth**: Potential viral sharing integration points during realtor onboarding
- **Frontend → Backend**: Realtor join flow submits to `POST /api/realtors/join`; growth preview endpoint at `POST /underwriting-shares/:token/actions/preview`