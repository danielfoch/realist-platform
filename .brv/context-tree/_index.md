---
children_hash: 854339a785eafb96dc5928d991d52e886f4f057cbfc2170790a64f8b7d7ecdfb
compression_ratio: 0.6706349206349206
condensation_order: 3
covers: [frontend/_index.md, growth/_index.md]
covers_token_total: 1260
summary_level: d3
token_count: 845
type: summary
---
# Realist Platform — Structural Summary (d3)

## Frontend Domain

**Scope**: React UI components, form implementations, design system, and user flows. Excludes backend routes and database schemas.

### Design System (`design_system/`)
- **Theme**: Dark mode with glassmorphism (`backdrop-filter: blur(10px)`)
- **Palette**: Gradient background `#1a1a2e` → `#16213e`, indigo/purple accent `#6366f1` → `#8b5cf6`, success green, error red
- **Components**: `.step-indicator`, `.checkbox-grid` (auto-fill `minmax(150px, 1fr)`), `.agreement-box`, `.routing-preview`
- **Responsive**: Breakpoint at `640px`; mobile hides step titles, single-column layout, stacked buttons
- **Source**: `client/pages/JoinForm.css`

### Realtor Join Flow (`realtor_join_flow/`)
- **Component**: `client/pages/JoinRealtors.tsx` → `POST /api/realtors/join`
- **5-Step Wizard**: Contact Info → Business Info (brokerage, markets, assets, deals) → Preferences → Referral Fee → Agreement
- **Referral Fee Tiers**: Standard 20/25/30/35/40%; Custom 10–50% (0.5% increments)
- **Routing Tiers**: Preferred (≥30%), Standard (≥25%), Introductory (<25%)
- **Data Scope**: 15 Canadian cities, 9 asset types, 7 deal strategies
- **Key Functions**: `getCommittedReferralFee()`, `getReferralRoutingTier()`

### Relationships
- `JoinForm.css` styles shared across realtor join flow and other form components
- Realtor join flow triggers backend lead routing based on referral fee tier

---

## Growth Domain

**Scope**: Viral growth mechanics, referral systems, credit/reward systems, user acquisition. Excludes auth and DB schema details.

### Viral Sharing System (`viral_sharing/`)
- **Implementation**: `src/underwriting-share-routes.ts` | **Tests**: `test/underwriting-share-routes.test.ts`
- **Token Generation**: `crypto.randomBytes(18).toString("base64url")` with lineage tracking (`parent_share_id`, `shareDepth`)
- **Recipient Management**: Max 25/call, SHA-256 hashed keys, anonymous recipients from IP+user-agent
- **URL Pattern**: `/underwriting/${token}?recipient=${recipientKey}`
- **Tables**: `underwriting_shares`, `underwriting_share_recipients`, `underwriting_share_actions`, `premium_credit_ledger`, `premium_credit_redemptions`

### Credit Reward Structure
| Action | Credits | Share Cap | Recipient Cap |
|--------|---------|-----------|---------------|
| `unique_open` | 1 | 5 | 1 |
| `challenge` | 2 | 8 | 2 |
| `fork` | 3 | 8 | 2 |
| `saved_version` | 4 | 8 | 2 |
| `signup` | 5 | 5 | 1 |

Credit type: `google_sheets_export`

### Validation & Analytics
- **Rules**: Raw clicks excluded; daily caps enforced; signup requires `req.userId`; challenge/fork/saved_version require meaningful payloads
- **Duplicate Detection**: Share/recipient/action combination
- **Health Score**: `min(100, round(min(opens,5)*8 + min(challenges,4)*10 + min(forkOrSavedVersions,3)*12 + min(signups,2)*12))`
- **Funnel Thresholds**: `openToChallenge < 0.35`, `challengeToVersion < 0.5`, `versionToSignup < 0.4`

### Child Entry References
- `challenge_share_system.md`: Core implementation, qualified action tracking, analytics coaching
- `credit_preview_system.md`: Non-mutating preview endpoint (`POST /underwriting-shares/:token/actions/preview`)
- `premium_credit_eligibility_rules.md`: Auth requirements, payload validation
- `underwriting_share_rewards.md`: Reward structure, lineage tracking, credit management