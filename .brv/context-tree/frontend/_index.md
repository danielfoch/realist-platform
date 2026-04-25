---
children_hash: 95e95009d094ad4fe51114971c5fa14b00e47b3b1438ec9249fd422f334e1ca0
compression_ratio: 0.5302879841112215
condensation_order: 2
covers: [context.md, design_system/_index.md, realtor_join_flow/_index.md]
covers_token_total: 1007
summary_level: d2
token_count: 534
type: summary
---
# Frontend Domain — Structural Summary (d2)

## Domain Scope
Covers React components, pages, form implementations, CSS/design systems, user flows, and UI state management for the Realist Platform. Backend routes and database schemas are excluded.

---

## Design System

**Source**: `client/pages/JoinForm.css`

### Visual Architecture
- **Theme**: Dark mode with glassmorphism cards
- **Background**: Gradient `#1a1a2e` → `#16213e`
- **Primary Accent**: Indigo/purple gradient `#6366f1` → `#8b5cf6`
- **Status Colors**: Success green (`#10b981` → `#059669`), Error red (`#ef4444`)
- **Cards**: `backdrop-filter: blur(10px)`

### Component Patterns
- `.step-indicator` — Horizontal progress tracker
- `.checkbox-grid` — Auto-fill grid (`minmax(150px, 1fr)`)
- `.agreement-box` — Purple-tinted with arrow bullets
- `.routing-preview` — Green-tinted tier display
- `.form-actions` — Flex row layout

### Responsive Behavior
- Breakpoint at `640px` max-width; mobile hides step titles, switches to single-column, stacks buttons vertically

---

## Realtor Join Flow

**Component**: `client/pages/JoinRealtors.tsx` | **API**: `POST /api/realtors/join`

### 5-Step Wizard
| Step | Focus | Key Fields |
|------|-------|------------|
| 1 | Contact Info | name, email, phone |
| 2 | Business Info | brokerage, marketsServed, assetTypes, dealTypes |
| 3 | Preferences | avgDealSize |
| 4 | Referral Fee | referralFee or customReferralFeePct |
| 5 | Agreement | referralAgreement (required) |

### Referral Fee & Lead Routing
- **Standard Options**: 20%, 25%, 30%, 35%, 40%
- **Custom Range**: 10%–50% (0.5% increments)
- **Routing Tiers**: Preferred (≥30%), Standard (≥25%), Introductory (<25%)

### Key Functions
- `getCommittedReferralFee()` — Normalizes fee display
- `getReferralRoutingTier()` — Determines tier messaging

### Data Scope
- 15 Canadian cities, 9 asset types, 7 deal strategies

---

## Relationships
- Design system styles (`JoinForm.css`) are shared across the realtor join flow and other form components
- Realtor join flow submits to backend `POST /api/realtors/join`, which handles lead routing based on referral fee tier