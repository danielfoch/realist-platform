# REPLIT PULL TODAY — Realist.ca Nightly GitHub Builder

## 1. Date
Tuesday, May 26, 2026

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-26-qualified-share-credits`
- Code commit SHA: `60984f560ccc8d039d0268317cfd3016505bdb79`
- Branch HEAD: latest pushed commit on this branch (`git log -1 --format=%H`)

## 3. What changed
Tightened the viral underwriting reward loop so a recipient cannot spoof a `signup` qualified action from an anonymous request.

- Added a reusable `getShareActionQualificationBlockReason(...)` guard.
- Signup credits now require an authenticated recipient/account context before any credit-earning action is recorded.
- Challenge/fork/saved-version credit blocks now return the same “Challenge my underwriting.” CTA and anti-abuse guardrail copy used elsewhere.
- Added Jest coverage proving anonymous signup rewards are blocked while authenticated signups and meaningful challenges remain eligible.

This keeps the growth loop aligned with the rule: Google Sheets export credits are only earned through qualified, attributable actions — never raw share clicks or spoofed reward posts.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`
- `.brv/context-tree/growth/**` (local project context for future agents)

## 5. Migration steps
No database migration required.

Existing tables continue to work:
- `underwriting_shares`
- `underwriting_share_actions`
- `underwriting_share_recipients`
- `premium_credit_ledger`
- `premium_credit_redemptions`

## 6. Env vars needed
No new environment variables.

Existing auth/JWT configuration still applies:
- `JWT_SECRET`
- `JWT_EXPIRY` if used in Replit

## 7. Replit commands to run
```bash
git fetch origin
git checkout realist-nightly/2026-05-26-qualified-share-credits
npm install
npm run type-check
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
```

If Replit prefers build over type-check:
```bash
npm run build
```

## 8. Test/build result
Passed locally on Clyde’s Mac mini:

```bash
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
# PASS test/underwriting-share-routes.test.ts
# Tests: 18 passed, 18 total

npm run type-check
# tsc --noEmit passed
```

## 9. Risks/blockers
- No deploy performed.
- No outbound emails/messages sent.
- No paid API calls used.
- Push depends on GitHub auth being available and safe from this machine.
- Existing untracked local handoff files/directories were left alone and not included in this patch: `REPLIT_HANDOFF_CONTRACT.md`, `REPLIT_PULL_TEMPLATE.md`, `scripts/`.
- This patch intentionally makes anonymous `signup` reward posts return `401`; UI should prompt the recipient to log in/create an account before claiming signup credits.

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull `realist-nightly/2026-05-26-qualified-share-credits` to make the **“Challenge my underwriting.”** credit loop harder to game. The important fix: someone can still earn credits for real qualified actions, but signup credits now require an authenticated account instead of letting an anonymous request claim a signup reward. This protects Google Sheets export credits from spoofed reward posts while keeping the viral underwriting flow intact.
