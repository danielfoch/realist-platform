# Ontario property-data expansion

The anonymous lookup, printable report and Homies artifact skill share the same
evidence layers. `/api/property/coverage` includes the current source health,
published dataset row counts and `ontarioMarkets` implementation checklist.
None of the Ontario markets has been declared complete by that checklist yet.

## Owen Sound and Grey County — October 4, 2026

Five independently licensed originating Grey County feeds add settlement and
explicitly historical 2018-plan land-use, karst, significant woodland and
significant valleyland references for suitable independent points in the nine
named County municipalities. Their selected source counts are 56, 6,734, 380,
3,222 and 37: **10,429 overlapping source rows**, counted once. The duplicate
settlement offer and MNR-labelled County boundary layers are excluded. These
are not unique properties, field data points or imported rows.

See [Grey County rights, identity and vintage details](GREY-COUNTY.md) and
[Owen Sound current planning/property-file audit](OWEN-SOUND.md). Owen Sound
reports now retain OPA14/ZBA57 conditional effect and notice conflicts, separate
paid PIR scopes, occupancy/final-inspection distinctions, undated ARU/service
guidance, heritage/STR identity gaps and original GSCA evidence requests. City
feature rights remain unestablished; no City data query or paid request occurred.
Other Grey municipalities need their own current local audits. All completeness
flags remain false.

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

## York Region extension — October 3, 2026

Six scoped live feeds add **789,370 published records** across Vaughan, Markham,
Richmond Hill, Newmarket, Aurora, Georgina, East Gwillimbury,
Whitchurch-Stouffville and King. Counts: 424,666 active allowed property civic
points; 18 municipal boundary polygons; 352,918 active York Region-sourced
parcel references; 7,073 regional application boundaries; 4,612 employment-land
inventory records from 2025; 83 wellhead-protection polygons. They are overlapping
dataset rows, not unique properties, field counts or database imports. The
selected municipal expansion sources now total **68 verified feeds / 2,285,631
source rows and table observations**, with nineteen withheld sources excluded.
Ottawa's monthly permit snapshot remains separate.

