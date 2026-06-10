## Multiplex Overlay Architecture

This feature is a screening engine, not a zoning opinion.

Current integration:
- Embedded in `client/src/pages/DistressDeals.tsx` listing detail modal
- Full standalone experience in `client/src/pages/MultiplexFeasibilityPage.tsx`
- Core rules engine in `server/multiplexFeasibility.ts`
- Shared UI surface in `client/src/components/MultiplexFeasibilityPanel.tsx`

Rules hierarchy:
1. Province baseline
2. Municipality rules
3. Zone standards
4. Overlay constraints
5. Property-specific caveats

Current direct logic:
- Ontario Bill 23 / ARU baseline
- Toronto city-wide 4-unit logic
- Toronto garden suite logic
- Toronto laneway suite logic
- Toronto & East York / Ward 23 six-unit possibility handling
- Basic zone classification for common residential codes

Current inferred / heuristic logic:
- Municipality fallback lot coverage ratios
- Storey assumptions for GFA screening
- Practical GFA haircut
- Narrow-lot penalties
- Six-unit subarea likelihood when exact boundary data is unavailable
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
- Add transit / parking reduction logic
- Add heritage and flood / conservation overlay lookups from geometry, not manual flags
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
