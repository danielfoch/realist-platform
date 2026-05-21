# Troubleshooting

## DDF Authentication Fails
- Confirm CREA account is activated.
- Confirm IP whitelist with CREA support.
- Check `DDF_USERNAME` and `DDF_PASSWORD` are present.
- Run `npm run test:ddf` and inspect logs.

## Sync Runs But No Listings Imported
- Check `sync_runs` table for `failed_count` and `error_message`.
- Run full sync: `npm run sync:full`.
- Verify DDF endpoint returns results for expected status filters.

## `/health` Returns Degraded
- Validate `DATABASE_URL` and DB network reachability.
- Run `psql "$DATABASE_URL" -c 'select 1'`.
- Check DB connection limit and pool settings.

## API Returns 400 for Filters
- Query validation is strict; ensure numeric params are valid numbers.
- `province` must be 2 characters.
- `limit` must be between 1 and 100.

## High API Latency
- Confirm indexes were created by running migrations.
- Verify `sync_runs` and listings indexes exist.
- Enable EXPLAIN ANALYZE on slow queries and tune filters.

## Jest/Test Failures in CI
- Confirm PostgreSQL service is up before migrations.
- Run `npm ci` to align lockfile.
- Re-run `npm run test -- --runInBand` to isolate flakiness.

## Monitoring Page Not Updating
- Ensure server serves static files from `/monitoring`.
- Visit `/metrics` directly and verify JSON response.
