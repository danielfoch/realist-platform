---
children_hash: 2509314ff7ec41898c39c0675c89adae936a88a70d1c299a19a68ce0128d2c3e
compression_ratio: 0.6984978540772532
condensation_order: 2
covers: [context.md, viral_sharing/_index.md]
covers_token_total: 932
summary_level: d2
token_count: 651
type: summary
---
# Growth Domain: Viral Sharing System

## Domain Scope
The `growth` domain covers viral growth mechanics, referral systems, and user acquisition features. Excludes authentication and database schema details. Related to `frontend/realtor_join_flow` and `frontend/design_system`.

## Viral Sharing Architecture
Core implementation in `src/underwriting-share-routes.ts` with comprehensive test coverage. Tracks viral chains through `parentShareId`/`parentShareActionId`/`parentShareDepth` lineage fields.

### Token & URL Structure
- Tokens: `crypto.randomBytes(18).toString("base64url")`
- Recipient URLs: `/underwriting/${token}?recipient=${recipientKey}`
- Max 25 recipients per `createUnderwritingShareRecipientLinks` call
- SHA256 hashed recipient keys

### Core Functions
- `createUnderwritingShare` — token generation + lineage tracking
- `recordQualifiedShareAction` — cap enforcement + credit awarding
- `getShareActionSummary` — analytics + conversion coaching
- `getGoogleSheetsExportCreditBalance` / `redeemGoogleSheetsExportCredits` — credit management

## Premium Credit System
Credit type: `google_sheets_export`. Storage via `premium_credit_ledger` (earned) and `premium_credit_redemptions` (redeemed).

### Reward Tiers & Caps
| Action | Credits | Daily Share Cap | Daily Recipient Cap |
|--------|---------|-----------------|---------------------|
| unique_open | 1 | 5-8 | 1-2 |
| challenge | 2 | 5-8 | 1-2 |
| fork | 3 | 5-8 | 1-2 |
| saved_version | 4 | 5-8 | 1-2 |
| signup | 5 | 5-8 | 1-2 |

### Eligibility Enforcement
- Anonymous signups excluded (requires `req.userId`)
- Challenge/fork/saved-version actions require meaningful payload changes (10+ chars or non-empty objects/arrays)
- Duplicate actions (same recipient/action/share) prevented
- Daily caps: `shareActionCount < policy.dailyShareCap AND recipientActionCount < policy.dailyRecipientCap`

## Growth Analytics & Coaching
### Health Score Formula
`min(100, round(min(opens,5)*8 + min(challenges,4)*10 + min(forkOrSavedVersions,3)*12 + min(signups,2)*12))`

### Conversion Nudge Stages
`first_open → convert_opens_to_challenges → convert_challenges_to_versions → convert_versions_to_accounts → amplify`

### Conversion Thresholds
- openToChallenge: <0.35
- challengeToVersion: <0.5
- versionToSignup: <0.4

## Drill-Down References
- **Premium Credit Eligibility Rules** (`premium_credit_eligibility_rules.md`) — Authentication requirements and payload validation logic
- **Underwriting Share Rewards** (`underwriting_share_rewards.md`) — Core functions, reward tiers, enforcement rules, and growth optimization details