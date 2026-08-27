# Lean Realist.ca Platform Direction

## Product thesis

Realist should be the best place for a regular Canadian investor to answer one
question: **is this property worth pursuing?** The promise is institutional-grade
tools without institutional complexity.

The public product has four lanes:

1. **Deals** — browse DDF listings, see a pre-underwritten snapshot, and save or
   analyze a property.
2. **Multiplex** — test a Toronto lot, understand planning constraints, generate
   a concept, and see an acquisition/development/rental pro forma.
3. **Research** — turn podcast conversations and public data into useful charts,
   reports, and search-friendly market pages.
4. **Community** — discover events, RSVP with a Realist account, and get help
   from the team.

The podcast is the trust layer across all four lanes, not a fifth product silo.

## What changed in this slice

- Replaced the feature-directory homepage with a podcast-led front door and
  three product choices: find deals, test a multiplex, or use research.
- Reduced the primary navigation to Deals, Multiplex, Research, and Community.
- Added an inline player for the newest RSS episode and kept episode pages
  generated directly from the feed.
- Added deterministic related dashboards, reports, and tools to every episode
  page so new releases have useful on-site next steps without manual editing.
- Scheduled a timezone-aware RSS refresh for 5:10am Toronto on Tuesdays and
  Fridays, ten minutes after the normal release time. The refresh is deduped and
  keeps the last known-good feed if Omny is temporarily unavailable.
- Kept the existing DDF, rent intelligence, distress scoring, Toronto planning,
  multiplex envelope, concept image, CMHC, and pro-forma engines intact.
- Added clean public route aliases while retaining the legacy URLs behind them.

## Phase 2 progress

- Made `/deals` the canonical Canadian deal-discovery surface and removed the
  public US beta switch from that journey.
- Brought DDF listings, rent-derived underwriting, VTB/power-of-sale/motivated
  signals, saved searches, and listing details into one visible product flow.
- Connected listing and distress results to the offer funnel with a structured
  deal summary so price, rent, cap rate, cash flow, source, and signals survive
  the handoff to a future CRM or Konfidis integration.
- Added a prominent but qualified 50% cooperating-commission cash-back message
  for eligible represented buyers; final eligibility still requires written
  confirmation.
- Added crawler content, route metadata, and sitemap priority for `/deals` while
  preserving the existing detailed listing SEO pages.

This is the product-shell consolidation, not a claim that the underlying data is
production-ready. Before launch, Realist still needs live DDF credential testing,
rent-estimate source/confidence labels, saved-search delivery verification, a
listing-data health dashboard, and an agreed Konfidis webhook/API contract.

## Phase 3 progress

- Made `/multiplex` the canonical Toronto underwriter and kept the former tool
  URL as a query-preserving compatibility redirect.
- Connected Toronto DDF listings directly into the underwriter with MLS number,
  asking price, frontage, depth, and normalized lot area. The browser now makes
  the investor confirm that listing dimensions still need a survey check.
- Combined the stronger zoning/ward/tree/heritage/TRCA underwriter with the
  existing dimensioned site-plan and input-matched architectural concept engine,
  so the calculated massing controls whenever a generated image differs.
- Added explicit MTSA/PMTSA, station-distance, major-street, and corner-lot inputs.
  Confirmed boundaries and distance heuristics remain visibly different, and
  transit policy height never inflates the as-of-right envelope.
- Added a qualified CMHC small-rental screen for two-to-four-unit configurations
  while preserving MLI Select points, leverage, amortization, premium, and DSCR
  modelling at five or more units.
- Carries the multiplex underwriting ID, recommended units, takeout, maximum land
  price, rent, yield, cash flow, and planning signals into the buy/offer funnel.

The next calibration gate is data, not more interface: import and monitor the
Toronto zoning/tree/heritage layers in the production database, choose whether
to automate MTSA and major-street polygon resolution from City data, calibrate
cost/rent/condo assumptions with practitioners, verify the DDF lot-unit feed, and
test the concept-image budget and CRM/Konfidis destination end to end.

## Product consolidation map

| Public lane | Flagship surface | Supporting features that live inside it |
| --- | --- | --- |
| Deals | Canadian listing map | DDF search, rent estimate, yield, VTB/power-of-sale/motivated flags, watchlist, offer CTA |
| Multiplex | Toronto multiplex underwriter | lot geometry, zoning/planning flags, MTSA/major-street context, envelope, concepts, construction cost, CMHC financing, rental pro forma |
| Research | Insights hub + stats.realist.ca | podcast pages, market reports, StatCan/CMHC data stories, charts, city pages |
| Community | Meetups | events, account-backed RSVP, hosts, comments, experts, deal room |

