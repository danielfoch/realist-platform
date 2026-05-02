# REPLIT PULL TODAY — 2026-05-02

## 1. Date
Saturday, May 2, 2026

## 2. Branch and commit SHA
Branch: `realist-nightly/2026-05-02-share-recipient-invites`

Commit SHA: `8646e4c962fa8d205a8b7919e8d9cc19ff024846`

## 3. What changed
- Added recipient-specific underwriting share links for the viral loop.
- New owner-only endpoint can generate tracked `/underwriting/:token?recipient=...` links using the CTA: “Challenge my underwriting.”
- Link creation does **not** award credits. Credits still require qualified actions: unique open, challenge, fork, signup, or saved version.
- Added a privacy-safe `underwriting_share_recipients` table that stores opaque recipient hashes and optional label hashes, not raw names/emails.
- Share opens from recipient links update `last_opened_at`, and status summaries now include invited/unopened recipient counts.
- Added tests for recipient link creation and for status summary invite counts.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `db/migrations/015_underwriting_share_recipient_invites.sql`
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
Run the new migration before using recipient tracked links:

```bash
npm run migrate
```

This creates `underwriting_share_recipients` with indexes for per-share recipient tracking.

## 6. Env vars needed
No new environment variables.

## 7. Replit commands to run
```bash
git fetch origin
git checkout realist-nightly/2026-05-02-share-recipient-invites
npm install
npm run migrate
npm run build
npx jest test/underwriting-share-routes.test.ts --runInBand
```

If merging into the active Replit branch instead:

```bash
git fetch origin
git merge realist-nightly/2026-05-02-share-recipient-invites
npm run migrate
npm run build
npx jest test/underwriting-share-routes.test.ts --runInBand
```

## 8. Test/build result
Passed locally:

```bash
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
npm run type-check
npm run build
```

## 9. Risks/blockers
- No deploy was performed.
- No outbound emails/messages were sent.
- No paid API calls were made.
- Requires running migration `015_underwriting_share_recipient_invites.sql` before the enhanced status endpoint can read invite counts.
- The new endpoint returns opaque recipient keys once; the UI should copy/store/display generated links immediately if needed.
- Push status: branch pushed to `origin/realist-nightly/2026-05-02-share-recipient-invites`.

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull `realist-nightly/2026-05-02-share-recipient-invites` to make “Challenge my underwriting” links trackable per recipient without rewarding empty sharing. Replit can generate recipient-specific share URLs, see how many invited recipients have not opened yet, and still only award Google Sheets export credits after qualified opens/challenges/forks/signups/saved versions within caps.
