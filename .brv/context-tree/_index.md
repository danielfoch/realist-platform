---
children_hash: 21b20895b68f51d869b31228282d980cad1386092b9df38d0e8cc3b16c24de25
compression_ratio: 0.7200328407224958
condensation_order: 3
covers: [frontend/_index.md, growth/_index.md]
covers_token_total: 1218
summary_level: d3
token_count: 877
type: summary
---
# Realist Platform — Structural Summary (d3)

## Frontend Domain

**Scope**: React components, pages, form implementations, CSS/design systems, UI state management. Excludes backend routes and database schemas.

### Design System (`design_system`)
- **Theme**: Dark mode with glassmorphism (`backdrop-filter: blur(10px)`), gradient background `#1a1a2e` → `#16213e`
- **Accent**: Indigo/purple gradient `#6366f1` → `#8b5cf6`; status colors green (`#10b981`) and red (`#ef4444`)
- **Components**: `.step-indicator` (horizontal progress), `.checkbox-grid` (auto-fill `minmax(150px, 1fr)`), `.agreement-box`, `.routing-preview`, `.form-actions`
- **Responsive**: Breakpoint at `640px`; mobile hides step titles, single-column layout, stacked buttons
- **Source**: `client/pages/JoinForm.css`

### Realtor Join Flow (`realtor_join_flow`)
- **Component**: `client/pages/JoinRealtors.tsx` | **API**: `POST /api/realtors/join`
- **5-Step Wizard**: Contact Info → Business Info (brokerage, markets, assets, deals) → Preferences (avgDealSize) → Referral Fee → Agreement
- **Referral Fee Tiers**: Preferred (≥30%), Standard (≥25%), Introductory (<25%); standard options 20–40%, custom range 10–50% (0.5% increments)
- **Key Functions**: `getCommittedReferralFee()`, `getReferralRoutingTier()`
- **Data Scope**: 15 Canadian cities, 9 asset types, 7 deal strategies

### Relationships
Design system styles shared across join flows; realtor join flow submits to backend which routes leads by referral tier.

---

## Growth Domain — Viral Sharing

**Scope**: Deal analysis distribution with credit-reward loop tied to qualified recipient actions.

### System Architecture
- **Implementation**: `src/underwriting-share-routes.ts`, `src/analysis-routes.ts`, `db/schema.ts`, migration `013_viral_underwriting_shares.sql`
- **Database**: `underwriting_shares`, `underwriting_share_actions`, `premium_credit_ledger` (credits typed `google_sheets_export`)
- **API Chain**: `POST /analyses/:id/share` → `GET /underwriting-shares/:token` → `POST /underwriting-shares/:token/actions` → `GET /underwriting-shares/:token/status`
- **Auth**: `authenticateOptional` (creation/actions), `authenticateToken` (status, inviter-only)
- **Token Format**: `crypto.randomBytes(18).toString('base64url')`

### Qualified Action Policies
| Action | Credits | Share Cap | Recipient Cap | Payload |
|---|---|---|---|---|
| `unique_open` | 1 | 5 | 1 | None |
| `signup` | 5 | 5 | 1 | None |
| `challenge` | 2 | 8 | 2 | Meaningful |
| `fork` | 3 | 8 | 2 | Meaningful |
| `saved_version` | 4 | 8 | 2 | Meaningful |

**Meaningful payload**: Requires `challengedFields` (non-empty), `assumptions`/`inputs`/`metrics` (non-empty objects), or `comment`/`notes` (≥10 chars).

### Safeguards & Mechanics
- **Duplicate prevention**: Triplet key `(share_id + recipient_hash + action)` returns original credit without re-awarding
- **Cap enforcement**: Overflow actions recorded as `capped` with `credit_amount = 0`
- **Recipient ID**: `sha256(IP:UA)` or explicit identifier
- **Fork/Save**: Authenticated users clone `deal_analyses` rows with optional overrides; `savedAnalysisId` tracked
- **Privacy**: `recentActions` excludes `recipientHash`

### Drill-Down References
- **qualified_action_gate** — `hasMeaningfulChallengePayload()` validation layer
- **underwriting_share_system** — Complete system documentation: API routes, schema, credit logic
- **viral_underwriting_share_loop** — High-level flow: analyze → share → challenge/fork → save → share onward