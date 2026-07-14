# API, UI and Matrix Outputs

## API sketches

```ts
type Claim = { level:"verified"|"inferred"|"unknown"; sourceUrl:string; retrievedAt:string; snapshotHash:string };
type SiteListQuery = { municipality?:string; stage?:string; tier?:string; bbox?:string; changedSince?:string; cursor?:string };
type SiteSummary = { id:string; address?:string; tier:string; geometry?:GeoJSON.Geometry; rollupStage:string; tracks:number; claim:Claim; lastChangedAt:string };
type SiteHistory = { site:SiteSummary; tracks:Array<{ type:string; activityState:"active"|"paused"; events:Array<{stage:string; observedAt:string; claim:Claim}> }> };
type MunicipalitySummary = { id:string; asOf:string; countsByStage:Record<string,number>; inflow:number; approvals:number; stale:boolean; claim:Claim; sourceSnapshotHashes:string[] };
type MatrixQuery = { archetype:string; scenario:"base"|"bull"|"bear"; densityMetric:"units"|"fsi"; output:"roc"|"rlv"|"irr"|"margin" };
type MatrixResponse = { modelVersion:string; assumptionHash:string; density:number[]; mliRates:number[]; mliCells:number[][]; condoPricePsf:number[]; condoCells:number[][]; frontier:Array<{density:number; threshold:number}> };
```

- `GET /api/land-inventory/sites`
- `GET /api/land-inventory/sites/:id/history`
- `GET /api/land-inventory/municipalities/:id/summary`
- `GET /api/multiplex-matrix?...`

## Inventory UI

Map/table split with municipality, tier, stage, track and recency filters; stage counts; “changed this month”; site drawer with parallel-track timeline and source evidence. Unknown/inferred records remain visually distinct. Default map never implies candidate sites are approved.

## Gradient matrices

- MLI panel axes: density (units or FSI) × takeout rate. Cell selector: ROC, levered IRR, cash-on-cash or RLV.
- Condo panel axes: density × sale price/sf (optional construction-rate slice). Cell selector: margin, IRR or RLV.
- Diverging palette is anchored to the selected hurdle: red below, neutral at hurdle, green above. Never use colour alone; show value and pass/fail glyph.
- Recharts does not provide a first-class heatmap. Use an accessible CSS grid for cells, Recharts for line/frontier charts, preserving existing cards/tooltips/legend conventions.

Illustrative four-cell slice (not market data):

| Units / MLI rate | 4.0% | 5.0% |
|---|---:|---:|
| 5 | IRR 7.1% | IRR 4.9% |
| 6 | IRR 10.3% | IRR 7.8% |

Decision frontier for density `d`: find threshold `x*` where `NPV_hold(d, rate, assumptions) - NPV_condo(d, price_psf=x*, assumptions) = 0`. Above/below the threshold, label the higher NPV path; if both fail hurdle rates, label `neither`.

Every export/footer contains “as of” date, official-source links, model version, assumption hash, claim legend and professional-verification disclaimer.