The [official York open-data page](https://www.york.ca/york-region/statistics-and-data/open-data)
links its Hub and commercial-reuse licence. Each enabled public item expressly
refers to that licence. Runtime metadata checks pin the inspected licence
document's publisher/name/type/modification epoch/size and each exact dataset
URL/title, explicit referral, named layer, geometry, copyright and field types.
Changed bindings fail before record queries. A York-specific HTML referral
normalization supports the inspected employment-item wording; it does not
weaken the generic municipal licence check or authorize blank-licence items.

Exact civic matching preserves suffix, type and direction; only active Single,
Multiple, Building, Building Entrance and Parcel points in the nine municipalities
are accepted. Transit/utility/park/unknown types, neighbouring counties and First
Nation boundaries are excluded. Known community aliases require published
postal-community agreement. Shared points must agree within 20 metres and share
a community; building/site context does not establish unit legality. Regional
property queries require one agreeing municipal boundary. Parcel SOURCE values
outside York Region are excluded; multiple point intersections and conflicts
with civic parcel references remain ambiguous. Geometry area stays in internal
units squared; no title, PIN, survey or legal lot-area finding is supplied.

Regional application boundaries intersect the subject point only. Preserve
legacy/new statuses, types and dates independently, even when they conflict.
UNITS can contain Yes/No text; it is not a numeric dwelling count. ESRI_OID is
query-row context; retain published regional/local file references for file
identity. Private applicant/owner/contact/employee fields, roll/PIN values,
fees and cross-joined planning constraints are excluded. Full municipal planning
history, nearby proposals, decisions, conditions and appeal outcomes remain
unsearched. [York's current role](https://www.york.ca/business/planning-for-regional-growth)
records the transfer of land-use approval and regional-plan implementation to
municipalities on July 1, 2024. Regional review is separate from municipal approval.

Employment inventory classifications retain their 2025 vintage and published
hectare fields; they do not establish current zoning, conversion permission,
servicing, vacancy or surveyed lot size. Wellhead codes/names remain source
mapping, not water safety, contamination, actual supply or current activity
rules. Five sources are withheld without property record queries: First Base
Solutions building footprints; two regional heritage datasets with public-access
wording only; regional-plan land-use mapping and urban structure with no verified
dataset-specific reuse grant.

`node --import tsx scripts/verify-york.ts /absolute/output/path` verifies six
bindings/scoped counts and eleven live controls across all nine municipalities.
Examples: King/Schomberg 199 Church Street matches regional file ZBA.26.K.0078,
parcel reference 412683 and Schomberg WHPA-D; Richmond Hill 15 Poplar Drive matches
CONS.18.R.0077 and parcel reference 396464; 111 Sandiford Drive intersects the
published 2025 employment inventory. The public API/report/skill preserve
subject-point scope and current municipal gaps. Markham now adds the municipal feeds below. Next priority is Vaughan's licensed
municipal catalogue and the other York municipalities' permit, detailed zoning,
heritage and current planning/plan sources. All 76 priority
municipalities and 16 CMA anchors remain incomplete pending full core audits.


## Markham municipal sources — October 3, 2026

[City open-data page and commercial licence](https://www.markham.ca/about-city-markham/open-data-markham) links to the official Hub. Its [Terms of Use](https://data-markham.opendata.arcgis.com/pages/terms-of-use), public City_of_Markham-owned Hub Page ac3dd6db2bbd4c0d9fb7260291496b9b in org OWiFbQmr7Eu5DHn1, contains the inspected v1.0 grant. Third-party/personal rights are excluded. Exact public publisher, epoch, grant-card SHA-256, per-item explicit referral, full root URL and named typed child are required before property queries. Blank-licence public items do not inherit the portal grant.

| Enabled source | Public item | Published rows |
| --- | --- | ---: |
| Civic Addresses | 7791a0d2e3d3422b8eab3c800be5c4e7 | 98,261 |
| Heritage Conservation Districts | d9e01d203c544d8b9f2671933f6fee40 | 4 |
| Secondary Plans | 69a4a292d99b4cf082d9f4b992b36369 | 58 |
| Development Charge Areas | 696a183a3a104bcd918f2b59c86363c9 | 55 |

Total 98,378 overlapping source rows, not unique homes or data points. Civic labels are MARKHAM 97,778, UNIONVILLE 158 and THORNHILL 325. Exact civic identity uses full address plus civic/street components, preserves direction/suffix/type and supports the source's PKY/CRT abbreviations. Unionville requests require the published UNIONVILLE label. Thornhill alone does not assign Markham rather than Vaughan. Conflicting/distant/unusable/shared-community points stay ambiguous. The municipal resolver is a fallback after York civic identity; polygon queries always require a precise point and unique York municipality boundary confirming Markham.

District mapping supplies names/IDs without bylaws, effective dates, individual listing/designation status or alteration approvals. The individual register remains unsearched. Secondary-plan labels include Statutory and Non-Statutory; preserve both and verify current written policies, schedules, amendments and appeals. The [City Official Plan page](https://www.markham.ca/economic-development-business/planning-development-services/official-plan) reports the 2014 plan's partial approval and continuing 1987 plan applicability for certain appealed/secondary-plan areas. These polygons cannot establish current in-force policy.

Development-charge mapping supplies area names/codes and raw statuses, including leading whitespace. Areas with Proposed Charge and Already Serviced/Covered by Agreement do not establish current rates, fees owed, payment/exemptions, subject agreements or actual servicing/capacity. No fees are calculated. Acres/hectares describe mapped polygons rather than this lot. All three polygon screens keep coverageComplete false, a separate queryCoverageComplete flag, absenceEstablished false and parcelWideScreenPerformed false. Source editingInfo is unpublished, so sourceUpdatedAt stays null.

Withheld without record queries: public Interactive Zoning Map b2f9531874c94167979864d22e200e4c (null licence); Heritage Property Locator 8320264b32a34e30bfbee576ea885906 (blank licence); Temp1_Markham Parcels d91aaf9c9a724bbb8344281a101385aa (no verified grant/third-party rights). [Current building services](https://www.markham.ca/economic-development-business/building-permits) provide ePLAN public search, inspection/completion/compliance and drawing requests; no licensed complete property permit history was identified in this catalogue pass. [Planning services](https://www.markham.ca/economic-development-business/planning-development-services/planning-and-development-applications) describe current file processes, but full current municipal file history/decisions/appeals and a nearby development feed remain unconnected. These current core gaps leave Markham partial.

`node --import tsx scripts/verify-markham.ts /absolute/output/path` checks all four bindings/counts and six live controls: Town Centre plan/charge, Unionville Station Lane district/Core plan, 197 Main Street Unionville, 96 Main Street North Markham district/plan, Church View proposed-charge classification and Cachet valid empty polygons. The municipal layers flow into the JSON API, printable report, one-click hosted Homies skill, seller questions and document requests. All 16 CMA anchors and 76 priority municipalities remain incomplete.


## Vaughan and Richmond Hill municipal audit — October 3, 2026

Official City map pages establish publisher context. Vaughan's old terms URL redirects to PLANit, whose warranty/risk wording does not establish commercial redistribution. Thirty-seven public Feature Service items owned by planning.gis_vaughan were inspected as metadata only; address, permit, active/closed application, parent-zone, heritage/district and plan items have blank/null licence fields. Current comprehensive-zoning and Building Standards guidance differ on 001-2021/1-88 applicability; verify current legal instruments, appeal decisions and parcel-specific transitions. The audit queries no municipal property records and does not claim catalogue or core completion.

Richmond Hill's official active-application map points to a null-licence dataset; heritage data supplies convenience/warranty language without a verified redistribution grant. Fifty-six public Feature Services in cu2HFDk7AqvG7e31 were inspected as metadata only. Quarterly municipal planning summaries are identified in the official planning page, but remain a separate unconnected source. York regional feeds remain usable for both cities. See `lib/property/york-local-audits.ts` and `coverage.live[].municipalAudits` for exact references and gaps.

## Kingston municipal extension — October 3, 2026

Official source: https://opendatakingston.cityofkingston.ca/ . The City policy and each selected item explicitly refer to the City of Kingston Open Data Licence 1.0. The inspected September 2016 PDF grants commercial use and excludes personal/unauthorized third-party rights. The legacy item referral redirects to https://www.cityofkingston.ca/media/wtpgpkb0/gis_license_opendata.pdf ; exact current PDF SHA-256 is `5b22699109219df0904056f9358f8bb901c3315902f3539018e0bc23492cea9d`. Runtime verifies direct grant bytes, complete normalized per-item terms hash, exact referral, owner/org/access/root, child name/copyright and typed whitelist before records. Redirects, oversized/invalid responses and failed bindings return unavailable. Inspect `kingston-sources.ts` for each whitelisted child and field.

| Inspected source child | Published rows |
| --- | ---: |
| addresses | 77,673 |
| municipality | 1 |
| permits | 68,473 |
| planningApplications | 418 |
| heritageApplications | 18 |
| designated | 1,236 |
| listed | 305 |
| easement | 55 |
| heritageDistrict | 3 |
| parentZone | 2,450 |
| exceptions | 829 |
| holding | 252 |
| formerBylawBoundary | 10 |
| landUse | 761 |
| secondaryPlanBoundary | 4 |
| cataraquiNorth | 14 |
| cataraquiWest | 14 |
| provincialCampus | 7 |
| rideauLandUse | 68 |
| siteSpecificPolicy | 82 |
| rideauSiteSpecificPolicy | 10 |
| opa50AppealMapping | 1 |
| floodplainOverlay | 927 |
| airportNoiseOverlay | 1 |

Total **153,612 overlapping rows in 24 source children**, not unique properties, data points or imports. Counts include repeated unit/civic and permit history records. Four upstream requests run at a time with one-hour caching and existing bounded timeout/body limits.

Civic matching preserves suffixes, street type/direction and published municipal identity. Shared-address points must agree within 20 metres; 52 Faircrest Boulevard and 267 Earl Street stay ambiguous. A unique licensed City boundary confirms Kingston before property queries. National building provenance is retained only with identity, City and 20-metre point agreement. Permit/active-application/heritage-application queries use exact civic address; coordinate-only requests skip them. Multiple-address/range descriptions, nearby proposals and full decision histories are unsearched. Unit requests remain unsupported.

Nested heritage sources preserve listing/designation, Part IV/V, de-listing/de-designation/demolition and easement flags/dates separately. Owner, mailing, inspector, applicant and staff contact fields are not requested or returned. Construction dates, permit fees/valuations and application meeting fields retain source text. An occupancy-date field does not establish current approval; an easement flag is not a title search. Empty/partial results do not establish absence. Source update time remains unknown where editingInfo is unpublished.

The City publishes a May 31, 2025 Official Plan consolidation; current written policies, later amendments and appeals remain unverified. The new plan remains separate draft material. Legacy OPA 50 appeal mapping does not establish a still-active appeal. Zoning parent, exception/hold text and former-bylaw boundaries are reference mapping; original legal documents take precedence and former-boundary membership does not establish current applicability. Floodplain elevation units/datum are unknown and the overlay is separate from authority regulation, safety and insurance. The NEF (30) polygon supplies no measured/current noise.

Nine sources are withheld without property queries: D1/D2/D3 additional-unit and J servicing overlays credit Utilities Kingston; G conversion credits MPAC/Teranet; intake/wellhead sources credit CRCA; two Draft 2 heritage/natural-heritage sources lack explicit reuse grants and are not in-force policy. Rights verification and current instruments remain to be added. The completion flag remains false.

`node --import tsx scripts/verify-kingston.ts /absolute/output/path` checks grant/schema/count bindings and six positive civic properties plus two ambiguous sites. Source evidence is in Homies/outputs/kingston-research-2026-10-03 and release evidence in Homies/outputs/kingston-2026-10-03. JSON API, printable report, hosted Homies prompt, seller questions and document requests all retain source-specific scope and gaps.

Additional positive controls verify full city/postal-suffix matching for 1383 Gardiners Road and 55 Cataraqui Woods Drive planning files, plus Approved heritage application observations at 244 James Street and 30 Sydenham Street. These labels remain raw source status and do not prove permission for new work. Two separately labelled synthetic interior points verify positive floodplain and NEF overlay queries; they are not property-geocoding controls.

### Kitchener–Waterloo–Cambridge (2026-10-03 source audit)

The selected expansion connects 26 City/regional children: Kitchener permits, active applications, heritage points/districts, improvement plans and subwatershed references; Waterloo municipal addresses, permits, heritage buildings/cultural landscapes, district plans and model pressure zones; Cambridge municipal addresses, heritage parcels, 2012 land-use/secondary-plan references and separate amendment/site-plan file polygons; regional addresses/boundary and historic sensitive-landscape, policy-area and significant-woodland inventories. Live counts on October 3 total 487,686 overlapping source rows across wider regional geography, not unique properties or database imports.

Each typed endpoint is bound to its exact public publisher/item URL and complete inspected terms before queries. Kitchener carries full per-item commercial grants. Cambridge refers to the current City 2.1 licence, and regional items explicitly refer to the former Region licence URL while the complete current official grant is separately validated. The Region page is headed v2.0 but its versioning clause says 1.0, so the API uses the unversioned licence name and pins the full text. Blank Waterloo item terms require exact membership of the City-owned curated open-data group plus the bound City site and complete licence page; neither public access nor organisation membership alone is a grant. A dynamic government-page accordion ID is not a licence identifier: the complete normalized licence text must match in one bounded section.

Exact civic identities preserve suffixes, directions, street types and City labels. Shared civic points must agree within 20 metres, then both City and regional boundaries must be unique and match. Permit/address histories are skipped on coordinate-only requests. City polygon references are subject-point screens, not parcel-wide findings. Source dates stay unknown where editingInfo is unpublished; raw recorded dates remain separate.

Current detailed zoning is unconnected. Kitchener explicitly excludes zoning/parcels/assessment from its open-data licence and has prior-plan/2026 adoption applicability questions. Waterloo has a separate Erb Street community-planning-permit regime. Cambridge publishes a 2026 plan consolidation and new Phase 1 zoning regime; its 2012 land-use reference does not establish current rights. Full current heritage, decisions/conditions/appeals, nearby development, servicing capacity and conservation-authority regulation remain incomplete. Ten selected records/viewers are withheld; never query or count them. Model HGL/future zones do not prove pressure, a connection or water capacity; historic environmental inventories and subwatershed ranks are not safety/clearance findings.

### Guelph (2026-10-03 source audit)

The official catalogue audit inspected 311 public dataset/service/site entries,
282 application/map entries and all three City Hub catalogue groups. Eleven
selected licensed feeds return **144,376 overlapping source rows**: civic points
53,847; City boundary 1; property references 43,267; building footprints 38,944;
2023 zoning references 3,414; legacy zoning 3,811; former termite mapping 443;
published planning files 308; registered 61M plans 144; watercourses 71; parks 126.
These counts are dataset rows, not distinct homes, unique data points or imports.

Each exact publisher/item URL, named typed child, complete licence referral and
schema is checked before records or counts. The inspected City licence/default
terms are bound to the exact City-owned site and licence/terms Pages. The blank
Active Development Planning item additionally requires exact individual
membership of the City-owned curated data group; public access and organization
membership alone do not establish reuse. The City terms require serial requests
and at most five per second. The adapter coordinates an exclusive renewable
lease across workers through the existing `property_refresh_runs` table, spaces
source requests by at least 250 ms after completion, and fails closed when the
lease or database is unavailable. It creates no schema or bulk import. The
property/report/coverage function budgets accommodate bounded serial queries.

Exact active civic points preserve suffix, street type and direction; civic
components must agree. Shared points beyond 20 metres remain ambiguous and a
unique City boundary must confirm Guelph before property queries. No unit,
PIN, roll, owner, surveyor or editor identifiers are queried. Property/building
polygons are reference evidence, with shape measures of unverified units;
they do not verify surveyed dimensions, interior floor area, age, title or units.
The 61M plan feed preserves registration dates separately and needs the actual
registered instruments. Watercourses and parks are subject-point references,
not nearby amenities, flood safety, setbacks, natural-heritage clearance or GRCA
regulation. Source update dates remain unknown if editingInfo is unpublished.

The source titled Active Development Planning includes old digitized files and
Undetermined statuses. Preserve raw file/type/status/description/application
fields without claiming present activity, full history, current decisions,
conditions, appeals or nearby proposals. Coordinate-only requests skip exact
address histories. Empty, failed, ambiguous and truncated responses remain
visible; no-match does not establish absence.

2023-20790 zoning/code/site-specific/parking/holding references are separate from
legacy mapping. Current written rules, unconsolidated 2024-21024 ADU amendments,
March 2026 partial appeal settlements and Stone/Edinburgh CPP By-law 2025-21064
are not verified by those labels. The current Official Plan legal schedules,
policies and later amendments remain unconnected; the City describes its online
consolidation as February 2024. Current City confirmation is required.

Termite_Data publishes 2021 activity/year observations for former areas. This
is historical evidence; do not expand raw A/N/Y labels into present infestation,
eradication, treatment, risk or absence. The City describes a separate
Regent/Grove outbreak identified in 2025 and City-managed during 2026. Reusable
machine-readable geometry for that current area was not verified. Keep the
current-area gap visible even when the historical map has no match, and request
current City confirmation plus property-specific inspection/treatment records.

Seven sources remain withheld from queries and counts: GPAS permit search,
underlying heritage and adjustment services lacking individual curated-dataset
grants, proposed zoning/flood overlays, separate CPP geometry and the current
termite image. City-curated viewers/packages do not establish their underlying
dataset reuse. The hosted Homies skill and printable report retain these gaps
and ask for the applicable current instruments and complete files. Guelph
remains partial municipal coverage within the all-major-markets goal.

Primary guidance: [City catalogue](https://explore.guelph.ca/search),
[licence](https://explore.guelph.ca/pages/open-data-license),
[traffic/default terms](https://explore.guelph.ca/pages/terms-of-use),
[current zoning guidance](https://guelph.ca/city-government/by-laws-and-policies/zoning-by-law/),
[termite guidance](https://guelph.ca/living/house-and-home/termites/),
[Official Plan](https://guelph.ca/plans-and-strategies/official-plan/),
[permit-record access](https://guelph.ca/city-government/building-permits-inspections/building-services-record-request/).


### Niagara Falls and regional Niagara (2026-10-03 source audit)

The releasable City expansion connects 11 licensed Niagara Falls feeds with
47,592 overlapping published rows at the local audit, plus the original Ontario
lower/single-tier boundary feed. The City adds civic points, completed permits,
subject-point planning applications, heritage polygons, 79-200 and historical
township zoning references, land-use/special-policy and brownfield CIP references.
Runtime coverage must verify counts before claiming the batch is live. Rows are
not distinct properties, unique data points or database imports. The Ontario
boundary count describes its full provincial feed rather than Niagara properties.

The eleven originally inspected regional feeds (219,047 rows at the local audit)
are **disabled and excluded from runtime counts**. Both the catalogue action API
and ordinary dataset/licence pages deny hosted reads with HTTP 403. The separate
Region-owned Hub has a placeholder terms link and no complete grant text. Blank
regional item terms alone are insufficient. No regional metadata/property/count
queries are performed by the public lookup or coverage route, and no proxy,
login, IP change or alternate restricted access is attempted. The audit fixtures
retain local evidence only; they are not an imported or live regional snapshot.

The original Ontario publisher item binds the exact typed LIO child and explicit
Ontario licence referral. Its individual active catalogue resource and complete
grant must agree before records/counts. A unique Ontario polygon at the precise
point must confirm the requested municipality before City property queries.
This identity screen covers all twelve Niagara municipalities without declaring
their core property evidence complete. Niagara Falls items refer to the City-owned
full Hub licence page, actually version 1.0; older CKAN labels are not operative.
Changed publisher/endpoint/schema/licence bindings fail closed.

Civic matching preserves suffix, street type and direction. Falls AV, CR and PY
abbreviations are queried and strictly checked against full civic components.
Shared points beyond 20 metres remain ambiguous. Regional civic resolution and
address-heritage are unavailable. Coordinate-only lookups skip City permit/address
histories. Selected attribute queries exclude owner, contact, roll/PIN and
editing-user fields; queries return at most 50 observations and expose truncation,
unknown source update dates, nested statuses and no-match limits.

Completed-permit records preserve raw status and dates without establishing
final inspections, occupancy or legal units. Planning application polygons
intersect the subject point, retain proposal/file text, and do not establish
current activity, approval, current zoning or nearby development. Full history,
current decisions, conditions and appeals remain unsearched.

79-200 zoning references are separate from the three historical former-township
maps: Crowland 1538 (1958), Humberstone 70-69 and Willoughby 395 (1966). The
service identifier B0395 does not mean By-law B03/95. A City-hosted November
2025 applicant report describes consolidation under 2025-102 and repeal of
Willoughby 395 (1966); this does not verify the enacted instrument, parcel
applicability or appeal effects. Current consolidation, written rules,
exceptions, holdings/removals and later amendments require City confirmation.
Current plan and secondary-plan policies are also unverified. On this audit,
City guidance described Northwest 2026-078/079 as signed September 9, 2026
and still in its appeal period until October 5; later current-status claims
require a fresh check.

Since March 31, 2025 the Niagara Official Plan belongs to the twelve local
municipalities. Unavailable regional reference polygons do not establish current local in-force
policies. The Other Wetlands description was explicitly DRAFT at the local audit;
its current status is unverified. No regional environmental/servicing records are
read. Current NPCA regulation, parcel-wide flood/natural-heritage conditions, water
quality, actual servicing connections and capacity remain unverified. Brownfield CIP membership
does not establish contamination, remediation, funding, eligibility or approval.

Ten sources are withheld without counts/records: six St. Catharines core
sources whose linked licence page returns an index rather than the complete
grant; the partial Falls boundary (the original licensed Ontario polygon is used);
current NPCA regulation; a provincial natural-system proxy with unresolved
lineage/rights; and a draft watercourse source requiring further audit. A
complete City Welland Hub grant and thirteen exact selected dataset
bindings have now been verified, as described below. No Niagara market is marked complete.

Primary guidance: [Region catalogue](https://niagaraopendata.ca/dataset/),
[Region grant](https://niagaraopendata.ca/pages/open-government-license-2-0-niagara-region),
[Falls grant](https://open.niagarafalls.ca/pages/terms-of-use),
[original Ontario boundary](https://geohub.lio.gov.on.ca/datasets/municipal-boundary-lower-and-single-tier),
[Ontario grant](https://www.ontario.ca/page/open-government-licence-ontario),
[current City zoning](https://niagarafalls.ca/building-planning-and-business/planning-and-development/zoning/),
[City-hosted 2025 applicant report](https://webpublic.niagarafalls.ca/Files/Planning/Applications/322/planning-justification-report.pdf),
[current secondary-plan guidance](https://niagarafalls.ca/building-planning-and-business/planning-and-development/long-range-plans-and-studies/secondary-plans/),
[Niagara plan transfer](https://www.niagararegion.ca/official-plan/default.aspx),
[NPCA permits](https://npca.ca/services/permits).


## Welland — source verification October 3, 2026

Thirteen licensed City feeds publish **30,039 overlapping source rows**: 22,461
civic points, 1,981 Current Zoning references, 2,014 Old Zoning references, 78
environmental protection and 125 environmental control zoning references,
2,608 Official Plan references across three children, 31 heritage records, 721
site-plan records, eight CIP, six BIA and six ward references. These are source
observations, not distinct properties, unique data points or imported rows.

The full [City grant](https://open-welland.hub.arcgis.com/pages/terms-of-use)
is bound to its exact City-owned Hub site/page, alias, AGOL item referrals and
separately identified enterprise services/typed children. Civic full address,
number, label, suffix, street type and direction must agree. Precise points and
one matching original Ontario municipality polygon are required before property
queries; that boundary feed is shared with Niagara and counted once.

Current and Old Zoning are separate source references. Verify applicability
and the City's [pre/post October 1, 2024 application transition](https://www.welland.ca/business-and-development/for-development/planning-and-zoning/comprehensive-zoning-by-law/).
Plan mapping preserves ProposedOP, Adopted_OP and appeal/deferral labels; the
[City's plan guidance](https://www.welland.ca/business-and-development/for-development/planning-and-zoning/official-plan/)
labels the February 2026 plan proposed. Neither older GIS labels nor public
page titles establish current in-force policy or appeal outcomes.

Heritage/site-plan records use exact civic-address City attributes without
returning or reusing cadastral geometry. Parcel identity remains unverified.
Raw site-plan dates, intended uses and statuses are kept: an Active record
received in 2000 does not establish current activity or approval. Current full
permit history, complete planning/variance decisions and nearby proposals remain
gaps. Supplier/2018 aerial-derived footprints are withheld; never use their
centroids for precise identity. CIP/BIA mapping does not establish adopted
programs, funding, eligibility, contamination, grants or levies. Environmental
zoning overlays do not screen current NPCA regulation or parcel-wide flood risk.
Source observation dates remain unknown when unpublished; returned records are
bounded to 50 and incomplete nested sources stay visible. Welland remains partial.

Seven positive controls cover three published civic addresses and four synthetic
interiors of inspected non-cadastral polygons. Run the public verifier sequentially:
`node --import tsx scripts/verify-welland.ts https://realist-lean.vercel.app /absolute/output.json`.
Coverage includes Guelph's serialized source session; do not run another Guelph
query or coverage verifier concurrently.


## Windsor — source verification October 3, 2026

Nine licensed City feeds publish **138,263 overlapping source rows**: 133,331
municipal civic attributes, one City boundary, 519 Section20 exception references,
1,058 heritage records, two heritage areas, nine BIA, 20 planning districts,
ten wards and 3,313 archaeological classification references. Counts describe
source records, including repeated/individual address observations; they are
not distinct properties, unique data points or imported rows.

The complete two-page [City OGL 1.0 grant](https://opendata.citywindsor.ca/Documents/OpenDataTermsofUse.pdf)
is checked by full PDF-byte hash, exact AGOL referral, public City publisher,
linked Hub site/page, City curation group membership, independent enterprise
root and named typed child, whitelisted field types and inspected lineage.
Published item orgId/serviceItemId/editingInfo values are absent on these sources;
no IDs or feed observation dates are invented.

The City’s generic AddressPoint metadata does not establish which street,
parcel-fabric or GPS method produced its positions. Its geometry is not used.
A suitable independently resolved national building point or caller-supplied
coordinate and one matching licensed Windsor municipal polygon are required
before spatial queries. Approximate street positions may return City civic and
heritage attributes only after a complete full-address/number/type/direction/
blank-unit match. These records retain `spatialScreenPerformed=false` and
`screenedPoint=null`; all polygon layers stay skipped. Coordinate-only calls do
not search civic or heritage addresses. Contradictory municipal/province inputs,
unknown points, unmatched or ambiguous boundaries cannot start property queries.

[S20](https://citywindsor.ca/documents/city-hall/by-laws-online/City%20of%20Windsor%20Consolidated%20Zoning%20By-law%208600%20%202026%20April.pdf)
means Section20 specific exceptions; it is separate from base zoning and the
[annex 85-18 regime](https://citywindsor.ca/residents/planning/plans-and-community-information/Zoning-By-law).
Current applicability, written text, holds, amendments, appeals and permissions
remain unverified. Planning districts are separate from current Official Plan
land-use schedules and adopted policy. Preserve raw heritage area/type/bylaw
and designation text: Walkerville/Victoria Avenue are published as Heritage Area,
which does not itself verify conservation-district designation. Heritage WARD
can contain Facilities/Parks custodian labels; use the separate ward reference.
Archaeological classifications are preliminary context, not a site inventory,
completed assessment, consultation, clearance or current Schedule C1 confirmation.

Ten gaps remain visible without records/counts: cadastral parcels, municipal
address geometry, address polygons, aerial-derived footprints/heights, complete
base/annex zoning, current Official Plan instruments, permit history, full
planning/variance histories and [ERCA regulatory mapping](https://www.essexregionconservation.ca/development-services).
The accessible Committee of Adjustment map and unbound child17 have blank terms;
they do not inherit neighbouring datasets’ grants. Public property inquiry access
is separate from commercial record reuse. ERCA says visual-reference mapping is
not a legal boundary and regulation may apply to unmapped areas; no-match cannot
establish flood safety or clearance. BIA/ward references do not verify current
levies, benefits, funding or election boundaries. Per-record edit dates remain
separate from unknown feed currency. Windsor and the broader CMA remain partial.

Positive controls include Willistead Manor at 1899 Niagara Street (five heritage
observations, Walkerville area/district, S.20(1)267 and ward4), Mackenzie Hall at
3277 Sandwich Street (exact-address heritage only with an approximate location),
8310 Enfield Place (City civic/district/ward, explicit empty heritage/exception
results), and two synthetic interiors of inspected BIA/archaeological polygons.
These synthetic coordinates are not surveyed properties. Run the public verifier
sequentially: `node --import tsx scripts/verify-windsor.ts https://realist-lean.vercel.app /absolute/output.json`. Coverage includes Guelph’s serialized source session.


## Barrie — source verification October 3, 2026

Eighteen licensed City feeds returned **75,764 overlapping source rows** at audit:
59,777 Current civic rows, one boundary reference, 4,921 active issued-permit
observations, 542 active application-point observations, 2,880 two-unit
registration rows, 4,332 zoning polygons, 484 site-plan-control references,
467 planning-application polygons, 2,233 plan land-use references, two MTSA
references, 94 cultural landmarks, one growth-centre reference, one historical
2008 built-up boundary, ten ward and ten separate Nov2026 ward references,
one special environmental policy area, eight historic-neighbourhood strategy
areas and zero employment-policy rows. Zero rows do not establish policy absence.
Rows overlap and are not unique properties, permits, field data points or imports.

[Official City portal](https://opendata.barrie.ca) item
7c5a1ebb6eb648e0be1e7bf1ff4f2e94 explicitly offers downloads under the complete
[Open Government Licence – Barrie 1.0](https://www.barrie.ca/Online%20Services/PublishingImages/OpenData_Images/COB_DataLicense.pdf).
Full three-page bytes SHA256
d23050c0c893d2d08328d63c7ed21cb8964e4deeae18a96ae960f231fa991bbd
and exact offer text are pinned. Site/publisher BarrieGIS, orgC964zBpHgJUpj4d0,
custom/default hostnames, catalogue scopes and City-curated content group
3ea69cc64836464a9b0e24064ca19e11 bind each selected item to that grant.
Per-item copyright/no-warranty disclaimers are preserved and independently pinned;
they are not mistaken for the grant itself. Public exact group/item membership,
independent fixed root and named typed child, lineage, field schema and source
credit are verified before records/counts. ArcGIS search omits orgId; that absence
is retained while authoritative full item/site/group orgId is verified.
MapServer serviceItemId, child objectIdField and editingInfo remain absent where
unpublished; no identifier or update epoch is invented.

Generic City civic metadata does not publish building/GPS accuracy or cadastral
lineage, so City civic geometry is not reused as precise property identity.
Full Current address, number, street type/direction and blank unit must agree.
A suitable independent building point or caller-verified coordinate requires one
licensed City boundary reference before spatial queries. Approximate independent
street/blockface positions can return strict civic attributes and exact permit/
registration rows, with spatialScreenPerformed=false/screenedPoint=null; polygon
and nearby screens skip. Coordinate-only requests skip address histories.
Current legal/January2026 annex boundaries remain unverified; reference-polygon
no-match does not establish outside present-day Barrie.

Permits preserve record/parent IDs, raw status and raw status-date text. The active
issued source describes permits opened since2018 and excludes complete older/
closed history. Two-unit rows preserve raw registration and unit fields without
claiming current legality, legal unit count, final inspection or occupancy.
Active application points publish neither addresses nor file numbers: the
bounded100m nearby screen is never assigned to the subject property. OBJECTID is
a GIS row identifier; distances use approximate published points, not lots.
Planning polygons preserve raw phase/status, received/approval/registration dates,
appeal field and proposed unit totals; current conditions and permission remain
unverified. The separate uncurated Site Plans child is not queried. City development
page plans/reports have separate viewing-only copyright terms and are not copied.

[Current City zoning guidance](https://www.barrie.ca/government/policies-laws/laws-listing/zoning-law)
reports July31,2026 office consolidation, with2009-141, former Innisfil054-04,
Springwater5000 and Oro-Medonte97-95 regimes applying in different areas.
[Allandale CPPS](https://www.barrie.ca/services-payments/permits-licences-applications/community-planning-permit-system-allandale-major-transit-station-area)
was adopted June17,2026 and is reported in effect, replacing2009-141, site-plan
control and minor variance within its area. The separate current CPP district
geometry is not connected; an MTSA reference is not substituted for it.
[Official Plan guidance](https://www.barrie.ca/government-news/adopted-strategies-plans/official-plan)
lists OPA1–8 consolidated as of July31,2026, including PPS2024, annexation and
Allandale CPP changes. GIS labels, raw2022/Approved references and historical
2008 built-up boundaries do not verify current instruments, amendments, appeals
or development permissions. Cultural monuments/landmarks and historic-neighbourhood
strategies are separate from individual/district designation; feature YEARBUILT
is never the subject building construction year. Current and Nov2026 ward
references stay separate with no unverified effective-date or councillor claims.

Twelve visible scope gaps cover civic geometry, current legal/annex boundary,
CPP districts, complete permits, active-application address identity, Site Plans,
current heritage register, variance, parcels, footprints, conservation regulation
and current planning instruments. No records/counts are read from unbound separate
feeds. Scientific watershed screens remain separate from current LSRCA/NVCA
regulation, floodplain and source-water originating rights. Personal/owner/legal
identifier/parcel/manager/editor/councillor fields are excluded. Query results are
bounded50, with transfer-limit failures and source gaps visible. Barrie and the
broader CMA remain partial.

Repeatable controls: scripts/verify-barrie.ts. The real1BlackbirdLane control
returns registration record3 Registered, nearby active application row69875 at
36m without property assignment, published R2-WS(SP-230), current ward7 and
separate Nov2026 ward8.351BayfieldStreet returns PMT18-00856, PMT22-02807 and
PMT26-00748 as raw Issued observations with raw date text; approximate location
uses address-only evidence. Planning/MTSA/special-policy polygon controls are
explicit synthetic non-cadastral interiors; cultural-feature point controls are
not surveyed properties.

Brantford: six City-curated reference feeds now use the full linked Hub Open Data License – Brantford 1.0 and exact official City offer. Civic components are strictly matched; independent precision and a unique named City boundary gate polygon screens. Catalogue zoning/footprint/water-body data are dated 2023 despite September2026 metadata edits. These are reference observations, not current zoning, permission, surveyed measurements, building age, floodplain or GRCA regulation. Eight core scopes remain withheld, including separate blank-grant permit/planning/current-zoning maps, full heritage, cadastral fabric, ADU records and current instruments. Reports include City/GRCA questions and document requests. Brantford and the Ontario expansion remain incomplete; source-row counts overlap and are not unique properties or imports.

Quinte West: four City-curated feeds add footprint row references at the subject point and parks, stormwater ponds and school locations within a 1,000-metre search buffer. A suitable independent point and unique complete original Ontario municipal polygon must name Quinte West before City spatial queries. Trenton, Frankford and Batawa are candidate aliases; the City boundary polyline is never used as a containment polygon. The reused province-wide municipality source is counted once. Exact public publisher/org, legacy portal `values.groups` curation, linked full municipal licence PDF, service lineage and typed fields are checked before query. The PDF's publisher redirect is restricted to one exact ArcGIS file path, with bounded body/hash verification; ordinary provider redirects remain disabled. Nearby rows are not assigned to the property, and source edit dates do not establish current condition. Footprints expose no measured area, height, floors, age, geometry or verified building identity. Parks do not establish current access/amenities; schools do not establish catchment or performance; ponds do not establish drainage, floodplain or conservation clearance. Eleven core/terrain scopes remain withheld. The general GIS has separate personal/non-commercial restrictions. The City’s 2022-derived contours/grid expressly are not survey-grade; originating rights, units and vertical datum remain unverified. Current zoning review and draft ARU plan amendment are separate from adopted permission.

Belleville: the originating City and Hub terms restrict commercial reuse. Seventy-four curated items and thirteen root services were inspected without property record, count or geometry queries. Nine withheld scopes are now visible in coverage/reports, with official terms and current-file questions. Separate national/provincial evidence remains available. Public DevReady access does not establish redistribution rights or current legal development permission. The Belleville–Quinte West CMA remains incomplete.

## Greater Sudbury — source verification October 3, 2026

Eight City-curated feeds returned **324,974 overlapping source rows**: 70,171
civic addresses, 117,701 archived/current permit observations, 8,518 zoning
polygons, 29 temporary-zoning polygons, 64,503 building-roofline references,
23 communities, 42 township references and 63,987 parcel references. These are
source rows, not unique properties, projects, field data points or database
imports. The reused original Ontario municipality feed is counted once.

The [City's official open-data offer](https://www.greatersudbury.ca/city-hall/open-government/open-data/),
[full licence 1.0](https://www.greatersudbury.ca/city-hall/open-government/open-data/licence/)
and current linked policy bind exact public publishers/org, catalogue group,
item terms and typed service/child lineage before record/count queries. Some
items link the former policy path, which was separately audited as a 301 to the
fixed current City policy. Runtime reads the fixed current policy and licence;
provider redirects remain disabled. The portal application's CC-BY-SA label is
separate from the selected datasets' City grant. The City zoning page's exact
current app/map lineage is also checked for zoning and temporary-zoning layers;
its other map layers do not acquire reuse rights from that check.

Only one complete active primary City civic point can select a location.
Retired, secondary, assigned-unit, duplicate, truncated or coordinate-conflicting
matches remain unresolved. A unique complete original Ontario municipal polygon
must name Greater Sudbury before City GIS or permit queries. All 23 published City community names were audited as candidates, including
Blezard Valley, Wahnapitae, Skead, Whitefish, McCrea Heights, Naughton, Wanup and
Guilletville. Specific source communities remain distinct; former Walden/Lively naming is not silently
crosswalked. Coordinate-only requests do not query permit addresses. Strict full
civic components preserve direction and number suffix. The two live unique
controls were 47 Maki Avenue and 993 Delwood Court; 200 Brady Street and 200
Mumford Drive in Lively had duplicate active primary rows and stopped spatial
screening. A further live control at 2777 Main Street, Blezard Valley resolved
one primary City point and returned GIS references; its permit no-match remains
explicit.

The [City permit legend](https://www.greatersudbury.ca/live/building-and-renovating/open-permit-search/)
distinguishes applications, issued permits and completed files. The raw feed's
`Complete` is not silently mapped to the legend's `Completed`; unrecognized
statuses retain raw evidence and unverified interpretation. Project dimensions,
units created and estimated value are permit-file evidence, not present building
facts. Metric/Imperial labels remain raw; Ground/Gross area units and estimated
value currency remain unverified. Strict calendar dates preserve unknown strings
without guessed conversions. Free-form project descriptions and all personal
contact fields are excluded. Feed data-edit dates, individual administrative
address dates and project events remain separate.

The [current zoning guidance](https://www.greatersudbury.ca/do-business/zoning/)
identifies 2010-100Z and says older PDF maps are outdated and official printed
publications prevail. Map labels are references; current written exceptions,
holds, amendments, appeals, temporary bylaw expiry/extensions and legal permission
remain unverified. Roofline heritage labels do not replace the current register;
no measured building area, height, construction year or parcel identity is
established. Township numeric codes have no verified name crosswalk.

Twelve core scopes remain withheld: complete permit history, current planning
instruments, planning applications, variance/consent, heritage, additional-unit
legality, wellhead/source protection, intake protection, watershed, airport,
floodplain and conservation regulation. Six separate constraint items used by
the City map have blank grants outside the inspected open group; no constraint
records, counts or geometry were queried. The [Official Plan page](https://www.greatersudbury.ca/city-hall/reports-studies-policies-and-plans/official-plan/)
separates Phase 1 effective April 26, 2019 from ongoing Phase 2 work. Current
property-level schedules and decisions need further integration. Greater Sudbury
and the Ontario expansion remain incomplete. Reports and the Homies skill retain
these gaps, source citations and concrete City/authority document requests.

Run the public verifier serially:
`node --import tsx scripts/verify-sudbury.ts https://realist-lean.vercel.app /absolute/output.json`.
Coverage contains a Guelph source session; do not run another Guelph lookup or
verifier concurrently.

## Thunder Bay — source verification October 3, 2026

Eight City-curated references publish 207,767 overlapping source rows: civic
45,102, parcel 52,699, footprint 107,697, district 1, Schedule A 2,128, Figure 9
3, historical City boundary 1 and historical register 136. These are source rows,
not unique properties, field data points or imports.

The configured references are civic attributes, OID-only parcel
and footprint references, Waverley Park heritage district, 2019 Official Plan
Schedule A land use, Figure 9 site-specific policy areas, a boundary originating
in the May 1969 Order in Council and the August 22, 2022 heritage CSV.

The [current City open-data offer](https://www.thunderbay.ca/city-hall/thunder-bay-open-data/)
and [full licence 1.0 PDF](https://www.thunderbay.ca/media/inmjquon/city-of-thunder-bay-open-data-licence.pdf)
permit commercial copy/adapt/distribute with attribution, excluding personal and
inaccessible information, unauthorized third-party rights, official marks and
endorsement. All 18 clauses were read. Dataset-linked old licence URL returns
404; the current official offer explicitly supplies the same complete version
1.0 dated March 12, 2020. The PDF is byte-pinned (SHA-256
`dbb70ac323a4aae50a57fee87a3b1b60b1b34aefda9189a92b57df4c3ea743dc`).
The complete City offer, privacy/selection guidance and web licence are also
pinned. Only per-request local accordion UUID fragments are canonicalized;
full text and originating external links remain part of the pin.

The exact City-linked Hub `0c64648ebf51412b99732c13b81c3979`, owner
`ChrisDoyle1`, top-level `catalog.groups` and public open-data group
`169818a570a44bcfae6afd78d055f37a` curate 85 items. Public site/group/dataset
metadata omits `orgId`; do not invent it. Exact publisher
`opendata_Thunderbay`, curated membership, hosted service path under
`services5.arcgis.com/h9xShea49ZANgOtx`, dataset terms, item/root/child lineage,
descriptions/copyright and typed whitelist fields must agree before queries.
This grant is not extended to separate uncurated dashboards/general-GIS sources.

Civic evidence preserves complete address, number/suffix, street/type/direction,
city/province and address type. Only a complete unique `ADDRESS-REGULAR` match
is reported as available attributes. The City describes the point source as
original CAD centroid layers; its geometry is never requested or reused and
active-address/current building precision is not inferred. Duplicate, non-regular
or truncated evidence stops spatial screening. An independent precise national
building/civic point or caller coordinate plus one unique complete original
Ontario municipality polygon naming Thunder Bay is required for City spatial
queries. That provincial dataset is reused and counted once. The City 1969
boundary reference is not this containment gate. No parcel/footprint geometry,
PIN, ownership, area, elevation, construction age, condition or legal/current
units are returned.

The licensed plan Feature Layers are explicitly **2019 references**, separate
from the current official app's services. Data edit dates are not proof of a
current consolidated instrument. The [City property guidance](https://www.thunderbay.ca/growth/build-thunder-bay-your-one-stop-development-shop/find-zoning-and-property-information/)
links the Official Plan consolidation to August 26, 2024 and subsequent Appendix
3 amendments, zoning 1-2022 effective April 11, 2022 and zoning consolidation to
May 27, 2024. Its zoning app points to `2022DRAFT_ZoningMap` with draft-proposal
metadata and blank originating grant; exact current adoption/reuse lineage remains
unverified. No current zoning records, counts or geometry are queried.

The [current heritage page](https://www.thunderbay.ca/city-hall/history-heritage-and-records/heritage-in-thunder-bay/heritage-properties/)
announces five June 2026 designations under bylaw 219-2026. The licensed export
is fixed to August 22, 2022 and is presented only as historical exact-civic
observations. Preserve raw `Listed`, `Designated`, mixed district/listed statuses,
bylaw/report and approximate construction labels. Ownership is omitted. Current
status, exact instruments, amendments/appeals and parcel-wide applicability need
confirmation. Waverley Park GIS derives bylaw 65-1988 and is a district reference,
not the complete current property register. The CSV's complete byte hash and
schema/vintage are verified before parsing; changes fail closed for re-audit.

The public permit portal was inspected through its ordinary anonymous **Public
Search** workflow. It warns that files may be inaccurate and may omit history;
City guidance limits searchable zoning amendments/variances to after April 11,
2022. The City-linked dashboard describes building activity since 2014, but its
permit item `a00d2d4d7e964f368095a98a71de8976` has blank grant outside the
curated open group. Its metadata was inspected; records/counts/geometry were not.
Current complete permits, inspection/occupancy, planning decisions/conditions,
heritage/ADU registers and current instruments remain explicit gaps. A certified
City Property Information Report is a separate paid/account workflow.

[Lakehead's current mapping guidance](https://lakeheadca.com/planning-permits/map-your-property/)
identifies conceptual screening and warns that not all regulated areas are
mapped. [LRCA development guidance](https://lakeheadca.com/planning-permits/development-regulations/)
identifies Ontario Regulation 41/24. Originating reuse rights/current adapters for
regulation, flood and source protection are unverified; no such records/counts/
geometry are queried. The airport-height candidate combines third-party Airport
Authority surfaces and City bylaw 100-2010; originating rights, current instrument,
units and vertical datum need audit before interpretation. Point references and
no-matches never establish legal permission, safety, insurance or clearance.
Thunder Bay remains incomplete.

Bounded source verifier:
`node --import tsx scripts/verify-thunderbay-sources.ts /absolute/output.json`.

Seven bounded address controls verify four independent building points, two
blockface skips and one civic-only/no national-location result. Two Waverley
Street addresses return district references while preserving civic no-match
from the separate City Waverly spelling. The City published street-name domain
is used for query candidates; literal apostrophes and SQ/SQUARE types are
handled without weakening direction, suffix, City/province or unit identity.


## North Bay and Sault Ste. Marie — originating reuse gaps (October 3, 2026)

Both centres now expose explicit gaps and City/authority document questions in the API, coverage, roadmap, full report and native Homies skill. No new source rows are counted, and neither market is complete. No municipal/authority property records, counts or geometry were queried.

North Bay's current City-linked Explore Hub (site 659061e0ca5a4b5abf304eea1b929996, owner NorthBay) links the City's restrictive legal terms. Its top-level catalogue group exposes three Hub pages, not three property feeds. Linked application/map/parcel metadata was inspected separately; no specific compatible grant was found. The zoning page independently requires express written permission before disclosure to third parties and gives official printed instruments precedence. The current office consolidation label is July 15, 2026 for 2015-30. NBMCA's complete mapping terms prohibit data scraping and third-party disclosure/transfer except permitted generated maps; no viewer agreement was accepted or service queried. Its 41/24 mapping is approximate and can omit regulated areas, and conservation, drinking-water and septic jurisdictions differ.

Useful manual checks: North Bay's ADU page includes a four-total-unit urban section and retained three-total-unit 2023 section. Resolve the applicable current rule, settlement/rural scope, registration and occupancy with the City; do not select either section as property permission. RRHL guidance says the program is under review/on hold, which does not establish exemption or compliant units. STR licensing is separate. Heritage recognition priorities/glass plaques and the 2018 guide are distinct from the current statutory register and operative designation instruments.

Sault Ste. Marie's normal public browser displays a SooMaps disclaimer prohibiting commercial use, expressly including consumed map services. It was read with the agreement unchecked and closed. Web-tool 502 and terminal TLS validation failure were retained; no insecure TLS workaround. The City website separately requires consent for reproduction. Current zoning 2005-150 and consolidated special exceptions require instrument/appeal verification; the published plan is separate from Shape the Sault's proposed draft. Applicant access is required for permit management/inspection results; key-based inspection booking is not anonymous inspection evidence. Monthly statistics are separate from full property history and a reuse grant. The map splash retains Floodline 2019/176_06 wording; current SSMRCA lineage/instruments remain unresolved. Authority homepage and provincial-law web fetch returned HTTP403, without retries or bypass. Heritage, planning/Committee decisions, ADU registration and parcel-wide authority/source-protection confirmation remain manual gaps.

Sources: [North Bay terms](https://northbay.ca/legal/), [North Bay zoning](https://northbay.ca/services-payments/building-development/planning-applications/zoning-by-laws/), [NBMCA complete mapping terms](https://nbmca.ca/planning-development-permits/map-your-property/), [SooMaps](https://www.soomaps.com/), [Sault City disclaimer](https://saultstemarie.ca/privacy-policy/), [Sault permit services](https://apps.saultstemarie.ca/cityapps/). Complete local research evidence is retained in Homies outputs/northbay-sault-research-2026-10-03. No outreach, agreement acceptance or protected-record access occurred.

## Sarnia — licensed catalogue references, 2026-10-03

The official [City GIS open-data offer](https://www.sarnia.ca/city-of-sarnia-open-data-portal/) links Sarnia GeoHub (`28a2a847e147447f8eb6ddc6025d561b`), its exact curated group (`b649f143e4a842e1a923dca3b3279eeb`) and linked [complete City OGL terms](https://city-of-sarnia.hub.arcgis.com/pages/terms-of-use) (`4acef04992034598a45181305786d2f3`). Five selected City-published roots/typed children have the same full grant independently pinned. Anonymous metadata omits orgId and group isOpenData; the adapter retains that absence and binds the exact offer, Hub/page/group, publisher `troy.fox` and fixed `services1.arcgis.com/ICybsLmBXrZCZV3x` lineage. City website terms are separate; the Hub offer is not extended to unrelated PDFs/apps or blank-grant datasets outside this group.

| Selected feed | Typed child | Verified source rows | Scope |
| --- | --- | ---: | --- |
| Addresses Open Data `2ed254db85d6442a8b040213c0c6b097` | 0 | 26,958 | Strict unique full civic/component match; no source geometry reuse |
| Zoning Open Data `6a10a84c460e4ea3814ffce7bf0faa1a` | 1 | 926 | Catalogue labels/bylaw/effect-date observation at independent point; current instrument unverified |
| Buildings Open Data `06d19190ebe24188afe310c94a05fbcc` | 2 | 40,444 | Footprint row identifiers only; no geometry/area/generalized-use/age/current identity |
| Development Charges Open Data `063155193efa4a019a4ad1996c735312` | 0 | 3 | Charge-area type; no rate, payment, exemption, eligibility or servicing conclusion |
| Parks Open Data `42d6cf7eb6224579b1c6f3a16c810636` | 0 | 107 | Park polygons intersecting 1,000-metre buffer; nearby references, no nearest ranking/walking/current-amenity conclusion |

Total **68,438 overlapping source rows**, not unique properties, field data points or imported records. These five feeds use bounded cached live queries. The licensed original Ontario municipal polygon must uniquely name Sarnia before City spatial reads; its province-wide count is already included elsewhere and is not duplicated here. Approximate independent street/blockface points may return strict complete civic attributes only. Duplicates, truncation and identity conflicts stop property screening; unit-specific requests remain unsupported. Point screening is not parcel-wide clearance. Preserve dataLastEditDate separately from item/schema edits.

Thirteen explicit gaps remain: complete permit/inspection/occupancy history; current planning decisions/pipeline; variance/consent; current zoning; current planning instruments; complete heritage; legal ADUs; cadastral/title/measurements; SCRCA regulation; floodplain; airport height/noise; shoreline management; source protection. The separate pipeline dashboard `b8aadf68bb554cf2877db64c65b2e1ef` → map `118987d2854448b2aff6978c39a619a6` → tracker `daa729f7630e4598b7f05e7ebc82f5e5` has blank grants outside the 14-item catalogue; no record/count/geometry queries were performed. Hazard, airport and shoreline children of the zoning root are excluded pending original rights/current legal lineage.

The [City zoning page](https://www.sarnia.ca/planning-zoning-by-law-document/) and [2026 review](https://www.speakupsarnia.ca/zoning) do not establish replacement adoption/repeal from a draft public meeting. Confirm current 85-of-2002 rules and any adopted replacement, amendments/holds/appeals, current [Official Plan instruments](https://www.sarnia.ca/official-plan-document/) and [charge rates/exemptions](https://www.sarnia.ca/development-charges-guidelines/). [Permit guidance](https://www.sarnia.ca/construction-projects-and-renovations/building-permits/) sends permit copies/history through issuer/Clerk processes; applications/statistics do not verify final inspections. [SCRCA](https://www.scrca.on.ca/planning-and-regulations/map-your-property/) warns mapping can omit regulated areas under Regulation 41/24. Its separate viewer agreement was not accepted and no authority property data was queried. Full sourced native Homies artifacts carry all returned evidence, limits, gaps, City/authority questions and document requests. **Sarnia remains incomplete.**

## Chatham-Kent — reuse audit and drain obligations, 2026-10-03

The [City-linked Hub](https://opendata.chatham-kent.ca/) (`e3abcef27a1d4673b14fb37b88563e9a`, owner `CK_agol_admin`, org `BlSm9A1poQIGIz9S`) exposes 40 curated items in group `7c964e660e2c469383b0f2d206d68ac6`, with complete pagination. Pages, apps and document links are included; this is not 40 property feeds. Eleven catalogue Feature Services plus separately linked zoning and pump sources were inspected at root and typed-child metadata level. **No City or authority property records, counts or geometry were queried.**

The complete [City terms](https://www.chatham-kent.ca/Pages/Terms-of-Use.aspx) permit a personal non-commercial copy. The [Hub terms](https://opendata.chatham-kent.ca/pages/terms) offer disclaimers and a data-sharing-agreement process for municipal contract projects, without establishing a compatible commercial API grant. The current [City-linked zoning viewer](https://opendata.chatham-kent.ca/apps/6d64f5dbdac44ba5831d310321f0beed/explore) expressly restricts scraping and redistribution. Its map `7bd2187c0cb54cda8263d7ad29ca1d8e` points to `89ce208974094e6184daa05198a88776`, child 11; item/root/child metadata supplies no specific reuse exception. Blank grants on public address, settlement and ward sources are retained as unresolved rights.

The [drainage viewer](https://opendata.chatham-kent.ca/apps/049eb12a858744c085b882849f9fe57d/explore), map `96dadbc07e164eee9ca69d72204bae6a`, points to `2021MunicipalDrains-secured` (`c2184e0291e740aca0d1a98ffb856557`) through a utility proxy. Its grant is blank. No protected endpoint was queried or replaced. Pump item `12cd01fb4e5d4a65a59c3fb8752d89d7` contains a network-suitability warning, not a reuse grant. Mapped proximity would not establish an actual connection, assessed liability, capacity or flood protection.

The API, report, brief and hosted skill now include separate incomplete scopes and actionable requests for:

- Current 216-2009 zoning, Schedule B exceptions/holds/amendments/appeals, adopted Official Plan and unconsolidated secondary plans; draft growth proposals remain separate.
- Complete permits, final inspections/occupancy and planning/Committee decisions with satisfied conditions.
- Legal unit identity separately from pre-approved designs or grants, and current statutory heritage status/instruments separately from public register sections.
- The property's municipal drain assessment schedule, engineer's report/bylaw, easements, unpaid construction/maintenance charges and pending work. [City drainage guidance](https://www.chatham-kent.ca/services/Drainage/Pages/Municipal-Drains.aspx) identifies private owners among those bearing drain costs; no subject charge is calculated.
- Current parcel-wide shoreline/flood/airport/source-protection constraints and relevant authority jurisdiction. The [current official LTVCA page](https://lowerthames-conservation.on.ca/planning-regulations/regulated-areas-map/) links app `7fcbaf0fe62f4b24b07cee640d3072bb`, whose complete terms are non-transferable and prohibit derivative products without consent; third-party rights are separate. SCRCA remains a distinct source/jurisdiction scope. No map agreement was accepted.

Named City communities select manual research scope only; they do not confirm municipal containment or surveyed identity. Independent national/provincial evidence remains available where separately supported. There are **zero new integrated feeds or counted source rows** in this audit. Chatham-Kent and the Ontario expansion remain incomplete. Evidence is retained in Homies outputs/chatham-current-audit-2026-10-03.


### Cornwall source expansion — 2026-10-03

Five City-curated feeds are connected under the complete Open Government Licence – City of Cornwall 2.0: municipal addresses (20,698 rows), catalogue zoning labels (370), designated heritage site references (18), footprint identifiers (33,580) and Schedule 1 land-use labels (106). This audited snapshot totals **54,772 overlapping source rows**, not unique properties, field data points or imports. Runtime coverage verifies current counts independently; failures remain unavailable.

The current official open-data offer explicitly binds the exact Hub/group to the fully read current licence PDF. Old individual dataset licence links return 404 and are not treated as valid grants. Runtime checks bind full PDF bytes and the complete offer section, public publisher/org, exact curation, item/root/typed child and field domains. Search results omit orgId for four items while direct item metadata publishes it; preserve those observed distinctions. Attribution: “Contains information licensed under the Open Government Licence – City of Cornwall.” Third-party and personal-information exemptions remain in effect.

The City source explicitly describes address points as over their represented buildings. One complete unique PRIMARY civic record, matching full number/street/long-street/suffix/direction/municipality/province/country without unresolved unit/floor/building distinctions, can provide its published WGS84 point after one complete original licensed Ontario polygon names Cornwall. Other City points are not promoted. Duplicate, truncated, conflicting or unsupported civic evidence stops reference queries. The City Municipal_Boundary is a polyline and is not used for containment. The original Ontario polygon feed is counted once elsewhere. Independent approximate street/blockface results can return strict civic attributes only. Source points remain separate from present building condition, legal units or surveyed identity.

Footprint item description claims 2022 mapping while its originating service description claims 2017; both are retained and vintage remains unresolved. Only row identifiers are returned, excluding footprint geometry/measurements, STORIES/USAGE, construction age, condition and unit count. The designated-sites data-edit date is March 8, 2022; current listed/designated/district instruments remain separate. Current City zoning app `9fdb7331d3364917b441bfc97f9e71a9` → web map `8d55d928820e4ad4a6f8341c0492e080` references the integrated zoning/address children. This establishes published lineage, not current written rules or permission. City-linked zoning 2022-001 office consolidation is December 2025 and warns of possible omissions; the plan download is a June 2025 consolidation of the 2017 adopted plan. Later amendments/appeals and actual property applicability remain unverified.

Fourteen explicit unqueried scopes remain: complete permits/inspection/occupancy, current zoning and plan instruments, planning/variance decisions, full current heritage, legal units, original cadastral rights, RRCA regulation/flood, shoreline and Cornwall Sediment Strategy constraints, intake protection and airport surfaces. Approximate parcel/ROLLNO records/counts/geometry are withheld pending original rights. No map labels establish clearance, contamination, water safety or legal unit count. City permit guidance assigns private septic approvals to South Nation Conservation; this is a separate future original-source audit.

The report requests a City Work Order Report, Zoning Compliance Letter, Agreement Compliance Letter, complete property files/current instruments, a survey and an RRCA formal Property Inquiry. These request/payment workflows are not completed by the API. RRCA states regulatory mapping may require site verification; current parcel-wide proposed-work requirements remain for authority confirmation. All source facts, dates, scope/unknowns and document requests feed the hosted one-click Homies skill and native artifact/link flow. Cornwall remains **partial**, and Ontario-wide completion remains in progress.

Sources: [City open data](https://www.cornwall.ca/en/government-council/opendata/), [full City licence](https://media-003-ca.cdn.govstack.com/cornwall-ca/media/5i0aznnd/city-of-cornwall-open-government-licence.pdf), [zoning](https://www.cornwall.ca/en/build-invest/zoning/), [Official Plan](https://www.cornwall.ca/en/build-invest/official-plan/), [property report requests](https://www.cornwall.ca/en/build-invest/planning-and-development/work-order-reports-and-compliance-letters/), [heritage](https://www.cornwall.ca/en/recreation-community-supports/history-and-heritage/), [RRCA regulatory mapping](https://rrca.on.ca/page.php?id=158), [RRCA waterfront guidance](https://rrca.on.ca/page.php?id=111), [Cornwall source protection](https://yourdrinkingwater.ca/page.php?id=12).

### Simcoe County and Orillia references — 2026-10-03

Five County feeds are explicitly marked DOWNLOAD and licensed under the County's Open Government Licence 1.0 exception: civic attributes (259,079 source rows), general building references (141,925), unofficial jurisdiction labels (21), ward labels (72) and collection zones (13). The audited snapshot totals **401,110 overlapping source rows**, counted once across 18 supported municipalities including separated Barrie and Orillia references. This is not a unique-property, field-data-point or import count, or proof of each city's coverage. Runtime verifies live counts independently.

The complete County terms and licence text plus every anchor are pinned, excluding only non-licence script/style content. Runtime binds the exact original layer-to-feature-type pointer, namespace/store, DOWNLOAD keyword, full source definition/projection/schema and attribute types. WFS requests select bounded attributes, never owners, assessment codes, parcel geometry or building measurements. No record/count/geometry request is made to non-download parks, BIA/incentives, Linx or forest feeds. The protected Enterprise group remains unavailable; its public visibility is not treated as a reuse grant.

County civic geometry describes property locations and is never promoted to a precise building point. Full number/street/municipality/no-unit components must agree uniquely in a complete query. **50 Andrew Street South, Orillia returns three distinct civic observations**; those records remain ambiguous and halt County spatial screens. Independent precise or caller-supplied points require one complete original Ontario municipality polygon naming the requested municipality. Unofficial County borders never provide containment. Four reference queries use explicit CRS84 point intersection and return no geometry; the published WFS shape type is generic, so no polygon-area or building-identity claim is made. Generated WFS IDs identify observations in one response only.

Map metadata modification dates are separate from unknown data observation/update times. The building source describes a two-to-three-year imagery cycle; ward metadata names no election year. Orillia's inspected point returns a literal **NO COLLECTION** County zone and no County ward reference. Neither establishes absence of separate City waste service or a current ward assignment. Source vintage, duplicate/truncation/failure/no-match uncertainty and remaining local files flow into reports and the one-click native Homies artifact/link workflow.

Orillia City address/zoning/Official Plan map grants remain unverified. Current City property-compliance guidance offers a separate report for owners/authorized lawyers, covering current planning and active building/inspection/occupancy/order information; tax/water payments and Fire Code compliance are excluded. This release links that workflow and does not submit it or fetch restricted files. Current municipal permits/decisions/heritage/units, exact legal instruments, cadastral and original authority layers remain under audit. Orillia and every other County market remain **partial**, with Ontario-wide completion in progress.

Sources: [County viewer](https://opengis.simcoe.ca/), [complete terms](https://maps.simcoe.ca/terms.html), [County licence](https://maps.simcoe.ca/openlicense.html), [Orillia property compliance](https://www.orillia.ca/build-and-invest/permits-and-inspections/property-compliance/), [Orillia planning documents](https://www.orillia.ca/build-and-invest/planning-and-development/planning-documents/), [City permits](https://www.orillia.ca/build-and-invest/permits-and-inspections/building-permits-and-inspections/building-permits/). Source audit evidence is retained in the local Orillia/Simcoe audit handoff.

## Timmins and province-wide aggregate context — October 4, 2026 UTC

Timmins now has a source-guidance and originating-rights audit, without City/CGIS property records, counts or geometry queries. [City web/API terms](https://www.timmins.ca/find_or_learn_about/web_service_use_agreement) assert City ownership; no compatible specific redistribution grant was established. This is not an explicit noncommercial-only ban. The original [CommunityPAL offer](https://www.cgis.com/cpal/Default.aspx?CLIENT=Timmins) redirects to UnsupportedBrowser; no map agreement was accepted or alternate endpoint/authentication/TLS bypass used. City-offered current Committee, source-protection and MRCA links returned HTTP403 without retry/bypass. This is a bounded source-guidance audit, not a complete municipal/authority catalogue review.

[Zoning guidance](https://www.timmins.ca/our_services/building_and_planning/planning/zoning_by_law) identifies 2011-7100 as amended. [Official Plan guidance](https://www.timmins.ca/our_services/building_and_planning/planning/official_plan) reports approval July 16, 2010/in-force August 10, 2010 and offers a 2019-labelled ZIP; current complete instruments remain unverified. Current directory titles, proposed rezoning notices and public meetings do not establish adopted permissions. [Permit guidance](https://www.timmins.ca/our_services/building_and_planning/building/building_permits) links CGIS applications, which do not expose a verified reusable full permit/inspection/occupancy history. Serviced-area unit and parking guidance is separate from unit-specific legality, actual servicing, rural applicability and incentives. [Heritage guidance](https://www.timmins.ca/find_or_learn_about/municipal_heritage_register) directs users to CommunityPAL and separate statutory instruments; ask the Clerk for current listed/designated/district status and designation/amending by-laws with Schedule B attributes. Obtain signed/registered site-plan agreements and approved drawings separately from applications.

Timmins reports/briefs now preserve municipal civic/parcel, permit, detailed zoning, plan, planning/Committee, heritage/unit, site-plan, regulation/source-protection and AMIS gaps. They ask for full current property files, operative instruments/appeals/conditions, actual servicing and professional mining-history/closure/rehabilitation investigations where relevant. The City/authority audit remains incomplete and Timmins is not marked complete.

Independently licensed province-wide pit/quarry authorization context adds three original LIO children and 8,463 observed polygon rows (5,591 active, 2,794 inactive, 78 partial surrender), described in [ONTARIO-AGGREGATES.md](ONTARIO-AGGREGATES.md). Results preserve separate raw statuses, authorization IDs, limits, area, source accuracy and record timestamps. Nearby polygons do not establish subject parcel overlap, current extraction, impacts, rehabilitation, water safety or development permission. Counts overlap and are neither unique properties nor imports. Ontario AMIS has separate restrictive commercial/value-added terms; no AMIS records/counts/KML/geometry were queried.

## Original lot/township baseline and Kawartha Lakes audit, October 4 UTC

[Two original Ontario reference feeds](./ONTARIO-FABRIC.md) add 292,826 lot/concession polygons and 2,528 geographic township polygons: 295,354 overlapping reference rows, not unique properties or imports. Preserve accuracy, raw labels and dates; current survey/title, modern parcel and legal access remain unverified.

[Kawartha Lakes](./KAWARTHA-LAKES.md) adds dated source guidance for rural zoning appeals/review, operative plans, separate authorized building/septic searches, ARU registration, current heritage and shoreline/road-allowance files. City reuse grants are unresolved; parcel sharing has a separate explicit restriction. The OGL-labelled Regulated Area is OHN waterbody mapping, and the licensed natural-heritage archive is a historical 2012 conversion candidate, so neither establishes current regulation. No City property feed is integrated or counted. All market completion flags remain false.


## Woodstock/Oxford and original Ontario lidar index

Woodstock advances to an audited reuse gap with dated City/County source guidance,
current planning/record-search routes, explicit municipal layer gaps and report
document requests. No City/County property features, counts or geometry are
queried. Open-data definitions and blank/reference grants are assessed separately
from the contractor data-request restriction and main County website terms; no
categorical blanket ban is inferred. POLARIS/Teranet/MPAC lineage and mixed
City/provincial contours remain unresolved. Current text consolidation, Q2 2026
mapping, awaiting-consolidation amendments, conditional ARU eligibility, separate
Legal Compliance Letter, older-file gaps and conflicting survey-release guidance
remain explicit. See [WOODSTOCK.md](WOODSTOCK.md). Other Oxford markets retain
their individual queued audit status.

The original separately licensed Ontario lidar package index adds one shared feed
and an independently observed 420 overlapping package polygons. It returns
package/project references and reported raster resolution, retaining overlaps;
no geometry, pixels, elevation, slope, building height or regulatory findings.
Direct original raster sampling timed out and stays unintegrated. Package index
coverage does not verify actual raster coverage; resolution is not accuracy and
raw project-year labels are not verified acquisition dates. Counts are source
index rows, not properties, pixels, data points or imports. See
[ONTARIO-LIDAR.md](ONTARIO-LIDAR.md). All major-market completion remains unproven;
Stratford/Perth now has the separately documented audit below; other queued regional markets remain next candidates.

## Stratford/Perth and original generalized source-protection reference

[Stratford](STRATFORD.md) advances to an audited reuse gap with scoped City/County rights findings, current manual property-file routes, explicit ARU/document-vintage conflicts, survey authorization/timing differences, heritage/district guidance and original-authority document requests. No City/County property records, counts or geometry are integrated. Stratford PEI and the County member municipalities remain separate scopes.

[The original Ontario generalized source-protection feed](ONTARIO-SOURCE-PROTECTION.md) adds one independently licensed shared reference and 118 natively observed boundary rows. It returns raw IDs, accuracy and historical 2012 lookup labels with separate date provenance; it does not establish current legal boundaries, vulnerable areas, activity-specific policies, actual water supply or water safety. Generalized reference rows are neither distinct areas/properties nor imports. All market completion flags remain false. Owen Sound and other queued regional markets remain next audit candidates.
