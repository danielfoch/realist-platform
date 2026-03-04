# Realist.ca - Real Estate Deal Analyzer

## Overview
Realist.ca is a production-grade web application for real estate investors. It enables underwriting deals, comparing investment strategies (Buy & Hold, BRRR, Flip, Airbnb, Multiplex), and exporting investor-ready analysis sheets. The platform provides institutional-grade financial calculations including cap rates, IRR, cash-on-cash returns, and multi-year projections for Canadian and US real estate markets. Key features include a map-first homepage, a sophisticated deal analyzer supporting various strategies, community underwriting on the Cap Rates Explorer, MLS# import via CREA DDF, and an admin dashboard for lead management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript (Vite for bundling)
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **UI Components**: shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS with a custom modern fintech design system
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts
- **Theme**: Dark/light mode support

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful JSON APIs (`/api` prefix)
- **Build**: esbuild

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema**: Defined in `shared/schema.ts`
- **Migrations**: Drizzle Kit

### Key Design Patterns
- **Shared Types**: Client and server share schema definitions.
- **Storage Abstraction**: `IStorage` interface for database operations.
- **Path Aliases**: `@/` for client source, `@shared/` for shared code.

### Navigation Structure
The application features a category-based dropdown navigation:
- **Tools**: Deal Analyzer, BuyBox, Co-Invest, Calculators.
- **Community**: Events, Network, Online Community.
- **Insights**: Market Report, Podcast, Blog, Guides.
- **About**: Company information, Team, Programs, Shop, Contact.

### Core Features and Pages
- **Map-First Homepage**: `/` renders `MapHomepage.tsx` with a Leaflet cap rate map as subdued background, glass overlay with CTAs, stats strip, "As seen on" logos, embedded deal analyzer (via `<Home embedded />`), community underwriting explainer, and live leaderboard preview (fetches from `/api/leaderboard` and `/api/leaderboard/contributions`). Controlled by `VITE_HOME_VARIANT` env var ("map" default, "deal" for original). Original deal analyzer homepage at `/deal-analyzer` and `/tools/analyzer`.
- **Deal Analyzer**: Main product with calculator and analysis tools. Supports MLS# import via DDF (`GET /api/ddf/mls/:mlsNumber`) and URL/HTML paste import.
- **Cap Rates Explorer**: Realtor.ca-style map-driven search powered by CREA DDF. Default filters: minimum 4% cap rate, minimum 2 units, excludes parking/locker/storage and business sales/commercial. Features community underwriting with tabbed detail panel (Overview | Underwrite | Community), community cap rate badges on listing cards, batch aggregates, voting, and comments.
- **BuyBox**: Mandate builder with Google Maps integration and e-signature for buyer representation agreements.
- **Co-Investing Platform**: Tools for finding partners, pooling capital, group creation wizard, complexity assessment, and in-group chat. Includes BRA (Buyer Representation Agreement) gating for Ontario users.
- **Calculators Hub**: Includes various tools like "True Cost of Homeownership", "Will It Plex?", and "Fixed vs Variable".
- **Fixed vs Variable Calculator**: Compare total interest costs for fixed vs variable mortgages over 5, 10, and 25 years. Features: rate auto-fill from DB, rising/falling direction toggle, severity slider (0-300 bps), front/back/even loading speed, loan amount override, expandable yearly amortization tables per scenario (Fixed, Base, Best, Worst). Core engine: `client/src/lib/mortgage/amortization.ts` (with 15 unit tests). Route: `/tools/fixed-vs-variable`. API: `GET /api/rates/mortgage?termYears=N&type=fixed|variable`, `GET /api/rate-forecast/latest`. DB table: `rate_forecasts`. Integrated on ToolsHub, CalculatorSelector (replaced RenoQuote), and MortgageRates promo card.
- **Mortgage Rates Page**: Live Canadian mortgage rates at `/insights/mortgage-rates`. Three tabs: Best Rates (broker), Big Banks (posted), Policy Rates (BoC). Rate scraper: `server/rateScraper.ts` fetches from Bank of Canada Valet API, wowa.ca HTML, and hardcoded big-bank averages. Tables: `mortgage_rates`, `mortgage_rate_history`. Weekly refresh cron (every 6h, skips if <7 days old). Admin scrape: `POST /api/admin/mortgage-rates/scrape`.
- **Listing Import**: Supports property detail import from realtor.ca and zillow.com via URL, HTML paste, or MLS# (via DDF).
- **Rent Pulse API**: Integrates scraped rent data for market insights. Cascading rent estimation: 1) Rent Pulse scraped data (by city+bedrooms), 2) CMHC city-level benchmarks (`shared/cmhcRents.ts` — 150+ Canadian cities), 3) CMHC provincial/state averages (all 13 provinces/territories), 4) Country-level defaults. Source is labeled in the Cap Rates Explorer detail panel.
- **Stress Test Analysis**: Provides Base/Bear/Bull scenarios for financial projections within the Deal Analyzer.
- **MLI Select Calculator**: Standalone CMHC MLI Select points calculator with underwriting and stress testing.
- **Blog**: Database-backed blog at `/insights/blog` with individual post pages at `/insights/blog/:slug`. Dual-section layout: primary DB posts (with category filters, SEO) and secondary Substack RSS feed. Admin CRUD via `/api/blog/posts` endpoints. Categories: Market Analysis, Strategy, Deal Breakdown, News. Tables: `blog_posts`. Individual posts render full HTML content with dynamic SEO meta tags.
- **Guides**: Database-backed guides at `/insights/guides` with individual guide pages at `/insights/guides/:slug`. Features difficulty badges (Beginner/Intermediate/Advanced), auto-generated table of contents from headings, and prev/next navigation. Static "Tool Guides" section preserved. Admin CRUD via `/api/guides` endpoints. Categories: Getting Started, Strategy, Analysis, Advanced. Tables: `guides`.
- **Admin Dashboard**: Protected area for lead, webhook, blog post, and guide management. Blog and Guides tabs support full CRUD with editor dialogs, publish/draft toggles, and auto-generated slugs.
- **Authentication**: Custom email/password system with PostgreSQL-backed sessions, bcrypt hashing, and secure token management for resets/account setup. All lead capture forms auto-create user accounts with 7-day password setup tokens and send welcome emails via Resend. Admin backfill endpoint: `POST /api/admin/backfill-lead-accounts`.
- **Leaderboard & Analytics**: Dual-tab leaderboard with "Deal Analysis" and "Community Contributions" tabs, monthly/all-time toggle, user role badges. Route: `/leaderboard`. API: `/api/leaderboard`, `/api/leaderboard/contributions`, `/api/leaderboard/top-cities`.
- **Realtor Partner Network**: Realtors can claim a market, sign a 25% referral agreement (with e-signature canvas), receive lead notifications when deals are analyzed in their market, and claim leads via a formal logged introduction email. Route: `/partner/network`. Tables: `realtor_market_claims`, `realtor_lead_notifications`, `realtor_introductions`. API prefix: `/api/realtor-network/`.
- **Monthly Market Report**: Auto-generated monthly report covering 34 major Canadian cities. Three-tab layout: Overview (CMHC rents), DDF Yields (gross/net yield charts + pricing + market depth table), Compare Cities (interactive multi-city yield trend line chart — add/remove up to 10 cities). Shows CMHC rent benchmarks, DDF-derived yield data, DSCR, cash-on-cash, and purchase price averages. Province filtering, auto-generated written commentary. Route: `/insights/market-report`. Tables: `market_snapshots`, `ddf_listing_snapshots`, `city_yield_history`. API: `GET /api/market-report/latest|history|all`, `POST /api/market-report/compute-snapshot` (admin), `GET /api/yield-history`, `POST /api/yield-history/compare`, `POST /api/ddf-crawl/trigger` (admin), `GET /api/ddf-crawl/status` (admin). Hourly cron auto-generates both market snapshots and DDF yield crawls on the 1st of each month. DDF crawler (`server/ddfYieldCrawler.ts`) crawls all 34 cities via DDF API, calculates yields using CMHC rents + standardized expense assumptions (5% vacancy, 8% management, 5% maintenance, 0.3% insurance), stores individual listing snapshots + aggregated city-level yield history. The `computeMonthlySnapshot()` shared function handles startup check, admin endpoint, and cron.
- **Daily City Investment Reports**: Auto-generated blog posts for top 30 Canadian cities by population. One report published per day, cycling through all 30 cities each month. Module: `server/cityReportGenerator.ts`. Schedule logic: 30-day months = one city/day; 31-day months = skip day 16; 28-29 day months = drop bottom 2 cities. Each report includes: DDF yield data (gross/net yields, pricing, inventory), CMHC rent benchmarks, community deal analysis metrics, month-over-month trend comparisons, and strategy recommendations. Reports published as blog posts with category "market-analysis", author "Realist Research". Daily cron runs hourly after 8am, also checks on startup. Admin endpoints: `POST /api/admin/city-reports/generate` (single city), `POST /api/admin/city-reports/generate-all` (all 30), `GET /api/admin/city-reports/schedule` (view schedule). Idempotent — won't duplicate existing reports.

