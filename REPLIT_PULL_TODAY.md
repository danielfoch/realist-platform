# REPLIT_PULL_TODAY — 2026-06-01

## 1. Date
2026-06-01

## 2. Branch and commit SHA
Branch: `realist-nightly/2026-06-01-qualified-action-defense`
Commit: `7072337` (code/handoff commit before this metadata-only SHA refresh)

## 3. What changed
Added defense-in-depth to the viral underwriting reward path: `recordQualifiedShareAction` now enforces the same qualified-action rules used by the HTTP route before it looks up duplicates, inserts share actions, or writes premium credit ledger entries.

This protects Google Sheets export credits if future internal callers try to record a `challenge`, `fork`, `saved_version`, or `signup` directly without meaningful changed-underwriting evidence or an authenticated signup user.

## 4. Files changed
- `src/underwriting-share-routes.ts`
- `test/underwriting-share-routes.test.ts`
- `REPLIT_PULL_TODAY.md`

## 5. Migration steps
None.

## 6. Env vars needed
None.

## 7. Replit commands to run
```bash
npm install
npm run type-check
npm test -- underwriting-share-routes.test.ts
```

## 8. Test/build result
- `npm test -- underwriting-share-routes.test.ts` — PASS (24 tests)
- `npm run type-check` — PASS

## 9. Risks/blockers
- No deploy was performed.
- Existing unrelated dirty workspace files were left unstaged: ByteRover index files plus prior handoff/template/script files.
- Behavior change: direct internal calls to `recordQualifiedShareAction` for challenge/fork/saved_version now need meaningful metadata; signup needs `authenticatedUserId`. `unique_open` remains allowed without metadata.

## 10. Plain-English “what Dan should pull into Replit at 10am”
Pull the branch `realist-nightly/2026-06-01-qualified-action-defense` to harden the “Challenge my underwriting” reward loop. It makes the credit-award function itself reject empty challenges and anonymous signup rewards before any credit mutation, so premium Google Sheets export credits remain tied to real qualified actions — not raw clicks or spoofed internal calls.
