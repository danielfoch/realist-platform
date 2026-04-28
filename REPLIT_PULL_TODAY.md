# Realist.ca Replit Pull Brief — Viral Underwriting Share Loop

## Branch
- Branch: `realist-nightly/2026-04-27-viral-underwriting-loop`
- Purpose: Pull the viral underwriting share loop into Replit, apply its migration, and verify the focused API tests.

## Pull into Replit
```bash
git fetch origin
git checkout realist-nightly/2026-04-27-viral-underwriting-loop
git pull origin realist-nightly/2026-04-27-viral-underwriting-loop
```

If Replit has local edits, stop and inspect before overwriting anything:
```bash
git status --short
```

## Apply Migration
Run the project migration runner first:
```bash
npm run migrate
```

If the migration runner does not pick up numbered SQL files, apply directly:
```bash
psql "$DATABASE_URL" -f db/migrations/013_viral_underwriting_shares.sql
```

## Verify
```bash
npm install
npm run type-check
npx jest test/underwriting-share-routes.test.ts --runInBand
npm run build
```

## What Changed
- Added viral underwriting share API routes in `src/underwriting-share-routes.ts`.
- Mounted the share router in `src/server.ts` under `/api`.
- Added migration `db/migrations/013_viral_underwriting_shares.sql` for:
  - `underwriting_shares`
  - `underwriting_share_actions`
  - `premium_credit_ledger`
- Added qualification/anti-abuse logic:
  - Credits only for qualified actions, not raw clicks.
  - Duplicate recipient/action/share combinations do not earn repeat credits.
  - Daily share caps and recipient caps limit abuse.
- Added focused Jest tests in `test/underwriting-share-routes.test.ts`.

## Files in This Pull
- `src/server.ts`
- `src/underwriting-share-routes.ts`
- `db/migrations/013_viral_underwriting_shares.sql`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`
