## What was done

Plan step 1, schema:
- Added `ask_realist_interactions` and `find_deals_queries` to `shared/schema.ts`.
- Ask Realist table stores current question/answer/tool summaries/status/latency/context, with no history column.
- Find Deals table stores raw query, 16-char query hash, parsed filters, result count, source, user/session, and timestamps.

Plan step 2, schema deployment path:
- Kept the new tables in `shared/schema.ts`.
- Removed ad hoc SQL migration files after reconciling with `DEAL_DESK.md`; production Deal Desk schema changes deploy via `npm run db:push`.

Plan step 3, Ask Realist logging:
- Added `server/demandLedger.ts`.
- `server/askRealist.ts` now logs success/error/rate-limited rows best-effort.
- Tool inputs are summarized; raw Find Deals NL queries inside tool calls are hashed, not stored in `tool_calls`.
- Ask Realist `history` is not stored.

Plan steps 4-5, Find Deals logging:
- `/api/find-deals` logs web demand on cache hit and cache miss.
- `/api/agent/find-deals` passes `demandSource: "agent_api"` into the existing handler so MCP/agent demand logs once with the right source.

Plan step 6, priors ledger:
- `trainMarketDefaults()` now writes returned `ai_market_defaults` priors into `model_predictions` under imported constants `MARKET_DEFAULTS_MODEL_KEY` and `MARKET_DEFAULTS_VERSION`.
- Insert failures are caught and logged; training still completes.

Plan step 7, agent endpoints:
- Added bearer-authenticated endpoints:
  - `POST /api/agent/estimate-rent`
  - `POST /api/agent/underwrite-multiplex`
  - `POST /api/agent/deal-desk-submit`
- Refactored `server/multiplexUnderwriter.ts` to export `executeMultiplexUnderwriter()`.
- Refactored `server/routes/dealDesk.ts` to export `submitDealDesk()` and attribute agent submissions via existing `opportunities.source = "agent_api"` and `leadSource = "Deal Desk Agent API"`. No Deal Desk schema expansion.

Plan step 8, MCP:
- Added `estimate_rent`, `underwrite_multiplex`, and `submit_to_deal_desk` tools in `mcp-realist/src/index.ts`.
- Added client methods and CLI commands.
- Added `mcp-realist/package-lock.json` after installing subpackage deps so `npm run build` works reproducibly.
- Tool list now has 11 actual tools; a regex smoke reports 12 names because it also catches the server name `realist-mcp`.

Plan step 9, tests:
- Added `server/demandLedger.test.ts` covering hash normalization, safe tool-input summaries, Ask Realist ledger writes, and Find Deals query writes.
- Added `server/aiDefaults.test.ts` proving `ai_market_defaults` priors are written into `model_predictions` with the expected model key/version, subject ID, method, and rent-bedroom extraction.
- Added `server/agentApi.test.ts` covering missing bearer auth, happy-path rent estimate, multiplex underwriting delegation, Deal Desk `agent_api` attribution, and agent Find Deals forwarding exactly one `demandSource: "agent_api"` request.
- Existing `server/referralOutcomes.test.ts` still passes.

Plan step 10, commit/push:
- Committed `0a377ad feat: add demand ledger and agent revenue tools`.
- Pushed to existing PR branch `clyde/referral-outcome-ledger`.
- PR #138 remains open.

## Deviations

- Did not add a new Deal Desk attribution column; used existing `opportunities.source = "agent_api"` and lead source attribution so the ledger can ship without widening the schema.
- Did not publish `@realist/mcp`; only made it buildable/publish-ready.
- Did not apply `npm run db:push` to staging/prod; that remains a deploy smoke step.

## Verification results

- `npm run type-check`: passed.
- `npm run build`: passed. Existing encyclopedia/chunk-size/PostCSS/Browserslist warnings only.
- `npm test`: passed.
  - Jest IDX: 9 suites passed, 72 tests passed.
  - Vitest: 65 files passed, 737 tests passed.
- `cd mcp-realist && npm run build`: passed.
- Targeted tests: `npx vitest run server/aiDefaults.test.ts server/agentApi.test.ts server/demandLedger.test.ts server/referralOutcomes.test.ts`: passed, 22 tests passed.
- Schema rollout note:
  - The schema is defined in `shared/schema.ts`.
  - Per `DEAL_DESK.md`, staging/prod rollout should use `npm run db:push`, not `npm run migrate` or ad hoc SQL.
- `git diff --cached --check`: passed before commit.
- PR #138 description updated with Phase 2 scope, TTL/redaction follow-up, and Deal Desk attribution note.
- PR #138 CI after final push: pending at report time.

## Unresolved

- Need staging/prod deploy smoke after `npm run db:push`:
  - Push schema.
  - POST `/api/ask` and confirm `ask_realist_interactions` row.
  - POST `/api/find-deals` twice and confirm two query rows with same hash.
  - Run AI defaults training and confirm fresh `model_predictions` rows where `model_key='market_defaults'`.
  - Exercise new `/api/agent/*` endpoints with a real API key.
- Follow-up needed: TTL/redaction policy for raw NL text in `ask_realist_interactions` and `find_deals_queries`; current product decision stores raw current questions/queries indefinitely.

## Cost discipline

- Fable calls: plan + one clarification/ask.
- Middle 80% executed locally by Codex.
- No npm publish, no production DB push, no outbound comms.
