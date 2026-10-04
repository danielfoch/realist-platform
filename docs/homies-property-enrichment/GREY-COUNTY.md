# Grey County references

Audited October 4, 2026. Five individually licensed originating County feeds are
enabled for suitable independently supplied Ontario points in Owen Sound,
Georgian Bluffs, Meaford, The Blue Mountains, Chatsworth, Southgate, West Grey,
Grey Highlands and Hanover. This is shared reference coverage; each municipality
still needs its own current local source audit.

| Layer | Original item | Selected child | Source rows |
| --- | --- | --- | ---: |
| Settlement reference | f16f12e9f4f549d5a46331aa844599a1 | Reference FeatureServer/4 | 56 |
| Historical land use | c0a0ede3dc764d17a819adf6c46c614f | Official Plan MapServer/30 | 6,734 |
| Historical karst | 7878345b8e154bb9bdd2109aefe52d2e | Official Plan MapServer/9 | 380 |
| Historical significant woodlands | 4a67de16fa3e4fa9af8e3569cd862d66 | Official Plan MapServer/16 | 3,222 |
| Historical significant valleylands | 0a97ed4e85c840199d22cba0793c18fe | Official Plan MapServer/15 | 37 |

The **10,429 source rows overlap**. They are not unique properties, field data
points or database imports. The duplicate settlement offer is excluded; the
original provincial municipal boundary gate is already counted elsewhere.

## Rights and identity

The originating [County site](https://maps.grey.ca) offers a separate full
[Open Data Licence within its terms page](https://maps.grey.ca/pages/terms).
Its commercial reuse grant applies to these explicitly offered datasets and
does not replace the separate restrictive GIS-viewer terms or third-party
rights. The runtime validates the exact site/page binding, full terms text and
links, each item's owner, organisation, public access, licence and description,
original service item, selected child, complete typed schema, description and
copyright before feature or count queries. A changed grant or schema fails closed.

The current terms page item is `9bada6ae370e479f8fa98774a0219bd5`, bound to site
`645d414b2614427e91efc9c197c79657`; full normalized terms hash is
`849b8c1cb6062a8020e558d85d3c35e97f0ceaad87505a85aea7b50b9ab71f70`.
Blank/restricted City parcel and zoning offers, MNR-labelled County boundaries,
and unrelated protected Simcoe Enterprise services are not queried or counted.

## Query and interpretation

The original licensed Ontario municipality polygon must uniquely agree with the
named municipality before any County point query. County parcels/labels never
establish that gate. Interpolated, inconsistent, invalid or self-derived County
points are skipped. Queries return selected attributes only, with 51 source rows
and 50 displayed rows maximum; overlaps and incomplete/capped responses remain
ambiguous. Malformed typed empty responses, extra fields, geometry, duplicate or
invalid identities and coerced dates are rejected.

The plan service explicitly says **2018 Official Plan**; woodland/valleyland
catalogue descriptions refer to 2017 sources. Current item metadata timestamps
and source edit epochs are separate from observation dates and policy effect.
Raw date epochs are preserved; timezone and observation currency are unresolved.
An Owen Sound settlement row retains its 2013 edit epoch despite newer source
metadata. Complete point no-match results establish no parcel-wide absence.

These references establish no surveyed boundary, parcel identity, current zoning,
operative County/local policy, development permission, actual servicing/capacity,
current conservation regulation, water safety or insurance outcome. Obtain the
current applicable County/local instruments and property-specific evidence.
The [County approval FAQ](https://www.grey.ca/government/land-use-planning/land-use-planning-frequently-asked-questions)
expressly treats Owen Sound differently from the other eight member municipalities.

Native source metadata, full terms, schemas, bounded queries/counts and a real
Ontario municipal containment response are retained in the audit receipts and
test fixture. A caller point at 44.568, -80.941 returned settlement and historical
land-use references and complete empty karst/woodland/valleyland point results.
