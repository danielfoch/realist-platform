# REPLIT PULL TODAY — 2026-05-01

## 1. Date
Friday, May 1, 2026

## 2. Branch and commit SHA
Branch: `realist-nightly/2026-05-01-share-status-dashboard`

Commit SHA: `974cae125488499a38d1c69f8d7e27f10eff390f`

## 3. What changed
- Improved the viral underwriting owner status payload so Dan/Replit can show a more useful sharing dashboard.
- Added per-action daily qualified counts and remaining daily share-cap counts, reinforcing that credits are capped and only awarded for qualified actions.
- Added unique recipient and qualified recipient counts without exposing recipient hashes.
- Added conversion-rate metrics for the loop:
  - qualified open → challenge
  - challenge → fork/saved version
  - fork/saved version → signup
- Added a `growthNudge` object with stage-specific copy using the standing CTA: “Challenge my underwriting.”
- Added tests covering the richer summary, privacy behavior, conversion rates, daily caps, and growth-nudge stages.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
No database migration required. This reuses the existing `underwriting_share_actions.recipient_hash`, `qualified`, `credit_amount`, and `created_at` fields.

## 6. Env vars needed
No new environment variables.

## 7. Replit commands to run
```bash
git fetch origin
git checkout realist-nightly/2026-05-01-share-status-dashboard
npm install
npm run build
npx jest test/underwriting-share-routes.test.ts --runInBand
```

If merging into the active Replit branch instead:
```bash
git fetch origin
git merge realist-nightly/2026-05-01-share-status-dashboard
npm run build
npx jest test/underwriting-share-routes.test.ts --runInBand
```

## 8. Test/build result
Passed locally:
```bash
npm run type-check
npx jest test/underwriting-share-routes.test.ts --runInBand
npm run build
```

## 9. Risks/blockers
- No deploy was performed.
- No outbound emails/messages were sent.
- No paid API calls were made.
- This changes the JSON shape returned by `GET /api/underwriting-shares/:token/status` by adding fields, but does not remove existing fields.
- Push status: pending GitHub auth check.

## 10. What Dan should pull into Replit at 10am
Pull the `realist-nightly/2026-05-01-share-status-dashboard` branch if you want the underwriting share status endpoint to power a better owner dashboard: daily cap visibility, privacy-safe recipient counts, viral-loop conversion rates, and suggested “Challenge my underwriting” follow-up copy for the next sharing step.
