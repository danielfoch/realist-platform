# REPLIT_PULL_TODAY

## 1. Date
2026-06-02

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-06-02-share-playbook`
- Commit SHA: `e075b67e641993b4c6a7bcfbd8a19cbf5aaf50e4`

## 3. What changed
Added a qualified-action share playbook for the viral underwriting loop. Share status now turns funnel bottlenecks and recipient-source coaching into ranked next actions for the owner, including:

- Primary next qualified action for the current funnel phase.
- Stage-specific “Challenge my underwriting.” recipient prompt.
- Owner action copy tied to the bottleneck.
- Source recommendation when invite data exists.
- Credit amount and daily cap remaining for each action.
- `ready` / `capped` status so UI can avoid promising unavailable rewards.
- Explicit guardrail that raw share clicks alone never earn Google Sheets export credits.

The playbook is exposed at both:
- `actionSummary.sharePlaybook`
- `actionSummary.loopPlan.sharePlaybook`

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
None. This is a TypeScript/API payload helper change only. No database migration required.

## 6. Env vars needed
None new.

## 7. Replit commands to run
```bash
npm install
npm run type-check
npm test -- underwriting-share-routes.test.ts
```

Optional full gate if time allows:
```bash
npm run check
```

## 8. Test/build result
Passed locally:

```bash
npm test -- underwriting-share-routes.test.ts
# Test Suites: 1 passed, 1 total
# Tests: 25 passed, 25 total

npm run type-check
# tsc --noEmit
# TYPECHECK_EXIT=0
```

## 9. Risks/blockers
- No deploy was performed.
- No outbound messages/emails were sent.
- No paid API calls were made.
- Existing uncommitted repo artifacts from prior work were left unstaged unless directly related to this patch.
- ByteRover curate was attempted after implementation, but the `brv curate` process exited with SIGKILL; this did not affect repo code/tests.

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull `realist-nightly/2026-06-02-share-playbook` to give the Realist.ca share-status UI a concrete next-action playbook for the “Challenge my underwriting” loop. It tells users what qualified action to drive next, what copy to use, which recipient source is working, and whether the Google Sheets export credit reward is still available under daily caps — while keeping the rule clear that raw share clicks do not earn credits.
