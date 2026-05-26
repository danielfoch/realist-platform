---
children_hash: adbf7ddfbd6192f727aac22b2c77f193b83df2b0058cafcdc509a545d127653d
compression_ratio: 0.44058154235145386
condensation_order: 1
covers: [context.md, premium_credit_eligibility_rules.md, underwriting_share_rewards.md]
covers_token_total: 1582
summary_level: d1
token_count: 697
type: summary
---
# Viral Sharing System

## Overview
Viral underwriting share system that rewards users with premium credits when recipients engage meaningfully with shared property analyses. Covers share creation, recipient tracking, action qualification, credit management, and growth analytics.

**Related:** `frontend/realtor_join_flow`, `frontend/design_system`

## Premium Credit Eligibility Rules
Enforces authentication requirements for credit qualification at the route level before `recordQualifiedShareAction`.

- **Anonymous exclusion:** Signup actions without `req.userId` earn no credits
- **Authenticated requirement:** Signup requires authenticated context before qualification
- **Payload validation:** Challenge/fork/saved_version actions require meaningful changed underwriting payloads

## Underwriting Share Rewards
Implemented in `src/underwriting-share-routes.ts` with comprehensive test coverage.

### Core Functions
- `createUnderwritingShare` — token generation + lineage tracking
- `createUnderwritingShareRecipientLinks` — max 25 recipients, sha256 hashed keys
- `recordQualifiedShareAction` — cap enforcement + credit awarding
- `getShareActionSummary` — analytics + coaching
- `getGoogleSheetsExportCreditBalance` / `redeemGoogleSheetsExportCredits` — credit management

### Credit Rewards & Caps
| Action | Credits | Daily Share Cap | Daily Recipient Cap |
|--------|---------|-----------------|---------------------|
| unique_open | 1 | 5-8 | 1-2 |
| challenge | 2 | 5-8 | 1-2 |
| fork | 3 | 5-8 | 1-2 |
| saved_version | 4 | 5-8 | 1-2 |
| signup | 5 | 5-8 | 1-2 |

### Key Architecture
- **Token generation:** `crypto.randomBytes(18).toString("base64url")`
- **Recipient URLs:** `/underwriting/${token}?recipient=${recipientKey}`
- **Lineage tracking:** `parentShareId`/`parentShareActionId`/`parentShareDepth` for viral chains
- **Credit type:** `google_sheets_export`
- **Storage:** `premium_credit_ledger` (earned), `premium_credit_redemptions` (redeemed)

### Growth Optimization
- **Health score:** `min(100, round(min(opens,5)*8 + min(challenges,4)*10 + min(forkOrSavedVersions,3)*12 + min(signups,2)*12))`
- **Nudge stages:** first_open → convert_opens_to_challenges → convert_challenges_to_versions → convert_versions_to_accounts → amplify
- **Conversion thresholds:** openToChallenge <0.35, challengeToVersion <0.5, versionToSignup <0.4

### Enforcement Rules
1. Signup credits require authenticated recipient
2. Challenge/fork/saved-version credits require meaningful payload changes (10+ chars or non-empty objects/arrays)
3. Max 25 recipients per `createUnderwritingShareRecipientLinks` call
4. Duplicate actions (same recipient/action/share) prevented
5. Daily caps: `shareActionCount < policy.dailyShareCap AND recipientActionCount < policy.dailyRecipientCap`