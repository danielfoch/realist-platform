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

## Building permits (Vancouver, Calgary, Montréal)

- Adapters in `shared/buildingPermits.ts` (endpoints + columns verified live);
  importer streams the CSV exports (50-500MB, embedded newlines handled by
  `shared/streamingCsv.ts`): `npx tsx scripts/import-building-permits.ts all`
  (or a comma list; re-runnable, upserts by permit number — schedule monthly).
- Listing pages: "Building permits" card — permit history at the address +
  "N permits issued within 1 km in the last 24 months" (project value where the
  city publishes it: Vancouver yes; Calgary/Montréal publish no cost column).
- Adding a city = one adapter object (key, downloadUrl, licence, mapRow).

## Toronto development activity

Development applications (open.toronto.ca AIC, resource 8907d8ed) →
`development_applications`; `getDevelopmentActivity(lat,lng)` returns "N
applications within 800m in the last 3 years" + the recent few. `GET
/api/enrichment` returns `development`; the listing shows a "Development activity
nearby" card. Import: `npx tsx scripts/import-toronto-dev-apps.ts`.

**Coordinate gotcha (verified):** the dataset's X/Y are **MTM Zone 10** (Ontario)
easting/northing in metres — NOT UTM 17N. `shared/torontoMtm.ts` reprojects to
WGS84 (validated: 3920/3920 geocoded records land inside Toronto; 1001 Sheppard
Ave → 43.771, -79.375).

## Toronto parcels (lot size)

Toronto has no open assessment roll (MPAC is licensed), so the parcel fabric is
the lot-size source. The "Property Boundaries – 4326" CSV ships each parcel as a
WGS84 GeoJSON MultiPolygon + STATEDAREA ("271.68 sq.m"). `shared/parcels.ts`
parses it; `toronto_parcels` stores geometry + bbox; `resolveParcel(lat,lng)`
matches a listing by point-in-polygon and returns the lot area. `GET
/api/enrichment` returns `parcel`; the listing shows a "Lot size" card (Toronto,
where the assessment roll didn't supply one). Import:
`npx tsx scripts/import-toronto-parcels.ts` (~500k parcels, streamed).
Follow-up: frontend/depth via an oriented-bounding-box heuristic on the polygon
(unlocks lot-split feasibility); STATEDAREA already gives area.

## Toronto ward boundaries

25-ward model (open.toronto.ca, already EPSG:4326 GeoJSON) into `municipal_wards`;
`resolveWard(lat,lng)` uses the same bbox + point-in-polygon pattern as the
census layer. `GET /api/enrichment` now returns `ward: {city, code, name}` and
the neighbourhood card shows it. Import: `npx tsx scripts/import-toronto-wards.ts`.
This is the verified geography the multiplex underwriter needs to replace its
FSA-inferred sixplex-ward heuristic (By-law 654-2025) — that wiring is the
follow-up.

## Follow-ups (workplan §3)

- Render neighbourhood facts into the listing SEO bot fallback + JSON-LD
  (`listingSeo.ts`) so the unique content is crawlable.
- Analyzer prefill from `GET /api/enrichment`.
- Next layers on the same spine: NS/Winnipeg/Calgary/Edmonton assessment
  rolls (same assessment_units table, new source value), more permit cities
  (Toronto/Ottawa/Edmonton/Winnipeg adapters), climate screeners, Montréal
  parcel geometry (joins the roll by matricule).
