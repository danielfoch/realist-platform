# Property forensics release

The public `/api/property/skill` prompt starts with “Create a property forensics report for me.” It asks only for a missing property address, enriches it, and delegates one complete report job through Homies `manage-agents` (`tasks` objects with `name`/`prompt`). The worker follows the existing brand → brief → file → design review → share protocol. It returns the actual `share_artifact` URL; revisions use `update_artifact` and preserve the link. No native Homies harness change is included. Contract checked against `homies-web/app/agent/prompts.py`, the design/share-artifact/manage-agents manifests, design handler and artifact service. Native publishing remains controlled by Homies' runtime gate; it was not run from this Codex session.

## Evidence additions

- Toronto Heritage Register Q3 2026: 12,332 civic-address records. Part IV individual designation, Part V district designation and Listed remain distinct. Published dates, bylaws and district names retained.
- Licensed TRCA RegulationLimit_2025: live, cached point intersections with contributing criteria. Conceptual point screen; not parcel-wide mapping or proof of flood safety. Positive record 1 and valid empty-result controls checked against independent source geometry.
- Toronto development: 26,613 application-site records. Group by application number, nearest site, approximate straight-line distance within 800 m, published status and conservative stage. Recent inactive histories (36 months) plus older non-closed/unknown records. Non-closed does not establish ongoing activity; closed does not establish built. Unlocated records and output truncation are disclosed.
- Pre-showing `brief`: supported findings, seller questions, document requests, explicit gaps. Listing discrepancies remain unassessed until a listing is supplied in the consuming harness.
- Printable fallback `/api/property/report`: self-contained HTML, escaped source text, full returned evidence and attribution. Saved artifacts remain dated snapshots.

## Refresh

Six public snapshots total 80,512 source records: rental buildings 3,611; evaluations 6,842; Brampton additional units 30,539; Brampton heritage 575; Toronto heritage 12,332; Toronto development 26,613. These are dataset rows, not unique homes or field counts.

`GET /api/cron/property-refresh`, daily `15 8 * * *` (08:15 UTC), uses the existing `CRON_SECRET`. `POST` uses a dedicated `PROPERTY_REFRESH_SECRET` for scoped operator verification; consumer requests require neither. No production environment bundle was downloaded.

Each feed validates schema, rights, complete pagination, unique IDs and source version/count stability. A 10-minute lease prevents competing workers; atomic SQL replaces the snapshot and health together. Fetch/schema/publication failures retain the last good payload. API caches loaded snapshots for five minutes and retains traced compiled assets as a DB-outage fallback. Coverage shows actual delivery, source vintage and refresh health. National/assessment/permit bulk imports keep separate registry cadences; this daily job does not reimport them. Only two new property snapshot/health tables are bootstrapped; no platform schema push.

## Validation and pilot

110 relevant property/underwriting tests pass, with real PostgreSQL tests for publication/lease/failure retention; TypeScript, scoped ESLint, local webpack and hosted Turbopack builds pass. Hosted report passed the harness's actual static HTML reviewer and was opened in the browser. Live source refresh succeeded for all six feeds; deployed cron metadata confirms the schedule.

The 100-property pilot uses 25 distinct civic properties per four official source strata, with expected IDs captured before calls. It tests retrieval of known records and reports layer coverage and latency. It is not a representative Ontario coverage or all-field accuracy estimate. A separate 10-property automated heritage-retrieval benchmark measures fresh export download/scan versus enrichment latency, not human realtor time. Full pilot artifacts are in the task's durable output folder.

## Census quality finding and verified rebuild

The pre-existing Census importer used several adjacent characteristic codes incorrectly (e.g. 57 = persons in private households, while 56 = average household size). The corrected mapping is bound to official CL_CHARACTERISTIC 1.3 English definitions, tested and prepared in `lib/property/ingest/census.ts` and `scripts/property/import.mts`.

The public property API withholds profiles without verified mapping provenance or passing consistency checks. After explicit user approval on 2026-10-02, all 57,936 profiles were rebuilt from the corrected mapping. The live report now returns the verified Census context. Suppressed values remain null, with their source flags; 1,800 areas have a suppressed/unpublished average household size. Census statistics describe an area in 2021, with income reference year 2020, rather than the subject property or household.

The operator workflow in `scripts/property/census-rebuild.mts` saves an exact rollback snapshot of profiles and Census registry/import metadata in a read-only repeatable-read transaction. The importer supports `--census-candidate-file` without `--write`: it fetches and validates all 33 characteristic definitions/extracts, rejects changed series/geographies/duplicates/incomplete fields and contradictory counts, and saves a compressed candidate without database mutation. Publication requires `--write`, a verified rollback checksum, the identical 57,936 DA IDs, and unchanged database contents since backup. Temporary staging and the profile/registry/import-health update run in one database transaction; no rows are deleted, no persistent staging table is created and no schema push runs. Only the required database connection was retrieved; no production secret bundle.

The rebuild processed 1,911,888 source observations. Every profile has verified mapping provenance, and no household average exceeds the quality range. Independent Python comparison of the public results against the source CSVs matched all 264 values and 264 suppression flags across eight areas. A ninth property correctly skipped Census because it had no resolved coordinates. The refreshed live HTML report passed the actual Homies static reviewer. Seventeen targeted Census/imported-layer tests, TypeScript and scoped lint passed for this follow-up.

Rollback/candidate/publication manifests and evidence are saved in the Homies workspace under `outputs/census-rebuild-2026-10-02`. The rollback file's SHA-256 is `8de81971ee55652ee559ab38cef7d85060dec1189f3ec32817cf43103af3c2c5`. Keep that copy and its metadata together. A later rebuild needs fresh scope authorization, a new backup and a fully validated candidate; do not silently republish legacy profiles.
