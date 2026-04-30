---
children_hash: 09c81df806faccd32f70ec0fd35de614b2014f7187222c94eb587fff535b0da2
compression_ratio: 0.7215295095594347
condensation_order: 3
covers: [frontend/_index.md, growth/_index.md]
covers_token_total: 1203
summary_level: d3
token_count: 868
type: summary
---
# Realist Platform — Knowledge Structure (d3)

## Frontend Domain
Covers React UI architecture, design systems, and user flows. Backend routes and schemas excluded.

### Design System (`design_system`)
- **Visual Theme**: Dark mode glassmorphism (`backdrop-filter: blur(10px)`) on gradient `#1a1a2e` → `#16213e`
- **Accent Palette**: Indigo/purple (`#6366f1` → `#8b5cf6`), success green, error red
- **Component Patterns**: `.step-indicator` (horizontal progress), `.checkbox-grid` (auto-fill `minmax(150px, 1fr)`), `.agreement-box`, `.routing-preview`, `.form-actions`
- **Responsive**: Breakpoint at `640px`; mobile collapses step titles, single-column layout, stacked buttons
- **Source**: `client/pages/JoinForm.css` — shared across all form components

### Realtor Join Flow (`realtor_join_flow`)
- **Component**: `client/pages/JoinRealtors.tsx` → `POST /api/realtors/join`
- **5-Step Wizard**: Contact Info → Business Info (brokerage, markets, assets, deals) → Preferences (avg deal size) → Referral Fee → Agreement (required)
- **Referral Fee Structure**: Standard tiers (20%, 25%, 30%, 35%, 40%); custom range 10%–50% (0.5% increments)
- **Routing Tiers**: Preferred (≥30%), Standard (≥25%), Introductory (<25%)
- **Key Functions**: `getCommittedReferralFee()`, `getReferralRoutingTier()`
- **Data Scope**: 15 Canadian cities, 9 asset types, 7 deal strategies

---

## Growth Domain — Viral Underwriting Share Loop
Users share deal analyses and earn `google_sheets_export` credits when recipients perform qualified actions. Credits awarded only for meaningful engagement.

### API Surface (`src/underwriting-share-routes.ts`, `src/analysis-routes.ts`)
| Endpoint | Purpose |
|----------|---------|
| `POST /analyses/:id/share` | Create share token (optional auth) |
| `GET /underwriting-shares/:token` | Read share, records `unique_open` |
| `POST /underwriting-shares/:token/actions` | Record qualified action |
| `GET /underwriting-shares/:token/status` | Owner dashboard (auth required) |

### Database Schema (`db/migrations/013_*`, `014_*`)
- `underwriting_shares` — Lineage via `parent_share_id`, `parent_share_action_id`, `share_depth`
- `underwriting_share_actions` — Dedup/cap on `share_id` + `recipient_hash` + `action` triplet
- `premium_credit_ledger` — Credit awards (type: `google_sheets_export`)
- `deal_analyses` — Cloned on fork/saved_version actions

### Credit Policy (`qualified_action_gate`)
| Action | Credits | Share Cap | Recipient Cap |
|--------|---------|-----------|---------------|
| `unique_open` | 1 | 5 | 1 |
| `challenge` | 2 | 8 | 2 |
| `fork` | 3 | 8 | 2 |
| `signup` | 5 | 5 | 1 |
| `saved_version` | 4 | 8 | 2 |

**Meaningful payload required**: non-empty `challengedFields`, `assumptions`/`inputs`/`metrics`, or ≥10 char `comment`/`notes`.

### Safeguards (`underwriting_share_system`)
- Duplicate triplets return original credit, no new award
- Both share AND recipient caps must pass; overflow recorded as `capped` with `credit_amount = 0`
- Recipient ID: `SHA256(IP:user-agent)` or explicit hash
- Token: `crypto.randomBytes(18).toString("base64url")`

### Viral Lineage (`underwriting_share_lineage`)
Authenticated `fork`/`saved_version` triggers loop continuation:
1. Clone `deal_analyses` with optional overrides
2. Create onward share with `share_depth = parentDepth + 1`
3. Update action metadata with `savedAnalysisId`/`onwardShareToken`
4. CTA: "Challenge my underwriting"
5. Capped/duplicate actions do NOT propagate