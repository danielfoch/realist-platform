# REPLIT PULL TODAY

## 1. Date
Saturday, May 16, 2026

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-16-challenge-invite-summary`
- Commit SHA: `65f4caa30d3c78eab1c615ad3ce6d824051d088a` (code commit before this documentation update; final branch tip may include this file)
- Code commit: `65f4caa30d3c78eab1c615ad3ce6d824051d088a`

## 3. What changed
Added a qualified recipient invite plan to underwriting share status summaries.

This gives the product/API a next-step plan for the viral underwriting loop:

- Keep the CTA: “Challenge my underwriting.”
- Recommend how many new recipient-specific links to create when unique-open credit slots are available.
- Identify opened recipients who have not challenged yet.
- Identify challenged recipients who have not saved/forked a version yet.
- Suggest high-value recipient personas: neighbourhood rent skeptic, active agent, lender/broker, and operator/property manager.
- Provide invite and follow-up copy that asks for a changed assumption, saved version, or fork.
- Re-state the anti-abuse rule: raw clicks and link creation do not earn credits; only qualified tracked actions within daily caps do.

The new `qualifiedRecipientInvitePlan` object is included in `getShareActionSummary(...)`, which feeds the authenticated share status endpoint.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
No database migration required.

This is API/status-shape only. It adds `actionSummary.qualifiedRecipientInvitePlan` to `GET /api/underwriting-shares/:token/status` responses.

## 6. Env vars needed
No new environment variables.

## 7. Replit commands to run
```bash
npm install
npm run type-check
npm run build
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
```

Optional fuller gate if Replit has enough time/resources:
```bash
npm test
```

## 8. Test/build result
Passed locally:

```bash
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
# PASS test/underwriting-share-routes.test.ts
# 23 tests passed

npm run type-check
# tsc --noEmit passed

npm run build
# tsc passed
```

Lint was also attempted and is blocked by pre-existing unrelated unused-variable errors in files not changed by this patch, for example `src/analysis-routes.ts`, `src/api-routes.ts`, `src/auth-routes.ts`, `src/flywheel-routes.ts`, `src/investor-lead-routes.ts`, and others. The new patch itself type-checks and targeted tests pass.

## 9. Risks/blockers
- No deploy was run.
- No outbound messages/emails were sent.
- No paid APIs were called.
- `npm run lint` is currently blocked by existing repo-wide unused-variable errors unrelated to this change.
- Client code must opt into rendering the new `qualifiedRecipientInvitePlan`; existing response fields remain unchanged.

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull this branch to give the underwriting-share status API a concrete invite plan: who to send recipient-specific “Challenge my underwriting” links to next, how many links to create, what follow-up to send after opens, and how to keep Google Sheets export credits tied only to qualified actions instead of raw clicks.
