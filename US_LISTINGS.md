# US Listings (HomeHarvest Import)

US listings are imported into the same `listings` table and shown on the same listings page/map as Canadian listings. Canadian data continues to come from CREA DDF (`npm run sync`); US data is imported from CSV files produced by the [HomeHarvest](https://github.com/Bunsly/HomeHarvest) Python library.

> **Legal note:** HomeHarvest scrapes Realtor.com. Review Realtor.com's Terms of Service and your legal exposure before using this data in production or for marketing purposes. **CREA DDF remains the Canadian source of truth**; HomeHarvest data is best treated as supplementary/experimental.

## 1. Produce the CSV

Requires Python 3.9+:

```bash
pip install homeharvest
homeharvest "Buffalo, NY" --listing_type for_sale --output csv --filename us_listings
```

This writes `us_listings.csv` to the current directory. Repeat per market (e.g. `"Phoenix, AZ"`, `"Austin, TX"`).

## 2. Import into the database

Run migrations first (adds the `source` column and country/source indexes via `db/migrations/016_us_listings_source.sql`):

```bash
npm run migrate
npm run import:us -- us_listings.csv
```

The importer:

- Parses the CSV with a built-in parser (no extra dependencies).
- Upserts by `mls_number` (`ON CONFLICT (mls_number) DO UPDATE`), so re-importing the same file is safe.
- Skips rows with no `list_price` or no `city`.
- Processes rows in batches of 100, each batch in its own transaction.
- Logs an `inserted` / `updated` / `skipped` summary on completion.
- Stores the original CSV row in `raw_data` (JSONB) and the `primary_photo` URL in `listing_photos`.

## 3. Suggested daily cron (Replit)

In Replit, use Scheduled Deployments (Deployments → Scheduled) with a daily schedule (e.g. `0 6 * * *`) and a command like:

```bash
pip install homeharvest && homeharvest "Buffalo, NY" --listing_type for_sale --output csv --filename us_listings && npm run import:us -- us_listings.csv
```

Alternatively, run the same one-liner from any cron-capable host with `DATABASE_URL` set.

## 4. Column mapping

| HomeHarvest CSV column | `listings` column | Notes |
| --- | --- | --- |
| `mls_id` | `mls_number` | Falls back to `${mls}-${row index}` if missing |
| `status` | `status` | `FOR_SALE`/`for_sale` → `Active`; other values pass through capitalized (e.g. `PENDING` → `Pending`) |
| `style` | `property_type` | |
| `street` + `unit` | `address_street` | Unit appended with a space when present |
| `city` | `address_city` | Row skipped if missing |
| `state` | `address_province` | 2-letter US state code |
| `zip_code` | `address_postal_code` | |
| — | `address_country` | Always `USA` |
| — | `source` | Always `homeharvest` (DDF rows are `ddf`) |
| `beds` | `bedrooms` | |
| `full_baths` | `bathrooms_full` | Schema stores full/half baths as separate INTEGER columns |
| `half_baths` | `bathrooms_half` | |
| `sqft` | `square_footage` | |
| `year_built` | `year_built` | |
| `list_price` | `list_price` | Row skipped if missing |
| `list_date` | `list_date` | |
| `latitude` / `longitude` | `latitude` / `longitude` | |
| `stories` | `stories` | |
| `hoa_fee` | `maintenance_fee` | |
| `primary_photo` | `listing_photos.photo_url` | Inserted as the primary photo (deduplicated by URL) |
| (entire row) | `raw_data` | JSONB copy of the source row |

## 5. API and UI

- `GET /api/listings` and `GET /api/listings/map` accept an optional `country=CA|US` query param (translated to `CAN`/`USA` internally). Omit for all countries.
- The listings page (`/listings`) has an All / Canada / US toggle, and each card shows a small CA/US country badge.
