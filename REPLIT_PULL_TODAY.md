# REPLIT_PULL_TODAY

## 1. Date
2026-06-05

## 2. Branch and commit SHA
- Repo: `https://github.com/danielfoch/realist-platform.git`
- Branch: `realist-nightly/2026-06-05-qualified-share-digest`
- Code commit SHA: `cb65051`
- Handoff verification: `PASS`

## 3. What changed
Added a qualified-share morning digest to the viral underwriting loop so the share status API can tell an owner exactly what to do next before Dan pulls into Replit.

Highlights:
- New `getQualifiedShareDigest()` helper summarizes the current loop stage, health score, earned Google Sheets export credits, remaining daily credit opportunity, next qualified action, and best recipient source.
- Digest returns a short morning checklist with owner actions, recipient copy, proof requirements, and credit amounts.
- Digest includes risk flags when opens are not becoming challenges, challenges are not becoming saved/forked versions, recipient links are unopened, or all daily caps are exhausted.
- `getShareActionSummary()` now includes `qualifiedShareDigest` alongside reward brief, loop plan, share playbook, challenge nudges, and recipient coaching.
- Tests assert the digest uses “Challenge my underwriting.”, prioritizes qualified actions, and preserves the anti-abuse rule that raw share clicks never earn credits.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
None. This is a TypeScript/API payload and test change only. No database migration required.

## 6. Env vars needed
None new.

## 7. Replit commands to run
```bash
npm install
npm run build
npm test -- underwriting-share-routes.test.ts --runInBand
```

Optional broader checks if time allows:
```bash
npm run type-check
npx eslint src/underwriting-share-routes.ts test/underwriting-share-routes.test.ts
```

## 8. Test/build result
Passed locally:

```bash
npm run build
# tsc
# exit 0

npm run type-check
# tsc --noEmit
# exit 0

npm test -- underwriting-share-routes.test.ts --runInBand
# Test Suites: 1 passed, 1 total
# Tests: 29 passed, 29 total

npx eslint src/underwriting-share-routes.ts test/underwriting-share-routes.test.ts
# exit 0
```

Known broader lint state:

```bash
npm run lint
# exits 1 because of pre-existing unused-variable errors in unrelated files such as
# src/analysis-routes.ts, src/api-routes.ts, src/auth-routes.ts, src/flywheel-routes.ts,
# src/investor-lead-routes.ts, src/realtor-routes.ts, src/scripts/*, and src/stripe-integration.ts.
# The changed underwriting share files pass targeted ESLint.
```

Deploy status: No deploy was run.

## 9. Risks/blockers
- No deploy was performed.
- No outbound messages/emails were sent.
- No paid API calls were made.
- Full `npm run lint` is blocked by existing unrelated lint errors; the changed files pass targeted ESLint.
- Frontend/Replit UI still needs to render `qualifiedShareDigest` if Dan wants the morning digest card visible in-product.

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull `realist-nightly/2026-06-05-qualified-share-digest`. The underwriting share status response now includes a “morning qualified-share digest” that tells the owner what stage the viral loop is in, which qualified action to chase next, which recipient source is performing best, how many Google Sheets export credits were earned, and what risk is blocking the Analyze → Share → Challenge/Fork → Save → Share onward loop. It keeps the growth loop safe: raw share clicks still never earn credits; only qualified unique opens, challenges, forks, signups, and saved versions within anti-abuse caps can earn Google Sheets export credits.
