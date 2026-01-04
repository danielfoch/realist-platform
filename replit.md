# Realist.ca - Real Estate Deal Analyzer

## Overview

Realist.ca is a production-grade real estate deal analyzer web application designed to help investors underwrite deals, compare investment strategies, and export investor-ready analysis sheets. The platform targets Canadian and US real estate investors with institutional-grade financial calculations including cap rates, IRR, cash-on-cash returns, and multi-year projections.

The application features a high-converting landing page with lead capture, a sophisticated deal analyzer tool supporting multiple investment strategies (Buy & Hold, BRRR, Flip, Airbnb, Multiplex), and an admin dashboard for lead management. It integrates with GoHighLevel CRM for automated lead delivery.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for client-side routing (lightweight alternative to React Router)
- **State Management**: TanStack Query (React Query) for server state and data fetching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system following modern fintech aesthetics (Inter font, JetBrains Mono for financial figures)
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for financial visualizations
- **Theme**: Dark/light mode support with CSS variables

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful JSON APIs under `/api` prefix
- **Build**: esbuild for server bundling, Vite for client

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Tables**: leads, properties, analyses, webhookLogs, dataCache
- **Migrations**: Drizzle Kit for schema management (`npm run db:push`)

### Key Design Patterns
- **Shared Types**: Schema definitions in `shared/` directory are shared between client and server
- **Storage Abstraction**: `IStorage` interface in `server/storage.ts` abstracts database operations
- **Path Aliases**: `@/` maps to client source, `@shared/` maps to shared code

### Page Structure
- `/` - Deal Analyzer (main product page with hero section and calculator)
- `/about` - Team bios and company information
- `/admin` - Protected dashboard for lead and webhook management
- `/privacy` and `/terms` - Legal pages

## External Dependencies

### CRM Integration
- **GoHighLevel (GHL)**: Webhook integration for lead delivery
- **Configuration**: `GHL_WEBHOOK_URL` environment variable
- **Features**: Retry logic with exponential backoff, delivery logging in database

### Database
- **PostgreSQL**: Required, configured via `DATABASE_URL` environment variable
- **Session Store**: connect-pg-simple for Express sessions

### Third-Party Services (Planned/Configurable)
- **Google Maps Places API**: For address autocomplete and geocoding (referenced in requirements)
- **PDF Export**: html-to-image and jsPDF for analysis exports

### Key NPM Packages
- `drizzle-orm` / `drizzle-zod` - Database ORM and schema validation
- `@tanstack/react-query` - Data fetching and caching
- `recharts` - Financial charts and visualizations
- `@hookform/resolvers` / `zod` - Form validation
- `date-fns` - Date formatting
- Full Radix UI component suite via shadcn/ui