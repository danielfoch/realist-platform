# Realist.ca Replit Pull Brief — Onward Share Loop

## 1. Date
- Thursday, April 30, 2026

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-04-30-onward-share-loop`
- Commit: `e365700`

## 3. What changed
- Added share lineage so challenged/forked underwriting versions can be traced back to the original share.
- Added automatic onward-share creation when an authenticated recipient completes a qualified `fork` or `saved_version` action.
- The action response can now include `onwardShare` with the same CTA: “Challenge my underwriting.” This lets a recipient immediately share their challenged version onward.
- Kept the reward model qualified-action-only: no credits are awarded for raw share clicks alone, and onward shares are only created after the fork/save action qualifies.
- Avoided duplicate/capped abuse creating extra saved analyses or onward shares by moving the save/fork clone after qualification succeeds.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `db/migrations/014_underwriting_share_lineage.sql`
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
- New migration required:
```bash
npm run migrate
```
- If the migration runner does not pick up numbered SQL files, apply directly:
```bash
psql "$DATABASE_URL" -f db/migrations/014_underwriting_share_lineage.sql
```
- This still depends on the existing viral underwriting tables from `db/migrations/013_viral_underwriting_shares.sql`.

## 6. Env vars needed
- No new environment variables.
- Existing app/database env vars still apply, especially `DATABASE_URL` for migrations/runtime.

## 7. Replit commands to run
```bash
git status --short
# Stop if Replit has local edits.

git fetch origin
git checkout realist-nightly/2026-04-30-onward-share-loop
git pull origin realist-nightly/2026-04-30-onward-share-loop
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
- Replit must apply migration `014_underwriting_share_lineage.sql` before the updated share creation endpoints run, because `underwriting_shares` now stores `parent_share_id`, `parent_share_action_id`, and `share_depth`.
- Automatic onward shares are created only for authenticated recipients who perform a qualified `fork` or `saved_version`; anonymous challenges still record qualified actions but do not produce a saved analysis or onward share.
- Branch push status: local branch/commit prepared; push only if GitHub auth is configured and safe.

## 10. What Dan should pull into Replit at 10am
Pull `realist-nightly/2026-04-30-onward-share-loop` to make the viral underwriting loop more complete: when someone challenges and saves/forks a deal, Realist now creates their own shareable version with “Challenge my underwriting.” so the loop can continue from recipient to recipient while keeping credits tied to qualified actions only.
