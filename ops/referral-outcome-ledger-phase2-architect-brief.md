# Referral Outcome Ledger Phase 2 — Architect Brief

## Goal

Extend the open `clyde/referral-outcome-ledger` PR so Realist stops losing demand-side and model-output data, and so the agent/MCP surface has a revenue path. The user's pasted architecture verdict says the core data advantage is the assumption-to-outcome join: what an investor believed ex ante, joined to showing/offer/close/lost outcomes. PR #138 already added the first outcome ledger table and magic-link outcome flow.

## Current Branch / PR

- Repo: `/Users/clyde/.openclaw/workspace-lite/realist-platform`
- Branch: `clyde/referral-outcome-ledger`
- Base: `origin/main` at merge commit `b46828f`
- Current commit: `0636021 feat: add referral outcome ledger`
- PR #138 adds:
  - `referral_outcomes` table in `shared/schema.ts`
  - `server/referralOutcomes.ts`
  - public `GET/POST /api/referral-outcome/:token`
  - claim-lead flow returns `outcomeToken` and `outcomeUrl`
  - tests for outcome transitions and fee math

## User's New Requirements

1. Data advantage:
   - Preserve Ask Realist natural-language conversations. `server/askRealist.ts` currently imports no DB module and discards the highest-intent NL corpus.
   - Preserve Find Deals natural-language queries. The architecture note says these are currently only stored as a 16-char hash. In this repo, `/api/find-deals` currently returns `query` but does not appear to persist the raw query at all.
2. ML/AI roadmap:
   - `server/aiDefaults.ts` trains `ai_market_defaults` but does not write those priors to `model_predictions`, so "the AI learns from your usage" is not measured.
   - Existing rent estimator loop is already real: `server/rentIntelligence.ts` writes `model_predictions` and exposes `/api/intelligence/rent-estimate`, `/accuracy`, `/sweep`.
3. API/MCP:
   - `mcp-realist` already has 8 tools, package name `@realist/mcp`, main `dist/index.js`, `prepublishOnly`.
   - Add agent/MCP tools:
     - `estimate_rent` wrapping the rent estimator.
     - `underwrite_multiplex` wrapping `server/multiplexUnderwriter.ts` / `/api/multiplex-underwriter`.
     - `submit_to_deal_desk` wrapping `/api/deal-desk/submit`.
   - Do not actually publish npm in this PR. Make the package buildable/publish-ready.

## Relevant Existing Code

- `server/askRealist.ts`
  - `POST /api/ask { question, context?, history? }`
  - rate-limited by session/IP
  - tool loop over `underwrite_property`, `find_deals`, `get_mortgage_rates`, `get_market_report`
  - returns `{ answer, toolCalls }`
  - currently no durable storage.
- `server/routes.ts`
  - `/api/find-deals` around line 6678.
  - parses natural-language query into filters, hits DDF, scores listings, returns `query`, `filters_applied`, `listings`, `total`, and caches in-memory for 10 minutes.
- `server/aiDefaults.ts`
  - `trainMarketDefaults()` writes `ai_market_defaults` and `ai_training_runs`.
  - It can insert/update rows for metrics like `market_rent_all`, `cap_rate`, `purchase_price`, `monthly_cash_flow`.
- `server/rentIntelligence.ts`
  - exports `getRentEstimate(params)`.
  - writes to `modelPredictions` via private `recordPrediction()`.
  - model key constants: `MARKET_DEFAULTS_MODEL_KEY = "market_defaults"`, `MARKET_DEFAULTS_VERSION = "v1.0.0"`.
- `server/agentApi.ts`
  - `/api/agent/*` is bearer-authenticated with usage metering.
  - Already exposes underwrite listing/custom, find deals, analyses, community submit, mortgage rates, market report.
- `mcp-realist/src/client.ts` and `src/index.ts`
  - Thin client + MCP tools mirror `/api/agent/*`.

## Constraints / House Rules

- Simplest working solution wins.
- Extend existing backend/API/MCP patterns; do not build a marketplace, protocol, or frontend UI in this pass.
- Backend/server/schema is Clyde-owned; frontend is Replit-owned. Avoid `frontend/src/**` unless absolutely necessary.
- Preserve existing privacy posture:
  - For Ask Realist, store enough to learn demand and debug, but avoid leaking sensitive contact info or public exposure.
  - For API usage, the existing design stores input hashes, not raw request bodies. New query-ledger rows can store raw query only where the product explicitly needs a demand corpus.
- Do not send outbound comms, publish npm, or apply DB changes against production.
- Deal Desk production schema changes are deployed via `npm run db:push`, per `DEAL_DESK.md`; do not add or run ad hoc SQL migrations for this work.
- Tests/build required before PR update.

## Desired Done Bar

- Drizzle schema definitions persist Ask Realist interactions and Find Deals queries and are ready for `npm run db:push`.
- Ask Realist writes a best-effort row after each successful/failed request without breaking responses if logging fails.
- Find Deals writes/updates a best-effort demand row including raw query, parsed filters, result count, source, user/session if known, and query hash for dedupe/analytics.
- `aiDefaults.ts` records market-default priors into `model_predictions` or an equivalent measurable ledger row during training, without compromising training if ledger writes fail.
- Agent API + MCP add `estimate_rent`, `underwrite_multiplex`, and `submit_to_deal_desk`.
- Local targeted tests and TypeScript/build pass.
- Architect final review approves or flags only non-blocking caveats.
