# REPLIT PULL TODAY

## 1. Date
Monday, May 18, 2026

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-18-qualified-share-credits`
- Commit SHA: `23381ffce49856b349d44b2c7207296c51637642`

## 3. What changed
Added an anti-abuse guardrail to the viral underwriting credit path: an inviter/owner cannot earn Google Sheets export credits by recording their own qualified underwriting action.

This tightens the loop around the intended qualified sharing behavior:

- Recipients can still qualify owners for credits through accepted actions: issued-recipient unique open, challenge, fork, signup, or saved version.
- Raw/generic clicks still earn 0 credits.
- Duplicate recipient/action/share records still earn 0 additional credits.
- Daily share and recipient caps still apply.
- New self-action attempts are tracked as unqualified with `creditQualificationReason: "inviter_self_action_not_credit_eligible"`.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
No database migration required.

This is application logic only. It adds an optional `actorUserId` to `recordQualifiedShareAction(...)` and passes the authenticated user from `POST /api/underwriting-shares/:token/actions`.

## 6. Env vars needed
No new environment variables.

## 7. Replit commands to run
```bash
npm install
npm run type-check
npm test
```

Optional if Dan wants the production build artifact refreshed in Replit:
```bash
npm run build
```

## 8. Test/build result
Passed locally:

```bash
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
# PASS test/underwriting-share-routes.test.ts
# 25 tests passed

npm run type-check
# tsc --noEmit passed

npm test
# PASS 4 test suites
# 32 tests passed
```

No deploy was run.

## 9. Risks/blockers
- No deploy was run.
- No outbound messages/emails were sent.
- No paid APIs were called.
- The self-action guardrail only applies when the actor is authenticated on the action endpoint. Anonymous opens remain governed by existing issued-recipient-link, duplicate, and cap rules.
- Existing qualified recipient behavior should be unchanged; the new test covers owner self-action suppression.

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull this branch to prevent users from farming premium Google Sheets export credits by challenging/forking their own shared underwriting. Real recipients still drive the viral loop with “Challenge my underwriting,” but owner self-actions are now recorded as unqualified instead of rewarded.
