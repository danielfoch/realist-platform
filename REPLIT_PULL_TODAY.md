# REPLIT_PULL_TODAY — Realist.ca Nightly GitHub Builder

## 1. Date
Saturday, May 9, 2026 (America/Toronto)

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-09-challenge-prompt-pack`
- Implementation commit: `650808b6aff7ef911cc14146d96d6dbb7bd2a30e`

## 3. What changed
Added a recipient-facing challenge prompt pack to the viral underwriting share API.

Key behavior:
- Public share API now returns `challengePromptPack` alongside the deal analysis.
- Prompt pack turns saved assumptions into concrete challenge targets: market rent, vacancy, operating expenses, cap rate, and monthly cash flow.
- Each prompt includes the current value, a plain-English challenge question, and a payload hint for submitting a qualified challenge.
- If an analysis has no recognizable metrics/inputs, the API falls back to a general underwriting-note challenge.
- Copy keeps the required CTA: “Challenge my underwriting.”
- Guardrail stays explicit: credits require qualified challenge/fork/signup/saved-version behavior; raw share clicks do not earn credits.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
None. No database migration required.

## 6. Env vars needed
None.

## 7. Replit commands to run
From repo root:

```bash
npm install
npm run type-check
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
```

## 8. Test/build result
Passed locally:

```bash
npm run type-check
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
```

Result: TypeScript check passed; targeted underwriting share test suite passed, 16/16 tests.

## 9. Risks/blockers
- No migration or env-var risk.
- Public API response adds `challengePromptPack`; it does not remove or rename existing fields.
- Prompt aliases cover the current known metric/input names, but the frontend may still choose which prompts to render first.
- Existing uncommitted `.brv/`, `.learnings/`, and `BUILD_NOTES.md` workspace files were present before this run; I did not include them in the implementation commit.

## 10. Plain-English what Dan should pull into Replit at 10am
Pull `realist-nightly/2026-05-09-challenge-prompt-pack` to make shared underwriting links more actionable. Recipients will no longer just see a deal; the API now hands the frontend ready-made prompts that ask them to challenge rent, vacancy, expenses, cap rate, or cash flow and submit a qualified “Challenge my underwriting” response that can lead to forks, saved versions, and Google Sheets export credits.
