# REPLIT_PULL_TODAY — Realist.ca Nightly GitHub Builder

## 1. Date
Friday, May 22, 2026

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-22-qualified-share-credits`
- Implementation commit: `a533240a9394511fe02c5e4e20c2f731a52e4507`
- Pull-brief docs commit: `5870b8d` (branch also includes the implementation commit above).

## 3. What changed
Added a qualified viral underwriting loop for Realist.ca using the required CTA: **“Challenge my underwriting.”**

The patch connects the full product path:

`Analyze deal -> Share underwriting -> Recipient challenges/forks assumptions -> Account/save version -> Share onward`

Key behavior:
- Investors can create a challenge/share link from Analysis History.
- Recipients can open a shared underwriting page at `/underwriting/:token`.
- Recipients can submit a challenge, save a version, or fork assumptions with meaningful metadata.
- Signed-in recipients who save/fork can get an onward share link, creating share lineage.
- Google Sheets export credits are awarded only for qualified actions within caps.
- Raw share link creation/clicks do not award credits.
- Anti-abuse tracking includes recipient hashes, unique recipient/open tracking, per-share daily caps, capped-action status, and a share status summary.
- Also cleared small existing frontend TypeScript blockers so `npm --prefix frontend run build` now passes.

## 4. Files changed
- `db/migrations/013_viral_underwriting_shares.sql`
  - Adds `underwriting_shares`, `underwriting_share_actions`, and `premium_credit_ledger` support for qualified share rewards.
- `db/migrations/014_underwriting_share_lineage.sql`
  - Adds parent share/action lineage fields and share depth.
- `db/migrations/015_underwriting_share_recipient_invites.sql`
  - Adds recipient-specific tracked invite links without exposing raw recipient identity.
- `src/underwriting-share-routes.ts`
  - New backend share router, qualified-action policy, anti-abuse gates, reward brief, status summary, recipient invite funnel, and onward-share creation.
- `src/server.ts`
  - Registers underwriting share routes under `/api`.
- `test/underwriting-share-routes.test.ts`
  - Covers qualified-only rewards, no duplicate/capped credits, recipient invite tracking, status summaries, reward brief, conversion insights, and lineage-aware onward shares.
- `frontend/src/App.tsx`
  - Registers `/underwriting/:token`.
- `frontend/src/pages/AnalysisHistory.tsx`
  - Adds **Challenge my underwriting** share action for saved analyses.
- `frontend/src/pages/AnalysisHistory.css`
  - Styles share success/guardrail UI.
- `frontend/src/pages/UnderwritingSharePage.tsx`
  - New recipient-facing underwriting challenge page.
- `frontend/src/pages/UnderwritingSharePage.css`
  - Styles the recipient share/challenge flow.
- `frontend/src/lib/event-tracking.ts`
  - Adds the existing homepage CTA event to the typed frontend tracking whitelist so frontend build passes.
- `frontend/src/pages/CreaStatsPage.tsx`, `frontend/src/pages/HomePage.tsx`, `frontend/src/pages/SavedListingsPage.tsx`, `frontend/src/pages/SixixplexReportPage.tsx`
  - Small TypeScript cleanup for existing build blockers.

## 5. Migration steps
Run the normal migration command after pulling this branch:

```bash
npm run migrate
```

Expected new migrations:
- `013_viral_underwriting_shares.sql`
- `014_underwriting_share_lineage.sql`
- `015_underwriting_share_recipient_invites.sql`

## 6. Env vars needed
None new.

## 7. Replit commands to run
```bash
git fetch origin
git checkout realist-nightly/2026-05-22-qualified-share-credits
npm install
npm --prefix frontend install
npm run migrate
npm run type-check
npx jest test/underwriting-share-routes.test.ts --runInBand
npm --prefix frontend run build
```

## 8. Test/build result
Passed locally:

```bash
npm run type-check
# PASS: tsc --noEmit

npx jest test/underwriting-share-routes.test.ts --runInBand
# PASS: 12 tests passed

npm --prefix frontend run build
# PASS: tsc && vite build
# Note: Vite reports an existing large chunk warning; build exits successfully.
```

## 9. Risks/blockers
- Not deployed.
- Branch pushed to GitHub: `origin/realist-nightly/2026-05-22-qualified-share-credits`.
- PR URL: https://github.com/danielfoch/realist-platform/pull/new/realist-nightly/2026-05-22-qualified-share-credits
- No outbound emails/messages were sent.
- No paid APIs were called.
- Credits are intentionally server-controlled and qualified-only; creating share links or receiving raw clicks does not award credits.
- Recipient tracking uses hashes/keys and status summaries; do not expose raw recipient identity in UI.
- Anonymous recipients can challenge; saved/forked onward-share creation requires an authenticated user context.
- Local pre-existing untracked files were left uncommitted intentionally:
  - `REPLIT_HANDOFF_CONTRACT.md`
  - `REPLIT_PULL_TEMPLATE.md`
  - `scripts/__pycache__/verify-replit-handoff.cpython-314.pyc`
  - `scripts/verify-replit-handoff.py`

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull `realist-nightly/2026-05-22-qualified-share-credits` to add the viral underwriting loop: investors can click **Challenge my underwriting** from Analysis History, send a tracked share link, recipients can challenge/fork/save assumptions, qualified actions earn Google Sheets export credits within anti-abuse caps, and signed-in challengers can create onward share links so the loop compounds.
