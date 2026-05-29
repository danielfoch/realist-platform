---
title: Challenge Share Card Pattern
tags: []
related: [growth/viral_sharing/underwriting_share_rewards.md, growth/viral_sharing/premium_credit_eligibility_rules.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-05-29T05:06:37.634Z'
updatedAt: '2026-05-29T05:06:37.634Z'
---
## Raw Concept
**Task:**
Document getChallengeShareCard pattern for Challenge my underwriting viral loop

**Changes:**
- Added getChallengeShareCard pattern documentation for viral loop UI payloads

**Flow:**
user challenges underwriting -> getChallengeShareCard generates payload -> shareUrl + instructions + rewardTeaser -> recipient action -> credit earned

**Timestamp:** 2026-05-29

## Narrative
### Structure
getChallengeShareCard is the UI payload generator for the "Challenge my underwriting" viral loop on Realist.ca

### Dependencies
Requires viral underwriting share system and Google Sheets export credit redemption

### Highlights
Returns shareUrl, nextQualifiedAction, recipient/owner instructions, rewardTeaser for Google Sheets export credits, loop steps, qualifiedActionsRequired, and anti-abuse copy. Key anti-abuse rule: raw share clicks alone never earn credits — only qualified actions count.

### Rules
Rule 1: Raw share clicks alone never earn credits
Rule 2: Only qualified actions (not just clicks) count toward credit eligibility
