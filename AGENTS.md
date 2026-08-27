<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Realist (lean rebuild)

Institutional-grade real-estate tools for regular Canadian investors. This is the
from-scratch lean rebuild of realist.ca (deploys first at new.realist.ca). The old
codebase lives on the `main` branch of this repo; this branch (`lean`) has fresh
history. Port selectively — never wholesale.

## Stack

- Next.js (App Router, RSC-first) + TypeScript + Tailwind v4. Real SSR is the SEO
  strategy — there is no crawler-fallback/meta-injection layer and there must never
  be one. Classic caching model (`cacheComponents` off): ISR via `revalidate`.
- Postgres (Neon) via drizzle-orm (`lib/db/schema.ts` is the only schema).
- Vitest for unit tests, colocated `*.test.ts`. `npm test` = `vitest run`.
- Deployed on Vercel. Scheduled work = Vercel Cron hitting `/api/cron/*` route
  handlers guarded by `CRON_SECRET`. Long-running syncs (DDF crawl) run via
  `scripts/*.ts` on GitHub Actions cron.

## Information architecture (the whole site — keep it this small)

| Route | Purpose |
|---|---|
| `/` | Podcast-led home: Canada's #1 real estate podcast, latest episode player, tools, event CTA |
| `/listings` (+`/listings/[key]`) | The ONE map/search: DDF listings across Canada, pre-underwritten (cap rate, cash flow) |
| `/multiplex` (+`/multiplex/r/[token]`) | Toronto multiplex underwriter — crown jewel. Lot → feasibility + concepts + CMHC proforma |
| `/deals` (+`/deals/report/[month]`) | Distressed: power-of-sale / VTB search, deal feed, monthly report |
| `/podcast` (+`/podcast/[slug]`) | Episode hub + auto-generated SEO episode pages |
| `/community` | Meetup.com events, integrated look, cross-signup |
| `/research` (+`/research/[slug]`) | Config-driven reports + links to stats.realist.ca |
| `/encyclopedia` (+`/encyclopedia/[slug]`) | 149 investing guides (ported content) |
| `/about`, `/work-with-us` | Team, podcast credibility, Konfidis offer funnel (50% cash-back CTA) |

Do not add new top-level routes without collapsing something else. One map tool, one
underwriting engine, one content model.

## Non-negotiable conventions

- **One cap-rate/cash-flow engine**: `lib/underwriting/investmentMetrics.ts`. Every
  surface (crawler, listings API, multiplex proforma, client) calls it. Never
  reimplement yield math inline.
- **CREA DDF compliance on every listing surface**: listing-brokerage attribution,
  MLS®/REALTOR® marks, "Powered by the REALTOR.ca DDF®" + last-updated stamp.
- **SEO**: every public page exports `generateMetadata` and renders JSON-LD via
  `lib/seo/jsonld.ts`. Sitemaps via `app/sitemap.ts`. Canonical base URL comes from
  `lib/brand.ts` `SITE_BASE_URL` (env `NEXT_PUBLIC_SITE_URL`, default realist.ca).
- **Secrets** only via env vars — never commit keys. See `.env.example`.
- Pure logic lives in `lib/**` with tests; route handlers and pages stay thin.
- Ported files keep their original comment voice; do not add porting commentary.
