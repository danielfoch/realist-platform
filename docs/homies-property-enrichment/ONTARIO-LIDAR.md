# Original Ontario lidar package references

Audited October 3, 2026. `ontarioLidarCoverageReference` reads the separately
licensed original Ontario DTM package index, independently of Oxford County's
mixed contours. The original count returned **420 overlapping download-package
polygons**; these are not lidar pixels, properties, data points or imports.

The active [Ontario catalogue](https://data.ontario.ca/en/dataset/ontario-digital-terrain-model-lidar-derived)
offers an English [original GeoHub map](https://geohub.lio.gov.on.ca/datasets/mnrf::ontario-digital-terrain-model-lidar-derived).
Before records or counts, verify the complete Ontario OGL body, exact active
catalogue/resource/offer, original map `776819a7a0de42f3b75e40527cc36a0a`, original
index `ae2f11bd9e0e473080a4c5ded9ff93da`, both explicit grants, publisher
`OntarioProvincialMapping`/org `TJH5KDher0W13Kgo`, map-to-index binding, root
service item and typed polygon child 0. Failure stops records/counts.

An independent suitable Ontario building/civic point or caller coordinate is
required. Return selected package/project labels and reported raster resolution
in metres only. The fixed query is attributes-only, ordered by OBJECTID, capped
at 51 with at most 50 displayed. Multiple complete overlapping packages are
valid source references, retained together; capped results remain ambiguous.
The native complete empty response omits fields and is supported only with the
expected OBJECTID identity. Empty results do not establish property-wide absence.

The sample point at 43.13, −80.748 returned Lake Erie L / OMAFRA Lidar 2016–18
and UpperThamesGrandRiver-DTM-05 / DEDSFM Upper Thames–Grand River 2025, both
reporting 0.5-metre resolution. Hamilton returned Hamilton–Niagara 2021 and the
Kawartha sample returned Kawartha Lakes 2023. These are sample coordinates and
raw package/project labels, not assigned address identities or verified flight
dates. Resolution is not vertical/horizontal accuracy or a property measurement.

The simplified package index does not verify actual raster coverage, current
ground condition, numeric elevation, slope, building height, contours or any
regulatory/flood screen. `rasterSamplePerformed=false`,
`actualRasterCoverageVerified=false`, `elevationM=null` and
`parcelWideScreenPerformed=false` are explicit. No source geometry, download URLs
or raster pixels are reused. Direct original raster catalogue and identify
sample operations timed out; raster sampling remains unintegrated.

Keep the historical catalogue resource range (2014–2019), item modification and
published index data-edit epochs separate from acquisition/observation dates.
The original technical guide describes metres and project-dependent vertical
datums; the raster service advertises CGVD2013 height. These audited metadata
statements do not validate a pixel sample or a property's surveyed level. Obtain
original project metadata/actual coverage and a current engineering survey before
terrain analysis. The provincial reference is shared once and never marks a
municipal market complete.
