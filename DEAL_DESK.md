# Realist Event + Deal Desk Loop v1

Turns underwriting activity into scored, routed transaction intent. Realist is
the source of truth: users, deals, opportunities, events, scores, assignments,
status history, consent, and email triggers all live here. External CRMs (GHL
etc.) are execution systems fed by the webhook/exports — state changes only
count when written back through this API.

> **PRODUCTION NOTE:** the live realist.ca app's Deal Desk lives in
> `server/dealDesk.ts` + `shared/dealDeskScoring.ts` + `client/` pages, with
> schema in `shared/schema.ts` deployed via **`npm run db:push`** — NEVER
> `npm run migrate` (the production DB is Drizzle-managed; migrate.ts will
> refuse to run there). The sections below describe the original idx-app
> implementation (`src/` + `frontend/`), kept as the reference spec. Scoring
> weights, bands, statuses, SLA behavior, and email-trigger semantics are
> identical in both.

## Setup (idx app only — for production see the note above)

1. Run migrations: `npm run migrate` (applies `db/migrations/013_deal_desk_loop.sql`)
2. Replit Secrets / env vars:
   - `DEAL_DESK_API_KEY` — admin API + dashboard key (falls back to `CONTENT_API_KEY`/`RENT_API_KEY`)
   - `DEAL_DESK_DEFAULT_ASSIGNEE` — default `dan`
   - `REALIST_WEBHOOK_URL` — optional; every ActivityEvent POSTs here (Clyde/automations)
   - `REALIST_WEBHOOK_SECRET` — optional; HMAC-SHA256 signature in `X-Realist-Signature: sha256=<hex>`
3. Cron (every 15 min): `curl -X POST -H "x-api-key: $DEAL_DESK_API_KEY" https://realist.ca/api/deal-desk/sweep`
   — generates SLA-breach nags and behavioural email triggers (idempotent).

## Surfaces

- `/deal-desk` — public submission form (pre-fillable: `?address=&market=&price=&rent=&analysisId=&src=`)
- `/admin/deal-desk` — internal dashboard (enter the API key once; stored in localStorage)

## API

- `POST /api/deal-desk/submit` — public. Creates/updates User, Deal, Opportunity,
  consent record, `deal_submitted` event, intent + deal scores, and the
  `hot_lead_immediate_followup` trigger for hot leads with consent.
- `GET /api/deal-desk/dashboard` — summary counts, lost-by-reason, recent events.
- `GET /api/deal-desk/opportunities?band=hot|warm|nurture&status=&assigned_to=`
- `PATCH /api/deal-desk/opportunities/:id/status` — `{status, lostReason, changedBy}`;
  writes StatusHistory + `crm_status_updated` (+ `lost_reason_added`/`closed`) events.
  `lostReason` is mandatory for `lost`.
- `POST /api/deal-desk/opportunities/:id/assign` — `{assignedTo, assignedBy}`
- `POST /api/deal-desk/sweep` — SLA + behavioural trigger sweep (cron).
- `GET /api/deal-desk/export/:entity?format=csv|json` — entity: users, deals,
  opportunities, events, triggers. For Clyde/automation consumption.
- `POST /api/events/track` — now accepts `deal_id` and the full Deal Desk event
  vocabulary (see `EventName` in `src/event-tracking.ts`).

## Scoring

- **Intent** (`src/scoring.ts`): weighted events with 10%/week decay
  (deal_submitted +40, deal_desk_cta_clicked +20, return_threshold_hit +20,
  report_exported/deal_saved +15, assumption_edited +5 capped at 20/deal, …)
  plus non-decaying profile bonuses (phone +10, financing/buying help +15).
  Bands: 80+ hot (call in 5 min), 50–79 warm (24 h), 20–49 nurture, <20 audience.
  Recomputed automatically on every scoring-relevant event insert.
- **Deal** (`src/scoring.ts`): starts at 50; cash flow, DSCR vs 1.2, cap vs city
  median, asking vs max offer, rent provenance, market liquidity. Verdicts:
  75+ submit, 50–74 negotiate, 25–49 watch, <25 pass.
- **Underwriting engine** (`src/underwriting.ts`): deterministic — DSCR, cash
  required, break-even rent, max offer price (highest price with DSCR ≥ 1.2 and
  CF ≥ 0), sensitivity grid. The LLM layer narrates these numbers; it never
  computes them.

## Email triggers (`email_triggers` table)

Pending rows are deduped per (user, type). Consumer (Resend worker / Clyde)
marks them `sent`/`skipped`. Types emitted today: `hot_lead_immediate_followup`,
`sla_breach_nag`, `saved_deal_no_submit`, `abandoned_underwriting`,
`financing_interest`, `lost_reason_nurture`. Consent lives in `email_consent`
(append-only ledger, latest row per user/channel wins) — check it before sending.
