# REPLIT PULL TODAY

## 1. Date
Wednesday, May 20, 2026

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-20-share-rewards-caps`
- Code commit SHA: `0e5481779e56df33ff011fcf50cb6fabab970187`
- Handoff file is committed after the code commit, so final branch tip may be newer.

## 3. What changed
Tightened anti-abuse on recipient-specific underwriting share invites.

When an owner creates a batch of “Challenge my underwriting.” recipient links, the server now normalizes and hashes each provided recipient label, then deduplicates repeated labels within the same request before issuing tracked links. This avoids accidentally creating multiple unique-open-credit-eligible links for the same named recipient in one batch.

The reward logic remains unchanged: creating links still awards zero credits, and credits only flow after qualified actions such as issued-recipient unique opens, meaningful challenges, forks, signups, or saved versions within daily caps.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
No database migration required.

This uses the existing `recipient_label_hash` field from the prior `underwriting_share_recipients` migration and only deduplicates within the invite creation request.

## 6. Env vars needed
No new environment variables.

## 7. Replit commands to run
```bash
npm install
npm run type-check
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
npm run build
```

Optional broader verification:
```bash
npm test
```

## 8. Test/build result
Passed locally:

```bash
npm test -- underwriting-share-routes.test.ts
# PASS test/underwriting-share-routes.test.ts
# 27 tests passed

npm run type-check
# tsc --noEmit passed
```

No deploy was run.

## 9. Risks/blockers
- No deploy was run.
- No outbound messages/emails were sent.
- No paid APIs were called.
- This deduplicates labels only within the current invite batch; it does not block a later request from creating another link with the same recipient label hash.
- Blank/missing recipient labels are not deduplicated because there is no safe label hash to compare.

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull this branch to reduce accidental reward abuse in the viral underwriting loop. If Dan creates recipient-specific “Challenge my underwriting.” links and accidentally includes the same investor/realtor twice with different casing or whitespace, Realist now issues only one tracked link for that recipient in that batch, keeping Google Sheets export credits tied to real qualified recipient actions instead of duplicate invite creation.
