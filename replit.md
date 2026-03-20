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
- **Admin Dashboard**: Protected area for managing leads, webhooks, blog posts, and guides.
- **Authentication**: Custom email/password system with secure session management.
- **Leaderboard & Analytics**: Tracks and displays user contributions and deal analyses.
- **Realtor Partner Network**: System for realtors to claim markets, receive leads, and manage referrals.
- **Monthly Market Report**: Auto-generated reports for Canadian cities based on DDF and CMHC data.
- **Market Report Builder**: Interactive tool at `/insights/market-report-builder` for custom market reports with geography search, metric selection (rent, vacancy, income, homeownership, crime, price, investor score), time-series charts (line/indexed/bar), CAGR/stats computation, and save/export. Backed by `geographies`, `metrics`, and `area_scores` tables seeded from CMHC data.
- **Map Layers Panel**: Floating layers control on Cap Rates Explorer with toggleable overlay categories (composite, financial, demographic, infrastructure), opacity sliders, and dynamic legend. Phase 1: UI controls built; Phase 2: actual map overlay rendering.
- **Indigenous Land Claim Screener**: Map-based tool to identify properties overlapping with Indigenous land claims and treaty areas, including "Watch Overlays" for high-sensitivity areas.
- **Distress Deals Browser**: Tool to find power-of-sale, bank-owned, motivated seller, VTB, and commercial/mixed-use listings using CREA DDF `contains(PublicRemarks,...)` OData queries with keyword-per-term search, distress scoring, and server-side caching. 4 category toggles: Foreclosure/POS, Motivated, VTB, Commercial — all ON by default. Map uses `leaflet.markercluster` for pin clustering. Cache key `distress-v5:all` uses all categories; user category/score/keyword filters applied at read-time. Daily pre-warm runs on startup + every 12 hours for Ontario, BC, Alberta, and Quebec. Cache TTL is 24 hours. Signup gate preserves selected listing MLS# via sessionStorage + URL param for redirect-back after auth. Note: DDF API does not support `tolower()` in OData filters; `contains()` is case-insensitive.
- **Monthly Distress Report**: Auto-generated monthly report system (`server/distressReportGenerator.ts`) that scans all provinces via DDF, captures snapshots to `distress_snapshots` table, and publishes a blog post with national/provincial/city breakdowns, month-over-month trends, and category analysis. Runs on 2nd of each month via cron. Admin can trigger manually via `POST /api/admin/distress-report/generate`. Frontend insights page at `/insights/distress-report` with charts and data tables.
- **Daily City Investment Reports**: Auto-generated, regularly published investment reports for major Canadian cities.
- **Multiplex Investor Fit Assessment**: Conversion funnel tool at `/multiplex-investor-fit` with 6-step quiz (market, goal, capital/experience, complexity tolerance, help preference, opt-in gate). Computes fit score (0–100) with tier routing (high→consult, moderate→course, early→nurture). Webhooks to GHL CRM with `formTag: "multiplexmasterclass"` and tags including fit tier, recommendation, province, goal, and capital. Also sends to Google Sheets backup. API endpoint: `POST /api/multiplex-fit`.
- **Community Underwriting System**: Facilitates collaborative deal analysis through notes, comments, votes, and a points system to determine community cap rates.

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