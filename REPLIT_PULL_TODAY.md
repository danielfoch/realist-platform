# REPLIT_PULL_TODAY — Realist.ca Nightly GitHub Builder

## 1. Date
Tuesday, May 5, 2026

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-05-share-recipient-dashboard`
- Implementation commit: `340add070c97951e69ab9679743b55590042e2ea`

## 3. What changed
Added a recipient invite funnel to the viral underwriting share status payload.

Owners can now see, by recipient-link source, how invite batches are moving through the qualified growth loop:

`invited -> opened -> challenged -> forked/saved version -> signup`

The funnel reports counts, conversion rates, and Google Sheets export credits earned from qualified actions only. It does not expose recipient hashes or raw visitor identity.

This supports the current priority loop:

Analyze deal -> Share underwriting -> Recipient challenges/forks assumptions -> Account/save version -> Share onward

Primary CTA remains: **“Challenge my underwriting.”**

## 4. Files changed
- `src/underwriting-share-routes.ts`
  - Added `getRecipientInviteFunnel(...)`.
  - Added `inviteFunnel` to `getShareActionSummary(...)` / share status response.
  - Funnel aggregates by `underwriting_share_recipients.source`.
  - Funnel only counts qualified actions and preserves anti-abuse/privacy boundaries.
- `test/underwriting-share-routes.test.ts`
  - Added coverage for invite-funnel aggregation.
  - Extended share-status summary test to verify the new `inviteFunnel` payload.
  - Verified recipient identity is not exposed.

## 5. Migration steps
None. This uses existing tables from prior migrations:
- `underwriting_share_recipients`
- `underwriting_share_actions`

## 6. Env vars needed
None.

## 7. Replit commands to run
```bash
git fetch origin
git checkout realist-nightly/2026-05-05-share-recipient-dashboard
npm install
npm run type-check
npm test -- underwriting-share-routes.test.ts --runInBand
```

If Dan wants the full gate in Replit:

```bash
npm run check
```

## 8. Test/build result
Passed locally on Clyde’s Mac mini:

```bash
npm test -- underwriting-share-routes.test.ts --runInBand
# PASS test/underwriting-share-routes.test.ts
# 12 tests passed

npm run type-check
# tsc --noEmit passed
```

## 9. Risks/blockers
- Not deployed.
- Branch has a local implementation commit. It was not pushed during this run.
- The funnel is API/status-payload work only; no frontend dashboard UI was added yet.
- Existing uncommitted `.brv/` knowledge-base files and unrelated untracked local files were left out of the implementation commit to avoid mixing product code with workspace memory artifacts.

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull the `realist-nightly/2026-05-05-share-recipient-dashboard` branch for a backend improvement to the viral underwriting loop: share owners can now see which recipient-specific share sources are actually producing qualified opens, challenges, saved/forked versions, signups, and Google Sheets export credits — without rewarding raw clicks or exposing recipient identity.
