# REPLIT PULL TODAY

## 1. Date
2026-06-07

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-06-07-share-reward-attribution`
- Commit SHA: `0aae9e5a8069f762fe2302415086d3dff6802043`

## 3. What changed
Added a qualified reward attribution payload for the viral underwriting loop. Share status responses now include `rewardAttribution`, which explains where Google Sheets export credits were actually earned, which qualified action should be pursued next, the best recipient source to target, remaining daily caps, and explicit anti-abuse copy.

This supports the loop: Analyze deal -> Share underwriting -> Recipient challenges/forks assumptions -> Account/save version -> Share onward, using the CTA “Challenge my underwriting.”

## 4. Files changed
- `src/underwriting-share-routes.ts`
  - Added `getQualifiedShareRewardAttribution()`.
  - Added reward attribution data to `getShareActionSummary()` / share status payload.
  - Preserved the rule that raw share clicks alone never earn credits.
- `test/underwriting-share-routes.test.ts`
  - Added direct unit coverage for qualified-only reward attribution.
  - Extended share summary coverage to verify `rewardAttribution` is returned and does not expose recipient hashes.
- `REPLIT_PULL_TODAY.md`
  - Updated this handoff.

## 5. Migration steps
None. No database schema changes.

## 6. Env vars needed
None new.

## 7. Replit commands to run
```bash
npm install
npm run type-check
npm test -- underwriting-share-routes.test.ts --runInBand
# optional full gate if time allows:
npm run check
```

## 8. Test/build result
Passed locally:
```bash
npm test -- underwriting-share-routes.test.ts --runInBand
npm run type-check
```

## 9. Risks/blockers
- No deploy performed.
- No outbound messages sent.
- No paid API calls made.
- Full `npm run check` was not run; targeted Jest coverage and TypeScript type-check passed.

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull `realist-nightly/2026-06-07-share-reward-attribution` to add a clearer reward-attribution layer to underwriting share status. It tells users which qualified recipient actions earned Google Sheets export credits, what to ask for next, and reinforces that raw clicks do not qualify for credits.
