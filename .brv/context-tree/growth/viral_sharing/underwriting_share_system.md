---
title: Underwriting Share System
tags: []
related: [growth/viral_sharing/qualified_action_gate/qualified_action_gate.md, growth/viral_sharing/viral_underwriting_share_loop.md]
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: '2026-04-29T05:04:55.768Z'
updatedAt: '2026-04-29T05:06:47.601Z'
---
## Raw Concept
**Task:**
Viral underwriting share system with qualified action tracking, credit awards, and cap enforcement

**Changes:**
- Documented qualified action policies (unique_open, challenge, fork, signup, saved_version)
- Documented recordQualifiedShareAction logic flow with duplicate/cap checks
- Documented API routes for share creation, token resolution, action recording, and status
- Documented database schema: underwriting_shares, underwriting_share_actions, premium_credit_ledger
- Documented payload validation: hasMeaningfulChallengePayload requirements

**Files:**
- src/analysis-routes.ts
- db/schema.ts
- db/migrations/013_viral_underwriting_shares.sql

**Flow:**
POST /analyses/:id/share -> create token -> GET /underwriting-shares/:token -> record unique_open -> POST /underwriting-shares/:token/actions -> validate & record action -> award credits -> GET /underwriting-shares/:token/status -> return actionSummary

**Timestamp:** 2026-04-29

## Narrative
### Structure
Share system built on 4 API routes and 3 database tables. Core logic in recordQualifiedShareAction() handles dedup, cap enforcement, and credit awarding. getShareActionSummary() centralizes reporting for owner dashboards. Status endpoint returns shareUrl/cta/rewardPolicy plus actionSummary with by-action totals, capped counts, credit totals, and recentActions (intentionally omitting recipientHash).

### Dependencies
Requires deal_analyses table for fork/saved_version cloning. Uses authenticateOptional for share creation and action recording, authenticateToken for status endpoint. Credit type always google_sheets_export in premium_credit_ledger.

### Highlights
Five qualified actions with credit amounts: unique_open(1), challenge(2), fork(3), signup(5), saved_version(4). Daily share caps: unique_open(5), challenge(8), fork(8), signup(5), saved_version(8). Daily recipient caps: unique_open(1), challenge(2), fork(2), signup(1), saved_version(2). Duplicate prevention via share_id + recipient_hash + action triplet. Meaningful payload validation for challenge/fork/saved_version requires challengedFields, assumptions/inputs/metrics with keys, or comment/notes ≥ 10 chars. Fork/saved_version with authenticated user clones deal_analyses row. Token generation: crypto.randomBytes(18).base64url. Recipient hashing: sha256(IP:UA or explicit recipient).

### Rules
Rule 1: unique_open/signup always valid payload, no challenge data required
Rule 2: challenge/fork/saved_version requires meaningful payload (challengedFields array, assumptions/inputs/metrics objects with keys, or comment/notes ≥ 10 chars)
Rule 3: Duplicate action (same share_id + recipient_hash + action) returns duplicate status, no credit awarded
Rule 4: Daily share cap and daily recipient cap must both pass for action to be qualified
Rule 5: recentActions intentionally excludes recipientHash for privacy
Rule 6: Only authenticated inviter (inviter_user_id = req.userId) can access share status

### Examples
POST /analyses/:id/share returns { shareUrl: /underwriting/${token}, cta: "Challenge my underwriting.", rewardPolicy }. GET /underwriting-shares/:token returns analysis data + visitorQualification. POST /underwriting-shares/:token/actions returns { status: "qualified"|"duplicate"|"capped", qualified: boolean, creditAmount: number }.

## Facts
- **qualified_actions**: Five qualified share actions: unique_open, challenge, fork, signup, saved_version [project]
- **unique_open_policy**: unique_open credits 1 point, daily share cap 5, daily recipient cap 1 [project]
- **challenge_policy**: challenge credits 2 points, daily share cap 8, daily recipient cap 2 [project]
- **fork_policy**: fork credits 3 points, daily share cap 8, daily recipient cap 2 [project]
- **signup_policy**: signup credits 5 points, daily share cap 5, daily recipient cap 1 [project]
- **saved_version_policy**: saved_version credits 4 points, daily share cap 8, daily recipient cap 2 [project]
- **credit_type**: All credits use credit_type google_sheets_export in premium_credit_ledger [project]
- **token_generation**: Share tokens generated with crypto.randomBytes(18).toString('base64url') [project]
- **recipient_hashing**: Recipient hash is sha256(IP:UA or explicitRecipient) [project]
- **duplicate_prevention**: Duplicate check uses share_id + recipient_hash + action triplet [convention]
- **privacy_design**: recentActions intentionally excludes recipientHash for privacy [convention]