Do not delete the legacy routes immediately. Stop linking to them, measure
traffic for 30–60 days, redirect any page without meaningful demand, then remove
dead code in batches. The existing analytics should provide the evidence.

## The flagship investor journeys

### 1. Find and underwrite a deal

Search Canada → open a listing → see price, estimated market rent, cap rate,
cash flow, financing assumptions, confidence, and distress/creative-finance
signals → adjust assumptions → save/share → request a second opinion or offer.

The underwriting card must always show source dates and confidence. CREA data,
rent observations, model outputs, and user assumptions should never look like
the same kind of fact.

### 2. Underwrite a Toronto multiplex

Choose a DDF listing or enter an address → confirm lot dimensions → overlay
major-street and MTSA context → estimate the feasible envelope/unit count →
show a clearly labelled concept massing/elevation → calculate acquisition,
hard/soft costs, contingency, rents, operating costs, and takeout → compare
CMHC standard below five units with MLI Select at five or more units → export or
request team review.

The 50% cash-back CTA belongs after the numbers, not before them. The offer
funnel should preserve the listing ID, assumptions, underwriting result, and
referring page for the future Konfidis handoff.

### 3. Find distressed and creative-finance opportunities

Use the same listings map with saved filters for power of sale, motivated seller,
and VTB signals. Snapshot each matching listing daily so the monthly report can
show inventory, price changes, days on market, relists, and removals over time.
This is a dataset inside Deals, not a separate family of pages.

## Podcast and research publishing

The Omny RSS feed remains the source of truth. Every feed item already receives
a stable `/insights/podcast/:slug` page, crawler-friendly metadata, show notes,
topic tags, related episodes, and now a small research/tool pack. The Tuesday and
Friday refresh makes those pages available shortly after release.

The general research workflow is now complete: an automation or administrator
can ingest a typed `ReportContent` draft with an idempotency key, review a signed
interactive preview, and explicitly publish it. Publication revalidates every
chart row, requires at least one HTTPS source, prevents collisions with committed
reports, records the attempt, and adds the report to `/insights`, structured
data, the no-JavaScript crawler rendering, and the report sitemap. Published
records are immutable; corrections ship as a reviewed replacement draft.

High-priority podcast episodes now have a second asynchronous layer:

1. check the public Omny clip record for a publisher transcript after each RSS refresh;
2. ingest that transcript privately, with a manual publisher-upload fallback;
3. generate a transcript-grounded summary, takeaways, and FAQ when Claude is configured;
4. require an administrator to review and explicitly publish the draft;
5. combine the reviewed brief with the existing deterministic chart/report/tool pack.

The raw transcript is never returned by a public endpoint. Episode briefs say
that they summarize the conversation and do not independently verify speaker
claims. Automated text never selects or invents a chart or statistic: the
episode page publishes immediately from RSS, and reviewed enrichment is added
later without changing its URL.

`/insights` is the only public research hub. The old `/reports` archive now
redirects there, while stable detail URLs under `/reports/:slug` remain intact.
New config and DB-published research use `/insights/reports/:slug` and the same
interactive renderer.

## Meetup integration boundary

Realist already has the most valuable part of the funnel: free-event RSVPs are
stored against a Realist account, so a site RSVP creates or attaches the person
to Realist. Keep Realist as the canonical account and event database.

Meetup changed its integrations to GraphQL in 2025. Phase 4 now uses Meetup's
OAuth server flow for the Realist Pro administrator account and the current
`https://api.meetup.com/gql-ext` endpoint. The administrator connects once from
`/admin/events`; access and single-use refresh tokens are encrypted before they
are stored. The network's upcoming events sync every six hours into the native
`realist_events` model.

The boundary is deliberate:

- Meetup is the distribution calendar and supplies event metadata plus an
  aggregate RSVP count.
- Realist owns the canonical event page, free RSVP, account creation, consent,
  reminders, discussion, and downstream investor journey.
- The sync does not import Meetup member profiles or email addresses.
- A Realist RSVP does not silently create a Meetup account or RSVP. Meetup
  requires that member to authorize its own identity, so both attendee lists
  are labelled separately.

The credentials previously shared in chat must be rotated before use. Register
`https://realist.ca/api/auth/meetup/callback` on the Meetup OAuth client and add
the rotated values only to the deployment secret store. The Pro network URL
name is `the-canadian-real-estate-investor`.

## Infrastructure recommendation

### Now: stabilize without a rewrite

- Keep the existing React/Express application together on the current always-on
  Replit deployment while the product is being narrowed.
- Keep Postgres as the system of record and confirm automated backups before
  changing hosting.
- Keep `stats.realist.ca` as the research/data publication surface and link it
  from the main Research hub.
