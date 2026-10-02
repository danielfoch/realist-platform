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

## Census quality finding and approval-required rebuild

The pre-existing Census importer used several adjacent characteristic codes incorrectly (e.g. 57 = persons in private households, while 56 = average household size). The corrected mapping is bound to official CL_CHARACTERISTIC 1.3 English definitions, tested and prepared in `lib/property/ingest/census.ts` and `scripts/property/import.mts`.

The public property API withholds profiles without verified mapping provenance or passing consistency checks. The existing 57,936 Census profile rows were not rewritten. Automatic approval review rejected that broad production overwrite without explicit approval of the mutation/scope. The live report shows the Census gap; it does not expose the suspect numbers.

To rebuild after approval: first preserve an exact rollback copy of `census_da_profiles` and its registry/import metadata, validate source definitions and candidate row completeness, run the corrected scoped importer, verify source-based samples/flags and profile counts, then confirm availability through the API. Do not run a general schema push, retrieve bulk secrets or silently republish legacy profiles. Rebuild is a separate approval step from this deployed release.
