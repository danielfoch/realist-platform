---
title: Viral Underwriting Share Loop
tags: []
related: [structure/deal_analyzer/analysis_flow.md, architecture/database/schema.md]
keywords: []
importance: 50
recency: 1
maturity: draft
createdAt: '2026-04-27T10:56:31.300Z'
updatedAt: '2026-04-27T10:56:31.300Z'
---
## Raw Concept
**Task:**
Implement viral underwriting sharing with qualified action credit rewards

**Changes:**
- Added underwriting_shares, underwriting_share_actions, premium_credit_ledger tables
- Implemented Express router with share creation, reading, action recording, and status endpoints
- Added qualified action policies with duplicate prevention and daily caps
- Tests cover qualified, duplicate, and capped credit behavior

**Files:**
- src/underwriting-share-routes.ts
- db/migrations/013_viral_underwriting_shares.sql
- test/underwriting-share-routes.test.ts

**Flow:**
Analyze deal -> Share underwriting -> Recipient challenges/forks assumptions -> Account/save version -> Share onward

**Timestamp:** 2026-04-27

**Author:** Realist Platform Team

## Narrative
### Structure
Express router mounted under /api with four endpoints: POST /api/analyses/:id/share (create share), GET /api/underwriting-shares/:token (read share), POST /api/underwriting-shares/:token/actions (record qualified actions), GET /api/underwriting-shares/:token/status (owner status). Database layer uses three tables: underwriting_shares (share records), underwriting_share_actions (action tracking), premium_credit_ledger (credit awards).

### Dependencies
Requires deal_analyses table for share source, users table for inviter tracking, and auth-middleware for optional/token authentication. Uses crypto for token generation and SHA-256 for recipient hashing.

### Highlights
Credits granted only for qualified actions, never for raw share clicks. Five qualified action types with different credit amounts and daily caps. Recipient identification via IP+User-Agent hash. Fork/saved_version actions create new deal_analyses records for the acting user.
