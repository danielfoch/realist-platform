# Agent Coordination Protocol

## Who's Who

- **Replit Agent** — runs in replit.com/@danielfoch/realist-platform. Handles features, UX, frontend, visual changes, anything browser-facing.
- **Clyde** — runs locally on Dan's Mac mini. Handles backend infra, data pipelines, automations, cron jobs, integrations.

## Core Rule
**Git is the tie-breaker.** Whoever edits a file last and pushes wins. The other pulls before their next session.

## Rules

1. **Pull before starting** — `git pull origin main` at the start of every session
2. **Push when done** — working code only, not TODOs or dead code
3. **Descriptive commits** — prefix with agent name: `replit:`, `clyde:`, `feat:`, `fix:`
4. **Don't touch the other agent's files** without checking first
5. **One agent per file per session** — coordinate via this file

## File Ownership

| Path | Owner | Notes |
|------|-------|-------|
| `frontend/src/**` | Replit Agent | All frontend/UI work |
| `src/routes/**`, `src/**/*.ts` | Clyde | Backend API routes |
| `server/**` | Clyde | Server logic |
| `db/**`, `*.sql` | Both | Coordinate on schema changes |
| `scripts/**` | Clyde | Automation scripts |
| `cron/` | Clyde | Scheduling |
| `dist/**` | Auto | Don't edit directly |

## Schema Changes
Both agents can modify `db/schema.ts` or migration files. When adding columns or tables:
- Document the change in this file under Current Schema
- The other agent should pull and adapt, not copy raw SQL

## Current Schema (as of 2026-04-11)

### Key Tables
- `users` — id (VARCHAR/UUID), email, password, name, role, created_at
- `analyses` — id, userId, sessionId, address, city, province, rentalIncome, purchasePrice, capRate, cashOnCash, monthlyCashFlow, status, createdAt
- `saved_deals` — id, userId, sessionId (localStorage bridge)
- `lead_submissions` — investor leads from landing pages
- `listing_comments` — public/private listing comments; question forum extension adds `thread_type`, `question_status`, `requested_expert_categories`, and `listing_snapshot` for listing-linked property Q&A
- `notification_preferences` — per-email-category preferences; question forum extension adds `expert_question_digest_enabled` and `expert_question_live_alerts_enabled`
- `email_triggers` — outbound Deal Desk trigger history; `dedupe_key` is nullable and globally unique when present. SLA breach nags use `email_trigger:sla_breach_nag:opportunity:<id>` so each opportunity can alert only once across sent history and autoscaled instances (migration `0016_email_trigger_entity_dedupe.sql`)
- `realtor_lead_notifications` — partner lead notifications; Phase 1 partner reactivation adds a `partner_type` discriminator (`realtor` | `mortgage_broker` | `lender`, default `realtor`) so financing-intent leads reuse this table instead of a parallel mortgage/lender table (migration `0015_partner_lead_routing.sql`)
- `realtor_market_claims` — partner market claims; `partner_type` covers `realtor`, `mortgage_broker`, and `lender` (lender claims are province/`National` level and match any deal in the claimed region)

### Key API Routes
- `POST /api/auth/signup` — investor signup
- `POST /api/auth/login` — investor login
- `POST /api/leads/submit` — investor lead submission (creates user + analysis)
- `POST /api/events/track` — event tracking (2026-04-11, Clyde)
- `GET /api/events`, `GET /api/events/summary` — event retrieval
- `GET /api/community/questions` — public outstanding listing questions
- `POST /api/community/questions` — authenticated listing question creation
- `POST /api/community/questions/:id/answers` — authenticated public answer creation
- `research_articles` — DB-backed unpublished research drafts using `ReportContent` JSON; ingest is idempotent via `source_id` + `ingest_idempotency_key`
- `research_publish_attempts` — idempotent admin publish-attempt ledger; Phase 2 records blocked attempts only, no public article publishing

### Pending/Recent Work
- `ef7766e` (Clyde) — /api/deals/join, user_sessions table for session→user linking
- `486c4e5` (Clyde) — event tracking infrastructure
- Replit Agent (in progress) — adapting session linking to Drizzle schema

