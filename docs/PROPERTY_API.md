# Homies property enrichment

One public call in the active Realist platform:

```sh
curl --get 'https://realist-lean.vercel.app/api/property' \
  --data-urlencode 'address=15 Deermeade Pl SE, Calgary, AB'
```

No API key or account is required. A GET with no parameters returns instructions.
Optional `city` and `province` can be supplied separately. Optional verified `lat`
and `lng` must be supplied together (WGS84 decimal degrees). Unknown, duplicate,
blank-coordinate and malformed parameters return 400. Canada is the initial
coverage area; this endpoint looks up one property at a time.

- Skill: `/api/property/skill` — starter: **Enrich a property for me.**
- Coverage and imported-source registry: `/api/property/coverage`
- OpenAPI 3.1: `/api/property/openapi.json`

The skill collects a missing address conversationally. A member never edits a
URL or prompt placeholder. The endpoint works through a Homies HTTP/web-fetch
tool; native tool registration remains a separate harness change.

## Evidence contract

`data` is the compact result; `layers` is its evidence contract. Each layer
has `status`, `data`, `source`, `retrievedAt`, `sourceUpdatedAt`, and `note`.
Imported records may have `importedAt`. `available` and `missing` summarize the
layers. Partial/no-data results return 200: `success: true` means the lookup
completed, not that all property facts exist.

| Status | Meaning |
| --- | --- |
| `available` | Matching published information returned |
| `no_match` | Query succeeded without a match; does not prove absence |
| `not_supported` | No live adapter for this geography/layer |
| `not_loaded` | Existing import table or attribution entry is absent |
| `unavailable` | Source, database or source schema could not be read |
| `ambiguous` | Multiple possible properties or excessive candidates; no guess |
| `skipped` | Required address/location information is missing or insufficient |

Unknown numeric fields remain null. Money is CAD; area is m². Assessments are
not sold prices or current market estimates. Census figures describe an area,
not this property or household. Retrieval/import dates are not observation
dates. Assessment roll year is retained; valuation-reference dates are distinct
from source-update dates.

The June 2026 National Address Register resolves a unique published building
location by civic address, municipality and province. NRCan's replacement
Geolocator (`keys=locate`) supplies a fallback and verifies civic number, street
type, direction and municipality. Street and blockface coordinates stay
approximate. Parcel/zoning lookup requires a published building point or
caller-supplied verified coordinates. Unit-specific
matching returns 422 rather than stripping a suite and guessing its assessment.

## Coverage and existing Realist data

Live queries use the municipal datasets identified by Realist's original
adapters: Calgary/Winnipeg assessments, Edmonton assessments, Nova Scotia PVSC
dwelling characteristics, Calgary/Vancouver permits, and Toronto active/cleared
permits and variance applications. Field mappings were checked against small
published samples.

Read-only imported adapters use the legacy table shapes in the active app's
existing database: assessments, permits, CoA history, census boundaries/profiles,
Toronto parcels, wards, zoning and nearby development. No table is created,
truncated, migrated or bulk-imported by a lookup. A legacy Replit table is not
assumed to exist in lean's Neon database. Coverage reports what is present;
missing imports remain visible. The production release now contains complete
Québec and New Brunswick public rolls, major municipal assessments, Nova Scotia
and Vancouver assessment histories, four cities' permit archives, national
Census profiles, and Toronto parcel/ward/zoning/development/CoA layers. Imports must carry source/licence registry
entries. The old broken `/api/enrichment` route is not a runtime dependency.

No account, private CRM, listing, owner-name, applicant-address or contractor
contact fields are returned. Descriptions from source records are untrusted
data. No paid model/data-provider API is called.

Additional physical attributes are explicitly whitelisted by source. Basement,
garage, building type, frontage and proposed-assessment fields are included only
where published. `publishedAttributes` preserves source terminology; proposed
values are distinct from annual assessed values. NAR address-record counts are
not verified dwelling counts. Census statistics describe 2021 areas; recovered
northern boundaries disclose their 10-metre simplification tolerance.

Import and refresh instructions: [scripts/property/README.md](../scripts/property/README.md).
Refresh is manual. Registry counts measure dataset records, including multiple
years and units, rather than a sum of distinct Canadian properties.

## Operations

The existing atomic Postgres throttle provides 30 lookups/client/minute and a
site-wide 120/minute ceiling across instances. Client keys are day-scoped SHA-256
hashes, not raw IPs. Limiter failure closes lookups with 429 and `Retry-After: 60`.
Distributed abuse can exhaust the global ceiling; revisit WAF/quotas before bulk
or broad launch. Existing throttle retention applies.

Fetches use fixed allowlisted HTTPS hosts, no redirects, an 8-second deadline (12 for Toronto)
and 1 MB limit. Queries/results are bounded; truncation is declared. Source
cache is one hour; property responses are no-store. Public CORS enables browser
calls. NRCan directs bulk users to its service team; unattended bulk geocoding
is outside this endpoint's workflow.

## Verify

```sh
npm test
npm run lint -- lib/property app/api/property scripts/check-property-live.ts
npm run build -- --webpack
node node_modules/tsx/dist/cli.mjs scripts/check-property-live.ts
```

The live script makes published sample lookups and reads the configured import
registry if available. Without database configuration, imported layers report
unavailable. Verify the deployed endpoint using its existing server-side config;
do not download a broad production environment merely for these checks.
HTTP calls consume ordinary rate-limit counters, without account/lead/property
or schema writes.

For a future Homies-domain alias, forward `/api/property/:path*` from the Homies
landing app to these Realist routes and update the skill/OpenAPI server URL.
The native Homies harness has not been edited.
