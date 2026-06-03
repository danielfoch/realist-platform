# REPLIT_PULL_TODAY

## 1. Date
2026-06-03

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-06-03-recipient-proof`
- Feature commit SHA: `9d0caffdb7b204012cddb116f89a421a0c0b70a3`

## 3. What changed
Added a qualified-action proof guide for the viral underwriting loop. Realist can now tell the UI exactly what evidence a recipient must provide before Google Sheets export credits can be earned.

Highlights:
- New `getQualifiedActionProofGuide()` helper covers `unique_open`, `challenge`, `fork`, `signup`, and `saved_version`.
- Each action now exposes required evidence, accepted metadata keys, sample metadata, qualification copy, credit amount, and anti-abuse guardrail.
- Challenge share cards now include a `proofGuide` for the next qualified action.
- Key API responses now include `qualifiedActionProofGuide` so Replit/frontend work can build recipient challenge/fork/save forms without guessing qualification rules.
- Tests verify the proof guide and ensure it keeps the “Challenge my underwriting.” CTA and qualified-action-only credit rules intact.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
None. This is a TypeScript/API payload helper change only. No database migration required.

## 6. Env vars needed
None new.

## 7. Replit commands to run
```bash
npm install
npm run type-check
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
```

Optional full gate if time allows:
```bash
npm run check
```

## 8. Test/build result
Passed locally:

```bash
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
# Test Suites: 1 passed, 1 total
# Tests: 26 passed, 26 total

npm run type-check
# tsc --noEmit
# exit 0
```

## 9. Risks/blockers
- No deploy was performed.
- No outbound messages/emails were sent.
- No paid API calls were made.
- Existing uncommitted `.brv`/handoff artifacts from prior work were left unstaged and not included in the feature commit.
- No database migration is included; this assumes the existing underwriting share action tables are already present.

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull `realist-nightly/2026-06-03-recipient-proof` to make the “Challenge my underwriting” loop easier to build in the UI. The API now tells Replit exactly what proof is needed for each qualified action before export credits are earned — for example, challenged fields/comment for a challenge, changed assumptions for a fork, authenticated user for signup, and changed inputs/metrics/notes for saved versions. This keeps the viral loop clear while protecting against raw-click credit abuse.
