import { fetchJson, literal, rows, socrata } from "./http";
import { cityKey, date, layer, number, publishedYear, sameStreet, streetKey, streetNumber, text, type Layer, type Row, type Source } from "./model";

export const SOURCES: Record<string, Source> = {
  calgary: { id: "calgary-assessment", name: "Calgary current property assessment", url: "https://data.calgary.ca/d/4bsw-nn7w", licence: "City of Calgary Open Data Terms of Use", attribution: "Contains information licensed under the Open Data Terms of Use of The City of Calgary." },
  winnipeg: { id: "winnipeg-assessment", name: "Winnipeg assessment parcels", url: "https://data.winnipeg.ca/d/d4mq-wa44", licence: "Open Government Licence – Winnipeg", attribution: "Contains information licensed under the Open Government Licence – City of Winnipeg." },
  edmonton: { id: "edmonton-assessment", name: "Edmonton current property assessment", url: "https://data.edmonton.ca/d/q7d6-ambg", licence: "City of Edmonton Open Data Terms of Use", attribution: "Source: City of Edmonton, Property Assessment Data (Current Calendar Year)." },
  ns: { id: "ns-pvsc-characteristics", name: "Nova Scotia PVSC dwelling characteristics", url: "https://www.thedatazone.ca/d/a859-xvcs", licence: "Open Data and Information Government Licence – PVSC and Participating Municipalities", attribution: "Contains information from PVSC, licensed under the Open Data and Information Government Licence – PVSC and Participating Municipalities." },
  "calgary-permits": { id: "calgary-permits", name: "Calgary building permits", url: "https://data.calgary.ca/d/c2es-76ed", licence: "City of Calgary Open Data Terms of Use", attribution: "Contains information licensed under the Open Data Terms of Use of The City of Calgary." },
  "vancouver-permits": { id: "vancouver-permits", name: "Vancouver issued building permits", url: "https://opendata.vancouver.ca/explore/dataset/issued-building-permits/", licence: "Open Government Licence – Vancouver", attribution: "Contains information licensed under the Open Government Licence – Vancouver." },
  "toronto-variance": { id: "toronto-variance", name: "Toronto Committee of Adjustment applications", url: "https://open.toronto.ca/dataset/committee-of-adjustment-applications/", licence: "Open Government Licence – Toronto", attribution: "Contains information licensed under the Open Government Licence – Toronto." },
  "toronto-permits": { id: "toronto-permits", name: "Toronto active and cleared building permits", url: "https://open.toronto.ca/dataset/building-permits-active-permits/", licence: "Open Government Licence – Toronto", attribution: "Contains information licensed under the Open Government Licence – Toronto. Cleared records since 2017: https://open.toronto.ca/dataset/building-permits-cleared-permits/" },
};

