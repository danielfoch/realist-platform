# Property forensics release

The public `/api/property/skill` prompt starts with “Create a property forensics report for me.” It asks only for a missing property address, enriches it, and delegates one complete report job through Homies `manage-agents` (`tasks` objects with `name`/`prompt`). The worker follows the existing brand → brief → file → design review → share protocol. It returns the actual `share_artifact` URL; revisions use `update_artifact` and preserve the link. No native Homies harness change is included. Contract checked against `homies-web/app/agent/prompts.py`, the design/share-artifact/manage-agents manifests, design handler and artifact service. Native publishing remains controlled by Homies' runtime gate; it was not run from this Codex session.

## Evidence additions

- Toronto Heritage Register Q3 2026: 12,332 civic-address records. Part IV individual designation, Part V district designation and Listed remain distinct. Published dates, bylaws and district names retained.
- Licensed TRCA RegulationLimit_2025: live, cached point intersections with contributing criteria. Conceptual point screen; not parcel-wide mapping or proof of flood safety. Positive record 1 and valid empty-result controls checked against independent source geometry.
- Toronto development: 26,613 application-site records. Group by application number, nearest site, approximate straight-line distance within 800 m, published status and conservative stage. Recent inactive histories (36 months) plus older non-closed/unknown records. Non-closed does not establish ongoing activity; closed does not establish built. Unlocated records and output truncation are disclosed.
- Pre-showing `brief`: supported findings, seller questions, document requests, explicit gaps. Listing discrepancies remain unassessed until a listing is supplied in the consuming harness.
- Printable fallback `/api/property/report`: self-contained HTML, escaped source text, full returned evidence and attribution. Saved artifacts remain dated snapshots.

## Refresh

Eight public snapshots total 95,983 source records: rental buildings 3,611; evaluations 6,842; Brampton additional units 30,539; Brampton heritage 575; Toronto heritage 12,332; Toronto development 26,613; Hamilton heritage 10,273; Hamilton development 5,198. These are dataset rows, not unique homes or field counts. Counts/vintages are the 2026-10-02 release baseline; read coverage for later refreshes.

`GET /api/cron/property-refresh`, daily `15 8 * * *` (08:15 UTC), uses the existing `CRON_SECRET`. `POST` uses a dedicated `PROPERTY_REFRESH_SECRET` for scoped operator verification; consumer requests require neither. No production environment bundle was downloaded.

Each feed validates schema, rights, complete pagination, unique IDs and source version/count stability. A 10-minute lease prevents competing workers; atomic SQL replaces the snapshot and health together. Fetch/schema/publication failures retain the last good payload. API caches loaded snapshots for five minutes and retains traced compiled assets as a DB-outage fallback. Coverage shows actual delivery, source vintage and refresh health. National/assessment/permit bulk imports keep separate registry cadences; this daily job does not reimport them. Only two new property snapshot/health tables are bootstrapped; no platform schema push.

## Hamilton extension

Eleven enabled official OpenHamilton feeds are bound to the City's organisation, public item owner, exact service endpoint and explicit redistribution licence. Attribution: “Contains public sector Data made available under the City of Hamilton’s Open Data Licence”. The source catalogue is linked per dataset in the response.

| Feed | Published dataset records | Delivery | Published update date |
| --- | ---: | --- | --- |
| Civic addresses | 274,719 | Bounded live matching | 2026-10-02 |
| Heritage properties | 10,273 | Complete daily snapshot | 2026-09-26 |
| Development applications | 5,198 | Complete daily snapshot | 2026-09-09 |
| Zoning polygons | 11,859 | Live point query | 2026-09-26 |
| Environmentally sensitive areas | 207 | Live point query | 2026-09-09 |
| Ward boundaries | 15 | Live point query | 2025-12-03 |
| Permits: 2017 to Present (source title) | 51,846 | Historical address query | 2024-02-05 |
| Permits: 2008 to 2016 (source title) | 142,620 | Historical address query | 2024-01-09 |
| Historic conservation-grant payments | 25 | Complete bounded table / exact civic community match | 2023-10-23 |
| Rural settlement boundaries | 19 | Live point query | 2024-01-08 |
| Wastewater catchments | 2 | Live point query | 2026-09-06 |

