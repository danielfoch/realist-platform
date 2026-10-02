# Public property data imports

The API uses Realist's existing Neon database and Vercel project. These imports
are additive and explicit: `--write` is required. A lookup never imports data or
changes property records. Tables are registered in `lib/db/schema/property.ts`
and re-exported through the platform schema.

Supply `DATABASE_URL` through a trusted server environment, or a mode-0600 file
with `--database-url-file=/absolute/path`. The default local credential file is
`/private/tmp/realist-import-database-url`; never commit it. Only this database
credential is needed. Do not export a broad production environment.

```sh
npx tsx scripts/property/import.mts migrate --write
npx tsx scripts/property/import.mts municipal --write
npx tsx scripts/property/import.mts quebec --write
npx tsx scripts/property/import.mts csv --write
npx tsx scripts/property/import.mts ns-details --write
npx tsx scripts/property/import.mts vancouver-tax --write
npx tsx scripts/property/import.mts toronto --write
npx tsx scripts/property/import.mts census-profiles --write
npx tsx scripts/property/import.mts census-boundaries --write
npx tsx scripts/property/import.mts status
```

Use `--feeds=calgary,winnipeg,edmonton,ns,nb,calgary-permits` for municipal
subsets; CSV and Toronto modes also accept subsets. `--restart` starts a
Socrata or Québec import from its beginning. `--refresh` downloads a fresh
CSV/XML source instead of reusing the cached snapshot. Use both for a Québec
refresh. CSV reruns upsert the cached source unless `--refresh` is supplied.
Existing records are preserved: these commands do not prune withdrawn records.
This release is a snapshot, and refreshes are manual.

Downloads use approved government hosts. CSV/XML sources have URL, size,
download date, ETag/Last-Modified where available, and SHA-256 manifests in
`--cache` (default `/private/tmp/realist-open-data`). Government descriptions
are untrusted data. Mappers explicitly select physical property fields and
exclude owner, applicant and contact fields; no complete source row is stored.

Socrata counts and update timestamps are checked around stable pagination.
Checkpoints advance after successful writes. Québec and NAR keep per-file
completion markers; partially written files can be rerun safely. Large feeds
stream with bounded batches. Failures remain in `property_import_runs` and
completed sources have attribution in `data_layers`.

## National Address Register

Download Statistics Canada's **June 2026** archive from
https://www150.statcan.gc.ca/n1/pub/46-26-0002/2022001/202606.zip into the cache
as `nar-202606.zip`, record its SHA-256 manifest, then run:

```sh
npx tsx scripts/property/import.mts national-addresses --write
```

Python 3's standard library streams the 50 archive members and checks ZIP CRCs.
Locations precede addresses. Natural building and address UUIDs are retained;
building coordinates and blockface coordinates stay separate. The release is
registered only after every member completes. The importer is pinned to this
release; a future quarterly release requires updating its reference date,
archive and registry version together. Do not label another archive June 2026.

## Census archive fallback

The geographic API fails on very large northern polygons. The official archive
can recover missing boundaries. Install the three GIS readers in a temporary
directory, then use:

```sh
python3 -m pip install --target /private/tmp/realist-python-deps pyshp pyproj shapely
npx tsx scripts/property/import.mts census-boundary-archive --write
```

The fallback uses the official source projection, simplifies only recovered
geometry at **10 metres** while preserving topology, and stores the tolerance
in `simplification_m`. The API exposes `boundarySimplificationM`. The source
archive remains intact. Polygon boundary proximity and approximate geocodes
must be verified for decisions on a specific property.

The 2021 housing/income/population profile uses 33 official characteristics,
including dwelling mix and construction periods. Suppressed values remain null.
Four published profile areas have no boundary and no population observation;
they remain in the profile table and do not create guessed polygons.
