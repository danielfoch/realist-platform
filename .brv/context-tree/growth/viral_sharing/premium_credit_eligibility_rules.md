---
title: Premium Credit Eligibility Rules
tags: []
related: [growth/viral_sharing/underwriting_share_rewards.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-05-26T05:05:42.002Z'
updatedAt: '2026-05-26T05:05:42.002Z'
---
## Raw Concept
**Task:**
Define premium credit eligibility rules for underwriting share actions on Realist platform

**Changes:**
- Anonymous share signup actions no longer earn premium credits
- Route-level qualification now requires authenticated req.userId for signup before recordQualifiedShareAction
- Challenge/fork/saved_version actions still require meaningful changed underwriting payloads

**Flow:**
share action -> check auth (req.userId) -> if anonymous skip credit -> if authenticated recordQualifiedShareAction -> evaluate payload changes -> award credits if qualified

## Narrative
### Structure
Premium credit qualification is enforced at the route level before calling recordQualifiedShareAction. Signup actions require an authenticated req.userId to be eligible for credits.

### Highlights
Anonymous underwriting share signup actions are excluded from premium credit earning. Challenge, fork, and saved_version actions remain eligible but still require meaningful changed underwriting payloads to qualify.

### Rules
Rule 1: Anonymous share signup actions must not earn premium credits
Rule 2: Signup requires authenticated req.userId before recordQualifiedShareAction
Rule 3: Challenge/fork/saved_version actions require meaningful changed underwriting payloads to earn credits
