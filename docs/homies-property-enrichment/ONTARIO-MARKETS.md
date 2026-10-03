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
and permit history; audit Durham's remaining municipal gaps alongside Oshawa;
finish Halton Hills and Halton's remaining layers, then York, Waterloo and Niagara before
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

## Durham regional planning and civic batch

Eighteen enabled feeds connect civic identity and regional mapping across Ajax,
Brock, Clarington, Oshawa, Pickering, Scugog, Uxbridge and Whitby. Their source
audit totals **269,836 published rows**: 253,571 civic rows assigned to those
eight municipalities, 8 municipal boundaries and 16,257 planning-map rows.
These overlap the other registries and are not distinct properties, unique data
points or bulk-imported database rows. `/api/property/coverage` returns each
feed's actual health/count; failed counts remain unknown. Three additional
blended natural-heritage/aquifer layers are withheld and excluded from totals.

| Enabled planning evidence | Source rows |
| --- | ---: |
| Urban expansion areas | 19 |
| Urban growth centres | 4 |
| Specific policy areas | 6 |
| Protected major transit station areas | 8 |
| Community areas | 75 |
| Employment areas | 72 |
| Prime agricultural areas | 79 |
| Major open space areas | 144 |
| Significant groundwater recharge areas | 9,113 |
| York/Durham WHPA Q1–Q2 | 1 |
| Ecologically significant recharge areas | 982 |
| Surface water contribution areas | 5,631 |
| Wellhead protection areas | 78 |
| Other wellhead protection areas | 12 |
| Intake protection zones | 30 |
| Source protection regions | 3 |

