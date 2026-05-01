---
title: Share Status Dashboard
tags: []
related: [growth/viral_sharing/underwriting_share_system.md, growth/viral_sharing/underwriting_share_lineage.md, growth/viral_sharing/viral_underwriting_share_loop.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-05-01T05:04:33.475Z'
updatedAt: '2026-05-01T05:04:33.475Z'
---
## Raw Concept
**Task:**
Viral underwriting share status dashboard with action metrics, conversion rates, and growth nudges

**Changes:**
- Added getShareActionSummary returning per-action dailyQualifiedCount, dailyRemainingShareCap, uniqueRecipientCount, qualifiedRecipientCount, conversionRates
- Added getShareGrowthNudge with 5 stage-specific copy variations using "Challenge my underwriting" CTA
- Enhanced the existing GET /underwriting-shares/:token/status endpoint payload (owner-only auth required)
- Tests updated in test/underwriting-share-routes.test.ts for status summary, growth nudges, and reward policies

**Files:**
- src/underwriting-share-routes.ts
- test/underwriting-share-routes.test.ts

**Flow:**
Share created -> actions recorded (unique_open/challenge/fork/signup/saved_version) -> getShareActionSummary aggregates metrics -> getShareGrowthNudge determines stage -> status endpoint returns dashboard data

**Timestamp:** 2026-05-01

## Narrative
### Structure
Share status dashboard aggregates underwriting share actions into per-action metrics, totals, conversion funnel rates, and stage-specific growth nudges. Implemented in src/underwriting-share-routes.ts via getShareActionSummary() and getShareGrowthNudge(). No migration needed; uses existing underwriting_share_actions fields. Recipient hashes remain private in dashboard output.

### Dependencies
Requires existing underwriting_shares and underwriting_share_actions tables. Uses premium_credit_ledger for credit awards (credit_type: google_sheets_export). Depends on QualifiedActionPolicy for daily cap enforcement.

### Highlights
Five qualified actions with credit rewards: unique_open (1 credit, 5/day cap), challenge (2 credits, 8/day cap), fork (3 credits, 8/day cap), signup (5 credits, 5/day cap), saved_version (4 credits, 8/day cap). Growth nudge stages: get_first_qualified_open -> convert_opens_to_challenges -> convert_challenges_to_versions -> convert_versions_to_accounts -> amplify_working_loop. Conversion rates track openToChallenge, challengeToForkOrSavedVersion, forkOrSavedVersionToSignup funnel. POST /underwriting-shares/:token/actions flow: validates qualified action, validates meaningful payload via hasMeaningfulChallengePayload, records action, creates onward share with lineage for fork/saved_version.

### Rules
Rule 1: unique_open and signup always qualify without payload validation
Rule 2: challenge/fork/saved_version require at least one of: challengedFields[], assumptions{}, inputs{}, metrics{}, comment (≥10 chars), or notes (≥10 chars)
Rule 3: Daily caps enforced per share (dailyShareCap) and per recipient (dailyRecipientCap)
Rule 4: Duplicate actions (same shareId + recipientHash + action) return status "duplicate" with no credit award
Rule 5: Capped actions return status "capped" with creditAmount 0 and no ledger insert
Rule 6: Recipient identities kept private via SHA-256 hash of IP:user-agent

### Examples
Growth nudge copy: "Challenge my underwriting — tell me which assumption you disagree with." (first open stage), "Challenge my underwriting — rent, vacancy, expenses, or exit cap: what would you change?" (convert to challenges). Share CTA: "Challenge my underwriting."
