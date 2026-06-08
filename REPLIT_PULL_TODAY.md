# Replit Pull Today — Realist.ca Nightly GitHub Builder

1. Date
- 2026-06-08

2. Branch and commit SHA
- Branch: `realist-nightly/2026-06-08-recipient-nudge`
- Commit SHA: `bee10c3` (code commit; this handoff note may be one commit ahead)

3. What changed
- Added an API share-challenge payload to saved analysis responses so each underwriting save/list/detail response can immediately drive the viral loop.
- The payload centers the CTA “Challenge my underwriting.” and gives recipient-facing copy for challenging rent, vacancy, expenses, or exit-cap assumptions.
- Added explicit premium-credit guardrails: Google Sheets export credits are tied to qualified actions, never raw share clicks alone.
- Added anti-abuse guidance for unique recipient tracking/fingerprints and daily caps per share, recipient, and action.
- Fixed the authenticated analysis list query so `notes` are selected before being returned.
- Added a Jest test covering the share prompt, qualified actions, reward guardrail, and anti-abuse fields.

4. Files changed
- `src/analysis-routes.ts`
- `test/analysis-share-prompt.test.ts`
- `REPLIT_PULL_TODAY.md`

5. Migration steps
- None. This patch only changes API response shape and tests.

6. Env vars needed
- None beyond existing app configuration.

7. Replit commands to run
- `npm install` if dependencies are not already installed.
- `npm run type-check`
- `npm test -- --runTestsByPath test/analysis-share-prompt.test.ts`
- Optional broader gate: `npm test`

8. Test/build result
- `npm test -- --runTestsByPath test/analysis-share-prompt.test.ts` — PASS
- `npm run type-check` — PASS

9. Risks/blockers
- This introduces a share URL contract (`/analyses/:id/challenge`) in API metadata, but does not implement the challenge landing page or reward ledger. Frontend/Replit can still use the copy/guardrails immediately, but the URL should be wired to the eventual challenge/fork screen before public launch.
- Reward credits remain informational in this patch; do not grant credits until backend qualified-action tracking is implemented with unique-recipient tracking and caps.

10. Plain-English “what Dan should pull into Replit at 10am”
- Pull this branch to expose “Challenge my underwriting.” share prompts directly from saved deal analyses. It gives the frontend ready-to-use viral-loop copy plus clear Google Sheets export credit guardrails, without needing a database migration.
