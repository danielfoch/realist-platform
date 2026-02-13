# Realist IDX Integration Checklist

## Credentials and Access
- [ ] CREA DDF account is activated and endpoint access is confirmed.
- [ ] `DDF_USERNAME` and `DDF_PASSWORD` are set in production secrets.
- [ ] Source IPs are whitelisted by CREA.

## Environment
- [ ] `.env` values are configured for `DATABASE_URL`, `PORT`, `LOG_LEVEL`.
- [ ] PostgreSQL is reachable from application runtime.
- [ ] Monitoring URL `/monitoring/dashboard.html` is reachable internally.

## Database
- [ ] Run migrations: `npm run migrate`.
- [ ] Verify `listings`, `sync_runs`, and indexes exist.
- [ ] Seed sample data in non-production: `npm run seed`.

## API and Sync
- [ ] Validate `/health` returns `status=ok`.
- [ ] Validate `/metrics` returns sync and Prometheus payload.
- [ ] Execute DDF connection test: `npm run test:ddf`.
- [ ] Execute sync: `npm run sync` and verify `sync_runs` updates.

## Quality Gates
- [ ] Type check passes: `npm run type-check`.
- [ ] Lint passes: `npm run lint`.
- [ ] Tests pass with coverage: `npm run test`.

## Deployment
- [ ] Run deployment script: `./deploy.sh`.
- [ ] Containerized run validated with `docker compose up --build`.
- [ ] GitHub Actions pipeline passes on `main`.

## Operations
- [ ] Set a scheduled sync job (hourly/daily as needed).
- [ ] Alert on failed syncs (`sync_runs.status='failed'`).
- [ ] Alert on `/health` degradation.
- [ ] Rotate logs and retain at least 14 days.