The exact public `GIS_DurhamRegion` publisher, `tFqRz8TAqe7XY7GD`
organization, licensed item/root service, named child layer, geometry and field
schema are checked before any query. The Region's current
[Open Data Licence v1.0](https://www.durham.ca/regional-government/access-to-information/open-data/)
allows reuse and excludes third-party rights it is not authorized to license.
The three withheld sources identify conservation-authority/provincial inputs;
originating terms or redistribution authorization remain unverified. No property
records from them are queried or returned. Source observation dates are unknown.
Publisher metadata requests are shared only within a lookup, and live queries
retain the one-hour cache. Count checks limit upstream concurrency.

Common community names such as Bowmanville, Courtice, Newcastle Village, Orono,
Brooklin, Port Perry, Blackstock, Cannington, Beaverton, Sunderland and Claremont
are bound to observed `TOWN`/`MUNICIPALITY` source values. A requested community
must agree with the exact civic record. Directions and civic suffixes are not
stripped. Shared unit/site points more than 20 metres apart or conflicting
community names remain ambiguous. `UNIT` is a yes/no flag; the API preserves
`UNIT_NUM` and `UNIT_RANGE` separately, together with postal codes, regional
address IDs and record-edit dates. At most 50 whitelisted civic rows are shown,
with the total and truncation visible. No individual unit is independently
identified or verified. Oshawa retains its own civic-point and CSV adapters.

`municipality` must uniquely intersect the point and agree with the requested
municipality before `durhamPlanning` runs. The latter preserves all 19 nested
statuses, sources and query/truncation limits. `coverageComplete=false` includes
withheld sources and unverified current policy; `enabledQueryCoverageComplete`
describes only the 16 enabled queries. Empty results never prove absence.
Seven newly connected municipalities retain explicit permit, detailed zoning,
heritage, planning-history and current municipal-plan gaps.

The [Region's current planning guidance](https://www.durham.ca/doing-business/planning-and-development/envision-durham/)
reports September 3, 2024 approval in part, December 13 approval of remaining
northeast Pickering matters, and transfer of plan responsibilities to the eight
municipalities on January 1, 2025. The selected service descriptions identify
the September consolidation. Its polygons may predate the later approval, and
municipalities can amend their inherited plans. Current written policies,
amendments, appeals and legal schedules are unverified. Growth and agricultural
designations do not establish zoning permission, lot-creation rights, density or
servicing. Water-source polygons are separate from contamination, drinking-water
test results, flood mapping, actual water connection and current activity-specific
prohibitions. Source-protection region membership is separate from conservation
authority regulatory jurisdiction. Uninterpreted source codes stay uninterpreted.

`scripts/verify-durham.ts` pins civic/boundary IDs in all eight municipalities,
Pickering growth-centre `1`, Cannington wellhead `43`, Uxbridge wellhead `8`,
Port Perry source-protection region `2`, Oshawa community area `231`, and an
interior geometry fixture from Ajax GO Station polygon `1` (published status
`Existing`). The geometry fixture is a GIS query control, not a property identity
or surveyed lot. A conflicting requested municipality must stop plan queries.
Tests also exercise publisher/schema failures, complete and incomplete empties,
unit/context limits, truncation, source outages and zero queries to withheld feeds.

Next regional batches: finish Halton Hills, then York, Waterloo and Niagara. Each still needs its
municipal permit, current zoning, heritage and planning audit before completion.

## Burlington, Milton and Oakville first batch — October 3, 2026

Nineteen enabled municipal feeds add **204,269 published source rows**. Combined
with the 23 earlier municipal and 18 Durham feeds, these selected registries now
contain **60 verified feeds / 1,495,456 source rows** at release verification.
These are overlapping dataset rows, not distinct properties, unique data points
or database imports. Ten withheld feeds and Ottawa's separate monthly permit
snapshot are excluded. Actual health and counts are published in the coverage
endpoint; source observation dates remain unknown where not explicitly supplied.

| Municipality | Enabled feed counts | Total source rows |
| --- | --- | ---: |
| Burlington | Civic points 60,356; permit observations 5,062; heritage parcel polygons 271; heritage address points 294; older 2020 zoning mapping 1,782; planning communities 22; planning districts 8 | 67,795 |
| Milton | Civic points 46,417; urban zoning 2,497; rural zoning 534; heritage address points 978; development polygons 373; hamlets 3; neighbourhoods 26 | 50,828 |
| Oakville | Civic points 71,156; 2014-014 zoning 4,419; 2009-189 zoning 797; permit observations 9,221; generalized land use 53 | 85,646 |

Each enabled public item is bound to its exact municipal publisher, organization,
fixed service, named child layer, geometry, whitelisted fields and explicit
dataset reuse grant. Sources use the [Burlington Open Data Terms of Use](https://opendata.burlington.ca/opendata-terms-of-use/City%20of%20Burlington%20-%20Open%20Data%20Terms%20of%20Use.pdf),
[Milton Open Government Licence version 2.0](https://discover-milton.hub.arcgis.com/pages/disclaimer-and-terms-of-use)
and [Oakville Open Data Licence](https://www.oakville.ca/town-hall/plans-strategies/open-data/open-data-licence/).
Oakville's fixed items sometimes link its former licence paths; the adapter
accepts only those pinned Town licence anchors and supplies the verified current
canonical grant. Blank item licences are not inherited from adjacent datasets.
The API and report retain attribution and Burlington's linked reuse terms and
acceptance statement. Owner, owner-address, applicant and contact fields are
excluded. Live queries retain bounded downloads and one-hour caching.

Civic identity requires exact normalized civic number, type, suffix and direction.
Burlington uses only Active Ontario address records. Oakville's missing CITY/PROV
values remain unknown; conflicting values are rejected. Shared civic points more
than 20 metres apart remain ambiguous, with no arbitrary building point.
Municipal unit/suite and Milton ADU fields are address context, not proof of legal
units. Unit-specific requests remain unsupported. Building metadata from the
National Address Register is attached only when identity and the published
building point agree within 20 metres. Campbellville can appear in Milton's
published hamlet screen; former-community address aliases are not connected yet.

[Burlington's current zoning guidance](https://www.burlington.ca/en/planning-and-development/zoning.aspx)
says residential By-law **09-2026 came into force March 2, 2026**, while By-law
2020 still applies to other lands. The licensed older map cannot establish
current residential permission. A January 2026 final-draft service is withheld
because its enacted scope and separate reuse limitations are unverified. The
aggregate zoning layer makes the incomplete current screen explicit and retains
the older map's own note and date. Burlington's heritage district item is also
withheld for lack of an explicit dataset reuse licence.

[Milton's urban 016-2014 and rural 144-2003 zoning](https://www.milton.ca/en/business-and-development/zoning-by-laws.aspx)
are both screened. [Oakville's 2014-014 and 2009-189 bylaws](https://www.oakville.ca/town-hall/by-laws-enforcement/zoning-by-laws/)
are both screened, preserving holding, site-specific and temporary-use references
where published. These are point intersections, not full parcel/legal reviews;
current text, overlays, amendments, appeals, density, height and permission remain
unverified. Generalized land use, hamlets and planning communities do not replace
current Official Plan schedules.

Milton's heritage dataset title says Designated Heritage Properties, but its
records include **LISTED** properties. The API preserves that distinction and
published designation-date text without guessing its format. Exact heritage
address evidence more than 100 metres from a usable civic point stays ambiguous.
Burlington's heritage address points and parcel polygons are separate evidence;
both preserve register and designation flags. Oakville's selected heritage and
active-development items lack explicit reuse licences and remain withheld;
none of their records or owner fields is queried.

Burlington retains repeated permit numbers with differing work/date fields. At
1268 Abbey Court, three observations include two entries for `24-019651`; they
are not counted as three distinct permits. Oakville's catalogue advertises a
rolling **last-ten-years** scope, updated nightly; full older history remains
unverified. At 3140 Harasym Trail, `2022 132737 000 00 RN` is published Closed and
`2022 132737 000 00 TH` is Cancelled. Closed/Final does not verify a final
inspection or occupancy. Published construction estimates stay in CAD; Oakville
GFA units are undocumented and are not assumed to be square metres. No values
are summed across observations and no legal/current unit count is inferred.

Milton's development polygons intersect the subject point and preserve published
file, registration, status, approval and lapsing dates. They are not nearby
quarterly application observations, comprehensive decisions, current conditions
or appeal outcomes. Property permit history remains unconnected for Milton.
[Halton's former regional plan became each local municipality's plan on July 1, 2024](https://www.halton.ca/the-region/supporting-land-use-planning/regional-official-plan).
Both applicable municipal and former regional plans require review; Milton's
municipal consolidation is February 2026. Full current plan GIS, amendments,
nearby proposals and decisions remain explicit gaps for all three municipalities.
Halton Hills published website evidence is documented separately below; its GIS reuse scope remains unverified.

`scripts/verify-halton.ts` validates the 19 enabled and four withheld bindings,
pins eight civic controls and positive heritage/permit records, and retains
source limits. Controls include Milton designated heritage `1` and listed
heritage `5`, Burlington heritage parcel `481107` and address point `565982`,
repeated Abbey Court permit observations, and Oakville Closed/Cancelled records.
Tests cover identity, province/city conflict, point ambiguity, withdrawn rights,
changed schema, truncation, repeated observations, unknown units, current-zoning
gaps and zero record queries to withheld sources. Halton Hills and the remaining
core categories still require an audit before any market can be marked complete.


## Halton Hills published website evidence — October 3, 2026

Two separately scoped sources add **805 published table observations**:
538 Listed, 139 Part IV and 10 Part V heritage entries (**687** total), and
**118** development-table rows. These are observations, not unique properties
or applications. They bring the selected municipal expansion sources to
**62 verified feeds / 1,496,261 source rows and table observations**, excluding
withheld feeds and Ottawa's separate 23,794 monthly permit observations.
No database import is claimed.

The [heritage page](https://www.haltonhills.ca/heritage) and
[development page](https://www.haltonhills.ca/work/planning-development/active-development-applications)
explicitly permit attributed reproduction in their Town footer. Runtime checks
pin the publisher, permission, headings/table schema, heritage map-link layer,
and development script's fixed endpoint and exact six rendered fields. Scripts
are parsed for fixed bindings and never evaluated. The development request
excludes geometry, contacts, owner attributes and unpublished status/date fields.
Heritage historic-person and narrative columns are excluded. Both responses are
bounded, reject redirects and use a one-hour cache; changed rights/schema or
incomplete responses return unavailable without factual results.

Only exact civic-location observations are matched. Street type, direction and
suffix must agree. Published communities must agree; missing or conflicting
communities remain **ambiguous candidates**. In particular, Part IV/V entries
publish no explicit community and are not confirmed property designations by
this adapter. Listed and designated statuses remain separate, repeated
observations are retained, and null phases are unknown. Address ranges,
multi-address locations and lot/concession descriptions are not expanded.
No observation date is published; retrieval does not establish currency.

The Town's ArcGIS licence page applies to information in its Open Data site.
The linked site is currently private (403), so membership of blank-licence
civic, boundary and ward items cannot be verified. Those feeds and separate
zoning GIS are withheld, with no record queries. Website permission is not
inherited by unrelated GIS services. This limitation does not stop use of the
Town's explicitly reproducible website content.

Core-category audit: municipal identity uses the existing national geocoder
baseline; the municipal civic feed is withheld. Permit, final-inspection and
occupancy history remain gaps. The Town's
[building-record guidance](https://www.haltonhills.ca/town-hall/governance-accountability/freedom-of-information)
directs a non-owner without authorization to the formal information-request
process. [Additional-unit guidance](https://www.haltonhills.ca/aru) is useful for
requesting documents but is not a property registry or legal-unit conclusion.
[Current zoning](https://www.haltonhills.ca/zoning) requires the applicable
2010-0050/00-138 rules, exceptions and amendments; the page describes the
2025-0070 housekeeping amendment, but no complete GIS/rule screen is connected.
[Official-plan schedules](https://www.haltonhills.ca/work/planning-development/planning-policy/official-plan)
and current amendments/constraints remain unparsed, including the former
regional plan that became local July 1, 2024. Published quarterly planning
summary totals are not assigned to individual properties. Complete heritage
register/district geometry, nearby planning history, decisions, conditions and
appeals remain unverified. Halton Hills stays **partial**, and all 76 priority
municipalities / 16 metro anchors remain in the checklist.

`node --import tsx scripts/verify-halton-hills.ts /absolute/output/path` verifies
the two published sources, four withheld feeds and nine positive/ambiguous/empty
controls, including repeated Esquesing heritage and Georgetown planning rows.
The public API, report, coverage ledger and Homies skill preserve these limits.
