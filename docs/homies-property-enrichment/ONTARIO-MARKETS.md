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
| Ottawa | Municipal civic points, Part V heritage district mapping, monthly permit reports covering January 2024–August 2026 | Older permit history, later unpublished months/current status, planning/Part IV data, detailed zoning and current official-plan layers remain to be connected |
| Oshawa | Municipal civic points, mapped zone labels, existing-use classifications, parcel references, communities, wards, issued two-unit certificates and rental-licence expiry dates | Detailed zoning rules/amendment/appeal currency, property permit history, heritage, current Official Plan GIS and comprehensive planning history remain gaps |

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
Unique National Address Register building metadata is retained when its civic identity and published building point agree within 20 metres of the municipal point. Ambiguous, blockface-only and conflicting register points are not attached.
Tests cover street direction, proposed addresses, unit scope, point disagreement,
truncation, empty results, licence withdrawal and schema failure.

Next: extend Ottawa's older permit reports, planning, both current zoning regimes and overlays;
find a licensed current Mississauga 2051 feed; connect London's detailed zoning
and permit history; expand the Durham regional address and plan feeds alongside
Oshawa's remaining gaps, then Halton, York, Waterloo and Niagara before
working through southwestern, eastern and northern CMA/regional markets.
Retain explicit gaps when a dataset cannot be reused; continue other available
market work instead of treating one missing licence as a province-wide blocker.

## Ottawa permit report snapshot

Two fixed official files add **23,794 permit/address report observations** across
32 reporting months, January 2024 through August 2026. These are observations,
not distinct permits or properties, and are separate from the 15 GIS feeds above.
The [2024–2025 item](https://open.ottawa.ca/documents/05046d836248455d92cbc0543ce4c022/about)
and [2026 item](https://open.ottawa.ca/documents/a8992582cb764c1a9edaebfb0b30e9c7/about)
link the City's open-data policy; its [licence FAQ](https://ottawa.ca/en/city-hall/open-transparent-and-accountable-government/open-data/open-data-license-change-faq)
explicitly applies version 2.0 to datasets accessed through its open-data website
after September 8, 2016. Each refresh validates the exact public publisher, item,
file name, title, licence policy, byte size, workbook schema, reporting months and
unchanged catalogue version before publishing atomically. Only a single ArcGIS
file redirect to the exact item/file on its own origin is allowed.

All source observations are preserved, including master plans without addresses.
316 observations lack an address and 328 lack a former municipality; they are
excluded from property matching, as are unit/lot-only addresses. Explicit merged
property cells are repeated only according to workbook merge ranges. Three
malformed numeric observations remain null with source text in unparsedMeasures.
Contractor fields and summary-statistics sheets are excluded.

Reporting periods stay separate from issued dates. A July 2026 report at
99 Fourth Avenue includes a cancelled revision with a July 29, 2003 issued date;
that is not a newly issued 2026 permit. At 50 Laxford Drive, Kanata, permit
CON-2024-009110 reports basement additional-unit work issued January 2, 2025.
Published work units/value/area are not a verified property unit count, property
value or finished floor area. Preserve square-feet versus square-metres labels.
Do not add values across repeated permit/address observations. Exact civic
matching retains former-municipality ambiguity, returns at most 50 observations,
and explicitly marks older history/current status/final inspections unverified.

The ninth public snapshot joins the existing daily refresh route, with last-good
retention and a traced compiled fallback. No production schema or manual refresh
is required; the scheduled run can publish it normally.

## Oshawa first municipal batch

Eight licensed feeds add **194,389 published rows**, bringing this municipal
adapter registry to **23 verified feeds / 1,021,351 source rows** at verification
time. The counts overlap properties and include address/unit and issue-history
rows; they are not unique properties or unique data points. The three withheld
Mississauga feeds and Ottawa's separate permit-report snapshot remain excluded.

| Feed | Published rows |
| --- | ---: |
| Civic-address points | 64,226 |
| Zoning labels | 2,459 |
| Existing land-use classifications | 61,549 |
| Parcel-reference polygons | 61,549 |
| Communities | 20 |
| 2018 ward boundaries | 5 |
| Issued two-unit certificates | 2,965 |
| Issued rental-licence records | 1,616 |

Each item binds the public `City.of.Oshawa` publisher, organization
`qQGLFamV2KgdKsUa`, fixed URL/file and
[Open Government Licence v2.0](https://map.oshawa.ca/OpenData/Open%20Government%20Licence%20version%202.0%20-%20Oshawa.pdf).
The licence permits commercial reuse, with attribution and exclusions including
personal information and unlicensed third-party rights. Only the whitelisted
municipal property-reference fields and address/date lists are returned.
[Parcel metadata](https://map.oshawa.ca/OpenData/Metadata/Parcel%20Metadata.pdf)
describes area in internal units squared. The API preserves that label and does
not call it surveyed lot area or convert it; municipal parcel IDs are not PINs.

The zoning feed returns complete published labels such as `R1-D(6)`, without
separate exception text, holding rules, amendment dates, appeals or verified data
observation dates. [City guidance](https://www.oshawa.ca/business-development/planning-and-development/development-applications/zoning/)
requires checking the applicable bylaw after obtaining the label.
[Transit-station amendment guidance](https://www.oshawa.ca/business-development/planning-and-development/development-applications/development-studies/)
also describes approval-dependent provisions. Existing use is separately
classified and does not establish a plan designation, legal unit count or
permission for the proposed use. Licensed Official Plan PDF schedules were
identified but are not yet parsed into property GIS. The public housing-permit
dashboard's reuse licence was blank; it is not queried by the API. The City's
[active applications page](https://www.oshawa.ca/business-development/planning-and-development/development-applications/)
has a public-meeting date limit and is not treated as complete planning history.

The fixed [two-unit CSV](https://www.arcgis.com/home/item.html?id=97d92126eeae4430885d6225df0ff2a0)
and [rental-licence CSV](https://www.arcgis.com/home/item.html?id=1331c821b8cd49369f6dc89e2ce0fc50)
are small bounded live files with one-hour caching. Their catalogue modification
dates are December 2, 2025; actual observation dates remain unknown. Downloads
reject redirects and exceedance of byte/row bounds. Strict headers, quoting,
row widths and stable metadata are verified. Dates use the source's month/day/year
format; invalid dates remain null with original text. Certificate issue dates
and rental expiry dates retain different meanings. Neither proves current
legality, final inspection, revocation status or an unpublished renewal.

`scripts/verify-oshawa.ts` verifies eight feed counts and pins City records at
55 Aberdeen Street (certificate issued February 9, 2018, zone `R1-C`, mapped
existing use `Single with Registered Apt`) and 52 Air Dancer Crescent (published
licence expiry September 5, 2027, zone `R3-A(18)`). At 460 Woodmount Drive, the
shared civic-address site contains differing unit points, so location remains
ambiguous and GIS is skipped. Rental unit entries remain available as site-level
address-list evidence without choosing an arbitrary building point. Tests cover
exact suffix/direction, damaged CSV, date parsing, withdrawn rights, changed file
versions, bounded results and source failures.

Durham research has also identified licensed regional civic addresses and plan
map items. The official City/Region catalogues and current licence text are
retained in the local research handoff. Regional source adoption, municipal
matching, the status of inherited planning policies and current amendments still
need verification before those feeds are enabled.
