# REPLIT_PULL_TODAY — Realist.ca Nightly GitHub Builder

## 1. Date
Monday, May 11, 2026 (America/Toronto)

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-11-qualified-share-assist`
- Implementation commit: `39156a32ebbd0fe6f1c4411bc8a842ee7d9815c7`
- Pull-brief commit: this file is committed after the implementation commit on the same branch.

## 3. What changed
Added a qualified-share assist playbook to the viral underwriting share status payload.

Key behavior:
- `getShareActionSummary(...)` now includes `qualifiedShareAssist` alongside the existing growth nudge, conversion insights, reward brief, invite funnel, and recent actions.
- The assist object converts live share metrics into a concrete next step: which qualified action is bottlenecked, who to target next, what “Challenge my underwriting” message to use, and what follow-up trigger matters.
- The copy keeps the core CTA: “Challenge my underwriting.”
- Reward framing remains tied to Google Sheets export credits and the next qualified action, not raw share clicks.
- Anti-abuse guidance is embedded in the status response: use recipient-specific links, never award for raw clicks/link creation, require meaningful changed assumptions for challenge/fork credits, and respect daily share/recipient caps.
- Added tests covering the new assist payload and verifying it appears in share summaries without exposing recipient identity.

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

Result: backend TypeScript check passed; targeted underwriting share test suite passed, 17/17 tests.

## 9. Risks/blockers
- No migration or env-var risk.
- This is backend/API shaping only; a frontend owner still needs to render `actionSummary.qualifiedShareAssist` in the share dashboard/status UI.
- The assist payload depends on existing `underwriting_share_actions` and `underwriting_share_recipients` data quality.
- Existing dirty workspace files from before this run were stashed as `pre-2026-05-11-nightly-context-dirty` before creating this branch; they were not included in this patch.

## 10. Plain-English what Dan should pull into Replit at 10am
Pull `realist-nightly/2026-05-11-qualified-share-assist` to make each underwriting share tell the owner what to do next: who to send it to, whether opens/challenges/saved versions/signups are the current bottleneck, and what “Challenge my underwriting” copy to use. It keeps premium-credit rewards focused on qualified actions and reinforces the anti-abuse rules so raw clicks never earn Google Sheets export credits.
