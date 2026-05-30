# REPLIT PULL TODAY

1. Date
- 2026-05-30

2. Branch and commit SHA
- Branch: realist-nightly/2026-05-30-share-quality-score
- Commit SHA: 7e0ef57b8a6faf54c855d8af8cb54cb21086f542

3. What changed
- Added a qualified-only viral loop plan to underwriting share status summaries.
- The plan packages the current funnel phase, next qualified action, milestone progress, recommended recipient source, earned Google Sheets export credits, and anti-abuse guardrail copy.
- Keeps the “Challenge my underwriting.” loop focused on qualified actions only: unique open, challenge, fork, signup, saved version.

4. Files changed
- src/underwriting-share-routes.ts
- test/underwriting-share-routes.test.ts
- REPLIT_PULL_TODAY.md

5. Migration steps
- No database migration required.
- This only adds response payload fields and tests around existing underwriting share analytics.

6. Env vars needed
- No new env vars.

7. Replit commands to run
```bash
npm install
npm run type-check
npm test -- underwriting-share-routes.test.ts
```

8. Test/build result
- PASS: `npm test -- underwriting-share-routes.test.ts` (22 tests passed)
- PASS: `npm run type-check`

9. Risks/blockers
- No blocker found.
- Existing untracked repo files were left untouched: `REPLIT_HANDOFF_CONTRACT.md`, `REPLIT_PULL_TEMPLATE.md`, and `scripts/`.
- Replit UI needs to decide where to show `actionSummary.loopPlan`; API payload is now available from share status summaries.

10. Plain-English “what Dan should pull into Replit at 10am”
- Pull the new branch to get a cleaner viral underwriting status payload that tells the UI exactly where a shared deal is in the loop and what qualified action to ask for next — without ever rewarding raw share clicks.
