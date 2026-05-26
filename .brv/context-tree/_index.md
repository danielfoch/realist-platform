---
children_hash: 7c42b6ac4efbd17354c7480e76e5607d22e2b941c5a522cad0db97eaab389710
compression_ratio: 0.6500754147812972
condensation_order: 3
covers: [frontend/_index.md, growth/_index.md]
covers_token_total: 1326
summary_level: d3
token_count: 862
type: summary
---
# Platform Structural Summary (d3)

## Frontend Domain
Covers React components, form implementations, CSS/design systems, and UI state management. Backend routes and DB schemas excluded.

### Design System
**Source**: `client/pages/JoinForm.css`
- **Theme**: Dark mode with glassmorphism (`backdrop-filter: blur(10px)`)
- **Palette**: Gradient bg `#1a1a2e` → `#16213e`, accent `#6366f1` → `#8b5cf6`, success `#10b981`, error `#ef4444`
- **Components**: `.step-indicator`, `.checkbox-grid` (auto-fill `minmax(150px, 1fr)`), `.agreement-box`, `.routing-preview`, `.form-actions`
- **Responsive**: `640px` breakpoint; mobile hides step titles, single-column layout, stacked buttons

### Realtor Join Flow
**Component**: `client/pages/JoinRealtors.tsx` | **API**: `POST /api/realtors/join`
- **5-Step Wizard**: Contact Info → Business Info (brokerage, markets, assets, deals) → Preferences → Referral Fee → Agreement
- **Referral Fee Structure**: Standard tiers (20%, 25%, 30%, 35%, 40%), custom range 10%–50% (0.5% increments)
- **Routing Tiers**: Preferred (≥30%), Standard (≥25%), Introductory (<25%)
- **Key Functions**: `getCommittedReferralFee()`, `getReferralRoutingTier()`
- **Data Scope**: 15 Canadian cities, 9 asset types, 7 deal strategies

---

## Growth Domain
Covers viral growth mechanics, referral systems, and user acquisition features. Excludes auth and DB schema details.

### Viral Sharing Architecture
**Implementation**: `src/underwriting-share-routes.ts`
- **Lineage Tracking**: `parentShareId` / `parentShareActionId` / `parentShareDepth`
- **Token Format**: `crypto.randomBytes(18).toString("base64url")`
- **URL Structure**: `/underwriting/${token}?recipient=${recipientKey}` (SHA256 hashed keys)
- **Core Functions**: `createUnderwritingShare`, `recordQualifiedShareAction`, `getShareActionSummary`, `getGoogleSheetsExportCreditBalance`, `redeemGoogleSheetsExportCredits`
- **Limits**: Max 25 recipients per `createUnderwritingShareRecipientLinks` call

### Premium Credit System
**Credit Type**: `google_sheets_export` | **Storage**: `premium_credit_ledger` (earned) + `premium_credit_redemptions` (redeemed)

| Action | Credits | Daily Share Cap | Daily Recipient Cap |
|--------|---------|-----------------|---------------------|
| unique_open | 1 | 5-8 | 1-2 |
| challenge | 2 | 5-8 | 1-2 |
| fork | 3 | 5-8 | 1-2 |
| saved_version | 4 | 5-8 | 1-2 |
| signup | 5 | 5-8 | 1-2 |

**Eligibility Rules**: Requires `req.userId` (no anonymous signups), meaningful payload changes (10+ chars or non-empty objects/arrays), duplicate action prevention, daily cap enforcement (`shareActionCount < policy.dailyShareCap AND recipientActionCount < policy.dailyRecipientCap`)

### Growth Analytics & Coaching
- **Health Score**: `min(100, round(min(opens,5)*8 + min(challenges,4)*10 + min(forkOrSavedVersions,3)*12 + min(signups,2)*12))`
- **Conversion Nudge Stages**: `first_open → convert_opens_to_challenges → convert_challenges_to_versions → convert_versions_to_accounts → amplify`
- **Thresholds**: openToChallenge <0.35, challengeToVersion <0.5, versionToSignup <0.4

---

## Cross-Domain Relationships
- Design system styles (`JoinForm.css`) shared across realtor join flow and other form components
- Realtor join flow submits to `POST /api/realtors/join`, which routes leads based on referral fee tier
- Growth domain connects to `frontend/realtor_join_flow` (referral mechanics) and `frontend/design_system` (UI consistency)