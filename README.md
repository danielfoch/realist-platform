# Realist.ca CREA DDF IDX Integration

Production-oriented IDX backend/frontend integration for CREA DDF data.

## Stack
- Backend: Express + TypeScript + PostgreSQL
- Frontend: React + TypeScript + Vite + Tailwind + shadcn components
- Sync: CREA DDF RETS client with retry, rate limiting, and sync telemetry

## Prerequisites
1. **PostgreSQL** (v14+) - Local or hosted (Supabase, Neon, Railway, etc.)
2. **Node.js** (v18+)
3. **Mapbox Token** - Get free at https://mapbox.com

## Setup

```bash
# 1. Clone and install dependencies
cd idx-integration
npm ci

# 2. Configure environment
cp .env.example .env
```

### Environment Variables (.env)

```env
# CREA DDF Credentials (get from CREA)
DDF_USERNAME=your_username
DDF_PASSWORD=your_password

# Database (PostgreSQL connection string)
DATABASE_URL=postgresql://user:password@host:5432/realist

# Rent API (from realist.ca scraper)
RENT_API_URL=https://realist.ca/api/rents
RENT_API_KEY=your_api_key

# Server
PORT=3000
NODE_ENV=development

# Mapbox (REQUIRED for map view)
# Get free token at https://mapbox.com
VITE_MAPBOX_TOKEN=pk.your_token_here

# Optional: Sync schedule (cron format)
SYNC_SCHEDULE=0 2 * * *
```

### Database Setup

```bash
# Run migrations
npm run migrate

# Seed with sample data (optional but recommended for testing)
npm run seed:comprehensive
```

### Start Development Server

```bash
# Backend + Frontend
npm run dev
```

Visit http://localhost:3000

## Core Commands
- `npm run sync` - Incremental sync from CREA DDF
- `npm run sync:full` - Full sync (all listings)
- `npm run test:ddf` - Test CREA DDF connectivity
- `npm run seed:comprehensive` - Seed sample data with cap rates
- `npm run test` - Unit/integration tests with coverage
- `npm run type-check` - Strict TypeScript checks

## Cap Rate Calculation

Formula: `(Monthly Rent × 12 × 0.6) / Listing Price = Cap Rate`

This uses a 40% expense ratio (60% NOI ratio) which accounts for:
- Property management (8-10%)
- Maintenance (5-10%)
- Vacancy (5-8%)
- Insurance (1-2%)
- Property taxes (1-2%)
- Utilities (if included)
- Other expenses

## Features

### Map View
- Interactive Mapbox map showing all listings
- Markers colored by cap rate (green = investment property)
- Click markers for property details
- Filter by cap rate range

### Investment Filters
- Filter by minimum/maximum cap rate
- Sort by cap rate, price, cash flow, yield
- Investment focus mode (only show properties with cap rate data)

### API Endpoints
- `GET /api/listings` - Paginated listings with filters
- `GET /api/listings/:id` - Single listing details
- `GET /api/listings/map` - Listings optimized for map view
- `GET /api/stats` - Market statistics
- `POST /api/rent/ingest` - Receive rent data from scraper
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics

## Documentation
- `API_DOCUMENTATION.md`
- `DEPLOYMENT.md`
- `TROUBLESHOOTING.md`
- `ENVIRONMENT_VARIABLES.md`
- `INTEGRATION_CHECKLIST.md`

## Known Issues

### DDF Connection
If DDF endpoints return DNS errors, the CREA account may not be activated. Contact CREA support to verify:
1. Account is active
2. IP is whitelisted
3. Correct endpoint URLs are provided

### Mapbox Token Required
The map view requires a valid Mapbox public token. Get one free at https://mapbox.com
