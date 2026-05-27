---
title: Credit Preview System
tags: []
related: [growth/viral_sharing/underwriting_share_rewards.md, growth/viral_sharing/premium_credit_eligibility_rules.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-05-27T05:04:44.913Z'
updatedAt: '2026-05-27T05:04:44.913Z'
---
## Raw Concept
**Task:**
Implement non-mutating qualified underwriting share credit preview via previewQualifiedShareActionCredit helper and POST /underwriting-shares/:token/actions/preview endpoint

**Changes:**
- Added previewQualifiedShareActionCredit helper for eligible/blocked/duplicate/capped status without mutating ledgers
- Added POST /underwriting-shares/:token/actions/preview endpoint
- Defined 5 qualified share actions: unique_open, challenge, fork, signup, saved_version with credit amounts 1-5
- Implemented daily share and recipient caps per action type
- Added getShareActionQualificationBlockReason for block condition validation
- Added hasMeaningfulChallengePayload for payload evidence validation
- Integrated Google Sheets export credit balance calculation (earned - redeemed)

**Files:**
- src/underwriting-share-routes.ts
- test/underwriting-share-routes.test.ts

**Flow:**
share link opened -> action triggered -> previewQualifiedShareActionCredit called -> check caps/duplicates/block reasons -> return status + CTA without inserting rows

**Timestamp:** 2026-05-27

**Patterns:**
- `^unique_open$` - Distinct recipient opens tracked underwriting link for first time today within caps
- `^challenge$` - Recipient submits specific disagreement with changed fields, assumptions, metrics, inputs, notes, or 10+ char comment
- `^fork$` - Recipient forks analysis with changed assumptions or metrics creating comparison version
- `^signup$` - Recipient creates or associates account after engaging with shared underwriting
- `^saved_version$` - Recipient saves version with changed assumptions, metrics, inputs, notes, or challenged fields

## Narrative
### Structure
The credit preview system provides a read-only preview of qualified share action credits before committing to the ledger. The previewQualifiedShareActionCredit function checks eligibility against daily caps, duplicate tracking, and block conditions, returning status (eligible/blocked/duplicate/capped), remaining caps, CTA text, and guardrail copy. No underwriting_share_actions or premium_credit_ledger rows are inserted during preview.

### Dependencies
Requires underwriting_shares table with share_depth and qualified_action_count tracking, underwriting_share_recipients for recipient_hash deduplication, premium_credit_ledger for balance calculation, and premium_credit_redemptions for redemption tracking.

### Highlights
Five qualified actions with varying credit amounts: unique_open (1 credit, 5 daily share cap, 1 daily recipient cap), challenge (2 credits, 8/2 caps), fork (3 credits, 8/2 caps), saved_version (4 credits, 8/2 caps), signup (5 credits, 5/1 caps). Credits are Google Sheets export type. Preview returns potentialCreditAmount, shareRemainingToday, recipientRemainingToday, blockReason, cta, and creditGuardrail without any database mutations.

### Rules
Rule 1: Credits never granted for raw clicks alone — requires unique opens, challenges, forks, signups, or saved versions within daily caps
Rule 2: Duplicate recipient/share/action combinations do not earn additional credits
Rule 3: Signup credits require authenticated recipient (authenticatedUserId must be present)
Rule 4: Challenge/fork/saved-version credits require meaningful payload evidence (challengedFields array, assumptions/inputs/metrics objects, or 10+ character comment/notes)
Rule 5: Only the first qualifying recipient/share/action counts for fork credits
Rule 6: Preview endpoint does NOT insert underwriting_share_actions or premium_credit_ledger rows

### Examples
Block reason for anonymous signup: "Signup credits require the recipient to be authenticated so a real account can be associated with the shared underwriting." | Block reason for empty challenge: "Challenge/fork/saved-version credits require changed assumptions, challenged fields, metrics, inputs, notes, or a 10+ character comment."

## Facts
- **unique_open_policy**: unique_open action earns 1 credit with daily share cap of 5 and recipient cap of 1 [project]
- **challenge_policy**: challenge action earns 2 credits with daily share cap of 8 and recipient cap of 2 [project]
- **fork_policy**: fork action earns 3 credits with daily share cap of 8 and recipient cap of 2 [project]
- **saved_version_policy**: saved_version action earns 4 credits with daily share cap of 8 and recipient cap of 2 [project]
- **signup_policy**: signup action earns 5 credits with daily share cap of 5 and recipient cap of 1 [project]
- **credit_type**: Credit type for share actions is google_sheets_export [project]
- **meaningful_challenge_threshold**: Meaningful challenge payload requires challengedFields array, assumptions/inputs/metrics objects, or 10+ character comment/notes [convention]
- **preview_non_mutating**: Preview endpoint does not mutate underwriting_share_actions or premium_credit_ledger tables [convention]
