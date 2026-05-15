# REPLIT PULL TODAY

## 1. Date
Friday, May 15, 2026

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-15-share-reward-eligibility`
- Commit SHA: `5a935b98d8e3ce9835077edcf4baca2f59ff440a` (code change commit; documentation commit follows it on this branch)
- Code commit: `5a935b98d8e3ce9835077edcf4baca2f59ff440a`

## 3. What changed
Added a reward eligibility summary to the viral underwriting share status payload so the client can show exactly which actions can earn Google Sheets export credits today, why an action is blocked, and what each action requires.

This strengthens the “Analyze deal → Share underwriting → Recipient challenges/forks assumptions → Account/save version → Share onward” loop by making the qualified-action rules product-visible:

- CTA stays: “Challenge my underwriting.”
- Google Sheets export credits are shown per action.
- Unique-open credits explicitly require issued recipient-specific links.
- Raw/generic opens are described as analytics only, not credit-eligible.
- Daily share caps, daily recipient caps, blocked reasons, and requirements are exposed for challenge/fork/signup/saved-version actions.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
No database migration required.

This is API/status-shape only. It adds `actionSummary.rewardEligibility` to `GET /api/underwriting-shares/:token/status` responses.

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
# 22 tests passed

npm run type-check
# tsc --noEmit passed
```

## 9. Risks/blockers
- No deploy was run.
- No outbound messages/emails were sent.
- No paid APIs were called.
- Pre-existing unrelated `.brv/context-tree` working-tree changes from the prior branch were preserved in a local stash named `pre-2026-05-15-nightly-preserve-brv-context` before this branch was created.
- Client code must opt into rendering the new `rewardEligibility` object; existing response fields remain unchanged.

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull the branch that makes the underwriting-share reward rules visible in the status API. Dan/Replit can now show users which “Challenge my underwriting” actions can still earn Google Sheets export credits today, what each action requires, and why raw clicks or capped actions will not pay credits.