- Use the current server cron for feed, DDF, rent, and report jobs. It is
  timezone-aware and appropriate for a continuously running process.

### After the core journeys are proven

- Put the public web frontend on Vercel if desired, but keep crawling, DDF sync,
  long-running enrichment, and scheduled data jobs on an always-on worker/API
  service. A serverless frontend should not own data ingestion.
- Give the API a stable private connection to managed Postgres and object storage
  for concept images/exports.
- Add a durable job queue with idempotency keys before increasing automation.
- Route `realist.ca` to web, `api.realist.ca` to the application API, and
  `stats.realist.ca` to research. Keep one analytics and account model across
  them.

Do not split the current application merely to say it is on Vercel. First make
the four user journeys measurable and reliable; then separate runtimes where
their operational needs differ.

## Required accounts, approvals, and likely spend

1. **CREA DDF:** brokerage/board permission, active DDF credentials, and an
   approved destination website/data feed. Confirm the Analytics Web Service
   requirement with the brokerage/CREA setup.
2. **Meetup:** active Meetup Pro plus approved API access. Rotate the exposed
   client secret before connecting anything.
3. **Hosting:** one production web plan, one always-on API/worker runtime, and a
   managed Postgres plan with backups. Existing Vercel and Replit accounts are
   enough for the first phase if the Replit deployment is truly always-on.
4. **Maps:** Mapbox token with billing alerts and URL restrictions.
5. **AI:** Anthropic usage for underwriting narratives, Ask Realist, and
   transcript-brief drafts; OpenAI usage for optional illustrative multiplex
   concept images. Enforce per-user budgets and fall back to deterministic
   underwriting when either provider is unavailable.
6. **Email/CRM:** verified sending domain, working transactional email, and GHL
   webhook credentials for the buy/finance/offer funnels.
7. **Konfidis:** webhook or API contract, lead consent language, referral/cash-
   back terms, and a test destination before enabling the offer CTA handoff.

## Delivery sequence

### Phase 1 — front door and trust

Ship the new homepage/navigation, current-episode player, episode resource packs,
and social sharing card. Measure homepage → listing map/analyzer/multiplex and
podcast-player engagement.

### Phase 2 — Deals as one product

Unify DDF search, pre-underwriting, distress flags, saved searches, and the offer
funnel. Add source/confidence labels and a listing data health dashboard.

### Phase 3 — best-in-class multiplex

Turn the existing underwriter into a guided address-to-pro-forma flow, verify
planning layers against Toronto sources, calibrate construction/rent assumptions,
and make concepts explicitly illustrative. Add export and team-review CTAs.

### Phase 4 — community and research compounding

Meetup Pro event ingestion, native RSVP/account conversion, calendar
consolidation, OAuth administration, encrypted token refresh, and scheduled
sync are implemented on the feature branch. Production activation still needs
the rotated OAuth secret and one administrator authorization.

### Phase 5 — sourced research publishing

The DB-backed research workflow now publishes reviewed StatCan/CMHC-style
reports into the canonical Research hub with charts, citations, structured data,
crawler tables, and sitemap discovery. The episode RSS pipeline already creates
pages and evidence packs after Tuesday/Friday releases.

### Phase 6 — longitudinal motivated-listing intelligence

Monthly DDF searches now retain one minimal observation per unique flagged
listing instead of discarding the underlying records after aggregation. The
dataset tracks newly flagged, persistent, no-longer-flagged, and repriced
cohorts, plus exclusive primary categories and overlapping triggered signals.
It deliberately does not retain full public remarks. Every capture records
query coverage and a methodology version; partial province runs are retried and
cannot publish a falsely national report.

The canonical `/insights/motivated-report` page exposes those cohort trends,
methodology limits, province/city history, the generated monthly article, and a
direct path into the live motivated-listings browser and underwriting funnel.
Generated monthly reports now compound into the Research hub and sitemap.

### Phase 7 — transcript-backed podcast briefs

The scheduled RSS job now checks recent Omny clip metadata for a public
publisher transcript. Available transcripts are stored privately and become
Claude-assisted editorial drafts, never unattended public copy. The existing
Research admin screen can also ingest a publisher transcript manually, review
the summary, takeaways, and FAQ, and explicitly publish the brief. Public
episode pages, crawler HTML, metadata, and FAQ structured data all use only the
reviewed record and keep a visible provenance/caveat label.

## Success metrics

- percent of listing views that reach a complete underwriting;
- percent of multiplex starts that reach a pro forma;
- saved/search-alert creation and return visits;
- offer, financing, and team-review requests with full underwriting context;
- podcast starts and episode-page organic landings;
- meetup RSVP → verified Realist account conversion;
- freshness, coverage, and confidence of DDF/rent/distress data.
