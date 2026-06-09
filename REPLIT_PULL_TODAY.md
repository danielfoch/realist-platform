# Replit Pull Today — 2026-06-09

1. Date
- Tuesday, June 9, 2026

2. Branch and commit SHA
- Branch: `realist-nightly/2026-06-09-qualified-challenge-caps`
- Commit: `567b959` (code + handoff commit before SHA self-reference update)

3. What changed
- Added backend API support for the viral underwriting loop: analyze deal → share underwriting → recipient opens/challenges/forks assumptions → authenticated user can save a version → share onward.
- Added the exact CTA copy: “Challenge my underwriting.”
- Added qualified reward logic for Google Sheets/premium export credits.
- Raw share clicks do **not** grant credits; credits only come from qualified actions: unique open, fork/challenge, signup, saved version.
- Added anti-abuse controls: visitor/user/recipient identity keys, duplicate status tracking, hashed recipient emails, daily credit cap, qualified/status ledger, and per-share credit balance.

4. Files changed
- `src/underwriting-share-rewards.ts` — pure reward/qualification policy and visitor-key normalization.
- `src/underwriting-share-routes.ts` — share creation, share open, and challenge/fork/save-version endpoints.
- `src/server.ts` — mounts underwriting share routes under `/api`.
- `db/migrations/013_underwriting_shares.sql` — tables/indexes/check constraints for shares and share actions.
- `test/underwriting-share-rewards.test.ts` — reward policy unit tests.
- `REPLIT_PULL_TODAY.md` — this handoff.

5. Migration steps
- Run the new migration in Replit/Postgres:
  - `db/migrations/013_underwriting_shares.sql`
- It creates:
  - `underwriting_shares`
  - `underwriting_share_actions`
  - indexes for share token lookup, analysis lookup, action history, and visitor/recipient/user identity lookup.

6. Env vars needed
- No new environment variables.
- Existing auth/JWT and database env vars continue to apply.

7. Replit commands to run
- `npm install` only if Replit dependencies are stale.
- `npm run type-check`
- `npm run build`
- Optional targeted test: `npm test -- --runTestsByPath test/underwriting-share-rewards.test.ts`
- Apply migration before exercising the new routes.

8. Test/build result
- `npm run type-check` — passed.
- `npm test -- --runTestsByPath test/underwriting-share-rewards.test.ts` — passed, 5 tests.
- `npm run build` — passed.

9. Risks/blockers
- Migration must run before the new `/api/analyses/:id/share` and `/api/underwriting-shares/:token...` endpoints are used.
- Signup attribution is represented in the reward policy/migration but there is not yet a dedicated signup attribution endpoint wired into auth.
- Credits are tracked in `underwriting_shares.export_credit_balance`; a later patch should connect this balance to the actual Google Sheets export entitlement/spend path.
- Duplicate protection is application-level with indexed lookup; if very high concurrency appears, add a generated identity key or partial unique constraint.

10. Plain-English “what Dan should pull into Replit at 10am”
- Pull this branch to give Realist.ca the backend foundation for “Challenge my underwriting.” sharing. It creates share links, records qualified opens/challenges/saved versions, avoids paying for raw clicks, caps daily rewards, and tracks premium export credits so the frontend can start building the viral underwriting flow.
