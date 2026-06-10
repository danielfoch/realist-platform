---
title: Qualified Action Gate
tags: []
related: [growth/viral_sharing/viral_underwriting_share_loop.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-04-28T05:02:52.694Z'
updatedAt: '2026-04-28T05:02:52.694Z'
---
## Raw Concept
**Task:**
Implement qualified action gate requiring meaningful metadata before challenge/fork/saved_version actions earn Google Sheets export credits

**Changes:**
- Added hasMeaningfulChallengePayload() validation for challenge, fork, and saved_version actions
- Prevents empty CTA/button clicks from earning credits
- Leaves unique_open and signup actions unchanged (always qualify)
- Added savedAnalysisId tracking for fork/saved_version actions that create deal_analyses records

**Files:**
- src/underwriting-share-routes.ts
- test/underwriting-share-routes.test.ts

**Flow:**
POST /underwriting-shares/:token/actions -> validate action type -> validate meaningful payload -> lookup share -> fork/save analysis if applicable -> recordQualifiedShareAction -> check caps -> insert action record -> award credits if qualified

**Timestamp:** 2026-04-28

## Narrative
### Structure
The qualified action gate is implemented in src/underwriting-share-routes.ts via the hasMeaningfulChallengePayload() function and enforced in the POST /underwriting-shares/:token/actions route handler. The gate sits between action validation and credit recording, rejecting requests with 400 status if metadata is insufficient.

### Dependencies
Requires underwriting_shares table, underwriting_share_actions table, premium_credit_ledger table, and deal_analyses table. Uses authenticateOptional middleware for share creation and action recording, authenticateToken for share status endpoint.

### Highlights
Challenge actions earn 2 credits, fork earns 3, saved_version earns 4, signup earns 5, unique_open earns 1. Daily share caps: unique_open/signup at 5, challenge/fork/saved_version at 8. Daily recipient caps: unique_open/signup at 1, others at 2. Credits are Google Sheets export credits stored in premium_credit_ledger.

### Rules
Rule 1: unique_open and signup actions always qualify without metadata requirements
Rule 2: challenge, fork, and saved_version actions require at least one of: challengedFields (non-empty array), assumptions (non-empty object), inputs (non-empty object), metrics (non-empty object), comment (10+ chars), or notes (10+ chars)
Rule 3: Duplicate actions (same share_id + recipient_hash + action) return duplicate status with original credit amount and do not award new credits
Rule 4: Actions exceeding daily share cap or daily recipient cap are recorded as capped with credit_amount = 0 and do not insert into premium_credit_ledger
Rule 5: Fork and saved_version actions for authenticated users create a new deal_analyses record copying source analysis fields, with optional metadata overrides for metrics, inputs, verdictCheck, and notes

### Examples
Valid challenge: { challengedFields: ["rent", "vacancy"] }
Valid fork: { inputs: { rent: 3200 }, metrics: { capRate: 5.2 } }
Invalid: { comment: "too short" } (under 10 chars)
Invalid: {} (empty object)
