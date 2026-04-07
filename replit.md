# Realist.ca - Real Estate Deal Analyzer

## Overview
Realist.ca is a production-grade web application designed for real estate investors. Its primary purpose is to facilitate the underwriting of real estate deals, compare various investment strategies (Buy & Hold, BRRR, Flip, Airbnb, Multiplex), and generate investor-ready analysis sheets. The platform provides institutional-grade financial calculations, including cap rates, IRR, cash-on-cash returns, and multi-year projections for Canadian and US real estate markets. Key capabilities include a map-first homepage, a comprehensive deal analyzer, community-driven underwriting via the Cap Rates Explorer, MLS# import functionality, and an admin dashboard for lead management. The project aims to be the leading tool for sophisticated real estate investment analysis.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript (Vite)
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

### Core Features
- **Map-First Homepage**: Interactive map-driven interface with embedded deal analyzer and community features.
- **Deal Analyzer**: Central tool for financial modeling and strategy comparison, supporting MLS# import.
- **Cap Rates Explorer**: Map-based search tool leveraging CREA DDF data for community underwriting.
- **BuyBox**: Mandate builder with geographic area selection and paid outreach service integration.
- **Co-Investing Platform**: Tools for partner discovery, capital pooling, and group management.
- **Calculators Hub**: Collection of specialized real estate calculators including "Fixed vs Variable" mortgage analysis.
- **Mortgage Rates Page**: Displays live Canadian mortgage rates from various sources.
- **Listing Import**: Supports property data import from major real estate portals.
- **Rent Pulse API**: Integrates scraped and benchmarked rent data for market insights.
- **Stress Test Analysis**: Provides Base/Bear/Bull scenarios for financial projections.
- **MLI Select Calculator**: Standalone CMHC MLI Select points calculator.
- **Content Management**: Database-backed Blog and Guides sections with CRUD capabilities via Admin Dashboard.
- **Weekly Email Digest**: Automated Monday 9am (Toronto time) email digest via Resend + node-cron. Sends platform stats (total deals, avg cap rate, avg cash-on-cash, avg DSCR, hottest market) and per-user stats (deals analyzed, rank) with HMAC-signed unsubscribe links. Users opt in by default (`email_digest_opt_in` column). Endpoints: `GET /api/email/unsubscribe?uid=&token=`, `POST /api/email/resubscribe` (authenticated), `POST /api/admin/weekly-digest/send` (admin manual trigger). Module: `server/weeklyDigest.ts`.
- **Admin Dashboard**: Protected area for managing leads, webhooks, blog posts, and guides.
- **Authentication**: Custom email/password system with secure session management. Login events (email/password and Google OAuth) fire async GHL webhook with `formTag: "realist_login"` and tags including `realist-user`, `logged-in`, and login month.
- **GHL Webhooks for Activity Tracking**: User logins (all auth paths) and deal analyses trigger async webhooks to GHL with user info, tags, and metadata. Deal analysis webhook (`formTag: "realist_deal_analysis"`) includes strategy type, property address, city, cap rate, cash-on-cash, and purchase price. Also backs up to Google Sheets via `SHEETS_WEBHOOK_URL`.
- **Leaderboard & Analytics**: Tracks and displays user contributions and deal analyses. Shows all-time and monthly leaderboards side by side for permanent gamification. Auto-tracks every deal analysis via `POST /api/analyses` when results are computed. Platform Overview panel blends user-analyzed deal metrics with DDF market data from `city_yield_history` (total listings, avg cap rate, avg price, avg rent, cities tracked, hottest yield city).
- **DDF Yield Crawler**: Monthly automated province-based crawl (`server/ddfYieldCrawler.ts`) of 9 Canadian provinces via CREA DDF RESO API, computing gross/net yields per listing, storing snapshots to `ddf_listing_snapshots` and aggregated city-level yields to `city_yield_history`. Crawls by province (not city) to capture all listings including small towns. Uses full province names for DDF API (e.g., "Ontario" not "ON"), page size 100, yield bounds (gross 0-20%, net -10 to 15%), 200ms delay between pages. Current inventory: ~235K listings across ~3,000 cities. Hot city requires 500+ listings. Manual full crawl via `npx tsx server/runFullCrawl.ts`. Runs daily (every 24 hours) via `setInterval` to keep listings fresh, plus monthly on the 1st for new-month snapshots. Admin trigger via `POST /api/ddf-crawl/trigger`.
- **Realtor Partner Network**: System for realtors to claim markets, receive leads, and manage referrals.
- **Monthly Market Report**: Auto-generated reports for Canadian cities based on DDF and CMHC data.
- **Market Report Builder**: Interactive tool at `/insights/market-report-builder` for custom market reports with geography search, metric selection (rent, vacancy, income, homeownership, crime, price, investor score), time-series charts (line/indexed/bar), CAGR/stats computation, and save/export. Backed by `geographies`, `metrics`, and `area_scores` tables seeded from CMHC data.
- **Map Layers Panel**: Floating layers control on Cap Rates Explorer with toggleable overlay categories (composite, financial, demographic, infrastructure), opacity sliders, and dynamic legend. Phase 2 complete: toggling a layer renders coloured circle markers for 73 Canadian cities on the Yield Map, color-coded by the active metric (investor score, rent, vacancy, income, homeownership). Clicking a city marker shows a popup with latest KPIs (rent, vacancy, income, ownership rate), rent trend direction badge, and a mini area chart of rent over time. Data sourced from `geographies`, `metrics`, and `area_scores` tables via `GET /api/geographies/map-data` and `GET /api/geographies/:id/trends`.
- **Indigenous Land Claim Screener**: Map-based tool to identify properties overlapping with Indigenous land claims and treaty areas, including "Watch Overlays" for high-sensitivity areas.
- **Distress Deals Browser**: Tool to find power-of-sale, bank-owned, motivated seller, VTB, and commercial/mixed-use listings using CREA DDF `contains(PublicRemarks,...)` OData queries with keyword-per-term search, distress scoring, and server-side caching. 4 category toggles: Foreclosure/POS, Motivated, VTB, Commercial — all ON by default. Map uses `leaflet.markercluster` for pin clustering. Cache key `distress-v5:all` uses all categories; user category/score/keyword filters applied at read-time. Daily pre-warm runs on startup + every 12 hours for Ontario, BC, Alberta, and Quebec. Cache TTL is 24 hours. Signup gate preserves selected listing MLS# via sessionStorage + URL param for redirect-back after auth. Note: DDF API does not support `tolower()` in OData filters; `contains()` is case-insensitive.
- **Monthly Distress Report**: Auto-generated monthly report system (`server/distressReportGenerator.ts`) that scans all provinces via DDF, captures snapshots to `distress_snapshots` table, and publishes a blog post with national/provincial/city breakdowns, month-over-month trends, and category analysis. Runs on 2nd of each month via cron. Admin can trigger manually via `POST /api/admin/distress-report/generate`. Frontend insights page at `/insights/distress-report` with charts and data tables.
- **Daily City Investment Reports**: Auto-generated, regularly published investment reports for major Canadian cities.
- **Multiplex Investor Fit Assessment**: Conversion funnel tool at `/multiplex-investor-fit` with 6-step quiz (market, goal, capital/experience, complexity tolerance, help preference, opt-in gate). Computes fit score (0–100) with tier routing (high→consult, moderate→course, early→nurture). Webhooks to GHL CRM with `formTag: "multiplexmasterclass"` and tags including fit tier, recommendation, province, goal, and capital. Also sends to Google Sheets backup. API endpoint: `POST /api/multiplex-fit`.
- **Multiplex Masterclass Sales Page**: Hidden sales page at `/masterclass` for paid ad traffic. High-converting landing page with hero, opportunity, curriculum, audience, proof/social, offer ($999 CAD), FAQ, and lead capture form + Stripe checkout. Lead form captures name, email, phone, intent and fires GHL webhook (`formTag: "multiplex_masterclass"`), Google Sheets backup, and auto-enrollment. Stripe checkout creates one-time $999 CAD payment session via `POST /api/masterclass/checkout`. Not linked in main navigation.
- **In-App LMS (Multiplex Masterclass Course)**: Full course viewer at `/course` with enrollment gating. 8 modules, 47+ lessons seeded from Skool content (`server/courseSeed.ts`). Features: sidebar module navigation with expand/collapse, video player (YouTube embed), lesson completion tracking, progress bar, responsive layout with mobile sidebar toggle, prev/next lesson navigation, and community link to Skool. Tables: `course_modules`, `course_lessons`, `course_enrollments`, `course_progress`. API: `GET /api/course/enrollment`, `GET /api/course/modules`, `POST /api/course/progress/:lessonId`, `PATCH /api/admin/course/lessons/:id`, `POST /api/admin/course/enroll`. Auto-enrollment via Stripe webhook on masterclass purchase (`metadata.product = "multiplex_masterclass"`). Welcome email directs to `/course` with Skool community link.
- **Community Underwriting System**: Facilitates collaborative deal analysis through notes, comments, votes, and a points system to determine community cap rates.
- **Partner Join Pages**: `/join/realtors` and `/join/lenders` landing pages with full application forms, value props, and CRM webhook integration (GHL + Google Sheets). Realtor form collects name, email, phone, brokerage, markets, asset types, deal types, avg deal size, referral agreement. Lender form collects name, company, email, phone, lending types, target markets, loan size range, DSCR/LTV preferences, turnaround time, referral agreement. Stored in `realtor_applications` and `lender_applications` tables.
- **Deal Match CTA**: "Ready to move on this deal?" card appears after analysis results with "Find a Realtor" and "Find a Lender" buttons linking to join pages. Match requests stored in `deal_match_requests` table via `POST /api/deal-match`.
- **Gamification System**: Weekly stats panel (`/api/weekly-stats`), user profile stats with badges (`/api/user/stats`), rank change notifications, badge progress bar. 5 badge tiers: Analyst (10 deals), Power User (50), Deal Hunter (100), Veteran (250), Legend (500). Leaderboard supports period filter (all-time/monthly/weekly) and city filter. Badge earned dates computed from nth analysis timestamp.
- **My Performance Dashboard**: Personalized dashboard at `/my-performance` showing user KPIs vs platform averages. Requires authentication (redirects to `/login?returnUrl=...` if not logged in). Endpoint: `GET /api/user-performance` returns user metrics (deals_analyzed, avg_cap_rate, avg_cash_on_cash, avg_irr, weekly/all-time rank), platform averages, top-3 leaderboards (weekly + all-time), gamification progress (current/next badge, deals to next tier), and 6-month trend data (user vs platform avg cap rate over time). Features: KPI comparison cards with delta badges, ranking display, progress bar to next badge tier, cap rate trend chart (Recharts), leaderboard snapshots, and "Analyze More Deals" CTA. Supports `?source=email` tracking param. Results cached 5 minutes per user. SQL aggregates use safe numeric parsing to handle dirty JSON data.
- **Find Deals (Cap Rates Explorer)**: Natural language deal search on the Yield Map. Search bar accepts queries like "duplexes in Hamilton under 600k". Backend endpoint `POST /api/find-deals` parses NL queries into DDF filters (city, price, beds, property type), fetches listings, computes deal scores (cap rate, cash-on-cash, DOM, units, price tier), and returns scored/ranked results with map bounds. Deal score pin colors: Gold (>=80), Blue (65-79), Grey (<65). Sidebar shows top 20 ranked results with score, cap rate, cash-on-cash, address, and AI explanation. Filter sync with "AI Filters Applied" banner. Toggle for "Show only top deals". 10-minute query cache with LRU eviction. 60+ Canadian cities with coordinates for auto-pan.

## External Dependencies

- **CRM Integration**: GoHighLevel (GHL) for lead delivery.
- **Database**: PostgreSQL.
- **Session Store**: `connect-pg-simple`.
- **Mapping**: Google Maps Places API, Leaflet.
- **PDF Export**: html-to-image and jsPDF.
- **Google Sheets**: Webhook backup for lead data.
- **CREA DDF**: Official Canadian MLS data feed via RESO Web API.
- **Email Service**: Resend.
- **Geocoding**: Nominatim (for Land Claim Screener).
- **PostGrid**: For direct mail services (via BuyBox).
- **ElevenLabs**: For AI phone calls (via BuyBox).
- **SlyBroadcast**: For voicemail drops (via BuyBox).
- **Bank of Canada Valet API**: For mortgage rate data.
- **wowa.ca**: For mortgage rate scraping.
- **Indigenous Services Canada (SAC-ISC)**: Federal open data for Indigenous land claims.