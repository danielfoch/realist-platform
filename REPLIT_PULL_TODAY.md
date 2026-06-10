# REPLIT_PULL_TODAY

## 1. Date
2026-06-10

## 2. Branch and Commit SHA
Branch: `realist-nightly/2026-06-10-viral-underwriting-status`
Commit: `PENDING` (will be filled after local commit)

## 3. What Changed
- Added a reward-status summary for viral underwriting shares so the UI can show the CTA, earned Google Sheets export credits, qualified action counts, daily cap remaining, action/status counts, and the next qualified actions still available.
- Added `POST /api/underwriting-shares/:token/signup-credit` to award the existing `signup` qualified action only after an authenticated recipient account exists.
- Kept the core rule intact: raw share clicks are trackable but never earn credits. Credits continue to require unique/recipient/authenticated signals and respect the daily cap.
- Marked shares as `qualified` when a qualified action actually adds export credits.
- Expanded unit coverage for signup credits, reward status summaries, capped status, and raw-click exclusion from next-step progress.

## 4. Files Changed
- `src/underwriting-share-rewards.ts`
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-rewards.test.ts`
- `REPLIT_PULL_TODAY.md`

## 5. Migration Steps
No new migration tonight.

Required existing migration from the previous underwriting-share patch still applies if not already run:
- `db/migrations/013_underwriting_shares.sql`

## 6. Env Vars Needed
No new env vars.

Existing app env still required as usual:
- `DATABASE_URL`
- Auth/JWT/Stripe vars already used by the app where applicable.

## 7. Replit Commands To Run
```bash
npm install
npm run migrate
npm run type-check
npm run build
npm test -- underwriting-share-rewards.test.ts --runInBand
```

Optional once existing repo-wide lint debt is cleaned up:
```bash
npm run lint
```

## 8. Test/Build Result
Passed:
- `npm test -- underwriting-share-rewards.test.ts --runInBand` — 1 suite passed, 8 tests passed.
- `npm run type-check` — passed.
- `npm run build` — passed.

Blocked by pre-existing lint debt outside tonight's files:
- `npm run lint` fails on existing unused variables in files including `src/analysis-routes.ts`, `src/api-routes.ts`, `src/auth-routes.ts`, `src/flywheel-routes.ts`, `src/investor-lead-routes.ts`, `src/realtor-routes.ts`, `src/scripts/generate-market-update.ts`, `src/scripts/seed-comprehensive.ts`, and `src/stripe-integration.ts`.

## 9. Risks/Blockers
- The new signup-credit endpoint depends on the frontend/auth flow calling it after signup with the share token. It returns `401` unless `req.userId` is present.
- Export credits are still tracked on `underwriting_shares.export_credit_balance`; wiring spend/decrement into the actual Google Sheets export path remains a follow-up.
- The reward-status endpoint is token-accessible like the share page. It returns aggregate counts and credit balances for that shared underwriting token, not recipient PII.
- Repo-wide lint remains blocked by unrelated existing errors.

## 10. What Dan Should Pull Into Replit At 10am
Pull `realist-nightly/2026-06-10-viral-underwriting-status` for the next viral underwriting loop step: the share flow can now show reward progress and can award qualified signup credit after a recipient creates an account, while raw clicks still earn nothing. In Replit, run the existing underwriting share migration if needed, then run `npm run type-check`, `npm run build`, and the focused underwriting reward test.
