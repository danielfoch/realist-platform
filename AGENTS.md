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

## Information architecture — five doors, one per job an investor comes here to do

The nav (`components/SiteNav.tsx` `DOORS`) is the map. A new page goes behind an existing
door; there is no sixth door.

| Door | Routes | What happens there |
|---|---|---|
| **Find deals** | `/listings` (+`/listings/[key]`), `/deals` (+`/deals/map`, `/deals/report/[month]`) | The ONE map/search: DDF listings across Canada, already underwritten. Every listing page IS an underwriter. Distressed: power-of-sale / VTB feed, map terminal, monthly report |
| **Underwrite** | `/underwrite`, `/multiplex` (+`/multiplex/r/[token]`) | Any rental in a minute (two steps: four facts, then the full underwriter); the Toronto multiplex underwriter — lot → feasibility + concepts + CMHC proforma |
| **Power team** | `/team`, `/work-with-us` | Introductions to the nine people around a deal (+ the professional lane); the offer funnel: desk review → one showing → offer with cash back |
| **Community** | `/community`, `/community/leaderboard`, `/u/[id]` | Meetups (Meetup.com, native look, RSVP captured here first); the leaderboard; public track-record profiles |
| **Learn** | `/podcast` (+`/podcast/[slug]`), `/research` (+`/research/[slug]`), `/encyclopedia` (+`/encyclopedia/[slug]`), `/about` | Episode hub + auto SEO pages; config-driven reports + stats.realist.ca; 149 guides |

Also: `/` (the ten-stage journey, `components/scrollcraft`, carries its own header/footer),
`/login` (+`/login/confirm`), `/account` (profile, track record, analyses, saved deals,
power-team checklist) — not indexed.

The loop the product exists to turn: **find → underwrite → (save · share · rank) → team/offer → meet**.
Every underwrite feeds the member's history, the leaderboard and the learned market defaults.

## Non-negotiable conventions

- **Palette: greyscale with red accents, light only.** The homepage's `--rl-*` tokens in
  `components/scrollcraft/scrollcraft.css` are the source of truth and `app/globals.css`
  mirrors them: paper `#f5f5f5`, ink `#242424`, `brand` `#be1730` for text and buttons
  (AA contrast), `accent` `#ff334b` for dots/rules/marks only. No other hues — semantic
  good/bad follow the ledger convention (in the black / in the red). `.band-night` is the
  one dark surface.

- **One cap-rate/cash-flow engine**: `lib/underwriting/investmentMetrics.ts`. Every
  surface (crawler, listings API, multiplex proforma, client) calls it. Never
  reimplement yield math inline.
- **CREA DDF compliance on every listing surface**: listing-brokerage attribution,
  MLS®/REALTOR® marks, "Powered by the REALTOR.ca DDF®" + last-updated stamp.
- **SEO**: every public page exports `generateMetadata` and renders JSON-LD via
  `lib/seo/jsonld.ts`. Sitemaps via `app/sitemap.ts`. Canonical base URL comes from
  `lib/brand.ts` `SITE_BASE_URL` (env `NEXT_PUBLIC_SITE_URL`, default realist.ca).
- **Secrets** only via env vars — never commit keys. See `.env.example`.
- **Accounts** (`lib/auth/*`): opaque session tokens, SHA-256 at rest, cookie
  `realist_session`; every mutating route checks `isSameOrigin`. An emailed link is only
  spent by the POST from `/login/confirm`, never by a GET (mail scanners pre-fetch).
  Marketing consent is an append-only ledger (`email_consent`) mirrored on the user —
  write it through `recordConsent`, never by updating the flag alone.
- **One underwriter**: `components/underwrite/Underwriter.tsx` over `lib/underwriting/underwriter.ts`
  (inputs, house defaults, edit detection, offer-price solver, verdict, quality) over the
  one engine. It runs in the browser on every keystroke; the server recomputes on save and
  never trusts a browser's results. Mortgage math is Canadian (semi-annual compounding);
  returns are on all cash in (down payment + closing costs).
- **The analysis log** (`deal_analyses`, `lib/analyses/*`): one row per person per deal.
  A page view is not an analysis — a row is written only after an edit or a verdict.
  `defaults` = what we offered, `inputs` = what they kept or changed, `edited` = the diff.
- **The flywheel** (`lib/analyses/learn.ts`, nightly `/api/cron/learn`): a field's learned
  value comes ONLY from analyses where the person changed that field (an untouched default
  is inertia, not evidence), needs ≥5 different MEMBERS who are ≥25% of those who worked a
  deal in that market, city → province → national. Anonymous sessions are free to mint, so
  they never count toward learned values, listing medians or the leaderboard.
  Two rules keep the loop honest AND stable: (1) someone who worked a deal and KEPT a value
  we offered because the market taught it (`learned_applied`) is confirming it — without
  that a good default starves itself of evidence and oscillates; (2) rent is learned as a
  ratio against our RAW estimate (`rent_estimate`), never the adjusted one, and only from
  listings whose offered rent was an estimate — a reported rent is a fact, not a guess. Never weaken these to "get more data".
- **Community numbers** (`lib/analyses/community.ts`): medians on a deal appear only once
  3+ people have underwritten it; the leaderboard ranks members by quality-weighted unique
  deals; names are "First L."; off-market addresses are never shown to other people.
- **The deal memo** (`lib/underwriting/dealMemo.ts`): rules-based, computed in the browser,
  every sentence derived from the engine. `lib/ai/dealMemoWriter.ts` may re-narrate it with
  Claude and is rejected if it states a number not in the payload.
- **Email to members** is a commercial electronic message (CASL): consented members only,
  a postal address, and an unsubscribe that works without signing in. Links are never acted
  on by a GET (scanners pre-fetch) — see `/login/confirm` and `/unsubscribe`. The weekly
  digest (`lib/digest/*`) is off unless `WEEKLY_DIGEST_ENABLED=1`.
- **The cash-back figure** lives in `lib/offer.ts` only (`NEXT_PUBLIC_CASHBACK_PERCENT`).
- **Leads** (`lib/leads/*`): every form is `components/leads/LeadForm.tsx` posting to
  `/api/leads`; the server calls `captureLead()` — never insert a lead or call the CRM
  from anywhere else. A lead is committed with one `lead_deliveries` row per destination
  (GoHighLevel, team email, Keypr) and retried until it lands. New kind of hand-raise =
  new entry in `LEAD_KINDS` + its tags in `lib/leads/crmPayload.ts`, not a new endpoint.
  GHL's upsert REPLACES tags, so tags only ever go through the additive tags endpoint.
  `/admin/leads` (role admin, or a VERIFIED address in `ADMIN_EMAILS`) shows what is
  connected, the outbox by destination, recent leads, and retries failures.
- **Legacy members** arrive via `scripts/migrate-users.ts` (rules + tests in
  `lib/migration/`). It is re-runnable until cutover and never overwrites what a member
  has changed here. Most legacy accounts have no password: the emailed link is their
  way in, so `RESEND_API_KEY` must be set before cutover.
- **Schema changes on live tables**: add uniqueness with `uniqueIndex(...)` in the table config,
  never `.unique()` on a column — `drizzle-kit push` answers a new column constraint on a table
  with rows by offering to TRUNCATE it.
- Pure logic lives in `lib/**` with tests; route handlers and pages stay thin.
- Ported files keep their original comment voice; do not add porting commentary.