export function matchClause(field: string, address: string): string {
  const civic = streetNumber(address);
  if (!civic) throw new Error("Civic address required");
  const stem = streetKey(address).split(" ").slice(1).filter(w => !/^(street|avenue|boulevard|road|drive|place|court|crescent|lane|terrace|north|south|east|west|northeast|northwest|southeast|southwest)$/.test(w)).join(" ").toUpperCase();
  return `starts_with(upper(${field}), ${literal(civic.toUpperCase() + " ")}) AND upper(${field}) like ${literal("%" + stem.replace(/[%_]/g, "") + "%")}`;
}
export interface Assessment {
  address: string; city: string; rollNumber: string | null; rollYear: number | null;
  assessedValue: number | null; landValue: number | null; buildingValue: number | null;
  yearBuilt: number | null; floorAreaM2: number | null; lotAreaM2: number | null;
  dwellingUnits: number | null; bedrooms: number | null; bathrooms: number | null; landUse: string | null;
  currency: "CAD"; valuationKind: "municipal_assessment"; marketValueEstimate: null;
}
function base(address: string, city: string): Assessment {
  return { address, city, rollNumber: null, rollYear: null, assessedValue: null, landValue: null, buildingValue: null, yearBuilt: null, floorAreaM2: null, lotAreaM2: null, dwellingUnits: null, bedrooms: null, bathrooms: null, landUse: null, currency: "CAD", valuationKind: "municipal_assessment", marketValueEstimate: null };
}
const squareMetres = (v: unknown): number | null => { const n = number(v); return n === null ? null : Math.round(n / 10.7639104167 * 10) / 10; };
export function mapAssessment(city: string, r: Row): Assessment {
  if (city === "calgary") return { ...base(String(r.address), "Calgary"), rollNumber: text(r.roll_number), rollYear: number(r.roll_year), assessedValue: number(r.assessed_value), yearBuilt: publishedYear(r.year_of_construction), lotAreaM2: number(r.land_size_sm), landUse: text(r.land_use_designation) };
  if (city === "winnipeg") return { ...base(String(r.full_address), "Winnipeg"), rollNumber: text(r.roll_number), rollYear: number(r.current_assessment_year), assessedValue: number(r.total_assessed_value), yearBuilt: publishedYear(r.year_built), floorAreaM2: squareMetres(r.total_living_area), lotAreaM2: squareMetres(r.assessed_land_area), dwellingUnits: number(r.dwelling_units), landUse: text(r.zoning) };
  if (city === "edmonton") return { ...base([r.house_number, r.street_name].filter(Boolean).join(" "), "Edmonton"), rollNumber: text(r.account_number), assessedValue: number(r.assessed_value), landUse: text(r.tax_class) ?? text(r.mill_class_1) };
  return { ...base([r.address_num, r.address_direction, r.address_street, r.address_suffix].filter(Boolean).join(" "), String(r.address_city)), rollNumber: text(r.aan), yearBuilt: publishedYear(r.year_built), floorAreaM2: squareMetres(r.square_foot_living_area), dwellingUnits: number(r.living_units), bedrooms: number(r.bedrooms), bathrooms: number(r.bathrooms), landUse: text(r.style) };
}

export async function assessmentAtAddress(address: string | null, city: string | null, province: string | null): Promise<Layer<Assessment>> {
  const c = cityKey(city ?? "");
  const key = ["calgary", "winnipeg", "edmonton"].includes(c) ? c : /^(nova scotia|ns)$/i.test(province ?? "") ? "ns" : null;
  if (!key) return layer("not_supported", null, null, "Live assessment lookup is available in Calgary, Winnipeg, Edmonton and Nova Scotia; imported Realist rolls may add coverage.");
  const source = SOURCES[key];
  if (!address || !streetNumber(address)) return layer("skipped", null, source, "A civic address is required for assessment matching.");
  try {
    let hits: Row[];
    if (key === "calgary") hits = await socrata("data.calgary.ca", "4bsw-nn7w", matchClause("address", address), "roll_year DESC");
    else if (key === "winnipeg") hits = await socrata("data.winnipeg.ca", "d4mq-wa44", matchClause("full_address", address), "current_assessment_year DESC");
    else if (key === "edmonton") {
      const stem = streetKey(address).split(" ").slice(1).filter(w => !/^(street|avenue|road|drive|north|south|east|west|northeast|northwest|southeast|southwest)$/.test(w)).join(" ").toUpperCase();
      hits = await socrata("data.edmonton.ca", "q7d6-ambg", `house_number = ${literal(streetNumber(address)!)} AND starts_with(upper(street_name), ${literal(stem + " ")})`);
    }
    else hits = await socrata("www.thedatazone.ca", "a859-xvcs", `address_num = ${literal(streetNumber(address)!)} AND upper(address_city) = ${literal(city!.toUpperCase())}`);
    if (hits.length >= 51) return layer("ambiguous", null, source, "Candidate limit reached; no assessment selected.");
    const matches = hits.map(r => ({ row: r, value: mapAssessment(key, r) })).filter(({ value }) => sameStreet(address, value.address));
    const current = matches.filter(x => x.value.rollYear === matches[0]?.value.rollYear);
    const unique = [...new Map(current.map(x => [x.value.rollNumber, x])).values()];
    if (unique.length !== 1) return layer(unique.length ? "ambiguous" : "no_match", null, source, unique.length ? "Multiple assessment units at this civic address; no unit guessed." : "No matching published assessment record. This does not establish that a property has no assessment.");
    const { value, row } = unique[0];
    return layer("available", { ...value, valuationReferenceDate: date(row.assessment_date) }, source, key === "ns" ? "PVSC dwelling characteristics only. Assessed value is not published in this dataset." : "A municipal assessed value is not a sale price or a current market-value estimate.", date(row.mod_date));
  } catch { return layer("unavailable", null, source, "Municipal source unavailable; other layers can still return."); }
}

