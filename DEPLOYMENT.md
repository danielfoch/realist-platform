# Deployment Guide

## 1. Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Activated CREA DDF account with IP whitelist
- Environment variables configured (`ENVIRONMENT_VARIABLES.md`)

## 2. Local Deployment
```bash
npm ci
npm run migrate
npm run type-check
npm run lint
npm run test
npm run build
npm run start
```

## 3. One-command Deployment
```bash
./deploy.sh
```
`deploy.sh` runs install, migrations, DDF connection test, quality checks, build, and start.

## 4. Docker (Local Dev)
```bash
docker compose up --build
```
Services:
- `postgres` on port `5432`
- `app` on port `3000`

## 5. Replit-specific Steps
1. Create secrets in Replit:
- `DATABASE_URL`
- `DDF_USERNAME`
- `DDF_PASSWORD`
- `LOG_LEVEL` (optional)

2. Configure run command:
```bash
npm run migrate && npm run dev
```

3. Add scheduled sync (Replit Scheduled Deployments / Cron):
```bash
npm run sync
```
Recommended: every 2-6 hours depending on listing update cadence.

4. Verify:
- `GET /health` returns status `ok`
- `GET /metrics` returns sync stats
- `/monitoring/dashboard.html` loads

## 6. CI/CD
GitHub Actions workflow: `.github/workflows/ci-cd.yml`
- Spins up PostgreSQL service
- Runs migrations
- Runs type-check, lint, tests, build
- Publishes coverage artifact

## 7. Production Runtime Checks
- Ensure sync pipeline writes to `sync_runs`
- Alert on failed syncs
- Alert on `/health` degradation
- Validate API response times and DB connection pool saturation
