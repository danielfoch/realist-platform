# REPLIT PULL TODAY

## 1. Date
Sunday, May 17, 2026

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-17-qualified-share-digest`
- Code commit SHA: `7a16318418a2a6f72bb2f07772dcff2cf3efc384`
- Handoff file is committed after the code commit, so final branch tip may be newer.

## 3. What changed
Added a qualified-share owner digest to the viral underwriting share status flow.

The new `qualifiedShareDigest` object turns share analytics into one plain next step for the deal owner:

- Keeps the CTA: “Challenge my underwriting.”
- Names the next qualified action to pursue: unique open, challenge, saved version, signup, or fork.
- Provides owner-facing suggested copy for that next action.
- Shows how many opened recipients still need to challenge an assumption.
- Shows how many challenges still need a saved/forked version.
- Shows earned and remaining Google Sheets export credits for the share.
- Surfaces blockers like unopened recipient-specific links or reached daily caps.
- Repeats anti-abuse rules: no credits for raw share clicks, generic opens, or link creation alone.

This gives Replit/client code a compact panel candidate for “what should I do next to make this underwriting share grow?” without rewarding vanity clicks.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
No database migration required.

This is API/status-shape only. It adds `actionSummary.qualifiedShareDigest` to `GET /api/underwriting-shares/:token/status` responses via `getShareActionSummary(...)`.

## 6. Env vars needed
No new environment variables.

## 7. Replit commands to run
```bash
npm install
npm run type-check
npm test -- underwriting-share-routes.test.ts
```

Optional fuller gate if Replit has enough time/resources:
```bash
npm run build
npm test
```

## 8. Test/build result
Passed locally:

```bash
npm test -- underwriting-share-routes.test.ts
# PASS test/underwriting-share-routes.test.ts
# 24 tests passed

npm run type-check
# tsc --noEmit passed
```

No deploy was run.

## 9. Risks/blockers
- No deploy was run.
- No outbound messages/emails were sent.
- No paid APIs were called.
- Client code must opt into rendering the new `qualifiedShareDigest`; existing response fields remain unchanged.
- The digest is computed from existing share summary counts, so it does not change credit-award behavior or database writes.

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull this branch to add a simple owner-facing digest to underwriting share status: it tells the user the next qualified action to drive (“Challenge my underwriting”), what copy to use, who is stuck in the loop, how many Google Sheets export credits were earned/remain, and why raw clicks still do not count.