export async function permitsAtAddress(address: string | null, city: string | null): Promise<Layer> {
  const c = cityKey(city ?? "");
  if (c === "toronto") return torontoRecords("permits", address);
  if (!["calgary", "vancouver"].includes(c)) return layer("not_supported", null, null, "Live permit lookup covers Calgary, Vancouver and Toronto; imported Realist permit records may add coverage.");
  const source = SOURCES[`${c}-permits`];
  if (!address || !streetNumber(address)) return layer("skipped", null, source, "A civic address is required.");
  try {
    let hits: Row[];
    if (c === "calgary") hits = await socrata("data.calgary.ca", "c2es-76ed", matchClause("originaladdress", address), "issueddate DESC");
    else {
      const url = new URL("https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/issued-building-permits/records");
      const stem = streetKey(address).split(" ").slice(1).filter(w => !/^(street|avenue|boulevard|road|drive|place|court|crescent|lane|terrace|north|south|east|west)$/.test(w)).join(" ").toUpperCase();
      url.searchParams.set("where", `address like ${JSON.stringify(streetNumber(address)! + " " + stem + " %")}`);
      url.searchParams.set("limit", "51");
      url.searchParams.set("order_by", "issuedate desc");
      const result = await fetchJson(url) as { results: unknown };
      hits = rows(result.results);
      // Broad civic-number search can exceed its bound; never claim complete history.
      if (hits.length >= 51) return layer("ambiguous", null, source, "Too many permits at this civic number; narrow source query required.");
    }
    const matches = hits.filter(r => sameStreet(address, String(c === "calgary" ? r.originaladdress : r.address)));
    const permits = matches.slice(0, 25).map(r => ({
      permitNumber: text(r.permitnum) ?? text(r.permitnumber),
      address: text(r.originaladdress) ?? text(r.address),
      issuedDate: date(r.issueddate) ?? date(r.issuedate),
      status: text(r.statuscurrent), workType: text(r.workclassgroup) ?? text(r.typeofwork),
      description: (text(r.description) ?? text(r.projectdescription))?.slice(0, 1000) ?? null,
      estimatedProjectValue: number(r.estprojectcost) ?? number(r.projectvalue), currency: "CAD",
    }));
    const result = layer(matches.length ? "available" : "no_match", { permits }, source, "Published records at the civic address only. No matches is not proof of no permits.");
    result.truncated = hits.length >= 51 || matches.length > 25;
    return result;
  } catch { return layer("unavailable", null, source, "Permit source unavailable."); }
}

