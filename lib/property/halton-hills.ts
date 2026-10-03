import { load } from "cheerio/slim";
import { fetchJson, fetchText, rows } from "./http";
import { civicStreetKey, cityKey, hasUnit, layer, streetNumber, text, type Layer, type Row } from "./model";
import { provinceKey } from "./geocode";
import { HALTON_HILLS_DEVELOPMENT_FIELDS, HALTON_HILLS_DEVELOPMENT_QUERY, HALTON_HILLS_GUIDANCE, HALTON_HILLS_SOURCES, HALTON_HILLS_WITHHELD } from "./halton-hills-sources";

const communities = new Set(["acton", "georgetown", "glen williams", "esquesing", "norval", "stewarttown", "limehouse", "hornby", "henderson's corners", "bannockburn", "premier gateway", "southeast georgetown", "ashgrove"]);
function communityKey(value: string) { return cityKey(value).replace(/^town of\s+/, "").replace(/’/g, "'"); }
export function haltonHillsMarket(city: string | null, province: string | null): boolean {
  const key = communityKey(city ?? "");
  return provinceKey(province ?? "") === "ontario" && (key === "halton hills" || communities.has(key));
}
function clean(value: string): string | null {
  const result = value.replace(/\s+/g, " ").trim();
  return result && result.toLowerCase() !== "null" ? result : null;
}
function publishedPage(html: string, expectedTitle: string) {
  const $ = load(html);
  const footer = $("footer").text().replace(/\s+/g, " ");
  if ($("title").text().trim() !== expectedTitle || !footer.includes("Town of Halton Hills") || !footer.includes("Content may be shared or reproduced with proper attribution.")) throw new Error("Town publisher or attributed-reproduction permission changed");
  return $;
}
function heritageMapLink(href: string | undefined) {
  if (!href) throw new Error("Missing published heritage link");
  const url = new URL(href);
  const id = url.searchParams.get("q")?.match(/^OBJECTID=(\d+)$/)?.[1];
  if (url.origin !== "https://map.haltonhills.ca" || url.pathname !== "/HT5/Index.html" || url.searchParams.get("qL") !== "4" || !id) throw new Error("Unexpected published heritage binding");
  return { recordId: id, recordUrl: url.href };
}
export function parseHaltonHillsHeritage(html: string): Row[] {
  const $ = publishedPage(html, "Halton Hills - Heritage Planning");
  const sections = new Map([
    ["Listed Properties", { status: "Listed", headers: ["Location", "Historical Reference", "Heritage Value", "Phase"] }],
    ["Part IV Designated Properties", { status: "Part IV designated", headers: ["Property", "Civic Address", "Heritage Value"] }],
    ["Part V Designated Properties", { status: "Part V designated", headers: ["Property", "Civic Address", "Heritage Value"] }],
  ]);
  const seen = new Set<string>(), result: Row[] = [];
  let heading = "";
  for (const element of $("h5, table").toArray()) {
    if (element.type === "tag" && element.name === "h5") { heading = $(element).text().trim(); continue; }
    const section = sections.get(heading);
    if (!section) continue;
    const tableRows = $(element).find("tr").toArray();
    const headers = $(tableRows[0]).find("th,td").map((_, cell) => $(cell).text().trim()).get();
    if (JSON.stringify(headers) === JSON.stringify(["Symbol", "Report and Resolution number"]) && section.status === "Listed") continue;
    if (seen.has(heading) || JSON.stringify(headers) !== JSON.stringify(section.headers) || tableRows.length > 2501) throw new Error("Heritage table schema changed");
    seen.add(heading);
    for (const row of tableRows.slice(1)) {
      const cells = $(row).find("td");
      if (cells.length !== section.headers.length) throw new Error("Incomplete heritage row");
      const addressCell = cells.eq(section.status === "Listed" ? 0 : 1), anchors = addressCell.find("a");
      if (anchors.length !== 1) throw new Error("Ambiguous heritage civic cell");
      const address = clean(anchors.text());
      if (!address || address.length > 240 || !streetNumber(address)) throw new Error("Invalid heritage civic address");
      const remainder = addressCell.clone(); remainder.find("a").remove();
      const community = clean(remainder.text());
      if (community && community.length > 80) throw new Error("Invalid community");
      const districtName = section.status === "Part V designated" ? clean(cells.eq(0).text()) : null;
      if (districtName && districtName.length > 240) throw new Error("Invalid district label");
      // Historic person names and narrative essays are not part of this adapter's output.
      result.push({ ...heritageMapLink(anchors.attr("href")), address, community, publishedStatus: section.status, phase: section.status === "Listed" ? clean(cells.eq(3).text()) : null, districtName });
    }
  }
  if (seen.size !== 3 || result.length > 3000) throw new Error("Missing or excessive heritage tables");
  return result;
}
export function verifyHaltonHillsDevelopmentPage(html: string): void {
  const $ = publishedPage(html, "Halton Hills - Development Proposals Under Review");
  if ($("#activedevelopmentsbyregion").length !== 1) throw new Error("Missing published development table");
  const scripts = $("script").map((_, el) => $(el).text()).get();
  const binding = scripts.filter(script => /var\s+CONTAINER_ID\s*=\s*'activedevelopmentsbyregion'\s*;/.test(script));
  if (binding.length !== 1 || !binding[0].includes(`var SERVICE_URL = '${HALTON_HILLS_DEVELOPMENT_QUERY}';`) || !binding[0].includes(`var OUT_FIELDS = '${HALTON_HILLS_DEVELOPMENT_FIELDS.join(",")}';`)) throw new Error("Published table binding or fields changed");
  // Parse fixed bindings only; never evaluate the publisher's scripts.
}
export function parseHaltonHillsDevelopment(value: unknown): Row[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid development response");
  const response = value as Row;
  if (response.error || response.exceededTransferLimit) throw new Error("Incomplete published table");
  const fields = rows(response.fields), all = rows(response.features);
  if (all.length >= 501 || HALTON_HILLS_DEVELOPMENT_FIELDS.some(field => fields.filter(f => f.name === field && f.type === (field === "OBJECTID" ? "esriFieldTypeOID" : field === "MAP_ID" ? "esriFieldTypeInteger" : "esriFieldTypeString")).length !== 1)) throw new Error("Published table schema changed");
  const ids = new Set<number>();
  return all.map(feature => {
    const a = feature.attributes as Row;
    if (!a || typeof a !== "object" || Array.isArray(a) || HALTON_HILLS_DEVELOPMENT_FIELDS.some(field => !(field in a)) || typeof a.OBJECTID !== "number" || !Number.isInteger(a.OBJECTID) || a.OBJECTID < 0 || ids.has(a.OBJECTID)) throw new Error("Invalid published development row");
    if (a.MAP_ID !== null && (typeof a.MAP_ID !== "number" || !Number.isInteger(a.MAP_ID))) throw new Error("Invalid published map id");
    for (const field of ["LOCATION", "FILE_NO", "APP_DESC", "TWN_AREA"]) if (a[field] !== null && (typeof a[field] !== "string" || (a[field] as string).length > 1000)) throw new Error("Invalid published development text");
    ids.add(a.OBJECTID);
    return { recordId: String(a.OBJECTID), mapId: a.MAP_ID, address: clean(text(a.LOCATION) ?? ""), community: clean(text(a.TWN_AREA) ?? ""), fileNumber: clean(text(a.FILE_NO) ?? ""), description: clean(text(a.APP_DESC) ?? "") };
  });
}
async function heritageRows() { return parseHaltonHillsHeritage(await fetchText(new URL(HALTON_HILLS_GUIDANCE.heritage))); }
async function developmentRows() {
  verifyHaltonHillsDevelopmentPage(await fetchText(new URL(HALTON_HILLS_GUIDANCE.planning)));
  const url = new URL(HALTON_HILLS_DEVELOPMENT_QUERY);
  Object.entries({ f: "json", where: "1=1", outFields: HALTON_HILLS_DEVELOPMENT_FIELDS.join(","), returnGeometry: "false", resultRecordCount: "501", orderByFields: "OBJECTID" }).forEach(([key, value]) => url.searchParams.set(key, value));
  return parseHaltonHillsDevelopment(await fetchJson(url));
}
function singleCivic(value: string): boolean {
  return Boolean(streetNumber(value)) && !hasUnit(value) && !/[,/&;]|\d\s*[-–]\s*\d|\b(and|to|part of|lot|concession)\b/i.test(value);
}
export function matchHaltonHillsRows(key: "heritage" | "planningApplications", all: Row[], address: string, city: string): Layer {
  const exact = all.filter(row => typeof row.address === "string" && singleCivic(row.address) && civicStreetKey(row.address) === civicStreetKey(address));
  const requested = communityKey(city), broad = requested === "halton hills";
  const ambiguous = exact.some(row => !text(row.community) || !communities.has(communityKey(row.community as string)) || !broad && communityKey(row.community as string) !== requested);
  const result = layer(ambiguous ? "ambiguous" : exact.length ? "available" : "no_match", {
    records: exact.slice(0, 50), matchMethod: "exact_normalized_published_civic_location", scope: ambiguous ? "civic_address_candidates_community_unconfirmed" : "published_civic_site_context",
    requestedCommunity: city, publishedAddressMatchCount: exact.length, publishedTableObservations: all.length,
    queryCoverageComplete: exact.length <= 50, coverageComplete: false, parcelIdentityVerified: false, sourceObservationDate: null, absenceEstablished: false,
    ...(key === "heritage" ? { fullCurrentHeritageRegisterVerified: false, fullHeritageDistrictScreenPerformed: false } : { fullPlanningHistorySearched: false, nearbyPlanningScreenPerformed: false, currentApprovalConditionsVerified: false, appealOutcomesVerified: false, currentActivityVerified: false, excludedApplicationTypes: ["minor variances", "consents", "Niagara Escarpment development permits"] }),
  }, HALTON_HILLS_SOURCES[key], (key === "heritage" ? "Published Listed, Part IV and Part V table entries; listing and designation are different statuses. This is not a complete current register or district screen. " : "Only the six fields rendered in the Town's development table are used; no geometry, contacts, private owner fields or other GIS attributes are queried. Published table inclusion is not verification of current activity, approval or appeal outcomes. Ranges, multi-address and lot/concession descriptions are not expanded into individual civic matches. ") + "Unknown or conflicting communities remain candidate evidence. Street type, suffix and direction must agree; source observation dates are unknown and no-match never establishes absence.");
  result.truncated = exact.length > 50;
  return result;
}
export async function haltonHillsLayers(address: string | null, city: string | null, province: string | null, requestedCity?: string): Promise<Record<string, Layer>> {
  const requested = requestedCity ?? city;
  if (!haltonHillsMarket(requested, province)) return {};
  const identityAgrees = haltonHillsMarket(city, province) && (communityKey(requested!) === "halton hills" || communityKey(city!) === "halton hills" || communityKey(requested!) === communityKey(city!));
  const evidence = async (key: "heritage" | "planningApplications") => {
    if (!address || !singleCivic(address) || !identityAgrees) return layer("skipped", null, HALTON_HILLS_SOURCES[key], "A single civic address with agreeing Halton Hills municipality/community identity is required. No source query is made for conflicting identities, units or ranges.");
    try { return matchHaltonHillsRows(key, await (key === "heritage" ? heritageRows() : developmentRows()), address, requested!); }
    catch { return layer("unavailable", null, HALTON_HILLS_SOURCES[key], "Town publisher, reproduction permission, published schema, fixed table binding or complete bounded response could not be verified. No factual result is returned."); }
  };
  const [heritage, planningApplications] = await Promise.all([evidence("heritage"), evidence("planningApplications")]);
  return {
    heritage, planningApplications,
    zoning: layer("not_supported", { coverageComplete: false, fullCurrentZoningScreenPerformed: false, currentAmendmentsVerified: false, verificationUrl: HALTON_HILLS_GUIDANCE.zoning, applicableBylawsToVerify: ["2010-0050 as amended", "00-138 for Premier Gateway as amended"] }, null, "Current detailed zoning, exceptions, overlays and amendments are not connected as licensed property evidence. The website reproduction grant does not establish reuse rights for the separate zoning GIS service; verify the applicable bylaw and current written rules."),
    officialPlan: layer("not_supported", { coverageComplete: false, currentPlanScreenPerformed: false, currentMunicipalAmendmentsVerified: false, formerRegionalPlanBecameMunicipalDate: "2024-07-01", verificationUrl: HALTON_HILLS_GUIDANCE.plan }, null, "Current municipal plan schedules, amendments and property constraints are not connected. Review the local plan and former Halton regional plan with current amendments; published consolidation and retrieval dates are separate."),
    development: layer("not_supported", { coverageComplete: false, fullPlanningHistorySearched: false, nearbyPlanningScreenPerformed: false }, null, "Exact published civic-location observations are returned in planningApplications. Nearby proposals, ranges, full file history, decisions, conditions and appeals remain unverified."),
    permits: layer("not_supported", { coverageComplete: false, fullPropertyHistorySearched: false, finalInspectionsVerified: false, occupancyVerified: false, verificationUrl: HALTON_HILLS_GUIDANCE.buildingRecords }, null, "Halton Hills permit history, current inspection status, final inspections and occupancy records are not connected to a verified licensed open feed. The Town directs non-owners without owner authorization to its formal information-request process for building records."),
    additionalUnits: layer("not_supported", { coverageComplete: false, currentRegistrationVerified: false, unitLegalityVerified: false, verificationUrl: HALTON_HILLS_GUIDANCE.additionalUnits }, null, "The Town publishes additional-unit registration guidance, but no verified open address registry is connected. Request the specific unit's registration, inspection and occupancy documents; guidance does not establish a property's legal unit count."),
    heritageDistrict: layer("not_supported", { coverageComplete: false, fullHeritageDistrictScreenPerformed: false }, null, "The published Part V table is retained as heritage candidate evidence. Complete district geometry and current district/property-specific rules have not been screened."),
  };
}
export async function haltonHillsCoverage() {
  const datasets = await Promise.all((Object.keys(HALTON_HILLS_SOURCES) as ("heritage" | "planningApplications")[]).map(async key => {
    try { const records = await (key === "heritage" ? heritageRows() : developmentRows()); return { city: "Halton Hills", layer: key, status: "verified", records: records.length, source: HALTON_HILLS_SOURCES[key], sourceUpdatedAt: null }; }
    catch { return { city: "Halton Hills", layer: key, status: "unavailable", records: null, source: HALTON_HILLS_SOURCES[key], sourceUpdatedAt: null }; }
  }));
  return { cities: ["Halton Hills"], delivery: "cached_published_website_queries", cacheSeconds: 3600, datasets, withheldDatasets: HALTON_HILLS_WITHHELD.map(item => ({ ...item, status: "withheld", records: null })), note: "Partial municipal coverage. Counts are published table observations, not distinct properties, applications, unique data points or database imports. Only attributed Town website content and the six fields explicitly rendered by its development table are enabled; the Town's private Open Data Hub cannot currently establish scope for blank-licence GIS items. Unknown/conflicting communities remain ambiguous, complex addresses are not expanded, and source observation dates are unknown." };
}
