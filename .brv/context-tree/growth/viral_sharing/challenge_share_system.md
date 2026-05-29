---
title: Challenge Share System
tags: []
related: [growth/viral_sharing/credit_preview_system.md, growth/viral_sharing/premium_credit_eligibility_rules.md, growth/viral_sharing/underwriting_share_rewards.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-05-29T05:06:15.472Z'
updatedAt: '2026-05-29T05:06:15.472Z'
---
## Raw Concept
**Task:**
Challenge My Underwriting share system — viral loop with qualified action credits

**Changes:**
- Added getChallengeShareCard in src/underwriting-share-routes.ts
- API responses for share creation, opens, recipient links, and owner status include shareCard payload
- Tests in test/underwriting-share-routes.test.ts

**Files:**
- src/underwriting-share-routes.ts
- test/underwriting-share-routes.test.ts

**Flow:**
Analyze deal -> Share underwriting -> Recipient challenges/forks assumptions -> Save account-tied version -> Share onward

**Timestamp:** 2026-05-29

## Narrative
### Structure
Share system in src/underwriting-share-routes.ts with qualified action tracking, credit awarding, analytics coaching, and share card generation. Core types: QualifiedShareAction (unique_open, challenge, fork, signup, saved_version), QualifiedActionPolicy, QualifiedActionCatalogItem. Database tables: underwriting_shares, underwriting_share_recipients, underwriting_share_actions, premium_credit_ledger, premium_credit_redemptions.

### Dependencies
Shares track lineage via parent_share_id, parent_share_action_id, shareDepth. Recipient keys generated via crypto.randomBytes(12).base64url then sha256 hashed. Anonymous recipients hashed from IP+user-agent. Credit type: google_sheets_export.

### Highlights
Five qualified actions: unique_open (1 credit), challenge (2 credits), fork (3 credits), signup (5 credits), saved_version (4 credits). Daily share caps: 5 for opens, 8 for others. Daily recipient caps: 1 for opens, 2 for challenge/fork/saved_version, 1 for signup. Anti-abuse: raw clicks never earn credits, only qualified actions with unique recipient tracking and daily caps. Share lineage tracking with depth increments. Analytics coaching with funnel stages and bottleneck detection.

### Rules
Rule 1: Raw share clicks never earn credits — only qualified actions
Rule 2: Signup requires authenticatedUserId
Rule 3: Challenge/fork/saved_version require meaningful payload: challengedFields[], assumptions/inputs/metrics objects with keys, or comment/notes >= 10 chars
Rule 4: Max 25 recipients per recipient link creation call
Rule 5: Duplicate detection on same share/recipient/action combination

### Examples
Share URL format: /underwriting/${token}?recipient=${recipientKey}. Growth nudge stages: get_first_qualified_open -> convert_opens_to_challenges -> convert_challenges_to_versions -> convert_versions_to_accounts -> amplify_working_loop. Bottleneck thresholds: openToChallenge < 0.35, challengeToVersion < 0.5, versionToSignup < 0.4. Health score: min(100, round(min(opens,5)*8 + min(challenges,4)*10 + min(forkOrSavedVersions,3)*12 + min(signups,2)*12))

## Facts
- **share_credit_type**: Credit type for share actions is google_sheets_export [project]
- **unique_open_credits**: unique_open earns 1 credit with daily share cap of 5 [project]
- **challenge_credits**: challenge earns 2 credits with daily share cap of 8 [project]
- **fork_credits**: fork earns 3 credits with daily share cap of 8 [project]
- **signup_credits**: signup earns 5 credits with daily share cap of 5 [project]
- **saved_version_credits**: saved_version earns 4 credits with daily share cap of 8 [project]
- **max_recipients_per_call**: Maximum 25 recipients per recipient link creation call [convention]
