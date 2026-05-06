# Realist.ca - Real Estate Deal Analyzer

## Overview
Realist.ca is a production-grade web application (with a Capacitor-based iOS/Android shell in `mobile/` and a Model Context Protocol server / CLI plugin in `mcp-realist/` for Claude Desktop, Codex CLI, Cursor, and other AI agents) for real estate investors, providing institutional-grade financial analysis tools for Canadian and US markets. Its core purpose is to facilitate deal underwriting, compare investment strategies (Buy & Hold, BRRR, Flip, Airbnb, Multiplex), and generate investor-ready analysis sheets. The platform features a map-first homepage, a comprehensive deal analyzer with MLS# import, community-driven underwriting via Cap Rates Explorer, and an admin dashboard for lead management. The project aims to be the leading tool for sophisticated real estate investment analysis, offering multi-year projections, cap rate calculations, and IRR analysis.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript (Vite)
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **UI Components**: shadcn/ui (Radix UI)
- **Styling**: Tailwind CSS with a custom modern fintech design system
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts
- **Theming**: Dark/light mode support

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful JSON APIs (`/api` prefix)
- **Build**: esbuild

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema**: Shared definitions between client and server
- **Migrations**: Drizzle Kit

### Key Design Patterns
- **Shared Types**: Client and server utilize common schema definitions.
- **Storage Abstraction**: Database operations abstracted via `IStorage` interface.
- **Path Aliases**: `@/` for client source, `@shared/` for shared code.

