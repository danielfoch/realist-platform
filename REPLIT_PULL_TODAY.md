# REPLIT PULL TODAY — Realist.ca Nightly GitHub Builder

## 1. Date
Wednesday, May 27, 2026

## 2. Branch and commit SHA
- Branch: `realist-nightly/2026-05-27-credit-preview`
- Primary code change commit SHA: `d9a557958fecb50bce5d21d4dc7cf1c3a08f2750`
- Latest branch HEAD can be verified with: `git log -1 --format=%H`

## 3. What changed
Added a non-mutating credit eligibility preview for the viral underwriting loop.

- New helper: `previewQualifiedShareActionCredit(...)` checks the same qualification rules as the real action recorder before any reward is written.
- New API route: `POST /underwriting-shares/:token/actions/preview` for `challenge`, `fork`, `signup`, and `saved_version`.
- Preview responses tell the UI whether the pending recipient action is `eligible`, `blocked`, `duplicate`, or `capped`.
- The preview returns potential Google Sheets export credits, daily share/recipient cap remaining, the “Challenge my underwriting.” CTA, and clear anti-abuse guardrail copy.
- Blocked previews short-circuit before DB lookups when the action obviously cannot qualify, e.g. anonymous signup reward claims.
- Added Jest coverage proving previews do not insert `underwriting_share_actions` rows or premium-credit ledger entries.

This helps Replit/UI show recipients exactly what they need to do before submitting a challenge/fork/save/signup, without granting credits for raw clicks or speculative previews.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`
- `.brv/context-tree/growth/viral_sharing/credit_preview_system.md` (local project context for future nightly agents)

Existing untracked local files were left untouched and are not part of this patch:
- `REPLIT_HANDOFF_CONTRACT.md`
- `REPLIT_PULL_TEMPLATE.md`
- `scripts/`

## 5. Migration steps
No database migration required.

The preview route only reads existing tables:
- `underwriting_shares`
- `underwriting_share_actions`

It does not insert share actions or premium credit ledger rows.

## 6. Env vars needed
No new environment variables.

Existing auth/JWT configuration still applies:
- `JWT_SECRET`
- `JWT_EXPIRY` if used in Replit

## 7. Replit commands to run
```bash
git fetch origin
git checkout realist-nightly/2026-05-27-credit-preview
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
npm test -- --runTestsByPath test/underwriting-share-routes.test.ts
# PASS test/underwriting-share-routes.test.ts
# Tests: 20 passed, 20 total

npm run type-check
# tsc --noEmit passed
```

## 9. Risks/blockers
- No deploy performed.
- No outbound emails/messages sent.
- No paid API calls used.
- No migration required.
- Branch has a local commit; push should be done only if GitHub auth is configured and safe.
- Preview route is read-only from a rewards perspective, but it reveals cap/eligibility status for a share token. If the public UI exposes it, keep responses generic enough for recipients and do not display internal recipient hashes.

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull `realist-nightly/2026-05-27-credit-preview` to add a **“will this earn credits?”** check to the **“Challenge my underwriting.”** flow. Before someone submits a challenge, fork, save, or signup claim, Replit can now ask the backend whether it qualifies, whether it is capped/duplicate/blocked, and how many Google Sheets export credits are actually at stake — without awarding anything until the real qualified action is recorded.
