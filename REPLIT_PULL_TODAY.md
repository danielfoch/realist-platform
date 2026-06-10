# REPLIT PULL TODAY

## 1. Date
Thursday, May 21, 2026

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-21-recipient-label-dedupe`
- Code commit SHA: `4857e3899e2b26b8a4a45daa209da7791959048a`
- Handoff file may be committed after the code commit, so final branch tip can be newer.

## 3. What changed
Added persistent deduping for recipient-specific “Challenge my underwriting.” share invites.

Owners already could dedupe repeated recipient labels inside one request. This patch also checks prior issued invite labels for the same share before creating more recipient links, and adds a database uniqueness guard on `(share_id, recipient_label_hash)` so repeated investor/realtor labels cannot quietly receive multiple unique-open-credit-eligible links across later requests or races.

Credit rules remain unchanged: creating links awards zero credits. Premium Google Sheets export credits still require qualified actions: issued-recipient unique open, meaningful challenge, fork, signup, or saved version within duplicate checks and daily caps.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `db/migrations/016_underwriting_share_recipient_label_dedupe.sql`
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
Run the new migration before/with app startup:

```bash
npm run migrate
```

New migration:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_underwriting_share_recipients_label_once
  ON underwriting_share_recipients(share_id, recipient_label_hash)
  WHERE recipient_label_hash IS NOT NULL;
```

If production already has duplicate `(share_id, recipient_label_hash)` rows, the migration will fail until duplicates are cleaned up. The app-level pre-check should prevent new duplicates once deployed.

## 6. Env vars needed
No new environment variables.

## 7. Replit commands to run
```bash
npm install
npm run migrate
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
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
# PASS test/underwriting-share-routes.test.ts
# 28 tests passed

npm run type-check
# tsc --noEmit passed

npm run build
# tsc passed
```

No deploy was run.

## 9. Risks/blockers
- No deploy was run.
- No outbound messages/emails were sent.
- No paid APIs were called.
- Migration risk: if existing data has duplicate non-null label hashes for the same share, the unique index creation will fail and duplicates must be cleaned first.
- Blank/missing recipient labels still cannot be deduped safely because there is no label hash to compare.
- Existing pre-cron untracked files remain in the repo working tree and were not included: `REPLIT_HANDOFF_CONTRACT.md`, `REPLIT_PULL_TEMPLATE.md`, `scripts/`.

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull this branch to close another reward-abuse gap in the viral underwriting loop. Realist now avoids issuing multiple tracked invite links for the same hashed recipient label on the same underwriting share, even across separate requests, so Google Sheets export credits stay tied to real qualified recipient actions instead of duplicate invite-link generation.
