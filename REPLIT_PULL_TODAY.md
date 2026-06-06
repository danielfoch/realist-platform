# REPLIT_PULL_TODAY

## 1. Date
2026-06-06

## 2. Branch and commit SHA
- Repo: `https://github.com/danielfoch/realist-platform.git`
- Branch: `realist-nightly/2026-06-06-share-qualified-ledger`
- Code commit SHA: `5844ec4`
- Handoff doc commit SHA: see latest branch commit after this file is committed
- Handoff verification: `PASS`

## 3. What changed
Added a structured qualified-share abuse audit to the viral underwriting loop so Dan/Replit can safely show credit status and growth prompts without rewarding low-quality or abusive sharing.

Highlights:
- New `getQualifiedShareAbuseAudit()` helper flags capped/duplicate-controlled actions, qualified opens that have not become meaningful challenges, unopened recipient-specific links, and exhausted daily caps.
- `getShareActionSummary()` now returns `abuseAudit` alongside the qualified-share digest, loop plan, playbook, reward brief, challenge nudges, and recipient coaching.
- The audit includes the next safe qualified action, owner action, daily cap warnings, and explicit Google Sheets export credit guardrail copy.
- Tests cover the new audit directly and verify the status summary surfaces it without exposing recipient hashes.
- Growth direction is preserved: “Challenge my underwriting.” remains the CTA, and raw share clicks alone still never earn credits.

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
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
```

Optional targeted lint check:
```bash
npx eslint src/underwriting-share-routes.ts test/underwriting-share-routes.test.ts
```

## 8. Test/build result
Passed locally:

```bash
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
# Test Suites: 1 passed, 1 total
# Tests: 30 passed, 30 total
# exit 0

npm run type-check
# tsc --noEmit
# exit 0

npm run build
# tsc
# exit 0

npx eslint src/underwriting-share-routes.ts test/underwriting-share-routes.test.ts
# exit 0
```

Deploy status: No deploy was run.

## 9. Risks/blockers
- No deploy was performed.
- No outbound messages/emails were sent.
- No paid API calls were made.
- This adds API payload fields only; frontend/Replit UI still needs to render `actionSummary.abuseAudit` if Dan wants an abuse/risk panel visible in-product.
- The audit uses existing aggregate counts, so it does not expose recipient hashes or raw visitor identity.

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull `realist-nightly/2026-06-06-share-qualified-ledger`. The underwriting share status response now includes an `abuseAudit` object that tells the app whether the viral underwriting loop is healthy, needs watching, or is capped for the day. It highlights capped actions, opens that still need real challenges, unopened recipient-specific links, and the next safe qualified action to chase. This makes the “Challenge my underwriting.” growth loop easier to promote while protecting Google Sheets export credits from raw-click abuse.
