---
children_hash: ce59dc0e962a904acf6d41addbb88fd98d9ab9861cb8e3efcc7bd6f8a41848e0
compression_ratio: 0.6069078947368421
condensation_order: 3
covers: [frontend/_index.md]
covers_token_total: 608
summary_level: d3
token_count: 369
type: summary
---
# Frontend Domain — Structural Summary (d3)

## Scope
React components, pages, form implementations, CSS/design systems, and UI state management for the Realist Platform. Excludes backend routes and database schemas.

## Design System (`design_system/`)
- **Theme**: Dark mode with glassmorphism cards (`backdrop-filter: blur(10px)`)
- **Palette**: Background gradient `#1a1a2e` → `#16213e`; accent `#6366f1` → `#8b5cf6`; success `#10b981`; error `#ef4444`
- **Components**: `.step-indicator` (horizontal progress), `.checkbox-grid` (auto-fill `minmax(150px, 1fr)`), `.agreement-box`, `.routing-preview`, `.form-actions`
- **Responsive**: Breakpoint at `640px`; mobile collapses to single-column, hides step titles, stacks buttons
- **Source**: `client/pages/JoinForm.css`

## Realtor Join Flow (`realtor_join_flow/`)
- **Component**: `client/pages/JoinRealtors.tsx` | **API**: `POST /api/realtors/join`
- **5-Step Wizard**: Contact Info → Business Info → Preferences → Referral Fee → Agreement
- **Referral Fee Tiers**: Preferred (≥30%), Standard (≥25%), Introductory (<25%); custom range 10%–50% in 0.5% increments
- **Key Functions**: `getCommittedReferralFee()`, `getReferralRoutingTier()`
- **Data Scope**: 15 Canadian cities, 9 asset types, 7 deal strategies

## Relationships
- `JoinForm.css` styles are shared across the realtor join flow and other form components
- Realtor join flow submits to `POST /api/realtors/join`, which routes leads based on referral fee tier