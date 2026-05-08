# REPLIT_PULL_TODAY — Realist.ca Nightly GitHub Builder

## 1. Date
Friday, May 8, 2026 (America/Toronto)

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-08-share-conversion-readiness`
- Implementation commit: `81c765fe26f488181298d98280d6486c4148d968`

## 3. What changed
Added a public-facing qualified reward ladder to the underwriting share loop so recipients can see exactly which actions earn Google Sheets export credits and why raw clicks do not count.

Key behavior:
- Public share API now returns `rewardPolicy`, `rewardLadder`, `creditGuardrail`, and recipient tracking source.
- Underwriting share page renders a “Qualified reward ladder” card before the deal details.
- Ladder explains each qualified action: unique open, meaningful challenge, forked assumptions, signup, saved version.
- Copy reinforces the required CTA: “Challenge my underwriting.”
- Anti-abuse copy is explicit: credits unlock only for qualified actions within caps, never raw share clicks alone.
- Added test coverage for the public reward ladder helper.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `frontend/src/pages/UnderwritingSharePage.tsx`
- `frontend/src/pages/UnderwritingSharePage.css`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
None. No database migration required.

## 6. Env vars needed
None.

## 7. Replit commands to run
From repo root:

```bash
npm install
npm run type-check
npx jest test/underwriting-share-routes.test.ts --runInBand
```

If Replit also builds the frontend separately:

```bash
cd frontend
npm install
npm run build
```

## 8. Test/build result
Passed:

```bash
npm run type-check
npx jest test/underwriting-share-routes.test.ts --runInBand
```

Result: backend TypeScript check passed; targeted underwriting share test suite passed, 14/14 tests.

Additional frontend gate attempted:

```bash
cd frontend && npm run build
```

Result: blocked by existing unrelated TypeScript errors in `CreaStatsPage.tsx`, `HomePage.tsx`, `SavedListingsPage.tsx`, and `SixixplexReportPage.tsx`. To isolate this patch, I also ran:

```bash
cd frontend
./node_modules/.bin/tsc --noEmit --jsx react-jsx --moduleResolution node --module ESNext --target ES2020 --lib ES2020,DOM --esModuleInterop --skipLibCheck src/pages/UnderwritingSharePage.tsx
```

Result: passed for the changed page.

## 9. Risks/blockers
- Full frontend build is currently blocked by pre-existing unrelated TypeScript errors, not by this patch.
- No migration risk.
- Public API response adds fields but does not remove or rename existing fields.
- Reward ladder is informational; credit awards still happen only through existing qualified-action server logic and daily caps.

## 10. Plain-English what Dan should pull into Replit at 10am
Pull `realist-nightly/2026-05-08-share-conversion-readiness` for a clearer viral underwriting share page. Recipients will now see a simple reward ladder explaining how “Challenge my underwriting” turns into qualified actions and Google Sheets export credits, while making it obvious that raw share clicks do not earn credits.
