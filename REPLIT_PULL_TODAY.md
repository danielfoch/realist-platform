# Realist.ca Replit Pull Brief — Share Status Dashboard

## 1. Date
- Wednesday, April 29, 2026

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-04-29-share-status-dashboard`
- Implementation commit: `4c6b130` (`feat: add underwriting share status summary`)
- This pull brief may be in a later docs-only commit on the same branch.

## 3. What changed
- Added a richer owner/status payload for viral underwriting shares so Dan can see whether “Challenge my underwriting.” is producing qualified actions, capped actions, and Google Sheets export credits.
- `POST /api/analyses/:id/share` now returns the active `rewardPolicy` alongside the share URL/CTA.
- `GET /api/underwriting-shares/:token/status` now returns:
  - `shareUrl` and CTA copy: “Challenge my underwriting.”
  - `rewardPolicy` for all qualified action types.
  - `actionSummary.byAction` with totals, qualified counts, capped counts, credit totals, and last action timestamps.
  - `actionSummary.totals` across all actions.
  - `actionSummary.recentActions` without exposing recipient hashes.
- Added tests covering the summary helper, no recipient-hash leak, and reward policy snapshot.
- Updated ByteRover project context for the viral sharing system.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `.brv/context-tree/**` project knowledge updates
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
- No new migration for today’s patch.
- This still depends on the existing viral underwriting tables from `db/migrations/013_viral_underwriting_shares.sql`.
- If Replit has not applied that migration yet, run:
```bash
npm run migrate
```
- If the migration runner does not pick up numbered SQL files, apply directly:
```bash
psql "$DATABASE_URL" -f db/migrations/013_viral_underwriting_shares.sql
```

## 6. Env vars needed
- No new environment variables.
- Existing app/database env vars still apply, especially `DATABASE_URL` for migrations/runtime.

## 7. Replit commands to run
```bash
git status --short
# Stop if Replit has local edits.

git fetch origin
git checkout realist-nightly/2026-04-29-share-status-dashboard
git pull origin realist-nightly/2026-04-29-share-status-dashboard
npm install
npm run migrate
npx jest test/underwriting-share-routes.test.ts --runInBand
npm run type-check
npm run build
```

## 8. Test/build result
Passed locally on Clyde’s Mac mini:
```bash
npx jest test/underwriting-share-routes.test.ts --runInBand
npm run type-check
npm run build
```

## 9. Risks/blockers
- No deploy was performed.
- Branch builds on the existing viral underwriting share-loop branch lineage, not a fresh `main`, because the share-loop migration/API are not on `main` yet.
- The owner status endpoint now includes recent action metadata. It intentionally omits recipient hashes, but callers should still avoid putting sensitive PII into action metadata.
- Branch was pushed to GitHub successfully: `origin/realist-nightly/2026-04-29-share-status-dashboard`.

## 10. What Dan should pull into Replit at 10am
Pull `realist-nightly/2026-04-29-share-status-dashboard` if you want a practical dashboard/API layer for the viral underwriting loop: it shows which shared analyses are earning qualified Google Sheets export credits, which actions are capped, and whether recipients are actually challenging/forking/saving versions after clicking “Challenge my underwriting.”