### Core Features
- **Map-First Homepage & Deal Analyzer**: Interactive map with embedded analysis tools supporting MLS# import.
- **Cap Rates Explorer**: Map-based search using CREA DDF data for community underwriting.
- **BuyBox**: Mandate builder with geographic selection and integrated outreach services.
- **Co-Investing Platform**: Tools for investor collaboration.
- **Calculators Hub**: Specialized real estate calculators, including mortgage analysis.
- **Mortgage Rates Page**: Displays live Canadian mortgage rates.
- **Listing Import**: Supports property data import from major real estate portals.
- **Rent Pulse API**: Integrates scraped and benchmarked rent data.
- **Stress Test Analysis**: Provides Base/Bear/Bull financial scenarios.
- **CMHC MLI Select Calculator**: Standalone points calculator.
- **Content Management**: Database-backed Blog and Guides with Admin Dashboard CRUD.
- **Weekly Email Digest**: Automated email digest of platform and user stats.
- **Admin Dashboard**: Manages leads, webhooks, and content.
- **Authentication**: Custom email/password system with secure sessions and Google OAuth integration.
- **GHL Webhooks for Activity Tracking**: Tracks user logins and deal analyses for CRM and Google Sheets backup.
- **Leaderboard & Analytics**: Tracks user contributions and deal analyses, blending user data with DDF market insights.
- **DDF Yield Crawler**: Monthly automated province-based crawl of CREA DDF for listing snapshots and city-level yield aggregation, refreshed daily.
- **Realtor Partner Network**: System for lead distribution and referral management.
- **Monthly Market Report**: Auto-generated reports for Canadian cities.
- **Market Report Builder**: Interactive tool for custom market reports with geographic search, metric selection, time-series charts, and export.
- **Map Layers Panel**: Dynamic map overlays for various categories (composite, financial, demographic, infrastructure) on the Cap Rates Explorer, displaying KPIs and trends for Canadian cities.
- **Indigenous Land Claim Screener**: Map tool to identify properties overlapping with Indigenous land claims.
- **Distress Deals Browser**: Search tool for power-of-sale, motivated seller, and VTB listings using DDF OData queries, distress scoring, and server-side caching.
- **Monthly Distress Report**: Auto-generated report on distress listings trends.
- **Daily City Investment Reports**: Regularly published reports for major Canadian cities.
- **Private Client Reports (Unique-Link Gating)**: Single-token gated research reports for private client distribution. The first such report is the GTA Pre-Construction vs Resale Condo Pricing 1985-2000 reconstruction at `/insights/precon-vs-resale-1990s` (gated by `PRECON_REPORT_TOKEN` env secret using `crypto.timingSafeEqual` + `Cache-Control: private, no-store`; private-notice fallback when no/invalid key; `noIndex` SEO).
- **Public Embeddable Macro Reports**: Public market reports designed to embed via iframe in third-party sites. The Bank of Canada April 2026 Monetary Policy Report at `/insights/bank-of-canada-april-2026` is the reference implementation: a single self-contained page (`BankOfCanadaApril2026Report.tsx`) accepts an `embed` prop; the named export `BankOfCanadaApril2026ReportEmbed` is wired at `/embed/insights/bank-of-canada-april-2026`. The full version includes hero KPIs, four key takeaways, a Numbers-at-a-Glance KPI grid, four recreated recharts (GDP, CPI, Brent oil scenarios, tariffs) using anchor points stated directly in the source, a 12-card source-chart gallery deep-linking to specific pages of the BoC PDF, an 8-section narrative, a 5-tab Real Estate implications module (Buyers/Sellers/Investors/Renewers/Realtors), and an embed-code copy section. The embed view hides Navigation/narrative/source-charts/embed-code and adds an Open-Full-Report CTA; it sets `noIndex` on SEO. Card surfaced first in the Canadian Macro Reports grid on `/insights/market-report`.
- **Multiplex Investor Fit Assessment**: 6-step quiz funnel calculating investor fit score and routing to appropriate resources, integrating with GHL CRM and Google Sheets.
- **Multiplex Masterclass Sales Page**: Hidden sales page with lead capture and Stripe checkout for a one-time payment.
- **In-App LMS (Multiplex Masterclass Course)**: Gated course viewer with 8 modules, 47+ lessons, video player, lesson completion tracking, and community link.
- **Community Underwriting System**: Facilitates collaborative deal analysis with notes, comments, votes, and a points system.
- **Partner Join Pages**: Landing pages for realtors and lenders with application forms and CRM webhook integration.
- **Deal Match CTA**: Connects users to realtors and lenders after deal analysis.
- **Gamification System**: User stats, badges (Analyst to Legend), rank change notifications, and leaderboards.
- **My Performance Dashboard**: Personalized dashboard comparing user KPIs against platform averages, displaying rankings, badge progress, and trend data.
- **Find Deals (Cap Rates Explorer)**: Natural language search for deals on the Yield Map, parsing queries into DDF filters, computing deal scores, and displaying ranked results with AI explanations.
- **AI Agent API & MCP Plugin (`mcp-realist/`)**: Bearer-token-authenticated `/api/agent/*` endpoints (in `server/agentApi.ts`) backing an npm-publishable Model Context Protocol server (`@realist/mcp`) and CLI (`realist`). Eight tools: underwrite by MLS#, underwrite custom address, natural-language deal search, list/get saved analyses, submit to community feed, market report, mortgage rates. API keys minted at `/account/api-keys` (page `client/src/pages/AccountApiKeys.tsx`), stored as SHA-256 hashes in the `api_keys` table, returned plaintext only at creation. Works with Claude Desktop, Codex CLI, Cursor, and any MCP-compatible agent.

## External Dependencies

- **CRM Integration**: GoHighLevel (GHL)
- **Database**: PostgreSQL
- **Session Store**: `connect-pg-simple`
- **Mapping**: Google Maps Places API, Leaflet
- **PDF Export**: html-to-image and jsPDF
- **Google Sheets**: Webhook backup for lead data
- **CREA DDF**: Canadian MLS data feed (RESO Web API)
- **Email Service**: Resend
- **Geocoding**: Nominatim
- **Direct Mail**: PostGrid
- **AI Phone Calls**: ElevenLabs
- **Voicemail Drops**: SlyBroadcast
- **Mortgage Rate Data**: Bank of Canada Valet API, wowa.ca (scraping)
- **Indigenous Land Data**: Indigenous Services Canada (SAC-ISC)