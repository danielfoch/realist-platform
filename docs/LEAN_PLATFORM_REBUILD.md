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

The next research iteration should enrich high-priority episodes asynchronously:

1. transcribe or ingest the publisher transcript;
2. extract claims and cited datasets;
3. attach an existing chart/report or queue a human-reviewed chart brief;
4. generate a Canadian-investor summary and FAQ with source links;
5. update the podcast sitemap and internal links.

Automated text should never invent a chart or statistic. Publish the episode page
immediately, then add sourced enrichment when it is ready.

## Meetup integration boundary

Realist already has the most valuable part of the funnel: free-event RSVPs are
stored against a Realist account, so a site RSVP creates or attaches the person
to Realist. Keep Realist as the canonical account and event database.

Meetup changed its integrations to GraphQL in 2025. The production integration
should use:

- **JWT/server-to-server** for syncing Realist-owned events to and from the
  Realist Meetup Pro network; and
- **OAuth only as an optional account connection** when a member explicitly
  wants to connect their own Meetup identity.

Do not silently create or join a Meetup account for a Realist user. It requires
user authorization and creates privacy/consent issues. A practical first launch
is one-way event publication plus inbound RSVP reconciliation using the native
Realist account as the identity spine.

The credentials previously shared in chat must be rotated before use. Production
still needs the Meetup Pro network URL name, the OAuth callback registered as
`https://realist.ca/api/auth/meetup/callback`, and—if using JWT—the owner member
ID, signing key ID, and RSA private key. Secrets belong in the deployment secret
store only.

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
5. **AI:** Anthropic usage for multiplex narratives/concepts; enforce per-user
   budgets and fall back to deterministic underwriting when unavailable.
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

Connect the approved Meetup Pro integration, publish sourced episode enrichment,
and produce the monthly distressed-market dataset/report from accumulated
listing snapshots.

## Success metrics

- percent of listing views that reach a complete underwriting;
- percent of multiplex starts that reach a pro forma;
- saved/search-alert creation and return visits;
- offer, financing, and team-review requests with full underwriting context;
- podcast starts and episode-page organic landings;
- meetup RSVP → verified Realist account conversion;
- freshness, coverage, and confidence of DDF/rent/distress data.
