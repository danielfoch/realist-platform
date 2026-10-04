# Original Ontario lot and township references

Two independently licensed provincial feeds help a realtor locate original Crown survey records using the geographic township, lot and concession. These names can differ from current municipal names.

| API layer | Original typed child | Observed source rows, October 4, 2026 UTC |
| --- | --- | ---: |
| `ontarioLotFabricReference` | LIO_Open06/MapServer/2 | 292,826 |
| `ontarioGeographicTownshipReference` | LIO_Open06/MapServer/1 | 2,528 |

The 295,354 rows are overlapping reference polygons, not unique properties, modern parcels, field data points or imported rows. French duplicate offers are excluded. Read live coverage health and counts instead of treating this dated count as permanent.

## Original source and grant

The [Lot fabric improved catalogue](https://data.ontario.ca/en/dataset/lot-fabric-improved) identifies package `2af8a864-72c5-4714-9f66-66f6dd01c43e` and English resource `f8abaf9f-3e97-405a-9e06-bfcca3c9fd39`. Its native [resource offer](https://geohub.lio.gov.on.ca/datasets/lot-fabric-improved) identifies original item `960b8dccf21740e99448e47941ee84d6`, child 2.

The [Geographic Township Improved catalogue](https://data.ontario.ca/en/dataset/geographic-township-improved) identifies package `f4a8f715-894b-4b70-8244-7f5b4ca75876` and English resource `ff861d02-dc4d-46da-87dd-e28de58ce96a`. Its native [resource offer](https://geohub.lio.gov.on.ca/datasets/geographic-township-improved) identifies item `a159cf53aefb46ac806cda5c5f79792c`, child 1.

Both original items are public, published by `LandInformationOntario`, org `a03W7iZ8T3s5vB7p`, with specific [Open Government Licence – Ontario](https://www.ontario.ca/page/open-government-licence-ontario) grants. The API checks the full audited grant-body fingerprint before reading service metadata, then exact active catalogue/resource/offer, item publisher/grant, originating MapServer URL, root `service06`, typed polygon child, ordering capability and selected field types before records or counts. A changed grant, lineage, schema or failed source leaves that feed unavailable. Fixed HTTPS hosts, redirect rejection, bounded response size/time and a one-hour cache apply.

The native publisher data descriptions and the February 2015 shared lot/township FAQ were inspected, including visual checks of field definitions and boundary limitations. The township-specific FAQ offer returned 404; no alternative was guessed. The shared lot FAQ explicitly covers both fabrics.

## Property scope

Only independently suitable Ontario building/civic points or caller-supplied coordinates are queried. Original fabric never geocodes an address or verifies present municipal containment. Queries return source attributes for polygon intersections with that point, at most 51 rows ordered by OBJECTID with 50 displayed. No polygon geometry, calculated area, location-description or general-comment free text is returned. Multiple candidates and capped results are ambiguous; a complete empty source query does not establish property-wide absence. `queryCoverageComplete` describes the bounded query; `coverageComplete=false` preserves the incomplete property scope.

Lot/concession/township/survey-system labels, source accuracy, road-allowance, verification and annulment labels remain raw reported observations. The rural sample near Lindsay reports `LOT 26`, `CON 5`, `OPS`, accuracy `Within 100 metres`, `Verified`, and a null road-allowance flag. The source's verification flag describes geographic-unit verification, not an independent legal survey or current approval. A null flag is unknown, not no road allowance or no annulment.

Original geographic fabric is separate from modern parcel/PIN/title, current municipal jurisdiction and legal description. It does not establish boundaries on the ground, surveyed lot area/frontage, shoreline ownership, road closure/conveyance, legal/year-round access, maintained road, severance, permitted use or development rights. Fabric can end at the water's edge, and private patent subdivisions can be absent. Obtain current surveys/title instruments and original Crown plans where useful.

## Dates and reporting

Raw geometry-update, record-effective, system and verification epoch timestamps remain separate. Their timezone and live observation vintage are unverified; `sourceUpdatedAt=null`. Catalogue publication/range dates and catalogue/item metadata edits are not current survey, legal-validity or observation dates. Reports include source attribution, dates, every candidate, explicit gaps, survey/title document requests and seller questions. The short Homies starter remains one click and creates a native shareable artifact through the existing `fs_write` / `share_artifact` workflow.
