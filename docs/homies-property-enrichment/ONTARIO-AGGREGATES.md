# Ontario nearby pit and quarry context

Three independent layers add published Aggregate Resources Act (ARA) authorization polygons near a suitable Ontario point:

| API layer | Original typed child | Observed rows, October 4, 2026 UTC |
| --- | --- | ---: |
| `ontarioAggregateActiveSites` | LIO_Open05/MapServer/17 | 5,591 |
| `ontarioAggregateInactiveSites` | LIO_Open05/MapServer/16 | 2,794 |
| `ontarioAggregatePartialSurrender` | LIO_Open05/MapServer/23 | 78 |

The 8,463 rows are overlapping source polygons, not unique sites, authorizations, properties, imports or field data points. Different polygons can share an ALPS authorization ID. French duplicate catalogue items are excluded.

A realtor can use the result to ask about nearby pit/quarry authorizations and obtain relevant site plans and property investigations. It does not establish actual extraction, noise, dust, blasting, trucks, water quality, contamination, health effects, value or development permission.

## Origin and rights

The original [Ontario catalogue](https://data.ontario.ca/en/dataset/aggregate-site-authorized), package `69b95513-a28a-4d0c-b70c-483ea17882f3`, explicitly binds the three English resources to the [Open Government Licence – Ontario](https://www.ontario.ca/page/open-government-licence-ontario). Resources are `06de3b90-e453-4871-9f48-bf2f68fd23cb`, `c8d36603-2c3f-42ef-9935-925caaedc06a`, and `15b92ab7-563c-44d3-a92d-b31bfdbf3247`.

The original offered LIO items are:

- [Active](https://geohub.lio.gov.on.ca/datasets/874e7fa67ce94cc5b1e8e98c59ca06eb_17)
- [Inactive](https://geohub.lio.gov.on.ca/datasets/b83d0aef05fa49da9e12288bdb36992b_16)
- [Partial surrender](https://geohub.lio.gov.on.ca/datasets/4a83d157a2c24b4b9f32266d997e3632_23)

Each item has publisher `LandInformationOntario`, org `a03W7iZ8T3s5vB7p`, public access and a specific OGL Ontario link. Despite item type `Feature Service`, each item URL explicitly identifies its original **MapServer child**, which is preserved. Root `service05`, child identity/name/polygon type, child copyright, selected field types, distance-query and ordering capabilities are checked before records/counts are queried. The complete current Ontario grant text must match the audited fingerprint; a changed grant, catalogue binding, item or schema fails closed. Fixed HTTPS original URLs, redirect rejection, eight-second HTTP timeouts, one-hour cache and one-megabyte response caps apply.

The publisher-offered data descriptions were inspected, including the active version's status definitions and location-accuracy vocabulary, the inactive version's attribute definitions and the partial-surrender version's historical-area distinction. The general Aggregate Layers User Guide exceeded the source-audit size cap and was not read; no facts are derived from it. Documentation versions (2013 active, 2020 inactive/partial) are distinct from current live metadata.

## Query and interpretation

Only caller-supplied or independently resolved civic/building points with an explicit Ontario province and valid Ontario coordinate bounds are eligible. Street-interpolated, ambiguous, missing and out-of-bounds points are skipped. A source polygon query selects intersections with a 2,000-metre buffer around the point; no polygon geometry is returned in property responses. This is **nearby context**: surveyed parcel overlap, exact site distance and nearest ranking are not established. Source accuracy can be much poorer than the query radius.

Each child queries at most 51 rows, ordered by source OBJECTID, and displays at most 50. Transfer-limit or 51-row results are incomplete and appear as report gaps. An empty incomplete response cannot establish no match. Complete empty responses mean no returned match in this source/query only; MTO operations, non-ARA operations and unrecorded sites are outside the source.

Reported OBJECTID, OGF_ID and ALPS_ID remain separate identities. Raw current status, operation/authority type, water-status label and source location accuracy are preserved. Tonnage is a reported authorization limit in metric tonnes, not production or truck trips. Null limits do not imply unlimited extraction; preserve the separate raw indicator. Licensed hectares are reported authorized area, not measured extraction footprint or subject lot area. Client names and source-detail free text are excluded from queries and outputs.

The active data description can include applications; the raw source status governs the reported observation. Active authorization does not mean extraction is occurring and can encompass suspended authorization codes. Application does not establish issuance. Inactive Revoked/Surrendered labels do not independently verify present rehabilitation or safe redevelopment. Partial surrender is historical area released from a larger licensed/permitted site; it is not an ALPS Current Status value, and its record can retain ACTIVE status for the parent authorization. Do not merge these categories or infer the whole site's status from a partial polygon.

## Dates and reports

Raw `EFFECTIVE_DATETIME` and `SYSTEM_DATETIME` ArcGIS numbers are preserved with timezone unverified. The former is a source record creation/modification field, not verified observation, approval or extraction date. Catalogue resource date July 2, 2013 and range 1990–December 5, 2006, catalogue metadata edit, ArcGIS item metadata edit and retrieval timestamp remain separate. None is used as a verified live observation date; `sourceUpdatedAt` is null.

The API brief and Homies skill ask for current Ministry/City authorizations and approved site plans, relevant seller/professional investigations and current planning requirements. HTML/native Homies artifacts render full separate layer statuses, records, dates, sources and gaps. Municipal market completion remains unproven.

## Separate abandoned-mine source

[Ontario AMIS](https://data.ontario.ca/dataset/abandoned-mines-information) is labelled King's Printer copyright. Its original offered GeologyOntario page links [complete MEM terms](https://www.geologyontario.mines.gov.on.ca/mmd/mines/ogs/mem-disclaimer-terms_of_use_en.pdf), requiring prior written permission for commercial/value-added use. No AMIS records, KML, counts or geometry were queried or integrated. Timmins exposes this as a withheld gap. The independently licensed aggregate feeds are neither AMIS nor mining claims and do not constitute a complete extractive-industry screen.
