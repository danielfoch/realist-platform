---
children_hash: ab9154d902973a490c5b35bcc77d943635e76a82c776b7f4f690cb1455c0ba41
compression_ratio: 0.1606395127521888
condensation_order: 1
covers: [challenge_share_card_pattern.md, challenge_share_system.md, context.md, credit_preview_system.md, premium_credit_eligibility_rules.md, qualified_share_loop_plan.md, underwriting_share_rewards.md]
covers_token_total: 5254
summary_level: d1
token_count: 844
type: summary
---
# Viral Sharing System — Structural Summary

## System Overview
Viral underwriting share system (`src/underwriting-share-routes.ts`) rewards users with **Google Sheets export credits** when recipients take qualified actions on shared property analyses. Raw clicks never earn credits — only meaningful engagement counts.

## Qualified Actions & Credit Values
| Action | Credits | Daily Share Cap | Daily Recipient Cap | Qualification Requirement |
|--------|---------|-----------------|---------------------|---------------------------|
| `unique_open` | 1 | 5 | 1 | First distinct recipient open today |
| `challenge` | 2 | 8 | 2 | Changed fields/assumptions/metrics/inputs/notes or 10+ char comment |
| `fork` | 3 | 8 | 2 | Forked analysis with changed assumptions/metrics |
| `saved_version` | 4 | 8 | 2 | Saved version with meaningful payload changes |
| `signup` | 5 | 5 | 1 | Authenticated account creation/association |

## Anti-Abuse Guardrails
- **No raw click credits** — only qualified actions within daily caps
- **Duplicate prevention** — same share+recipient+action combination ignored
- **Auth requirement** — signup credits require `authenticatedUserId`
- **Payload validation** — challenge/fork/saved_version require meaningful evidence (non-empty objects/arrays or 10+ char text)
- **Recipient caps** — max 25 recipients per creation call
- **Privacy** — recipient keys hashed via SHA-256; anonymous recipients hashed from IP+user-agent

## Architecture & Dependencies
- **Core functions**: `createUnderwritingShare`, `createUnderwritingShareRecipientLinks`, `recordQualifiedShareAction`, `getShareActionSummary`, `getChallengeShareCard`, `previewQualifiedShareActionCredit`, `getQualifiedShareLoopPlan`
- **Database tables**: `underwriting_shares`, `underwriting_share_recipients`, `underwriting_share_actions`, `premium_credit_ledger`, `premium_credit_redemptions`
- **Token generation**: `crypto.randomBytes(18).toString("base64url")` for share tokens, `crypto.randomBytes(12).base64url` for recipient keys
- **URL format**: `/underwriting/${token}?recipient=${recipientKey}`
- **Share lineage**: `parent_share_id`, `parent_share_action_id`, `shareDepth` tracking for viral chains

## Growth Analytics
- **Health score**: `min(100, round(min(opens,5)*8 + min(challenges,4)*10 + min(forkOrSavedVersions,3)*12 + min(signups,2)*12))`
- **Conversion thresholds**: openToChallenge <0.35, challengeToVersion <0.5, versionToSignup <0.4
- **Nudge stages**: `get_first_qualified_open` → `convert_opens_to_challenges` → `convert_challenges_to_versions` → `convert_versions_to_accounts` → `amplify_working_loop`
- **Preview system**: Read-only credit eligibility check via `POST /underwriting-shares/:token/actions/preview` — no database mutations

## Entry References
- **challenge_share_system.md** — Core share system architecture, action types, caps, and database schema
- **underwriting_share_rewards.md** — Credit reward structure, route functions, and growth analytics
- **qualified_share_loop_plan.md** — Viral loop milestones, recipient hashing, and loop plan helper
- **credit_preview_system.md** — Non-mutating preview endpoint and eligibility checking
- **premium_credit_eligibility_rules.md** — Auth requirements and route-level qualification enforcement
- **challenge_share_card_pattern.md** — UI payload generator for share cards with anti-abuse copy