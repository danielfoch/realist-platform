# REPLIT_PULL_TODAY — Realist.ca Nightly GitHub Builder

## 1. Date
Tuesday, May 12, 2026 (America/Toronto)

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-12-share-recipient-coaching`
- Commit: `TBD after local commit`

## 3. What changed
Added recipient-side challenge coaching to the public underwriting share payload so a share recipient sees how to take a qualified action instead of just clicking the link.

Key behavior:
- New `getRecipientChallengeCoach(...)` helper turns saved underwriting assumptions into recipient instructions.
- Public `GET /api/underwriting-shares/:token` now returns `recipientChallengeCoach` alongside the existing challenge prompt pack, reward ladder, recipient tracking, and visitor qualification result.
- The coach keeps the CTA: “Challenge my underwriting.”
- It gives a primary assumption prompt, a 3-step recipient workflow, and example `challenge` / `saved_version` action payloads.
- It explicitly says raw share opens alone do not unlock premium credits; credits require qualified recipient actions within anti-abuse caps.
- Added test coverage for the coach payload and its qualified-action/anti-raw-click guardrails.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
None. No database migration required.

## 6. Env vars needed
None.

## 7. Replit commands to run
From repo root:

```bash
npm install
npm run type-check
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
```

Optional broader gate if time permits:

```bash
npm test
```

## 8. Test/build result
Passed locally:

```bash
npm run type-check
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
```

Result: backend TypeScript check passed; targeted underwriting share test suite passed, 18/18 tests.

## 9. Risks/blockers
- No migration or env-var risk.
- This is backend/API shaping only; frontend/Replit should render `recipientChallengeCoach` on the public underwriting share page to make the loop visible to recipients.
- The coach uses the first available prompt from saved inputs/metrics; frontend may want to let the recipient choose among all prompts from `challengePromptPack.prompts`.
- Existing ByteRover context-tree files were dirty before this run and remain uncommitted; they are not part of the product patch.

## 10. Plain-English what Dan should pull into Replit at 10am
Pull `realist-nightly/2026-05-12-share-recipient-coaching` so recipients of an underwriting share are coached to do the thing that actually grows the loop: challenge one assumption, save/fork a changed version, and share onward. The API now gives Replit ready-to-render recipient copy and example payloads while keeping premium credits tied to qualified actions — not raw clicks.
