# Realist.ca Replit Pull Brief — Qualified Challenge Gates

## 1. Date
- Tuesday, April 28, 2026

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-04-28-qualified-challenge-gates`
- Commit: `9315921`

## 3. What changed
- Tightened the viral underwriting loop so `challenge`, `fork`, and `saved_version` actions only proceed when the recipient submits a meaningful underwriting change or critique.
- Empty/low-effort qualified-action posts now return `400` before any credit-awarding logic runs.
- Kept `signup` eligible without challenge metadata, and kept `unique_open` internal to the share-view route.
- Added focused tests for meaningful payload qualification.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
- No new migration for today’s patch.
- This branch builds on the viral underwriting share schema from `db/migrations/013_viral_underwriting_shares.sql`; if Replit has not applied it yet, run:
```bash
npm run migrate
```
- If the migration runner does not pick up numbered SQL files, apply directly:
```bash
psql "$DATABASE_URL" -f db/migrations/013_viral_underwriting_shares.sql
```

## 6. Env vars needed
- No new environment variables.
- Existing app/database env vars still apply, especially `DATABASE_URL` for migrations and runtime.

## 7. Replit commands to run
```bash
git fetch origin
git checkout realist-nightly/2026-04-28-qualified-challenge-gates
git pull origin realist-nightly/2026-04-28-qualified-challenge-gates
npm install
npm run migrate
npx jest test/underwriting-share-routes.test.ts --runInBand
npm run type-check
npm run build
```

If Replit has local edits, stop and inspect first:
```bash
git status --short
```

## 8. Test/build result
- Passed locally: `npx jest test/underwriting-share-routes.test.ts --runInBand`
- Passed locally: `npm run type-check`
- Passed locally: `npm run build`

## 9. Risks/blockers
- Branch is based on yesterday’s viral underwriting share loop branch, not `main`, because `main` does not yet contain the share-loop API/migration.
- Frontend/client callers must send at least one meaningful metadata field for `challenge`, `fork`, or `saved_version`: `challengedFields`, `assumptions`, `inputs`, `metrics`, `notes`, or `comment`.
- No deploy was performed.

## 10. What Dan should pull into Replit at 10am
Pull `realist-nightly/2026-04-28-qualified-challenge-gates` if you want the viral underwriting share loop plus a safer credit gate: recipients can still “Challenge my underwriting,” but empty button clicks no longer qualify for Google Sheets export credits.
