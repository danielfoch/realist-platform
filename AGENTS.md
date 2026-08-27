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
- `research_articles` — DB-backed research using validated `ReportContent` JSON; ingest is idempotent via `source_id` + `ingest_idempotency_key`, and reviewed records publish at `/insights/reports/:slug`
- `research_publish_attempts` — idempotent admin publication ledger recording published, already-published, and blocked validation/collision outcomes
- `distress_snapshots` — monthly province/city aggregates plus DDF query coverage and methodology version
- `distress_listing_observations` — one minimal listing-level observation per capture month (`0018_distress_listing_observations.sql`); retains matched terms, signal categories, asking price, DOM, and location without retaining full remarks
- `podcast_episode_enrichments` — private publisher/manual transcript plus review state and public summary/FAQ draft (`0019_podcast_episode_enrichments.sql`); raw transcript text is never returned by a public route

### Research and distress APIs

- `GET /api/research/articles` and `GET /api/research/articles/:slug` — published, validated config-style research only
- `GET /api/distress-market-intelligence` — public monthly cohort summary (new, persistent, exited, repriced, primary and overlapping category counts); never returns full listing remarks
- `POST /api/admin/distress-report/generate` — admin capture/report rerun; refuses publication when any scheduled province capture fails
- `GET /api/admin/podcast-enrichments` — transcript-backed episode editorial queue; returns transcript length and draft content, not raw transcript text
- `POST /api/admin/podcast-enrichments/sync` — checks recent Omny clips for publisher transcripts and creates review drafts without auto-publishing
- `POST /api/admin/podcast-enrichments/ingest` — private manual/publisher transcript fallback; optional Claude draft generation
- `POST /api/admin/podcast-enrichments/:slug/publish` — explicit human-review publication gate for the public episode brief and FAQ

### Pending/Recent Work
- `ef7766e` (Clyde) — /api/deals/join, user_sessions table for session→user linking
- `486c4e5` (Clyde) — event tracking infrastructure
- Replit Agent (in progress) — adapting session linking to Drizzle schema

## How to Break Deadlocks

If both agents need the same file:
1. Agent A pulls and starts working
2. Agent B pulls after Agent A pushes
3. If conflict: check git log, adapt rather than overwrite