These 496,783 published records are across eleven enabled datasets, not distinct properties, field counts or bulk-imported rows. Only the 15,471 heritage/development rows are new persisted snapshot assets. Live feeds use a one-hour cache. Heritage/development snapshots participate in the existing daily 08:15 UTC job, including complete ID pagination, field allowlists, WGS84 points, before/after item/ID/edit-date checks and last-good retention. ArcGIS request batches are 100 IDs to remain within its URL gateway limit.

Municipal matching checks civic number, exact street/type/direction, Ontario jurisdiction and former community. Waterdown can resolve to published Flamborough community records. Multiple communities or points spanning more than 20 metres remain ambiguous. The municipal location is labelled a civic-address point, not a surveyed parcel or verified building centroid. Permit street abbreviations that omit types/directions are accepted only if uniquely resolved by this register; community is checked independently. Unit records remain building-level evidence.

Heritage includes Inventoried, Registered Non-Designated and Designated with Part IV/Part V fields. Unexplained `DATE_HERITAGE` years retain their published label; they are not claimed as construction or designation dates. Address ranges and uncertain identities remain ambiguous. Exact civic-address candidates whose heritage/civic points differ by more than 100 metres are retained as ambiguous with the separation shown; rural address points can be entrances far from a building. The current bylaw/district effective date still requires City confirmation. Development searches all published file years within 800 m and groups application numbers across sites. This feed has no stage, approval or submission-date field, so stage stays unknown and file year is not evidence of current activity.

Zoning retains all returned parent bylaws, zone codes/descriptions, exception/holding fields and published date fields. Hamilton has seven bylaws; GIS is a point screen, not zoning verification or a permission conclusion. Environmental sensitivity is City natural-heritage context, separate from conservation-authority regulation, flood safety or contaminated-site records. Interpolated streets are not used for these point screens. Both permit feeds retain their separate dates, status, failures and truncation. Their titles do not establish present coverage, and Closed/completed does not independently establish final inspection or occupancy.

The hosted report prompt and its checked-in copy include the Hamilton workflow. The report appendix includes every new field and layer; the pre-showing brief adds zoning verification and natural-heritage document requests. No native Homies runtime changes are needed for this endpoint extension.

## Hamilton planning follow-up

The grant layer reports historical payment years/amounts and the construction value of grant-supported work in CAD; it does not establish current funding eligibility, property value or completion. Municipal community is required for an unambiguous grant match. Rural settlement records retain official/unofficial boundary status; point intersection does not establish lot creation or development rights. Wastewater catchments identify the mapped treatment system; connection, capacity and septic status remain unverified.

Ontario LIO Open06 supplies three explicitly OGL-licensed polygon sources: Greenbelt Designation (90 rows), Niagara Escarpment Plan Boundary (12) and Plan Designation (1,211). These 1,313 published rows are separate from Hamilton's municipal count; no bulk provincial import is added. All are preliminary point screens. The service publishes no dataset observation timestamp; sourceUpdatedAt stays null, while effective/system/geometry date fields are retained. LOCATION_ACCURACY can be within 1,000 or 10,000 metres, which cannot verify an individual lot. Niagara Escarpment Plan area is distinct from development-control area; the latter and municipal official-plan land-use are explicitly unsearched. Legal maps and current amendments require City/NEC confirmation. Nested failure statuses and incomplete coverage remain visible in the brief and full appendix.

Hamilton's quarterly planning item `6b8d72b7f3414bfda2529251e021255d` publishes 1,154 observations but has **blank licenceInfo**. Its future adapter binds owner/org/service/schema/explicit licence, bounds a complete 800 m query, keeps repeated application observations and decision/appeal fields separately, and never infers a current approval. Currently it returns unavailable with reuse rights unverified and an official source link; none of these records count toward enabled totals. Do not weaken the rights check merely because the endpoint is public. Aggregate application-processing timelines are not property decisions and are excluded.

