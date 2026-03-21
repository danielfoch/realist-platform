# Replit Setup

This repo is ready to run in Replit from GitHub.

## 1. Import into Replit

Use the GitHub import flow in Replit and select:

- `danielfoch/realist-platform`

Replit should detect the repo automatically. The default run command is already set in [.replit](/Users/danielfoch/Realist-Platform/.replit).

## 2. Add Replit Secrets

Recommended secrets:

- `DATABASE_URL`
- `DDF_USERNAME`
- `DDF_PASSWORD`
- `RENT_API_URL`
- `RENT_API_KEY`
- `VITE_MAPBOX_TOKEN`
- `PORT`
- `LOG_LEVEL`

Optional for a backend-only smoke test before the database is ready:

- `DEMO_MODE=true`
- `SKIP_MIGRATIONS=true`

## 3. Start the app

Replit will run:

```bash
bash ./replit.start.sh
```

That script will:

1. install dependencies if needed
2. run migrations when `DATABASE_URL` is present
3. start the backend in dev mode

## 4. Replit workflow

Recommended workflow:

1. Keep Replit connected to `main` on GitHub
2. Let Codex/OpenClaw work against the same GitHub repo
3. Pull or re-import in Replit after changes land
4. Keep credentials only in Replit Secrets, never in the repo

## 5. Quick checks

After boot, verify:

- `GET /health`
- `GET /metrics`
- `GET /api/listings?limit=10`

If you do not have a live database yet, start with `DEMO_MODE=true` and `SKIP_MIGRATIONS=true`.

## 6. Replit database migration warning

This app needs:

- `cube`
- `earthdistance`

It does not require PostGIS.

If Replit publish says it is trying to alter `spatial_ref_sys`, your development database likely has the `postgis` extension installed and Replit is diffing extension-owned system tables.

Run:

```bash
npm run db:doctor
```

If `postgis` is installed and you are not intentionally using it, remove it from the Replit development database before publishing. Otherwise Replit may keep generating invalid production migration statements for system tables.

This repo also includes:

```bash
npm run db:replit:normalize
```

On Replit, `replit.start.sh` now runs that normalization step automatically before migrations. If the dev database has `postgis` installed but no `geometry`/`geography` columns, it will remove the unused extension and keep the required `cube` + `earthdistance` extensions in place.
