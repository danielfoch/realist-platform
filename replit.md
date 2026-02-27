# Realist.ca - Real Estate Deal Analyzer

## Overview
Realist.ca is a production-grade web application for real estate investors. It enables underwriting deals, comparing investment strategies (Buy & Hold, BRRR, Flip, Airbnb, Multiplex), and exporting investor-ready analysis sheets. The platform provides institutional-grade financial calculations including cap rates, IRR, cash-on-cash returns, and multi-year projections for Canadian and US real estate markets. Key features include a lead-capturing landing page, a sophisticated deal analyzer supporting various strategies, and an admin dashboard for lead management. The platform aims to be a comprehensive tool for real estate investment analysis.

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
- **Insights**: Podcast, Blog, Guides.
- **About**: Company information, Team, Programs, Shop, Contact.

### Core Features and Pages
- **Deal Analyzer**: Main product with calculator and analysis tools.
- **BuyBox**: Mandate builder with Google Maps integration and e-signature for buyer representation agreements.
- **Co-Investing Platform**: Tools for finding partners, pooling capital, group creation wizard, complexity assessment, and in-group chat. Includes BRA (Buyer Representation Agreement) gating for Ontario users.
- **Calculators Hub**: Includes various tools like "True Cost of Homeownership" and "Will It Plex?".
- **Listing Import**: Supports property detail import from realtor.ca and zillow.com via URL or HTML paste.
- **Rent Pulse API**: Integrates scraped rent data for market insights.
- **Stress Test Analysis**: Provides Base/Bear/Bull scenarios for financial projections within the Deal Analyzer.
- **MLI Select Calculator**: Standalone CMHC MLI Select points calculator with underwriting and stress testing.
- **Admin Dashboard**: Protected area for lead and webhook management.
- **Authentication**: Custom email/password system with PostgreSQL-backed sessions, bcrypt hashing, and secure token management for resets/account setup. Supports lead auto-enrollment.
- **Leaderboard & Analytics**: Displays top analysts and city insights based on deal data and aggregate metrics.
- **Realtor Partner Network**: Realtors can claim a market, sign a 25% referral agreement (with e-signature canvas), receive lead notifications when deals are analyzed in their market, and claim leads via a formal logged introduction email. Route: `/partner/network`. Tables: `realtor_market_claims`, `realtor_lead_notifications`, `realtor_introductions`. API prefix: `/api/realtor-network/`.

## External Dependencies

- **CRM Integration**: GoHighLevel (GHL) via webhooks for lead delivery, with retry logic and logging.
- **Database**: PostgreSQL (configured via `DATABASE_URL`).
- **Session Store**: `connect-pg-simple` for Express sessions.
- **Mapping**: Google Maps Places API (for address autocomplete and geocoding).
- **PDF Export**: html-to-image and jsPDF (for analysis exports).
- **Google Sheets**: Webhook backup for all lead creation endpoints.