---
title: Underwriting Share System API
tags: []
related: [growth/viral_sharing/challenge_share_card_pattern.md, growth/viral_sharing/credit_preview_system.md, growth/viral_sharing/premium_credit_eligibility_rules.md, growth/viral_sharing/underwriting_share_rewards.md, growth/viral_sharing/qualified_share_loop_plan.md]
keywords: []
importance: 60
recency: 1
maturity: draft
updateCount: 2
createdAt: '2026-06-01T05:03:59.697Z'
updatedAt: '2026-06-02T05:06:14.778Z'
---
## Raw Concept
**Task:**
Viral underwriting share system with qualified actions, credit rewards, and loop plan

**Changes:**
- 5 qualified share actions: unique_open (1cr), challenge (2cr), fork (3cr), signup (5cr), saved_version (4cr)
- Core APIs: createUnderwritingShare, createUnderwritingShareRecipientLinks, recordQualifiedShareAction, previewQualifiedShareActionCredit
- Google Sheets Export credit system with balance check and redemption
- Playbook ranks next actions by funnel bottlenecks (max 4 steps)
- Loop plan tracks milestones: unique_open -> challenge -> saved_version -> signup
- Anti-abuse: raw clicks never earn credits, meaningful payload required, daily caps per action

**Flow:**
share creation -> recipient links -> qualified action -> credit award -> loop plan -> growth nudge

**Timestamp:** 2026-06-02

**Patterns:**
- `^unique_open$` - First-time recipient open within daily caps
- `^challenge$` - Specific disagreement with changed fields/assumptions/metrics/inputs/notes/10+ char comment
- `^fork$` - Recipient forks analysis with changed assumptions creating comparison version
- `^signup$` - Recipient creates/associates account after engaging with shared underwriting
- `^saved_version$` - Recipient saves version with changed assumptions/metrics/inputs/notes/challenged fields

## Narrative
### Structure
The viral underwriting share system converts funnel bottlenecks and recipient-source coaching into ranked next qualified actions. Shares are created with createUnderwritingShare (returns id, token, shareDepth, shareUrl, cta, shareCard, rewardPolicy). Recipient links are created via createUnderwritingShareRecipientLinks (max 25 per call, generates recipientKey as 12 bytes base64url, hashes via sha256). Qualified actions are recorded via recordQualifiedShareAction which checks block reasons, duplicates, daily caps, then inserts into underwriting_share_actions and premium_credit_ledger if qualified.

### Dependencies
Uses premium_credit_ledger for earned credits and premium_credit_redemptions for redeemed credits. Database tables: underwriting_shares, underwriting_share_recipients, underwriting_share_actions, premium_credit_ledger, premium_credit_redemptions. Recipient hashing uses sha256 of recipientKey or IP+user-agent for implicit recipients.

### Highlights
Action credit amounts: unique_open=1 (cap 5 share/1 recipient), challenge=2 (cap 8/2), fork=3 (cap 8/2), signup=5 (cap 5/1), saved_version=4 (cap 8/2). Bottleneck detection: recipient_distribution (opens=0) -> unique_open, open_to_challenge (<0.35) -> challenge, challenge_to_version (<0.5) -> saved_version, version_to_signup (<0.4) -> signup, amplify_loop -> fork. Health score: min(100, min(opens,5)*8 + min(challenges,4)*10 + min(forkOrSavedVersions,3)*12 + min(signups,2)*12). Share depth increments from parent: shareDepth = parentShareId ? parentShareDepth + 1 : 0.

### Rules
Rule 1: Raw share clicks alone NEVER earn Google Sheets export credits
Rule 2: Credits earned ONLY from qualified actions (unique opens, meaningful challenges, forks, signups, saved versions)
Rule 3: Signup credits require authenticatedUserId
Rule 4: Challenge/fork/saved_version credits require meaningful payload (changed fields, assumptions, metrics, inputs, notes, or 10+ char comment)
Rule 5: Daily share caps and daily recipient caps apply per action type
Rule 6: Duplicate recipient/share/action combinations are blocked
Rule 7: Qualified actions return status: blocked, duplicate, qualified, or capped

### Examples
Share URL format: /underwriting/${token}?recipient=${recipientKey}. Share CTA: "Challenge my underwriting." Loop steps: Analyze deal -> Share underwriting -> Recipient challenges/forks -> Save account-tied version -> Share onward. Recipient prompt for challenge: "Challenge my underwriting — rent, vacancy, expenses, or exit cap: pick one number you would change."