Hamilton conservation coverage is an explicit unperformed review with links to HCA, Conservation Halton, NPCA and GRCA; authority jurisdiction is not inferred. [HCA mapper terms](https://conservationhamilton.ca/hca-map-tool-terms-of-use/) restrict commercial reuse, so no underlying mapper data is fetched or republished. City natural-heritage and provincial plan screens do not replace authority regulation/flood/permit review. Public parcel viewing layers were not ingested without verified third-party redistribution rights.

The hosted skill and checked-in copy retain the one-click starter and full native Homies artifact workflow. They include every new field, uncertainty and targeted document request. The current Hamilton+Ontario sources total 498,096 published dataset rows (496,783 municipal plus 1,313 provincial), not distinct properties, bulk imports or source attributes. Use live coverage for changing counts.

## Validation and pilot

110 relevant property/underwriting tests pass, with real PostgreSQL tests for publication/lease/failure retention; TypeScript, scoped ESLint, local webpack and hosted Turbopack builds pass. Hosted report passed the harness's actual static HTML reviewer and was opened in the browser. Live source refresh succeeded for all six feeds; deployed cron metadata confirms the schedule.

The 100-property pilot uses 25 distinct civic properties per four official source strata, with expected IDs captured before calls. It tests retrieval of known records and reports layer coverage and latency. It is not a representative Ontario coverage or all-field accuracy estimate. A separate 10-property automated heritage-retrieval benchmark measures fresh export download/scan versus enrichment latency, not human realtor time. Full pilot artifacts are in the task's durable output folder.

## Census quality finding and verified rebuild

The pre-existing Census importer used several adjacent characteristic codes incorrectly (e.g. 57 = persons in private households, while 56 = average household size). The corrected mapping is bound to official CL_CHARACTERISTIC 1.3 English definitions, tested and prepared in `lib/property/ingest/census.ts` and `scripts/property/import.mts`.

The public property API withholds profiles without verified mapping provenance or passing consistency checks. After explicit user approval on 2026-10-02, all 57,936 profiles were rebuilt from the corrected mapping. The live report now returns the verified Census context. Suppressed values remain null, with their source flags; 1,800 areas have a suppressed/unpublished average household size. Census statistics describe an area in 2021, with income reference year 2020, rather than the subject property or household.

The operator workflow in `scripts/property/census-rebuild.mts` saves an exact rollback snapshot of profiles and Census registry/import metadata in a read-only repeatable-read transaction. The importer supports `--census-candidate-file` without `--write`: it fetches and validates all 33 characteristic definitions/extracts, rejects changed series/geographies/duplicates/incomplete fields and contradictory counts, and saves a compressed candidate without database mutation. Publication requires `--write`, a verified rollback checksum, the identical 57,936 DA IDs, and unchanged database contents since backup. Temporary staging and the profile/registry/import-health update run in one database transaction; no rows are deleted, no persistent staging table is created and no schema push runs. Only the required database connection was retrieved; no production secret bundle.

The rebuild processed 1,911,888 source observations. Every profile has verified mapping provenance, and no household average exceeds the quality range. Independent Python comparison of the public results against the source CSVs matched all 264 values and 264 suppression flags across eight areas. A ninth property correctly skipped Census because it had no resolved coordinates. The refreshed live HTML report passed the actual Homies static reviewer. Seventeen targeted Census/imported-layer tests, TypeScript and scoped lint passed for this follow-up.

Rollback/candidate/publication manifests and evidence are saved in the Homies workspace under `outputs/census-rebuild-2026-10-02`. The rollback file's SHA-256 is `8de81971ee55652ee559ab38cef7d85060dec1189f3ec32817cf43103af3c2c5`. Keep that copy and its metadata together. A later rebuild needs fresh scope authorization, a new backup and a fully validated candidate; do not silently republish legacy profiles.