## Live event Q&A (2026-09-09, Codex)
- Working from an isolated clone after pulling main and checking the idle, clean Replit checkout. Session files: `server/eventQa*.ts`, `shared/eventQa.ts`, `client/src/pages/EventQuestions.tsx`; integration in `server/index.ts`, `server/seoMeta.ts`, `shared/routeMeta.ts`, `client/src/App.tsx`, and the Toronto event page.
- `/ask` is the audience feed; `/ask/screen` is a public projector with approved questions only; `/ask/moderate` reuses the existing event admin allowlist.
- `event_qa_settings` stores the event slug, open/paused flag, and extra blocked words. `event_qa_questions` stores author ID privately, question, panel, review status, feature flag and moderation audit fields. `event_qa_votes` has a composite question/user primary key and +/-1 constraint. The advisory-locked boot migration in `server/eventQaStore.ts` is also awaited by requests.
- Authentication is required on the server for submissions and votes. All submissions require host approval. Public feeds never expose account identifiers or rejected/pending questions. Votes are absolute, idempotent PUT requests. Admins can pause, reject, answer, feature, and extend the rejection dictionary.
- Cherry-pick integration changes onto the current Replit branch to preserve other unpublished work.

## Agent platform: hosted MCP, /api/v1, hosted result views (2026-09-18, Claude)
- Built in an isolated worktree on `feat/agent-platform-hosted-views` from origin/main @ c0104ce. Architecture + operating notes: `docs/AGENT_PLATFORM.md`. User-facing docs: `/developers`.
- ONE tool registry (`server/agent/tools.ts`, 14 tools) served over three transports: legacy `/api/agent/*` (`server/agentApi.ts`, now thin wrappers — paths and response keys unchanged), `/api/v1` + OpenAPI (`server/agent/v1Routes.ts`, `openapi.ts`), and a hosted stateless MCP endpoint at `/mcp` and `/mcp/u/:key` (`server/agent/mcpServer.ts`, official SDK). Add or change tools in the registry only. `mcp-realist/` is now a stdio bridge that reads `/api/v1/tools` at runtime.
- New table `agent_result_views` (id, token unique, kind, title, document jsonb, user_id, api_key_id, analysis_id, tool, channel, view_count, last_viewed_at, created_at; indexes on (user_id, created_at) and (analysis_id)). Declared in `shared/schema.ts` AND created idempotently by `server/agent/viewStore.ts` — no `db:push` needed to deploy. Backs the public `/v/:token` pages (`client/src/pages/AgentResultView.tsx`, `client/src/components/agent-views/*`); the token is the only credential, pages are noindex.
- The buy & hold engine moved from `client/src/lib/calculations.ts` to `shared/buyHoldAnalysis.ts` (the client file re-exports it). Agent underwriting (`server/agent/underwriting.ts`) now runs that engine with web-analyzer defaults. BEHAVIOUR CHANGE: `expenseRatio` is ALL-IN — the old path added property tax + insurance on top of it and understated NOI, so numbers from `/api/agent/underwrite/*` and Ask Realist's `underwrite_property` are higher (correct) now.
- Integration points touched: `server/routes.ts` (registers v1 + MCP after the agent routes), `server/services/usage.ts` (function-level limiter/meter for MCP), `server/seoMeta.ts` + `shared/routeMeta.ts` + `server/sitemap.ts` (routes `/v/:token` noindex, `/developers`), `client/src/App.tsx`, `SiteFooter.tsx`, `AccountApiKeys.tsx`, `Premium.tsx`, `server/index.ts` (`reusePort` Linux-only so the server boots on macOS).
- New root deps: `@modelcontextprotocol/sdk`, `zod-to-json-schema` (both stay esbuild externals). New env (optional): `PUBLIC_BASE_URL`.

## How to Break Deadlocks

If both agents need the same file:
1. Agent A pulls and starts working
2. Agent B pulls after Agent A pushes
3. If conflict: check git log, adapt rather than overwrite

## Multiplex event intake (2026-09-08)
- Codex added `/build-with-us` and `POST /api/multiplex-applications`. Dedicated private `multiplex_applications` table stores id, name, email, payload JSON, status and created_at; initialized idempotently at boot.
- Admin-only `GET /api/admin/multiplex-applications` lists latest 1,000 applications. No marketing enrollment, outbound email, or partner routing.
- Session files: client/src/pages/BuildWithUs.tsx, App.tsx route registration, server/multiplexApplication*.ts, server/index.ts and the admin route in server/routes.ts.

## Keypr cashback integration (2026-09-14, Codex)
- Checked the idle, clean Replit checkout at dc8567a before edits. Session files: shared/keypr.ts, server/keypr*.ts, CashbackDisplay.tsx, DealPromotions.tsx, KeyprCashbackDetails.tsx; integration in server/routes.ts and server/index.ts.
- Realist.ca remains the primary brand. Keypr is disclosed as the Ontario cashback partner; only consented Ontario cashback requests are routed to its webhook, never mortgage, recruitment, or general inquiries.
- `keypr_lead_outbox`: private, durable delivery jobs keyed by `leads.id`, minimal payload, consent version/time, status, attempt count, due time, response code and optional partner reference. Initialized at boot; lead and job commit atomically. Server-only KEYPR_REALIST_SECRET; no secret in Git or client code.
