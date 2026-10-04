import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { haltonHillsCoverage, haltonHillsLayers, haltonHillsMarket, matchHaltonHillsRows, parseHaltonHillsDevelopment, parseHaltonHillsHeritage, verifyHaltonHillsDevelopmentPage } from "./halton-hills";
import { HALTON_HILLS_DEVELOPMENT_FIELDS, HALTON_HILLS_DEVELOPMENT_QUERY, HALTON_HILLS_GUIDANCE } from "./halton-hills-sources";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import type { Row } from "./model";

const permission = "<footer>Town of Halton Hills. Content may be shared or reproduced with proper attribution.</footer>";
const mapLink = (id: number) => `https://map.haltonhills.ca/HT5/Index.html?qL=4&amp;q=OBJECTID=${id}`;
const listedRow = (id = 1, address = "16469 10 Side Road", community = "Esquesing", phase = "null") => `<tr><td><a href="${mapLink(id)}">${address}</a><br>${community}</td><td>Historic person</td><td>Narrative not reproduced</td><td>${phase}</td></tr>`;
const heritage = (entries = listedRow()) => `<title>Halton Hills - Heritage Planning</title>${permission}<h5>Listed Properties</h5><table><tr><th>Location</th><th>Historical Reference</th><th>Heritage Value</th><th>Phase</th></tr>${entries}</table><h5>Part IV Designated Properties</h5><table><tr><th>Property</th><th>Civic Address</th><th>Heritage Value</th></tr><tr><td>Historic person</td><td><a href="${mapLink(3)}">12428 Kirkpatrick Lane</a></td><td>Historic narrative</td></tr></table><h5>Part V Designated Properties</h5><table><tr><th>Property</th><th>Civic Address</th><th>Heritage Value</th></tr><tr><td>Syndicate Housing Heritage Conservation District</td><td><a href="${mapLink(4)}">69 Bower Street</a></td><td>Historic narrative</td></tr></table>`;
const planningPage = `<title>Halton Hills - Development Proposals Under Review</title>${permission}<div id="activedevelopmentsbyregion"></div><script>var SERVICE_URL = '${HALTON_HILLS_DEVELOPMENT_QUERY}'; var CONTAINER_ID = 'activedevelopmentsbyregion'; var OUT_FIELDS = '${HALTON_HILLS_DEVELOPMENT_FIELDS.join(",")}'; throw new Error('do not execute');</script>`;
const development = (attributes: Row[] = [{ OBJECTID: 7, MAP_ID: 21, LOCATION: "125 McDonald Blvd.", FILE_NO: "D12SUB12.001", APP_DESC: "108 townhouse unit subdivision", TWN_AREA: "Acton" }]): Row => ({ fields: HALTON_HILLS_DEVELOPMENT_FIELDS.map(name => ({ name, type: name === "OBJECTID" ? "esriFieldTypeOID" : name === "MAP_ID" ? "esriFieldTypeInteger" : "esriFieldTypeString" })), features: attributes.map(a => ({ attributes: a })) });
const fetch = vi.fn();
beforeEach(() => { vi.stubGlobal("fetch", fetch); fetch.mockReset(); });
afterEach(() => vi.unstubAllGlobals());
function provider() {
  fetch.mockImplementation(async (value: URL) => {
    const url = new URL(value);
    if (url.href === HALTON_HILLS_GUIDANCE.heritage) return new Response(heritage());
    if (url.href === HALTON_HILLS_GUIDANCE.planning) return new Response(planningPage);
    if (url.origin + url.pathname === HALTON_HILLS_DEVELOPMENT_QUERY) return Response.json(development());
    throw new Error(`Unexpected source ${url.origin}${url.pathname}`);
  });
}
describe("Halton Hills published website evidence", () => {
  it("preserves repeated listed observations, null phases and distinct designation statuses without historic names", () => {
    const records = parseHaltonHillsHeritage(heritage(listedRow(1) + listedRow(2, undefined, undefined, "Phase 2")));
    expect(records).toHaveLength(4); expect(records[0]).toMatchObject({ recordId: "1", community: "Esquesing", phase: null, publishedStatus: "Listed" });
    expect(records[1].phase).toBe("Phase 2"); expect(records[2]).toMatchObject({ publishedStatus: "Part IV designated", community: null });
    expect(records[3]).toMatchObject({ publishedStatus: "Part V designated", districtName: "Syndicate Housing Heritage Conservation District" });
    expect(JSON.stringify(records)).not.toContain("Historic person"); expect(JSON.stringify(records)).not.toContain("narrative");
  });
  it.each([
    ["removed permission", (s: string) => s.replace(permission, "")],
    ["different publisher", (s: string) => s.replace("<title>Halton Hills", "<title>Other Town")],
    ["changed schema", (s: string) => s.replace("<th>Phase</th>", "<th>Current year</th>")],
    ["missing section", (s: string) => s.replace("Part IV Designated Properties", "New table")],
    ["untrusted map link", (s: string) => s.replace("https://map.haltonhills.ca/HT5", "https://example.com/HT5")],
    ["changed map layer", (s: string) => s.replace("qL=4", "qL=19")],
  ])("withholds heritage on %s", (_, mutate) => expect(() => parseHaltonHillsHeritage(mutate(heritage()))).toThrow());
  it("keeps unknown and conflicting communities ambiguous even with a municipality-level request", () => {
    const records = parseHaltonHillsHeritage(heritage());
    for (const city of ["Halton Hills", "Acton"]) expect(matchHaltonHillsRows("heritage", records, "69 Bower St", city)).toMatchObject({ status: "ambiguous", data: { parcelIdentityVerified: false, absenceEstablished: false, fullCurrentHeritageRegisterVerified: false } });
    const brief = preShowingBrief({ heritage: matchHaltonHillsRows("heritage", records, "69 Bower St", "Acton") }, []);
    expect(brief.documentsToRequest.find(d => d.evidenceLayers.includes("heritage"))?.reason).toContain("community and exact parcel identity");
    expect(matchHaltonHillsRows("heritage", records, "16469 10 Side Rd", "Georgetown").status).toBe("ambiguous");
    expect(matchHaltonHillsRows("heritage", records, "16469 10 Side Rd", "Esquesing").status).toBe("available");
    expect(matchHaltonHillsRows("heritage", records, "16469 10 Side Rd", "Halton Hills").status).toBe("available");
  });
  it("requires civic suffix, direction and street type without inventing absence", () => {
    const records = parseHaltonHillsHeritage(heritage(listedRow(1, "10A Queen Street West", "Acton")));
    expect(matchHaltonHillsRows("heritage", records, "10a Queen St W", "Acton").status).toBe("available");
    for (const address of ["10 Queen Street West", "10A Queen Street East", "10A Queen Avenue West"]) expect(matchHaltonHillsRows("heritage", records, address, "Acton")).toMatchObject({ status: "no_match", data: { absenceEstablished: false, coverageComplete: false } });
  });
  it("parses fixed development bindings without executing scripts and fails on rights/field/URL drift", () => {
    expect(() => verifyHaltonHillsDevelopmentPage(planningPage)).not.toThrow();
    for (const page of [planningPage.replace(permission, ""), planningPage.replace("APP_DESC,TWN_AREA", "APP_DESC,P_CONTAC"), planningPage.replace("MapServer/24", "MapServer/19"), planningPage.replace('id="activedevelopmentsbyregion"', 'id="other"')]) expect(() => verifyHaltonHillsDevelopmentPage(page)).toThrow();
  });
  it("strips unpublished attributes and geometry; file year does not become a date or current status", () => {
    const raw = development(); ((raw.features as Row[])[0].attributes as Row).P_CONTAC = "Unpublished contact"; ((raw.features as Row[])[0].attributes as Row).CUR_STAT = "Approved"; (raw.features as Row[])[0].geometry = { x: 1, y: 2 };
    const records = parseHaltonHillsDevelopment(raw);
    expect(records[0]).toEqual({ recordId: "7", mapId: 21, address: "125 McDonald Blvd.", community: "Acton", fileNumber: "D12SUB12.001", description: "108 townhouse unit subdivision" });
    const result = matchHaltonHillsRows("planningApplications", records, "125 McDonald Boulevard", "Acton");
    expect(result).toMatchObject({ status: "available", sourceUpdatedAt: null, data: { sourceObservationDate: null, currentActivityVerified: false, currentApprovalConditionsVerified: false, appealOutcomesVerified: false, nearbyPlanningScreenPerformed: false } });
  });
  it("rejects incomplete, duplicate, wrong-type and excessive development responses", () => {
    const attrs = ((development().features as Row[])[0].attributes as Row);
    for (const raw of [{ ...development(), exceededTransferLimit: true }, { ...development(), error: { code: 500 } }, development([attrs, attrs]), development([{ ...attrs, OBJECTID: "7" }]), development([{ ...attrs, MAP_ID: "21" }]), development([{ ...attrs, APP_DESC: 123 }]), { ...development(), fields: [] }, development(Array.from({ length: 501 }, (_, id) => ({ ...attrs, OBJECTID: id })))]) expect(() => parseHaltonHillsDevelopment(raw)).toThrow();
  });
  it("does not expand multi-address, range or lot/concession descriptions", () => {
    const base = ((development().features as Row[])[0].attributes as Row);
    for (const address of ["125-129 McDonald Blvd", "125, 127 McDonald Blvd", "125 McDonald Blvd and 1 Mill Street", "Part of Lot 125, Concession 9"]) {
      const records = parseHaltonHillsDevelopment(development([{ ...base, LOCATION: address }]));
      expect(matchHaltonHillsRows("planningApplications", records, "125 McDonald Blvd", "Acton")).toMatchObject({ status: "no_match", data: { absenceEstablished: false, fullPlanningHistorySearched: false } });
    }
  });
  it("preserves repeated observations and makes truncation visible", () => {
    const all = Array.from({ length: 51 }, (_, id) => ({ recordId: String(id), address: "125 McDonald Blvd", community: "Acton" }));
    expect(matchHaltonHillsRows("planningApplications", all, "125 McDonald Blvd", "Acton")).toMatchObject({ status: "available", truncated: true, data: { publishedAddressMatchCount: 51, queryCoverageComplete: false, coverageComplete: false } });
  });
  it("uses only fixed published fields, no geometry or unrelated blank-licence feeds", async () => {
    provider(); const layers = await haltonHillsLayers("125 McDonald Blvd", "Acton", "ON");
    expect(layers.planningApplications.status).toBe("available"); expect(layers.zoning.status).toBe("not_supported"); expect(layers.permits.status).toBe("not_supported");
    const query = fetch.mock.calls.map(([url]) => new URL(url)).find(url => url.pathname.endsWith("/query"))!;
    expect(query.searchParams.get("outFields")).toBe(HALTON_HILLS_DEVELOPMENT_FIELDS.join(",")); expect(query.searchParams.get("returnGeometry")).toBe("false"); expect(query.searchParams.get("resultRecordCount")).toBe("501");
    for (const [, options] of fetch.mock.calls) { expect(options.redirect).toBe("error"); expect(options.next.revalidate).toBe(3600); }
    expect(fetch).toHaveBeenCalledTimes(3);
    const brief = preShowingBrief(layers, []); expect(brief.findings.find(f => f.layer === "planningApplications")?.summary).toContain("exact published civic-location"); expect(brief.documentsToRequest.find(d => d.evidenceLayers.includes("planningApplications"))?.reason).toContain("without decision dates");
  });
  it("skips conflicting cities, units and complex requests without source queries", async () => {
    for (const address of ["Unit 2 125 McDonald Blvd", "125-129 McDonald Blvd"]) expect((await haltonHillsLayers(address, "Acton", "ON")).planningApplications.status).toBe("skipped");
    expect((await haltonHillsLayers("125 McDonald Blvd", "Brampton", "ON", "Acton")).heritage.status).toBe("skipped");
    expect((await haltonHillsLayers("125 McDonald Blvd", "Georgetown", "ON", "Acton")).heritage.status).toBe("skipped");
    expect(await haltonHillsLayers("125 McDonald Blvd", "Acton", "BC")).toEqual({}); expect(fetch).not.toHaveBeenCalled();
  });
  it("retains source failure without reporting no match", async () => {
    fetch.mockRejectedValue(new Error("offline")); const layers = await haltonHillsLayers("125 McDonald Blvd", "Acton", "ON");
    expect(layers.heritage.status).toBe("unavailable"); expect(layers.planningApplications.status).toBe("unavailable"); expect(layers.heritage.data).toBeNull();
  });
  it("reports separately scoped website counts and withheld GIS without marking the market complete", async () => {
    provider(); const coverage = await haltonHillsCoverage(); expect(coverage.datasets).toMatchObject([{ layer: "heritage", status: "verified", records: 3 }, { layer: "planningApplications", status: "verified", records: 1 }]); expect(coverage.withheldDatasets).toHaveLength(4); expect(fetch).toHaveBeenCalledTimes(3);
    const road = ontarioMarketRoadmap(); expect(road.metropolitanMarkets).toHaveLength(16); expect(road.municipalities.map(m=>m.city)).toEqual(expect.arrayContaining(["Halton Hills","Wainfleet","West Lincoln"])); expect(road.majorMarketsComplete).toBe(false);
    expect(road.municipalities.find(m => m.city === "Halton Hills")).toMatchObject({ stage: "partial_municipal_coverage", complete: false, configuredLayers: ["heritage", "planningApplications"] });
    for (const m of road.municipalities) expect(m.complete).toBe(false);
  });
  it("keeps lookup aliases Ontario-scoped", () => {
    for (const city of ["Town of Halton Hills", "Georgetown", "Acton", "Glen Williams", "Esquesing"]) expect(haltonHillsMarket(city, "Ontario")).toBe(true);
    for (const city of ["Milton", "Burlington", "constructor", "Georgetown PEI"]) expect(haltonHillsMarket(city, "ON")).toBe(false);
    expect(haltonHillsMarket("Georgetown", "PE")).toBe(false);
  });
});
