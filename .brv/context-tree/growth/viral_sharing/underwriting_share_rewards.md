---
title: Underwriting Share Rewards
tags: []
keywords: []
importance: 55
recency: 1
maturity: draft
updateCount: 1
createdAt: '2026-05-26T05:04:51.924Z'
updatedAt: '2026-05-26T05:05:39.601Z'
---
## Raw Concept
**Task:**
Viral underwriting share system with premium credit rewards for qualified recipient actions

**Changes:**
- Implemented 5 qualified action types with credit rewards
- Added daily share and recipient caps per action type
- Signup requires authenticated recipient context
- Challenge/fork/saved_version require meaningful payload changes
- Share lineage tracks parentShareId/parentShareActionId/parentShareDepth for viral chain tracking
- Google Sheets export credit balance and redemption system

**Files:**
- src/underwriting-share-routes.ts
- test/underwriting-share-routes.test.ts

**Flow:**
create share -> generate token -> create recipient links -> recipient opens -> qualified action -> credit awarded -> update share stats

**Timestamp:** 2026-05-26

## Narrative
### Structure
Routes in src/underwriting-share-routes.ts with comprehensive test coverage. Core functions: createUnderwritingShare (token generation + lineage), createUnderwritingShareRecipientLinks (max 25, hashed recipient keys), recordQualifiedShareAction (cap enforcement + credit awarding), getShareActionSummary (analytics + coaching), getGoogleSheetsExportCreditBalance/redeemGoogleSheetsExportCredits (credit management).

### Dependencies
Uses premium_credit_ledger for earned credits, premium_credit_redemptions for redeemed credits. Credit type: google_sheets_export. Hashes recipient keys via sha256 for privacy.

### Highlights
5 action types: unique_open(1 credit), challenge(2), fork(3), saved_version(4), signup(5). Daily caps: share cap 5-8 actions, recipient cap 1-2 per action. Health score: min(100, round(min(opens,5)*8 + min(challenges,4)*10 + min(forkOrSavedVersions,3)*12 + min(signups,2)*12)). Token generation: crypto.randomBytes(18).toString("base64url"). Recipient URLs: /underwriting/${token}?recipient=${recipientKey}. Growth nudge stages: first_open -> convert_opens_to_challenges -> convert_challenges_to_versions -> convert_versions_to_accounts -> amplify. Conversion thresholds: openToChallenge <0.35, challengeToVersion <0.5, versionToSignup <0.4.

### Rules
Rule 1: Signup credits require the recipient to be authenticated (blocks anonymous signup qualified actions)
Rule 2: Challenge/fork/saved-version credits require meaningful changed assumptions/fields/metrics/inputs/notes/comment (10+ chars or non-empty objects/arrays)
Rule 3: Max 25 recipients per createUnderwritingShareRecipientLinks call
Rule 4: Duplicate actions (same recipient/action/share) are prevented
Rule 5: Daily caps enforced: shareActionCount < policy.dailyShareCap AND recipientActionCount < policy.dailyRecipientCap

### Examples
Share URL: /underwriting/abc123token. Recipient URL: /underwriting/abc123token?recipient=xyz789. CTA: "Challenge my underwriting." Lineage: shareDepth = parentShareId ? Number(parentShareDepth || 0) + 1 : 0

## Facts
- **unique_open_credit**: unique_open action awards 1 credit [project]
- **challenge_credit**: challenge action awards 2 credits [project]
- **fork_credit**: fork action awards 3 credits [project]
- **saved_version_credit**: saved_version action awards 4 credits [project]
- **signup_credit**: signup action awards 5 credits [project]
- **daily_share_cap**: Daily share cap ranges from 5-8 actions depending on type [project]
- **daily_recipient_cap**: Daily recipient cap ranges from 1-2 actions depending on type [project]
- **max_recipients_per_call**: Max 25 recipients per createUnderwritingShareRecipientLinks call [project]
- **credit_type**: Credit type is google_sheets_export [project]
- **signup_auth_requirement**: Signup requires authenticated recipient [convention]
- **token_generation**: Share tokens generated via crypto.randomBytes(18).toString("base64url") [project]
- **recipient_hashing**: Recipient keys hashed via sha256 for privacy [project]
