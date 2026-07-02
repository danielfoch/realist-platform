# Open-data enrichment spine

The enrichment spine turns free government/open data into listing-page context,
analyzer prefill, and Intelligence Engine features. v1 ships the **neighbourhood
layer**: StatCan 2021 Census dissemination-area (DA) profiles resolved by
lat/lng. The full national plan (assessment rolls, permits, parcels, climate)
lives in `~/portfolio-os/20-realist/OPEN-DATA-ENRICHMENT-WORKPLAN.md`.

## Pieces

- `shared/censusProfile.ts` — pure parsing/derivation for the 98-401-X2021006
  comprehensive CSV (characteristic-ID matched, suppression symbols → null).
- `server/enrichment.ts` — self-migrating tables (`data_layers`,
  `census_da_boundaries`, `census_da_profiles`), DA resolution
  (bbox prefilter + point-in-polygon, same pattern as `torontoGeo.ts`),
  and routes.
- `scripts/import-census-da.ts` — imports boundaries (GeoJSON/ndjson) and
  profiles (streamed CSV).
- `client/src/components/NeighbourhoodInsights.tsx` — "Neighbourhood snapshot"
  card on `/listings/:mlsNumber`; renders nothing until data is imported.

## API

- `GET /api/enrichment?lat=..&lng=..` → `{ success, data: { neighbourhood } }`
  where `neighbourhood` is `NeighbourhoodStats` (renter share, median household
  income, median home value, median rent paid, dwelling mix, built-since-2001
  share, density, attribution) or `null` when the point doesn't resolve.
- `GET /api/enrichment/layers` → the `data_layers` registry (source, licence,
  attribution, `last_imported_at`, `row_count`) — freshness at a glance.

## Import runbook (one-time per census; ~30 min total)

Tables self-create on boot and on import — no `db:push` needed.

1. **Boundaries** — download the 2021 DA boundary file (`lda_000b21a_e.zip`,
   Statistics Canada → 2021 Census boundary files), then either:
   - per-province (in-memory, easiest):
     `npx mapshaper lda_000b21a_e.zip -proj wgs84 -simplify 12% keep-shapes -filter 'PRUID === "35"' -o precision=0.000001 format=geojson da_on.geojson`
   - whole country (constant memory): `ogr2ogr -f GeoJSONSeq da_canada.ndjson lda_000b21a_e.shp -t_srs EPSG:4326`

   Then: `npx tsx scripts/import-census-da.ts boundaries da_on.geojson`

   The boundary file ships in Lambert conformal conic — reproject to WGS84
   (mapshaper: add `-proj wgs84`; ogr2ogr: the `-t_srs EPSG:4326` above).

2. **Profiles** — download the comprehensive CSV at DA level
   (98-401-X2021006) from the Census Profile download page; regional splits
   (Ontario, Quebec, …) or the 2.2GB national file both work (streamed):

   `npx tsx scripts/import-census-da.ts profiles 98-401-X2021006_English_CSV_data_Ontario.csv`

3. Verify: `GET /api/enrichment/layers` shows both layers with row counts;
   `GET /api/enrichment?lat=43.65&lng=-79.38` returns stats; listing pages in
   imported provinces show the "Neighbourhood snapshot" card.

Re-running either import upserts in place (safe to refresh anytime).

## Licence

Statistics Canada Open Licence — attribution required and rendered on every
display surface (the API returns the attribution string; the card shows it).

## Québec assessment roll (property layer)

- `shared/quebecRoll.ts` parses the MAMH RL XML (field codes verified against
  real 2026 files); `scripts/import-quebec-roll.ts` streams per-municipality
  files (Montréal ~800MB, constant memory) into `assessment_units`.
- Import (downloads directly from MAMH; re-runnable):
  - `npx tsx scripts/import-quebec-roll.ts list montr` — find codes
  - `npx tsx scripts/import-quebec-roll.ts municipality 66023,65005,81017` — Montréal, Laval, Gatineau
  - Province-wide: iterate the `list` output (1,134 municipalities, ~2.8M units).
- Matching: loose civic + street-name key (accents stripped, St→Saint expanded,
  street type dropped); ambiguous matches across municipalities are resolved by
  the listing's city and otherwise REFUSED rather than guessed.
- Listing pages show a "Property intelligence" card (year built, assessed value,
  listed-at-×-assessed, lot/floor area, frontage, storeys, dwelling units) with
  CC-BY Québec attribution.

## Follow-ups (workplan §3)

- Render neighbourhood facts into the listing SEO bot fallback + JSON-LD
  (`listingSeo.ts`) so the unique content is crawlable.
- Analyzer prefill from `GET /api/enrichment`.
- Next layers on the same spine: NS/Winnipeg/Calgary/Edmonton assessment
  rolls (same assessment_units table, new source value), city permits, climate
  screeners, Montréal parcel geometry (joins the roll by matricule).