### Community Underwriting System
- **Tables**: `underwriting_notes`, `listing_comments`, `votes`, `contribution_events`, `listing_analysis_aggregates`
- **API prefix**: `/api/community/`
- **Endpoints**: `POST /api/community/notes` (auth, 3/day/listing rate limit), `GET /api/community/notes/:mlsNumber`, `POST /api/community/comments` (auth), `GET /api/community/comments/:mlsNumber`, `POST /api/community/vote` (auth), `GET /api/community/aggregate/:mlsNumber`, `POST /api/community/aggregates` (batch)
- **Points system**: +5 note, +1 comment, +2 upvote received, -1 downvote (floor 0)
- **Aggregation**: Best note by score determines community cap rate; recomputed on note/vote

## External Dependencies

- **CRM Integration**: GoHighLevel (GHL) via webhooks for lead delivery, with retry logic and logging.
- **Database**: PostgreSQL (configured via `DATABASE_URL`).
- **Session Store**: `connect-pg-simple` for Express sessions.
- **Mapping**: Google Maps Places API (for address autocomplete and geocoding), Leaflet for Cap Rates Explorer map.
- **PDF Export**: html-to-image and jsPDF (for analysis exports).
- **Google Sheets**: Webhook backup for all lead creation endpoints.
- **CREA DDF**: Official Canadian MLS data feed via RESO Web API (OData v4). Auth: OAuth2 client_credentials grant at `identity.crea.ca`. API base: `https://ddfapi.realtor.ca/odata/v1`. Secrets: `CREA_DDF_USERNAME`, `CREA_DDF_PASSWORD`. Client module: `server/creaDdf.ts`. Routes: `GET /api/ddf/status`, `POST /api/ddf/listings`, `GET /api/ddf/listing/:listingKey`, `GET /api/ddf/mls/:mlsNumber`. Data is normalized to Repliers format for the Cap Rates Explorer. DDF is used as primary data source with Repliers as fallback.
