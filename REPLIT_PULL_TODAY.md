# REPLIT_PULL_TODAY — Realist.ca Nightly GitHub Builder

## 1. Date
Sunday, May 24, 2026

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-24-qualified-share-ledger`
- Implementation commit: `901c5ddec15b8f641a68d216246a7f352b29ed3a`

## 3. What changed
Added the missing redemption side of the viral underwriting reward loop so Google Sheets export credits can be checked and spent after they are earned from qualified share actions.

This keeps the current product direction intact:
- Recipients still earn the inviter credits only through qualified actions: unique open, challenge, fork, signup, or saved version.
- Raw share clicks and recipient-link creation still do not award credits.
- New authenticated API helpers expose Google Sheets export credit balance and redemption.
- Redemptions are tracked in their own ledger so Replit can gate Google Sheets export access without mutating the earned-credit history.
- Insufficient-credit responses include the **“Challenge my underwriting.”** earn prompt so the product can push users back into the viral loop.

## 4. Files changed
- `src/underwriting-share-routes.ts`
  - Adds `getGoogleSheetsExportCreditBalance()`.
  - Adds `redeemGoogleSheetsExportCredits()` using a balance-checked insert.
  - Adds authenticated endpoints:
    - `GET /api/premium-credits/google-sheets-export`
    - `POST /api/premium-credits/google-sheets-export/redemptions`
- `db/migrations/016_premium_credit_redemptions.sql`
  - Adds `premium_credit_redemptions` spend ledger and user/type index.
- `test/underwriting-share-routes.test.ts`
  - Adds tests for earned-minus-redeemed balance, successful redemption, and insufficient-credit blocking.
- `REPLIT_PULL_TODAY.md`
  - This handoff brief.

## 5. Migration steps
Run the new migration before using the redemption endpoints:

```bash
psql "$DATABASE_URL" -f db/migrations/016_premium_credit_redemptions.sql
```

This migration is additive and creates only `premium_credit_redemptions` plus an index/comments.

## 6. Env vars needed
None new.

## 7. Replit commands to run
```bash
git fetch origin
git checkout realist-nightly/2026-05-24-qualified-share-ledger
npm install
psql "$DATABASE_URL" -f db/migrations/016_premium_credit_redemptions.sql
npm run type-check
npm run build
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
```

## 8. Test/build result
Passed locally:

```bash
npm run type-check
# PASS: tsc --noEmit

npm run build
# PASS: tsc

npx jest test/underwriting-share-routes.test.ts --runInBand
# PASS: 16 tests passed
```

## 9. Risks/blockers
- Not deployed.
- No outbound emails/messages were sent.
- No paid APIs were called.
- Requires one additive DB migration before redemption endpoints are used.
- Branch is local at handoff time unless push succeeds after this file is committed.
- Pre-existing untracked files remain uncommitted intentionally:
  - `REPLIT_HANDOFF_CONTRACT.md`
  - `REPLIT_PULL_TEMPLATE.md`
  - `scripts/`

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull `realist-nightly/2026-05-24-qualified-share-ledger` to make the viral underwriting reward loop actually usable for Google Sheets exports. Users can now earn export credits only from qualified **“Challenge my underwriting.”** actions, see their available balance, and spend credits on exports; raw share clicks still never create rewards.
