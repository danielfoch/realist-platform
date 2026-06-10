---
title: Underwriting Share Lineage
tags: []
related: [growth/viral_sharing/underwriting_share_system.md, growth/viral_sharing/qualified_action_gate.md]
keywords: []
importance: 60
recency: 1
maturity: draft
updateCount: 2
createdAt: '2026-04-30T05:03:35.549Z'
updatedAt: '2026-04-30T05:05:49.842Z'
---
## Raw Concept
**Task:**
Document underwriting share lineage tracking — Migration 014 adds parent_share_id, parent_share_action_id, and share_depth to underwriting_shares for viral loop depth tracking

**Changes:**
- Added parent_share_id, parent_share_action_id, share_depth columns to underwriting_shares
- Authenticated qualified fork/saved_version actions create challenger saved analysis then onward share
- Onward share uses CTA "Challenge my underwriting"
- Duplicate/capped actions do not clone analyses or create onward shares

**Files:**
- db/migrations/014_underwriting_share_lineage.sql
- src/underwriting-share-routes.ts
- test/underwriting-share-routes.test.ts

**Flow:**
qualified fork/saved_version action -> clone deal_analyses -> createUnderwritingShare with lineage params -> update action metadata with savedAnalysisId/onwardShareId/onwardShareToken -> return response

**Timestamp:** 2026-04-30

**Patterns:**
- `shareDepth = parentShareId ? parentShareDepth + 1 : 0` - Computes viral loop depth from parent share
- `crypto.randomBytes(18).toString("base64url")` - Generates share token
- `SHA256(ip:user-agent)` - Recipient hash for dedup when no explicit recipient

## Narrative
### Structure
Migration 014 adds three columns to underwriting_shares: parent_share_id (references underwriting_shares.id), parent_share_action_id (references underwriting_share_actions.id), share_depth (INTEGER, default 0). Indexes on (parent_share_id, created_at DESC) and (share_depth, created_at DESC). Source: src/underwriting-share-routes.ts with test coverage in test/underwriting-share-routes.test.ts

### Dependencies
Requires authenticated user for fork/saved_version onward share creation. Depends on premium_credit_ledger for credit awards. Uses underwriting_share_actions for dedup/cap logic.

### Highlights
Share depth tracks viral loop: original owner share = 0, recipient onward share = 1, etc. Five qualified share actions with policies: unique_open (credit 1, cap 5/1), challenge (credit 2, cap 8/2), fork (credit 3, cap 8/2), signup (credit 5, cap 5/1), saved_version (credit 4, cap 8/2). hasMeaningfulChallengePayload validates challenge/fork/saved_version payloads require challengedFields, assumptions/inputs/metrics, or comment/notes >= 10 chars. Route endpoints: POST /analyses/:id/share (optional auth), GET /underwriting-shares/:token (no auth, records unique_open), POST /underwriting-shares/:token/actions (optional auth, fork/saved_version clones analysis + creates onward share), GET /underwriting-shares/:token/status (required auth).

### Rules
Rule 1: Qualified = shareActionCount < dailyShareCap AND recipientActionCount < dailyRecipientCap
Rule 2: Duplicate actions (same share/recipient/action) return status duplicate with no ledger insert
Rule 3: Capped actions return status capped, qualified false, creditAmount 0
Rule 4: hasMeaningfulChallengePayload returns true for unique_open/signup; for challenge/fork/saved_version requires challengedFields (non-empty array), or assumptions/inputs/metrics (non-empty objects), or comment/notes (>= 10 chars)