export async function torontoVariances(address: string | null, city: string | null): Promise<Layer> {
  if (cityKey(city ?? "") !== "toronto") return layer("not_supported", null, null);
  return torontoRecords("variance", address);
}
async function torontoRecords(kind: "permits" | "variance", address: string | null): Promise<Layer> {
  const source = SOURCES[`toronto-${kind}`];
  if (!address || !streetNumber(address)) return layer("skipped", null, source);
  try {
    const streetName = streetKey(address).split(" ").slice(1).filter(w => !/^(street|avenue|boulevard|road|drive|place|court|crescent|lane|terrace|north|south|east|west)$/.test(w)).join(" ").toUpperCase();
    const ids = kind === "variance" ? ["51fd09cd-99d6-430a-9d42-c24a937b0cb0", "9c97254e-5460-4799-896f-c7823413c81c"] : ["6d0229af-bc54-46de-9c2b-26759b01dd05", "a96c0ba4-3026-402b-b09d-5b1268b8f810"];
    const attempts = await Promise.allSettled(ids.map(async id => {
      const url = new URL("https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search");
      url.searchParams.set("resource_id", id);
      url.searchParams.set("filters", JSON.stringify({ STREET_NUM: streetNumber(address)!, STREET_NAME: streetName }));
      url.searchParams.set("limit", "100");
      const response = await fetchJson(url, 12000) as { success?: boolean; result?: { records?: unknown; total?: number } };
      if (!response.success || !response.result || (response.result.total ?? 101) > 100) throw new Error("Source unavailable or incomplete");
      return rows(response.result.records);
    }));
    const sets = attempts.filter((r): r is PromiseFulfilledResult<Row[]> => r.status === "fulfilled").map(r => r.value);
    if (!sets.length) throw new Error("No source available");
    const incomplete = sets.length !== attempts.length;
    const matches = sets.flat().filter(r => sameStreet(address, [r.STREET_NUM, r.STREET_NAME, r.STREET_TYPE, r.STREET_DIRECTION].map(v => text(v)).filter(Boolean).join(" ")));
    if (kind === "permits") {
      const permits = [...new Map(matches.map(r => [`${r.PERMIT_NUM}:${r.REVISION_NUM}`, r])).values()].sort((a, b) => String(b.ISSUED_DATE ?? b.APPLICATION_DATE).localeCompare(String(a.ISSUED_DATE ?? a.APPLICATION_DATE))).map(r => ({
        permitNumber: text(r.PERMIT_NUM), revisionNumber: text(r.REVISION_NUM), permitType: text(r.PERMIT_TYPE), workType: text(r.WORK), status: text(r.STATUS), issuedDate: date(r.ISSUED_DATE), completedDate: date(r.COMPLETED_DATE), description: text(r.DESCRIPTION)?.slice(0, 1000) ?? null, estimatedProjectValue: number(typeof r.EST_CONST_COST === "string" ? r.EST_CONST_COST.replace(/,/g, "") : r.EST_CONST_COST), currency: "CAD",
      }));
      const result = layer(permits.length ? "available" : incomplete ? "unavailable" : "no_match", { permits: permits.slice(0, 25) }, source, `${incomplete ? "Incomplete: one permit feed could not be read. " : ""}Active permits and cleared permits since 2017. A missing record is not proof that no permit exists.`);
      result.truncated = incomplete || permits.length > 25;
      return result;
    }
    const applications = [...new Map(matches.map(r => [r["REFERENCE_FILE#"], r])).values()].map(r => ({ fileNumber: text(r["REFERENCE_FILE#"]), status: text(r.STATUSDESC), decision: text(r.C_OF_A_DESCISION), applicationType: text(r.APPLICATION_TYPE), receivedDate: date(r.IN_DATE), hearingDate: date(r.HEARING_DATE), description: text(r.DESCRIPTION)?.slice(0, 1000) ?? null }));
    const result = layer(applications.length ? "available" : incomplete ? "unavailable" : "no_match", { applications: applications.slice(0, 25) }, source, `${incomplete ? "Incomplete: one application feed could not be read. " : ""}Active applications and closed applications since 2017. A prior variance is not approval for a new project.`);
    result.truncated = incomplete || applications.length > 25;
    return result;
  } catch { return layer("unavailable", null, source, "Toronto application source unavailable or its candidate response exceeded the bound."); }
}
