---
title: Qualified Share Loop Plan
tags: []
related: [growth/viral_sharing/underwriting_share_rewards.md, growth/viral_sharing/premium_credit_eligibility_rules.md, growth/viral_sharing/challenge_share_card_pattern.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-05-30T05:04:52.512Z'
updatedAt: '2026-05-30T05:10:00.000Z'
---
## Raw Concept
**Task:**
Add a qualified-only viral loop plan to Realist underwriting share status payloads.

**Changes:**
- Added `getQualifiedShareLoopPlan` in `src/underwriting-share-routes.ts`.
- `getShareActionSummary` now includes `loopPlan` alongside conversion insights, reward brief, and recipient coaching.
- The loop plan packages funnel phase, health score, milestone progress, next qualified action, owner action, recommended recipient source, earned Google Sheets export credits, and the anti-abuse guardrail.
- Tests cover the loop plan and ensure it does not promise credits for raw share clicks.

**Files:**
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`

**Flow:**
Share status -> action summary -> conversion insights + reward brief -> qualified share loop plan -> UI can show next milestone / next qualified action.

**Timestamp:** 2026-05-30
**Author:** realist-nightly/2026-05-30-share-quality-score

## Narrative
### Structure
`getQualifiedShareLoopPlan` is a pure helper, not a new endpoint. It is exposed through existing share status summaries as `actionSummary.loopPlan`. It uses existing qualified-action data and recipient funnel data; no database schema change is required.

### Highlights
The loop plan gives the UI a product-ready object for the viral underwriting loop: Analyze deal -> Share underwriting -> Recipient challenges/forks assumptions -> Account/save version -> Share onward. Milestones are first qualified open, first challenge, first saved/forked version, and account-tied loop.

### Rules
Rule 1: Raw share clicks never earn credits.
Rule 2: The plan may recommend `unique_open`, `challenge`, `saved_version`, or `signup`, but credit copy must stay qualified-action-only.
Rule 3: Google Sheets export credits remain tied to existing policies and daily share/recipient caps.
Rule 4: Recommended recipient source is summarized from aggregate funnel data and must not expose recipient hashes.
Rule 5: No migration or new environment variables are needed for this helper.

### Example
`actionSummary.loopPlan.nextMilestone` can be `{ key: 'first_version', qualifiedAction: 'saved_version' }` when opens and challenges exist but no saved/forked comparison version exists yet.
