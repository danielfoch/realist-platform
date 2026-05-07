# REPLIT_PULL_TODAY

## 1. Date
2026-05-07 (America/Toronto nightly builder)

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-07-recipient-key-guardrail`
- Implementation commit SHA: `6adc5831cf62b27e60cc8c5fcdcc5f6f9ca6185f`
- Note: this pull brief may be committed as a follow-up docs commit, so use `git log --oneline -2` after pulling to see both the implementation and handoff commits.

## 3. What changed
Added an anti-abuse guardrail to the viral underwriting share loop: explicit `recipient` keys are now trusted only if they were actually issued for that share in `underwriting_share_recipients`.

Before this patch, someone could append arbitrary `?recipient=random` values and create many unique recipient hashes. Now forged or unknown recipient keys fall back to normal IP/User-Agent visitor fingerprinting, so they cannot bypass recipient-level duplicate/cap tracking.

The share flow still supports the intended loop:
Analyze deal → Share underwriting → Recipient opens tracked link → “Challenge my underwriting” → Recipient challenges/forks/saves → Qualified credits/status tracking.

## 4. Files changed
- `src/underwriting-share-routes.ts`
  - Added `resolveShareRecipientHash()`.
  - GET `/api/underwriting-shares/:token` verifies recipient keys before recording unique opens.
  - POST `/api/underwriting-shares/:token/actions` verifies recipient keys before recording challenges/forks/signups/saved versions.
  - Action metadata now records whether tracking came from an issued recipient link or visitor fingerprint.
- `test/underwriting-share-routes.test.ts`
  - Added coverage proving issued keys are accepted and forged keys fall back to visitor fingerprint tracking.
- `REPLIT_PULL_TODAY.md`
  - This pull brief.

## 5. Migration steps
No new migration required.

This uses the existing `underwriting_share_recipients` table from migration `015_underwriting_share_recipient_invites.sql`.

## 6. Env vars needed
No new environment variables.

## 7. Replit commands to run
```bash
npm install
npm run type-check
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
npm run build
```

## 8. Test/build result
Local gates run on Clyde’s Mac mini:

```bash
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
# PASS: 13 tests

npm run type-check
# PASS: tsc --noEmit
```

## 9. Risks/blockers
- No deploy was run.
- No outbound email/message was sent.
- No paid API calls were made.
- Existing working-tree files under `.brv/`, `.learnings/`, and `BUILD_NOTES.md` were already dirty/untracked and were intentionally not included in this branch commit.
- This adds one small lookup against `underwriting_share_recipients` when a request includes an explicit recipient key. Normal untracked visitor opens/actions do not get that lookup beyond the empty-recipient fast path.

## 10. Plain-English: what Dan should pull into Replit at 10am
Pull `realist-nightly/2026-05-07-recipient-key-guardrail` to tighten the viral underwriting rewards loop. It prevents forged recipient parameters from creating fake “unique recipients,” while preserving the intended tracked-link flow and Google Sheets export credit rewards for real qualified actions.
