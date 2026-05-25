# REPLIT_PULL_TODAY — Realist.ca Nightly GitHub Builder

## 1. Date
Monday, May 25, 2026

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-25-share-intent-caps`
- Implementation commit: `9b13ecb2a603798498868c644ee46ff8b53469f5`

## 3. What changed
Added a structured qualified-action catalog for the viral underwriting loop so Replit/frontend surfaces can explain exactly what earns Google Sheets export credits under the **“Challenge my underwriting.”** CTA.

This reinforces the product direction:
- Share creation and raw clicks still do not award credits by themselves.
- Rewards are documented as qualified actions only: unique open, challenge, fork, signup, saved version.
- Each action now carries frontend-ready copy for: when it qualifies, recipient prompt, owner prompt, daily caps, credit amount, and anti-abuse rule.
- The catalog is returned from share creation/view/action/status and premium-credit balance APIs, so UI can show consistent reward/guardrail copy without hardcoding it.
- The existing reward brief now includes the same catalog next to earned/remaining credits and best-next-reward guidance.

## 4. Files changed
- `src/underwriting-share-routes.ts`
  - Adds `getQualifiedActionCatalog()`.
  - Adds action-specific qualification, CTA, owner coaching, and anti-abuse copy.
  - Includes `qualifiedActionCatalog` in underwriting share and premium-credit API responses.
  - Includes the catalog inside `getQualifiedShareRewardBrief()`.
- `test/underwriting-share-routes.test.ts`
  - Adds coverage for the qualified-action catalog and reward brief exposure.
- `REPLIT_PULL_TODAY.md`
  - This handoff brief.

## 5. Migration steps
None. No database changes in this branch.

## 6. Env vars needed
None new.

## 7. Replit commands to run
```bash
git fetch origin
git checkout realist-nightly/2026-05-25-share-intent-caps
npm install
npm run build
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
```

Optional broader gate if time allows:
```bash
npm run type-check
npm run lint
npm test
```

## 8. Test/build result
Passed locally:

```bash
npm run build
# PASS: tsc

npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
# PASS: 17 tests passed
```

## 9. Risks/blockers
- Not deployed.
- No outbound emails/messages were sent.
- No paid APIs were called.
- No DB migration required.
- Branch pushed to GitHub: `origin/realist-nightly/2026-05-25-share-intent-caps`.
- PR URL: https://github.com/danielfoch/realist-platform/pull/new/realist-nightly/2026-05-25-share-intent-caps
- Existing untracked files were left untouched and uncommitted intentionally:
  - `REPLIT_HANDOFF_CONTRACT.md`
  - `REPLIT_PULL_TEMPLATE.md`
  - `scripts/`

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull `realist-nightly/2026-05-25-share-intent-caps` to make the underwriting-share reward loop easier to wire into the UI. Replit can now show users exactly which **“Challenge my underwriting.”** actions earn Google Sheets export credits, what proof is required, and which anti-abuse caps apply — without promising rewards for raw share clicks alone.
