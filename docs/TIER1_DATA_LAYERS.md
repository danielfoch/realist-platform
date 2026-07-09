# Tier 1 investor data layers (Toronto-first)

Turns the multiplex feasibility engine from heuristic (user-typed lot + guessed
coverage + FSA-based sixplex) into **verified** where open data exists. Every
layer follows the existing `torontoGeo`/`enrichment` pattern: self-migrating
tables, bbox-prefilter + point-in-polygon in JS (no PostGIS), a `data_layers`
registry row for freshness/licence, graceful degradation when a layer is not
imported. Licence for all Toronto sources: **Open Government Licence – Toronto**
(commercial use OK with attribution).

All endpoints/field names below were **live-verified** on 2026-07-07.

## Layer A — Zoning overlays + wards + provincial ARU override (`server/torontoZoning.ts`)

Toronto CKAN datastore (`ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action`),
`datastore_search` paginates records whose `geometry` is a GeoJSON string.

| Layer | resource_id | key fields |
|---|---|---|
| Zoning Area | `76a2620f-a6b4-495d-8e41-c0ede1f8a928` | `ZN_ZONE` (code text), `GEN_ZONE` (category int), `FRONTAGE`,`ZN_AREA`,`UNITS`,`COVERAGE`,`FSI_TOTAL` (−1 = n/a), `ZBL_CHAPT`,`ZBL_SECTN` |
| Height Overlay | `f0a88d06-2430-4025-b15d-362cabd00f31` | `HT_LABEL` (max height m), `HT_STORIES` (−1 = n/a), `HT_STRING` |
| Lot Coverage Overlay | `58ad8814-ca4e-43d6-848d-d5fd8d873574` | `PRCNT_CVER` (max coverage %) |
| City Wards | pkg `city-wards`, GeoJSON 4326 resource | `AREA_NAME`/`AREA_SHORT_CODE` (ward #) |

- **Sixplex** (By-law 654-2025 / OPA 818, council item 2025.PH22.4, in force 2025-06-25):
  5–6 units as-of-right in wards **4, 9, 10, 11, 12, 13, 14, 19, 23** only.
  Replace the FSA heuristic with point-in-ward-polygon → exact ward number.
- **O.Reg 462/24** (amends O.Reg 299/19; ARU standards on "parcels of urban
  residential land"): provincial floor that **overrides stricter municipal
  zoning** — ≥45% lot coverage, no angular plane, reduced setbacks, max 1
  parking/ARU. Engine computes `max(municipal coverage, 0.45)` for ARU scenarios.

## Layer B — Parcel fabric + derived lot metrics (`server/parcels.ts`)

- **Property Boundaries** — pkg `property-boundaries`, "Property Boundaries -
  4326.geojson", WGS84 polygons, carries `GEO_ID` (parcel id joins permits).
- Derived per parcel via `shared/geoGeometry`: `geometryAreaSqMeters`,
  `minimumRotatedRect` (frontage=shorter, depth=longer), corner-lot (adjacency
  to ≥2 street centrelines), lane-access (`minDistanceToPolylineMeters` to a
  Toronto Centreline laneway ≤ ~6 m). Precision: "compiled, not a plan of
  survey" — screen with it, verify with a survey; surfaced as `basis`.

## Layer C — Permits + Committee of Adjustment precedent (`server/precedents.ts`)

Permits/CoA carry **street address but no coordinates** → geocode at import time
against **Address Points** (pkg `address-points-...`, datastore
`0b3756af-9caf-4f0f-ac28-9c6617adede4`: `ADDRESS_FULL`,`ADDRESS_NUMBER`,
`LINEAR_NAME_FULL`,`WARD`,`WARD_NAME`, Point geometry). Address Points have **no
`GEO_ID`** — join is on normalized address, not GEO_ID.

| Source | resource_id | unit signal | decision |
|---|---|---|---|
| Building permits (cleared) | `a96c0ba4-3026-402b-b09d-5b1268b8f810` | `DWELLING_UNITS_CREATED`/`_LOST`, `STRUCTURE_TYPE`,`WORK`,`PERMIT_TYPE`,`CURRENT_USE`/`PROPOSED_USE`,`STATUS`,`EST_CONST_COST`, dates | — |
| Building permits (active) | pkg `building-permits-active-permits` | same schema | — |
| Committee of Adjustment | `51fd09cd-99d6-430a-9d42-c24a937b0cb0` | `NUMBER_OF_LOTS_CREATED`,`APPLICATION_TYPE`,`WORK_TYPE`,`SUB_TYPE` | `C_OF_A_DESCISION` (sic), `OMB_DESCISION`, `HEARING_DATE` |

Feature: "N unit-adding permits and an M% variance-approval rate within R metres."
Filter permits on `DWELLING_UNITS_CREATED >= 1`.

## Layer D — Conservation registry + heritage re-source (`server/conservation.ts`)

- Registry of per-CA ArcGIS regulated-area feature services, point-intersect
  (same live-query pattern as the current TRCA screen), `geo_screen_cache` TTL,
  graceful degradation. **Verified:** TRCA
  `services1.arcgis.com/d0ZCwU7eGKVeNiEE/.../TRCA_Regulation_Limit2/FeatureServer/0`
  (also a "Generic_Regulations_Limit_2025" layer on the same org). Others (CVC,
  Halton, CLOCA, LSRCA, GRCA, HCA) added as endpoints with `available` flags.
- **Heritage**: the CKAN `heritage-register` open dataset was **retired
  Oct 2025** — the ingested `toronto_heritage_properties` copy is stale. New
  importer sources from the live Heritage Property Search backing service.
