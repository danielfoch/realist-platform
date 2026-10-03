# Ontario property-data expansion

The anonymous lookup, printable report and Homies artifact skill share the same
evidence layers. `/api/property/coverage` includes the current source health,
published dataset row counts and `ontarioMarkets` implementation checklist.
None of the Ontario markets has been declared complete by that checklist yet.

## Market scope

Start from [Statistics Canada's 16 Ontario CMA anchors (2021 classification)](https://www23.statcan.gc.ca/imdb/p3VD.pl?CLV=3&CPV=35A&CST=01012021&CVD=1348399&Function=getVDStruct&MLV=5&TVD=1348372&wbdisable=true).
Include major municipal submarkets in the GTA, Durham, Halton, Niagara, Waterloo
and Windsor areas, plus regional centres such as Sarnia, North Bay, Timmins,
Orillia, Woodstock, Cornwall, Owen Sound and Sault Ste. Marie. The municipality
list in `ontario-market-roadmap.ts` is an implementation priority list, not an
exhaustive list of every CMA constituent or an official geographic classification.
The final metropolitan audit also covers smaller municipalities through regional
feeds where available.

For each market, research civic identity, permit history, current detailed zoning
and overlays, planning decisions, heritage, current official-plan designations
and constraints. Add useful servicing, transit, incentives and rental-unit layers
where licensed. National address and neighbourhood census coverage alone does
not complete a municipal market.

## Added feeds verified October 2, 2026

| Municipality | Enabled evidence | Material gaps |
| --- | --- | --- |
| Mississauga | Municipal civic points, issued permit history, heritage polygons, wards, three explicitly historical 2010 plan layers | Specific zoning terms restrict copying; rezoning/site-plan reuse terms are unresolved; no current 2051 GIS screen |
| London | Issued civic points, heritage parcels and districts, generalized land use, Primary Transit Area, Community Improvement Project Areas | The licensed generalized layer lacks actual zone codes; current permit history, detailed zoning and planning remain to be connected |
| Ottawa | Municipal civic points, Part V heritage district mapping | Current permit/planning/Part IV data, detailed zoning and current official-plan layers remain to be connected |

The 15 enabled feeds collectively published **826,962 dataset rows** at the
verification time. These are source rows, **not** distinct properties, a count of
unique data points, or rows imported into our database. Three Mississauga feeds
are explicitly withheld and excluded from the count. Live counts can change.

Mississauga source terms were read from the [City's terms item](https://mississauga.maps.arcgis.com/sharing/rest/content/items/961c790805c14d8da258ec91bf4117e3/data).
The zoning item independently says GIS data cannot be copied or modified without
written consent; its specific restriction is retained. Heritage's signed terms
link is bound to that same City terms item without following its expired query.
London feeds link the [City's open-data terms](https://london.maps.arcgis.com/sharing/rest/content/items/e31458fd0c7e41dd9f93144a9550781d/data).
Ottawa items link its [Open Data Licence version 2.0](https://ottawa.ca/en/city-hall/open-transparent-and-accountable-government/open-data/open-data-licence-version-20).
Runtime checks bind each public item, publisher, fixed service URL, expected
schema and licence before querying records. Only whitelisted property fields are
returned; applicant, planner, owner and contact fields are excluded.

## Currency traps

Mississauga's [2010 plan was repealed March 24, 2026](https://www.mississauga.ca/projects-and-strategies/strategies-and-plans/mississauga-official-plan/mississauga-official-plan-versions/).
The [approved 2051 plan](https://www.mississauga.ca/publication/ministry-of-municipal-affairs-and-housing-modifications-decision/)
is the current plan. Recent edits to the old GIS layers do not make them current
policy. The API marks them historical and returns `currentPlanScreenPerformed=false`.

Ottawa's published services include `Zoning_Bylaw_2026_50` and
`Zoning_Bylaw_2008_250`; the new service also includes a zoning-under-appeal
layer. Both bylaw regimes, transition dates, appeals and overlays must be
researched together. The [City's appeal guidance](https://ottawa.ca/en/node/3046321)
is linked while this integration remains incomplete. Do not present the 2008
layer alone as complete current permission.

## Verification and next batch

`node --import tsx scripts/verify-ontario-municipal.ts /absolute/output/path`
checks live publisher/licence/schema bindings and pins expected records:
Mississauga permit `OBJECTID=3` at 1416 Liveoak Drive; London listed heritage
`OBJECTID=5992` at 857 Adelaide Street North; London designated heritage
`OBJECTID=5993` at 862 Waterloo Street. Address controls include 280 Lakeshore
Road East and 150 Donald Street, Ottawa. Spatial evidence uses published civic
or building points or caller-supplied coordinates; interpolated points are skipped.
Tests cover street direction, proposed addresses, unit scope, point disagreement,
truncation, empty results, licence withdrawal and schema failure.

Next: finish Ottawa's permits, planning, both current zoning regimes and overlays;
find a licensed current Mississauga 2051 feed; connect London's detailed zoning
and permit history; then expand Durham, Halton, York, Waterloo and Niagara before
working through southwestern, eastern and northern CMA/regional markets.
Retain explicit gaps when a dataset cannot be reused; continue other available
market work instead of treating one missing licence as a province-wide blocker.
