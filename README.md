# Realist — lean rebuild

Institutional-grade real estate tools for regular Canadian investors, from the
hosts of The Canadian Real Estate Investor podcast. This branch (`lean`) is the
from-scratch rebuild of realist.ca; the legacy app lives on `main`. First
deploy target: **new.realist.ca** on Vercel.

## What this is

Nine routes, three tools, one content model:

| Surface | What it does |
|---|---|
| `/` | Podcast-led home — Canada's #1 real estate podcast, live latest-episode player |
| `/listings` | CREA DDF listings across Canada, every one pre-underwritten (rent estimate → yield → cash flow) |
| `/multiplex` | **The crown jewel.** Toronto multiplex underwriter: address → zoning permissions (EHON fourplex + By-law 654-2025 sixplex wards, ward-verified), buildable envelope, unit configs, massing concepts, CMHC MLI Select proforma, dual-exit takeout recommendation, AI narrative with a number-leak validator |
| `/deals` | Power-of-sale / VTB / motivated-seller scanner over DDF remarks, with durable per-listing history + monthly report |
| `/podcast` | Auto-generated SEO episode pages from the Omny RSS feed (Tue/Fri cron adds AI briefings) |
| `/research` | Config-driven data reports (one TS file per report) + stats.realist.ca |
| `/encyclopedia` | 149 investing guides, statically rendered |
| `/community` | Meetup.com network events (26 cities), rendered natively |
| `/work-with-us` | The funnel: buy with our partner team, 50% of our commission back |

## Stack

Next.js (App Router, real SSR — that's the SEO strategy) · Tailwind v4 ·
Drizzle + Neon Postgres · Vitest (252 tests) · Vercel (crons in `vercel.json`) ·
GitHub Actions for the heavy nightly DDF/rents syncs.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in what you have; everything degrades gracefully
npm run dev
```

With zero env vars set you still get: full podcast vertical (live RSS), all
research reports, the encyclopedia, and a working multiplex underwriter on
coded default assumptions (geo screens report "layer not imported" honestly).
Add `DATABASE_URL` + `CREA_DDF_*` and the listings/deals/rent surfaces come
alive. `npm run db:push` creates the schema; `scripts/import-toronto-*.ts`
load the Toronto geo layers.

## Key directories

```
app/            routes (thin), API handlers, crons under app/api/cron/*
lib/            all logic, unit-tested: ddf/ rents/ underwriting/ distress/
                multiplex/ podcast/ community/ research/ seo/ db/
content/        encyclopedia JSON + one TS config per research report
components/     UI, grouped by domain
scripts/        sync entrypoints + Toronto geo importers + concept-image prompts
docs/           CONCEPT_IMAGE_GENERATION.md (the one outstanding asset task)
```

Conventions and the full IA contract: `AGENTS.md`. Report authoring:
`content/reports/REPORTS.md`.
