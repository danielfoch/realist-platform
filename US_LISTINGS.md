# US Listings (HomeHarvest → `us_listings`)

US listings live in the **`us_listings`** table (`shared/schema.ts`) and appear on the
same Cap Rate Map (`/cap-rates`, `client/src/pages/CapRates.tsx`) as Canadian listings,
behind an **All / Canada / US** country control. Canadian listings continue to come from
CREA DDF (`server/ddfYieldCrawler.ts` → `ddf_listing_snapshots`, plus the Repliers/DDF
search APIs); US data comes from the [HomeHarvest](https://github.com/Bunsly/HomeHarvest)
Python library, which scrapes Realtor.com.

There is no `country` column: the split is structural. Every `us_listings` row is a US
listing (it has a `source` column, `'homeharvest'` today) and every DDF/Repliers listing
is Canadian. The dedicated `/listings/us` browse page (`client/src/pages/UsListings.tsx`)
still exists, but the map is the unified surface.

> **Legal note:** HomeHarvest scrapes Realtor.com. Review Realtor.com's Terms of Service
> and your legal exposure before using this data in production or for marketing purposes.
> **CREA DDF remains the Canadian source of truth**; HomeHarvest data is supplementary /
> beta (it is labelled "US beta" in the UI).

## 1. Produce the CSV

Requires Python 3.9+:

```bash
pip install homeharvest
homeharvest "Buffalo, NY" --listing_type for_sale --output csv --filename us_listings
```

This writes `us_listings.csv` to the current directory. Repeat per market
(e.g. `"Phoenix, AZ"`, `"Austin, TX"`).

## 2. Import into the database

The schema already contains `us_listings` and `us_listing_price_history`; if you are on a
fresh database, deploy it with `npm run db:push` first (this repo uses `drizzle-kit push`,
not SQL migration files). Then:

```bash
npm run import:us -- us_listings.csv
```

The importer (`server/importUsListings.ts`, pure CSV/mapping helpers in
`shared/usListingsCsv.ts`):

- Parses the CSV with a built-in RFC 4180 parser (no extra dependencies).
- Upserts by **`(source, source_id)`** with `source = 'homeharvest'` and
  `source_id = mls_id` (falling back to `${mls || 'HH'}-${rowIndex}` when `mls_id` is
  missing — those fallback keys are not stable across re-scrapes, so prefer feeds that
  include `mls_id`). Re-importing the same file is safe and idempotent.
- Skips rows with no `list_price` or no `city`, and collapses duplicate `mls_id` rows
  within one file (last occurrence wins).
- Processes rows in batches of 250 and logs an
  `inserted / updated / skipped / priceChanges` summary.
- Preserves `first_seen_at` on update, bumps `last_seen_at` / `last_checked_at`, and
  appends a `us_listing_price_history` row whenever the stored `list_price` changed —
  exactly mirroring the HTTP ingest endpoint, so CSV imports and scraper pushes are
  interchangeable.

### Alternative: HTTP ingest

A remote scraper can instead POST batches to `POST /api/ingest/us-listings`
(header `X-Ingest-Token`, env `US_LISTINGS_INGEST_TOKEN`; see
`scripts/example-sync-us-listings.ts`). Both paths share the same upsert semantics.

## 3. Suggested daily cron

From any cron-capable host with `DATABASE_URL` set (or a Replit Scheduled Deployment,
e.g. `0 6 * * *`):

```bash
pip install homeharvest \
  && homeharvest "Buffalo, NY" --listing_type for_sale --output csv --filename us_listings \
  && npm run import:us -- us_listings.csv
```

## 4. Column mapping

| HomeHarvest CSV column | `us_listings` column | Notes |
| --- | --- | --- |
| — | `source` | Always `homeharvest` |
| `mls_id` | `source_id` | Falls back to `${mls \|\| 'HH'}-${rowIndex}` |
| `property_url` | `source_url` | |
| `street` + `unit` | `street_address` | Unit appended with a space when present |
| street/city/state/zip | `formatted_address` | Joined with commas (NOT NULL column) |
| `city` | `city` | Row skipped if missing |
| `state` | `state` | Uppercased, 2-letter code |
| `zip_code` | `postal_code` | |
| `latitude` / `longitude` | `lat` / `lng` | |
| `style` | `property_type` | |
| `beds` | `beds` | |
| `full_baths` + `half_baths` | `baths` | `full + 0.5 × half` (single REAL column) |
| `sqft` | `sqft` | |
| `lot_sqft` | `lot_sqft` | |
| `year_built` | `year_built` | |
| `list_price` | `list_price` | Rounded to integer; row skipped if missing |
| `hoa_fee` | `est_hoa` | |
| `days_on_mls` | `days_on_market` | |
| `list_date` | `list_date` | |
| `status` | `status` | Stored as-sent (e.g. `FOR_SALE`); `is_active` is derived: `SOLD` / `OFF_MARKET` / `PENDING`-style statuses become inactive, everything else active |
| (entire row) | `raw` | JSONB copy of the source row |
| — | `scraped_at`, `first/last_seen_at`, `last_checked_at` | Set at import time (NOT NULL defaults the CSV can't supply) |

Columns HomeHarvest can't supply (`est_rent`, `est_taxes`, `county` when absent,
`status_confidence` beyond the default `high`, `motivated_seller_signals`) are left NULL.

## 5. API and UI

- `GET /api/us-listings` — paginated browse (used by `/listings/us`).
- `GET /api/us-listings/map` — bounded map query (used by the Cap Rate Map US layer).
- The Cap Rate Map (`/cap-rates`) has an **All / Canada / US** control in the filter bar:
  *All* shows Canadian listings plus clustered blue "US" markers; *Canada* hides the US
  layer; *US* hides Canadian inventory and shows US listings as markers and simple cards.
  Canadian cards carry a small **CA** badge; US markers/cards carry a **US** badge.

---

*The older instructions that imported HomeHarvest CSVs into the dormant idx app's
`listings` table (`src/` + `frontend/`, `npm run import:us -- ...` against
`db/migrations/...`) are **superseded** by this document. The live app's importer is
`server/importUsListings.ts` and writes to `us_listings`.*
