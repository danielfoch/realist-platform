# Product Specification

## Product A: GGH entitlement inventory

### Users and jobs

- Developers/investors: find supply, stage, timing, and competing pipeline.
- Municipal/policy researchers: compare pipeline flow and bottlenecks.
- Realist editorial: publish defensible supply analysis with source-level provenance.

### Three nested inventories

| Tier | Meaning | Allowed claim |
|---|---|---|
| `parcel_universe` | Parcel/context layer where licensed and available | “Context only; not assessed as developable.” |
| `candidate` | Evidence suggests development potential, but no verified active application | “Realist infers potential from stated evidence.” |
| `verified_application` | Official application/decision/permit evidence exists | “Realist tracks this documented planning process.” |

Realist does **not** claim to enumerate all privately held developable land.

### Geographic rollout

- Wave 1 labels: Toronto, Peel, York, Durham, Halton, Hamilton. Because applications are usually lower-tier, adapters target Toronto and selected lower-tier municipalities such as Mississauga/Brampton/Caledon, Vaughan/Markham/Richmond Hill, Oshawa/Whitby/Ajax, Oakville/Burlington/Milton, plus Hamilton.
- Pilot: Toronto + one lower-tier municipality chosen after live source verification.
- Wave 2: Waterloo, Niagara and outer GGH only after readiness scoring.

### MVP acceptance

- Six wave-1 coverage groups each have at least one verified source adapter.
- At least 90% of published verified applications have canonical stage, official source URL, retrieved timestamp, adapter version and snapshot hash.
- Same-snapshot rerun creates zero duplicate sites and zero duplicate events.
- False auto-merges in a reviewed 100-record sample are below 1%; ambiguous matches are quarantined.
- A monthly run reports per-adapter counts and isolates failures.

## Product B: Toronto density/return study

Two layers are shown separately: policy-permitted density and economics. The model compares MLI Select rental hold/takeout with condo exit at varying density, rates and exit pricing.

### MVP acceptance

- Every displayed cell is reproducible from a versioned assumption set and model version.
- Density appears as units/site, units/acre and FSI/GFA where lot data permits.
- Matrix includes at least five density steps and five MLI rate steps plus condo price/sf sensitivity.
- Outputs include yield/return on cost, residual land value, levered IRR or cash-on-cash for hold, and margin/IRR for condo.
- Public report cannot publish until all current CMHC/lender and Toronto fee assumptions are independently verified.

## Non-goals

Province-wide perfect parcel coverage; AI-only stage classification; real-time refresh; paid data procurement; development advice; automatic investment recommendations; replacing planners, lenders, appraisers, architects or lawyers.
