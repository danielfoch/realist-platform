---
children_hash: 3aa572301c117c56a1738a029ba624cb843766960710da0b04a565338a78bd75
compression_ratio: 0.7184115523465704
condensation_order: 2
covers: [context.md, viral_sharing/_index.md]
covers_token_total: 1108
summary_level: d2
token_count: 796
type: summary
---
# Growth Domain — Structural Summary

## Domain Scope
Covers viral growth mechanics, referral systems, credit/reward systems, and user acquisition features. Excludes authentication and database schema details.

## Viral Sharing System (`src/underwriting-share-routes.ts`)

### Core Mechanism
Rewards users with **Google Sheets export credits** when recipients perform qualified actions on shared property analyses. Raw clicks never earn credits — only meaningful engagement counts.

### Qualified Actions & Credit Values
| Action | Credits | Daily Share Cap | Daily Recipient Cap | Qualification |
|--------|---------|-----------------|---------------------|---------------|
| `unique_open` | 1 | 5 | 1 | First distinct recipient open |
| `challenge` | 2 | 8 | 2 | Changed fields/assumptions/metrics/notes or 10+ char comment |
| `fork` | 3 | 8 | 2 | Forked analysis with changed assumptions |
| `saved_version` | 4 | 8 | 2 | Saved version with meaningful payload changes |
| `signup` | 5 | 5 | 1 | Authenticated account creation |

### Anti-Abuse Guardrails
- Duplicate prevention: same share+recipient+action ignored
- Auth requirement: signup credits require `authenticatedUserId`
- Payload validation: challenge/fork/saved_version require meaningful evidence
- Recipient caps: max 25 per creation call
- Privacy: recipient keys hashed via SHA-256; anonymous from IP+user-agent

### Architecture
- **Core functions**: `createUnderwritingShare`, `createUnderwritingShareRecipientLinks`, `recordQualifiedShareAction`, `getShareActionSummary`, `getChallengeShareCard`, `previewQualifiedShareActionCredit`, `getQualifiedShareLoopPlan`
- **Database**: `underwriting_shares`, `underwriting_share_recipients`, `underwriting_share_actions`, `premium_credit_ledger`, `premium_credit_redemptions`
- **Tokens**: `crypto.randomBytes(18).toString("base64url")` (share), `crypto.randomBytes(12).base64url` (recipient)
- **URL format**: `/underwriting/${token}?recipient=${recipientKey}`
- **Lineage**: `parent_share_id`, `parent_share_action_id`, `shareDepth` for viral chain tracking

### Growth Analytics
- **Health score**: `min(100, round(min(opens,5)*8 + min(challenges,4)*10 + min(forkOrSavedVersions,3)*12 + min(signups,2)*12))`
- **Conversion thresholds**: open→challenge <0.35, challenge→version <0.5, version→signup <0.4
- **Nudge stages**: `get_first_qualified_open` → `convert_opens_to_challenges` → `convert_challenges_to_versions` → `convert_versions_to_accounts` → `amplify_working_loop`
- **Preview**: Read-only eligibility check via `POST /underwriting-shares/:token/actions/preview`

### Entry References
- **challenge_share_system.md** — Core architecture, action types, caps, database schema
- **underwriting_share_rewards.md** — Credit reward structure, route functions, growth analytics
- **qualified_share_loop_plan.md** — Viral loop milestones, recipient hashing, loop plan helper
- **credit_preview_system.md** — Non-mutating preview endpoint and eligibility checking
- **premium_credit_eligibility_rules.md** — Auth requirements and route-level qualification enforcement
- **challenge_share_card_pattern.md** — UI payload generator for share cards with anti-abuse copy