## Multiplex Overlay Architecture

This feature is a screening engine, not a zoning opinion.

Current integration:
- Embedded in `client/src/pages/DistressDeals.tsx` listing detail modal
- Full standalone experience in `client/src/pages/MultiplexFeasibilityPage.tsx`
- Core rules engine in `server/multiplexFeasibility.ts`
- Deterministic development report model in `shared/multiplexFeasibilityReport.ts`
- Controlled GPT Image rendering adapter in `server/multiplexConceptImage.ts`
- Shared UI surface in `client/src/components/MultiplexFeasibilityPanel.tsx`

Development report layer:
- Selects an illustrative principal-building typology from the submitted frontage,
  depth, unit capacity, lane condition, and overlay result
- Produces a dimensioned deterministic site plan; this plan remains the controlling
  concept if a generated architectural rendering differs from it
- Compares 25, 30, 40, and 50 foot frontage outcomes at the submitted lot depth,
  with lane and no-lane variants
- Separates the as-of-right concept from any policy-height / rezoning upside
- Builds a sample rental-hold pro forma from the shared cost, rental, residual-land,
  and MLI Select underwriting modules
- Builds a complete indicative schedule from site control and acquisition through
  construction financing, construction phases, lease-up, stabilization, and CMHC
  MLI Select takeout
- Requests an input-matched, two-view concept board from `gpt-image-2`; the endpoint
  accepts only server-defined massing fields rather than arbitrary user prompts

Site-specific Toronto lookup:
- A submitted Toronto address is geocoded and checked against the mapped zoning
  polygon before the feasibility engine runs
- The response identifies whether the zone was mapped or supplied manually and
  includes available street-tree, heritage, TRCA / conservation, and coordinate data
- Lookup failures degrade to the submitted screening inputs and remain explicitly
  labelled rather than blocking the report

Rules hierarchy:
1. Province baseline
2. Municipality rules
3. Zone standards
4. Transit station area (MTSA / PMTSA)
5. Overlay constraints
6. Property-specific caveats

Current direct logic:
- Ontario Bill 23 / ARU baseline
- Toronto city-wide 4-unit logic
- Toronto garden suite logic
- Toronto laneway suite logic
- Toronto & East York / Ward 23 six-unit possibility handling
- Basic zone classification for common residential codes
- MTSA / PMTSA status when the user confirms it against the municipal delineation:
  - no minimum parking in a P/MTSA (Bill 185; in force 2025-08-15)
  - inclusionary zoning gated on PMTSA status, with Toronto's 100-unit / 8,000m²
    threshold and the O. Reg. 15/26 pause to 2027-07-01
  - Toronto's provincially-directed low-rise height inside a P/MTSA (4 storeys,
    6 on a major street) surfaced as a rezoning scenario

Current inferred / heuristic logic:
- Municipality fallback lot coverage ratios
- Storey assumptions for GFA screening
- Practical GFA haircut
- Narrow-lot penalties
- Six-unit subarea likelihood when exact boundary data is unavailable
- MTSA membership guessed from an 800m station-distance radius when the user has
  not confirmed it — flagged, and deliberately does NOT unlock the parking rule,
  the height direction, or any GFA change
- Missing overlay inputs default to unknown rather than clear

Confidence model inputs:
- Province recognized
- Municipality recognized
- Zone code provided / classifiable
- Lot dimensions provided vs. estimated
- Overlay flags provided
- Lot-context flags provided

What to improve next:
- Replace Toronto six-unit area heuristics with parcel-level boundary matching
- Add normalized municipal zoning datasets instead of city-level fallbacks
- Add frontage / lot-area minimums by zone
- Replace the MTSA distance heuristic with point-in-polygon matching against
  Toronto's published P/MTSA layer (Open Data), then extend to other Ontario
  municipalities' delineations
- Revisit the Toronto P/MTSA height direction once Council implements it in the
  zoning by-law — at that point it moves from a rezoning scenario into the
  as-of-right envelope math
- Extend the current Toronto heritage and TRCA / conservation screening to
  authoritative parcel-level status and additional municipalities
- Add deterministic floor-plan prototypes to complement the massing/site-plan library
- Add saved report snapshots and a PDF export after the report data model is versioned
- Persist multiplex overlay usage and results as structured listing intelligence
- Expand Ontario municipality coverage beyond province-baseline mode

Recommended next data model additions:
- `municipal_zone_rules`
  - municipality
  - zone_code
  - zone_category
  - max_storeys
  - max_coverage
  - min_frontage
  - min_lot_area
  - permissions_json
- `municipal_overlay_rules`
  - municipality
  - overlay_name
  - geometry
  - effect_summary
  - source_url
- `parcel_screening_inputs`
  - listing_id
  - lot_area
  - frontage
  - depth
  - lane_access
  - corner_lot
  - servicing_status

Product principle:
- Prefer explicit uncertainty over fake precision.
- Mark every estimate as direct, heuristic, or missing.
