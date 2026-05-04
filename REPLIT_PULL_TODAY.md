# REPLIT PULL TODAY — 2026-05-04

## 1. Date
Monday, May 4, 2026

## 2. Branch and commit SHA
Branch: `realist-nightly/2026-05-04-referral-reward-brief`

Code commit SHA: `a70749369d2be89a5775df7954d5199ef57071a3`

Note: this pull brief may be followed by a docs-only commit if the branch is pushed; use `git log -1 --oneline` for the latest branch tip.

## 3. What changed
- Added a qualified-only reward brief to viral underwriting share status.
- The status payload now includes `rewardBrief` with earned Google Sheets export credits, remaining daily qualified-action capacity, qualified actions already achieved, and the best next reward action.
- Added owner-facing CTA copy using “Challenge my underwriting.” to nudge recipients toward challenges, forks, saved versions, signups, and onward sharing.
- Kept anti-abuse explicit in the API response: raw share clicks never earn credits; credits require qualified actions within caps.
- Added tests covering the reward brief helper and status summary output.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
No new migration required.

This uses the existing viral underwriting tables from migrations `013`, `014`, and `015`. If Replit has not applied those yet, run:

```bash
npm run migrate
```

## 6. Env vars needed
No new environment variables.

## 7. Replit commands to run
```bash
git fetch origin
git checkout realist-nightly/2026-05-04-referral-reward-brief
npm install
npm run type-check
npx jest test/underwriting-share-routes.test.ts --runInBand
```

If merging into the active Replit branch instead:

```bash
git fetch origin
git merge realist-nightly/2026-05-04-referral-reward-brief
npm run type-check
npx jest test/underwriting-share-routes.test.ts --runInBand
```

## 8. Test/build result
Passed locally:

```bash
npm test -- underwriting-share-routes.test.ts --runInBand
npm run type-check
```

Targeted Jest result: 11 tests passed in `test/underwriting-share-routes.test.ts`.
TypeScript result: `tsc --noEmit` passed.

## 9. Risks/blockers
- No deploy was performed.
- No outbound emails/messages were sent.
- No paid API calls were made.
- No database schema changes in this patch.
- This only adds API/status payload fields; Replit UI still needs to surface `actionSummary.rewardBrief` to users.
- ByteRover curation was attempted after implementation, but the `brv curate` process was killed before completion; retry later if durable context is needed.
- Existing uncommitted ByteRover/context files and local notes were left untouched and excluded from this code commit.

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull `realist-nightly/2026-05-04-referral-reward-brief` so the “Challenge my underwriting” share dashboard can show users exactly what qualified reward progress they have: credits earned, credits still available today, which actions already qualified, and the best next action to ask recipients for — without ever rewarding raw clicks alone.
