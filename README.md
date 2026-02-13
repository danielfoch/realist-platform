# Realist.ca CREA DDF IDX Integration

Production-oriented IDX backend/frontend integration for CREA DDF data.

## Stack
- Backend: Express + TypeScript + PostgreSQL
- Frontend: React + TypeScript + Vite + Tailwind + shadcn components
- Sync: CREA DDF RETS client with retry, rate limiting, and sync telemetry

## Quick Start
```bash
cp .env.example .env
npm ci
npm run migrate
npm run dev
```

## Core Commands
- `npm run sync` incremental sync
- `npm run sync:full` full sync
- `npm run test:ddf` DDF connectivity test
- `npm run test` unit/integration tests with coverage
- `npm run type-check` strict TS checks
- `npm run lint` lint backend/test code

## Monitoring
- Health: `GET /health`
- Metrics: `GET /metrics`
- Dashboard: `/monitoring/dashboard.html`

## Documentation
- `API_DOCUMENTATION.md`
- `DEPLOYMENT.md`
- `TROUBLESHOOTING.md`
- `ENVIRONMENT_VARIABLES.md`
- `INTEGRATION_CHECKLIST.md`
