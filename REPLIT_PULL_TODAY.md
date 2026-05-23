# REPLIT_PULL_TODAY — Realist.ca Nightly GitHub Builder

## 1. Date
Saturday, May 23, 2026

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-23-share-recipient-coaching`
- Commit: `54622146d1c20328baffa8b32aa0c33605069318`

## 3. What changed
Added recipient-source coaching to the viral underwriting share status payload so owners can see which invite/channel segment needs the next qualified action in the loop.

This extends the existing **“Challenge my underwriting.”** flow with qualified-only growth guidance:
- Ranks recipient sources by priority.
- Labels the current bottleneck stage: get opens, ask for challenges, convert to versions, convert to accounts, or amplify.
- Recommends the next qualified action (`unique_open`, `challenge`, `saved_version`, `signup`, or `fork`).
- Provides stage-specific copy using **“Challenge my underwriting.”**
- Repeats the anti-abuse guardrail that Google Sheets export credits are only for qualified opens/challenges/forks/signups/saved versions — never raw share clicks.

## 4. Files changed
- `src/underwriting-share-routes.ts`
  - Adds `getRecipientShareCoaching()`.
  - Adds `recipientCoaching` to `getShareActionSummary()` and therefore the authenticated share status response.
- `test/underwriting-share-routes.test.ts`
  - Adds coverage for recipient-source coaching ranking and verifies the raw-click credit guardrail remains present.
  - Extends the share summary test to assert coaching is included.
- `REPLIT_PULL_TODAY.md`
  - This handoff brief.

## 5. Migration steps
None. This is API/status-response logic only and does not require a database migration.

## 6. Env vars needed
None new.

## 7. Replit commands to run
```bash
git fetch origin
git checkout realist-nightly/2026-05-23-share-recipient-coaching
npm install
npm run type-check
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
```

## 8. Test/build result
Passed locally:

```bash
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
# PASS: 13 tests passed

npm run type-check
# PASS: tsc --noEmit
```

## 9. Risks/blockers
- Not deployed.
- No outbound emails/messages were sent.
- No paid APIs were called.
- No new env vars or migrations.
- Branch is local unless the commit was pushed successfully after this file was written.
- This branch is based on the prior nightly branch `realist-nightly/2026-05-22-qualified-share-credits`, so Dan should pull it as an incremental improvement on top of that viral underwriting loop work.
- Pre-existing untracked files remain uncommitted intentionally:
  - `REPLIT_HANDOFF_CONTRACT.md`
  - `REPLIT_PULL_TEMPLATE.md`
  - `scripts/__pycache__/verify-replit-handoff.cpython-314.pyc`
  - `scripts/verify-replit-handoff.py`

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull `realist-nightly/2026-05-23-share-recipient-coaching` if you want the share-status API to tell the product which recipient source needs the next viral underwriting action. It turns tracked invite funnel stats into ranked guidance like: “these recipients opened but have not challenged assumptions,” “these challengers need to save/fork a version,” or “these version creators need to create accounts,” while keeping Google Sheets export credits qualified-only and never rewarding raw clicks.
