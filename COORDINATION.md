# Agent Coordination Protocol

## Who Does What
- **Replit Agent** → features, UX, frontend, visual changes, route wiring, schema integration, production deployment
- **Clyde (local/nightly)** → backend infrastructure, automations, cron jobs, data pipelines, event tracking

## Rules
1. **Pull before starting any session** — git is the tie-breaker; whoever pushes last wins, the other pulls before their next session
2. **Don't touch files the other agent owns** (see File Ownership below)
3. **Push working code, not TODOs** — every commit should be deployable
4. **Commit messages** — descriptive, agent-prefixed when possible
5. **One agent per file per session** — the other pulls after
6. **Schema changes require coordination** — if either agent needs a new column or table, note it clearly in commit messages so the other can adapt

## File Ownership

| Path | Owner | Notes |
|------|-------|-------|
| `client/src/**` | Replit Agent | All frontend components, pages, hooks |
| `server/routes.ts` | Replit Agent | API route wiring and request handling |
| `server/storage.ts` | Replit Agent | Storage interface and CRUD operations |
| `server/index.ts` | Replit Agent | Server startup, middleware, backfill logic |
| `server/resend.ts` | Replit Agent | Email templates |
| `server/webhookHandlers.ts` | Replit Agent | Stripe webhook handling |
| `shared/schema.ts` | **Both** | Coordinate on schema changes via commit messages |
| `server/weeklyDigest.ts` | Clyde | Automated digest |
| `scripts/**` | Clyde | Automation scripts |
| `cron/**` | Clyde | Scheduled jobs |
| `drizzle/**` | **Both** | Migration artifacts — don't manually edit |

## Schema Coordination
- Replit Agent uses Drizzle ORM schema (`shared/schema.ts`) + `db:push`
- Clyde may use raw SQL or different patterns (e.g., `INTEGER` user IDs, `analyzed_deals` table)
- **Do NOT merge Clyde's schema changes directly** — Replit Agent will adapt them to match the existing Drizzle schema (e.g., `varchar` UUIDs for user IDs, `analyses` table naming)
- When adding columns: use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` to be idempotent

## Known Differences
- Replit DB uses `varchar` UUIDs for user IDs; Clyde's code sometimes assumes `INTEGER` — always adapt
- Replit uses `analyses` table; Clyde may reference `analyzed_deals` — always use `analyses`
- Replit frontend generates `realist_session_id` in localStorage for anonymous tracking

## Sync Workflow
1. Dan coordinates which agent works on what
2. Each agent pulls latest before starting
3. Each agent pushes working code when done
4. If conflicts arise, git history + this protocol determines resolution
