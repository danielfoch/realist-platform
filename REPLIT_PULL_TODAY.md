# REPLIT PULL TODAY

## 1. Date
Thursday, May 14, 2026

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-14-qualified-share-rewards`
- Commit SHA: `d1ff3a5e89173ebbb0ba18cf179b553a8a922bec` (code change commit; documentation commit follows it on this branch)
- Code commit: `d1ff3a5e89173ebbb0ba18cf179b553a8a922bec`

## 3. What changed
Tightened the viral underwriting reward loop so generic share opens are still tracked, but **do not award Google Sheets export credits**.

Unique-open credits now require an issued recipient-specific link (`trackingSource: recipient_link` and `explicitRecipientAccepted: true`). This keeps the “Challenge my underwriting.” loop intact while making the anti-abuse rule explicit: raw link clicks alone are not rewardable.

Also updated the public reward ladder, reward brief, conversion insights, and share-assist copy so Replit/client surfaces explain that unique-open credits require recipient-specific links.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
No database migration required.

Existing generic `unique_open` rows remain in history. New generic opens will be inserted as `qualified = false`, `credit_amount = 0`, with metadata reason `unique_open_credit_requires_issued_recipient_link`.

## 6. Env vars needed
No new environment variables.

## 7. Replit commands to run
```bash
npm install
npm run type-check
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
```

Optional fuller gate if Replit has enough time/resources:
```bash
npm run build
npm test
```

## 8. Test/build result
Passed locally:

```bash
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
# PASS test/underwriting-share-routes.test.ts
# 21 tests passed

npm run type-check
# tsc --noEmit passed
```

## 9. Risks/blockers
- No deploy was run.
- Branch has unrelated pre-existing `.brv/context-tree` working-tree changes that were **not committed** by this nightly patch.
- Behaviour change: generic share opens no longer earn the 1-credit unique-open reward. This is intentional to enforce “no credits for raw share clicks alone.” Challenges, forks, signups, and saved versions can still qualify from visitor-fingerprint tracking when they include the required meaningful action payload.
- If the product wants anonymous/generic unique opens to earn credits later, add a stronger non-recipient proof signal first (for example verified email, logged-in account, or invite acceptance), not raw GET traffic.

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull the branch that makes underwriting share rewards safer: raw link opens are tracked for funnel analytics, but only recipient-specific opens can earn Google Sheets export credits. This protects the viral “Challenge my underwriting.” loop from cheap click abuse while preserving rewards for real challenges, forks, saved versions, signups, and issued-recipient opens.
