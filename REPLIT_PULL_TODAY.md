# REPLIT PULL TODAY — Realist.ca Nightly GitHub Builder

## 1. Date
Friday, May 29, 2026

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-29-challenge-share-card`
- Primary code change commit SHA: `5c6fa0f1ce8993b08fe87af6ed2d67bfe718d795`
- Latest branch HEAD can be verified with: `git log -1 --format=%H`

## 3. What changed
Added a reusable **Challenge my underwriting share card** for the viral underwriting loop.

- New helper: `getChallengeShareCard(...)` builds one consistent share payload for UI cards, recipient links, and status panels.
- The card includes the share URL, CTA, recipient instruction, owner instruction, loop steps, next qualified action, Google Sheets export credit teaser, and anti-abuse copy.
- Recipient-specific invite links now include a `shareCard` with encoded recipient tracking in the URL.
- Share creation, share-open responses, recipient-link creation, and owner status responses now expose `shareCard` so Replit can render the same viral loop CTA across the product.
- Owner status chooses the card’s `nextQualifiedAction` from the live conversion bottleneck (`unique_open`, `challenge`, `saved_version`, `signup`, or `fork`).
- Added Jest coverage proving share cards do not promise raw-click credits and keep the qualified-action guardrail visible.

This makes the growth loop easier to wire in Replit: Analyze deal → Share underwriting → Recipient challenges/forks assumptions → Account/save version → Share onward.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`
- `.brv/context-tree/growth/viral_sharing/challenge_share_system.md` (local project context for future nightly agents)
- `.brv/context-tree/growth/viral_sharing/challenge_share_card_pattern.md` (local project context for future nightly agents)
- `.brv/context-tree/_index.md`
- `.brv/context-tree/_manifest.json`
- `.brv/context-tree/growth/_index.md`
- `.brv/context-tree/growth/viral_sharing/_index.md`

Existing untracked local files were left untouched and are not part of this patch:
- `REPLIT_HANDOFF_CONTRACT.md`
- `REPLIT_PULL_TEMPLATE.md`
- `scripts/`

## 5. Migration steps
No database migration required.

The patch only adds response payload fields and a pure helper. It does not add or alter tables.

## 6. Env vars needed
No new environment variables.

Existing auth/JWT configuration still applies:
- `JWT_SECRET`
- `JWT_EXPIRY` if used in Replit

## 7. Replit commands to run
```bash
git fetch origin
git checkout realist-nightly/2026-05-29-challenge-share-card
npm install
npm run type-check
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
```

If Replit prefers the build gate:
```bash
npm run build
```

## 8. Test/build result
Passed locally on Clyde’s Mac mini:

```bash
npm test -- test/underwriting-share-routes.test.ts --runInBand
# PASS test/underwriting-share-routes.test.ts
# Tests: 21 passed, 21 total

npm run type-check
# tsc --noEmit passed
```

## 9. Risks/blockers
- No deploy performed.
- No outbound emails/messages sent.
- No paid API calls used.
- No migration required.
- Existing untracked local handoff/template/scripts files were not included.
- `shareCard.rewardTeaser` only describes potential credits for a qualified action; UI should keep the included anti-abuse guardrail visible so users do not think raw clicks earn credits.

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull `realist-nightly/2026-05-29-challenge-share-card` to get a ready-made **“Challenge my underwriting.”** share card in the underwriting API responses. Replit can render it on share pages, invite flows, and status screens so every recipient sees the same loop: challenge/fork assumptions, save a version, and share onward for Google Sheets export credits — with guardrails that raw clicks do not earn rewards.
