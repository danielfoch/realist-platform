import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { arcgisDate, hamiltonApplications, hamiltonHeritage, hamiltonLayers, hamiltonLocation, heritageMeaning, isHamilton, permitKeys, permitRecord } from "./hamilton";
import { HAMILTON, validHamiltonItem } from "./hamilton-sources";
import { fetchSnapshot } from "./refresh";
import type { Location, Row } from "./model";
const mockFetch = vi.fn();
const respond = (value: unknown) => new Response(JSON.stringify(value));
const item = (feed: typeof HAMILTON[keyof typeof HAMILTON]) => ({ access: "public", owner: "OpenHamilton", orgId: "rYz782eMbySr2srL", url: feed.root, modified: 1, licenseInfo: "<a href='https://www.hamilton.ca/city-initiatives/strategies-actions/open-data-licence-terms-and-conditions'>Open Data Licence</a>" });
const address = (full = "Balsam Avenue North", community = "Hamilton", lng = -79.8302): Row => ({ ...Object.fromEntries(HAMILTON.addresses.fields.map(k => [k, null])), OBJECTID: 123, NUMBER_COMPLETE: "75", STREET_NAME: "Balsam", FULL_STREET_NAME: full, STREET_SUFFIX_TYPE: "Avenue", STREET_SUFFIX_DIRECTION: "North", COMMUNITY: community, MUNICIPALITY: "City of Hamilton", PROVINCE: "Ontario", COUNTRY: "Canada", longitude: lng, latitude: 43.249 });
const location: Location = { address: "75 Balsam Avenue North", city: "Hamilton", province: "ON", latitude: 43.249, longitude: -79.8302, accuracy: "source_civic_address_point", provider: "hamilton" };
function fakeProvider(feed: typeof HAMILTON[keyof typeof HAMILTON], records: Row[], opts: { incomplete?: boolean; outage?: boolean } = {}) {
  return async (u: URL) => {
    if (u.pathname.includes("/sharing/rest/content/items/")) {
      const target = Object.values(HAMILTON).find(f => u.pathname.endsWith(f.item))!;
      return respond(item(target));
    }
    const target = Object.values(HAMILTON).find(f => u.origin + u.pathname.replace(/\/query$/, "") === f.url)!;
    if (!target) throw new Error("Unexpected source");
    if (!u.pathname.endsWith("/query")) return respond({ fields: target.fields.map(name => ({ name })), geometryType: ["addresses", "heritage", "development"].some(k => HAMILTON[k as "addresses"].url === target.url) ? "esriGeometryPoint" : "esriGeometryPolygon", editingInfo: { dataLastEditDate: Date.UTC(2024, 1, 5) } });
    if (target.url !== feed.url) return respond(u.searchParams.has("returnCountOnly") ? { count: 0 } : { features: [] });
    if (opts.outage) return new Response("down", { status: 503 });
    if (u.searchParams.has("returnCountOnly")) return respond({ count: records.length });
    return respond({ exceededTransferLimit: opts.incomplete ?? false, features: records.map(r => ({ attributes: r, geometry: { x: r.longitude, y: r.latitude } })) });
  };
}
beforeEach(() => vi.stubGlobal("fetch", mockFetch));
afterEach(() => { vi.unstubAllGlobals(); mockFetch.mockReset(); });
describe("Hamilton property identity and published meaning", () => {
  it("accepts Ontario former communities and rejects province conflicts", () => {
    for (const city of ["Hamilton", "Ancaster", "Dundas", "Flamborough", "Glanbrook", "Stoney Creek", "Waterdown"]) expect(isHamilton(city, "ON")).toBe(true);
    expect(isHamilton("Hamilton", "BC")).toBe(false); expect(isHamilton("Toronto", "ON")).toBe(false);
  });
  it("accepts shortened permit streets only when their register identity is unique", () => {
    expect(permitKeys("75 Balsam Ave N", [address()], "Hamilton")).toEqual(["75 balsam avenue north", "75 balsam north", "75 balsam"]);
    const other = { ...address("Balsam Avenue South"), STREET_SUFFIX_DIRECTION: "South" };
    expect(permitKeys("75 Balsam Ave N", [address(), other], "Hamilton")).not.toContain("75 balsam");
    const differentType = { ...address("Balsam Road North"), STREET_SUFFIX_TYPE: "Road" };
    expect(permitKeys("75 Balsam Ave N", [address(), differentType], "Hamilton")).not.toContain("75 balsam north");
  });
  it("resolves municipal points while refusing cross-community and distant-point ambiguity", async () => {
    mockFetch.mockImplementation(fakeProvider(HAMILTON.addresses, [address()]));
    const hit = await hamiltonLocation({ address: "75 Balsam Ave N, Hamilton, ON" });
    expect(hit?.data).toMatchObject({ address: "75 Balsam Avenue North", city: "Hamilton", accuracy: "source_civic_address_point", municipalAddress: { community: "Hamilton", recordIds: ["123"] } });
    mockFetch.mockImplementation(fakeProvider(HAMILTON.addresses, [address(), address("Balsam Avenue North", "Ancaster")]));
    expect((await hamiltonLocation({ address: "75 Balsam Ave N, Hamilton, ON" }))?.status).toBe("ambiguous");
    mockFetch.mockImplementation(fakeProvider(HAMILTON.addresses, [address(), address("Balsam Avenue North", "Hamilton", -79.84)]));
    expect((await hamiltonLocation({ address: "75 Balsam Ave N, Hamilton, ON" }))?.status).toBe("ambiguous");
  });
  it("does not resolve partial responses, different streets, units or unsupported provinces", async () => {
    mockFetch.mockImplementation(fakeProvider(HAMILTON.addresses, [address()], { incomplete: true }));
    expect(await hamiltonLocation({ address: "75 Balsam Ave N, Hamilton, ON" })).toBeNull();
    mockFetch.mockImplementation(fakeProvider(HAMILTON.addresses, [address("Balsam Road North")]));
    expect(await hamiltonLocation({ address: "75 Balsam Ave N, Hamilton, ON" })).toBeNull();
    expect(await hamiltonLocation({ address: "Unit 2, 75 Balsam Ave N", city: "Hamilton", province: "ON" })).toBeNull();
    expect(await hamiltonLocation({ address: "75 Balsam Ave N", city: "Hamilton", province: "BC" })).toBeNull();
  });
  it("keeps inventory, non-designation and unexplained years separate", () => {
    expect(heritageMeaning("Inventoried")).toBe("inventoried_not_a_designation");
    expect(heritageMeaning("Registered Non-Designated")).toBe("registered_non_designated");
    expect(heritageMeaning("Proposed new status")).toBe("unknown");
    expect(arcgisDate(null)).toBeNull(); expect(arcgisDate(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(arcgisDate(Infinity)).toBeNull();
  });
  it("retains an exact rural heritage candidate when civic and heritage points disagree", async () => {
    const result = await hamiltonHeritage("1965 Safari Road", { ...location, address: "1965 Safari Road", latitude: 43.33911566136974, longitude: -80.16608193142605 }, "Flamborough");
    expect(result.status).toBe("ambiguous");
    const records = (result.data as { records: { recordId: string; sourcePointSeparationM: number }[] }).records;
    expect(records[0].recordId).toBe("568"); expect(records[0].sourcePointSeparationM).toBeGreaterThan(100);
  });
  it("groups application sites and keeps every stage unknown regardless of year", () => {
    const r = { OBJECTID: 1, FILE_NUM: "ZAC-16-011", FILE_YEAR: 2016, FILE_TYPE: "Zoning Amendment", ADDRESS: "75 Balsam Ave N", DESCRIP: "source text", latitude: 43.249, longitude: -79.8302 };
    const data = hamiltonApplications([r, { ...r, ADDRESS: "77 Balsam Ave N" }, { ...r, FILE_NUM: "old", FILE_YEAR: 1990 }, { ...r, FILE_NUM: "far", latitude: 43.4 }, { ...r, latitude: null }], 43.249, -79.8302);
    expect(data.totalNearbyApplications).toBe(2); expect(data.sourceRecordsWithoutUsableCoordinates).toBe(1);
    expect(data.applications[0]).toMatchObject({ stage: "unknown", publishedStatus: null, dateSubmitted: null, fileYear: 2016, nearbyAddresses: ["75 Balsam Ave N", "77 Balsam Ave N"] });
  });
  it("allowlists permit fields, preserving dated closed status without a legality claim", () => {
    const data = permitRecord({ OBJECTID: 3, PERMITNUMBER: "P1", ORIGINALADDRESS2: "NULL", STATUSCURRENT: "Closed", ISSUEDDATE: Date.UTC(2017, 1, 1), owner: "PRIVATE", applicant: "PRIVATE" }, "historic");
    expect(data).toMatchObject({ publishedStatus: "Closed", publishedUnit: null, issuedAt: "2017-02-01T00:00:00.000Z", completedAt: null }); expect(JSON.stringify(data)).not.toContain("PRIVATE");
  });
});
describe("Hamilton source boundaries and incomplete coverage", () => {
  it("requires the official public organisation, endpoint and redistribution licence", () => {
    const feed = HAMILTON.zoning; expect(validHamiltonItem(item(feed), feed)).toBe(true);
    for (const changed of [{ owner: "somebody" }, { orgId: "other" }, { access: "private" }, { licenseInfo: "Public viewing only" }, { url: "https://example.com" }]) expect(validHamiltonItem({ ...item(feed), ...changed }, feed)).toBe(false);
  });
  it("keeps partial permit successes and each feed's own vintage", async () => {
    const r = { ...Object.fromEntries(HAMILTON.permitsHistory.fields.map(k => [k, null])), OBJECTID: 9, ORIGINALADDRESS1: "75 BALSAM N", ORIGINALCITY: "HAMILTON", PERMITNUMBER: "P1", STATUSCURRENT: "Closed" };
    const provider = fakeProvider(HAMILTON.permitsHistory, [r]);
    mockFetch.mockImplementation(async (u: URL) => u.pathname.includes("2017_to_Present") ? new Response("down", { status: 503 }) : provider(u));
    const layers = await hamiltonLayers(location.address, "Hamilton", "ON", { ...location, municipalAddress: { recordIds: ["1"], community: "Hamilton", permitAddressKeys: ["75 balsam avenue north", "75 balsam north"], source: HAMILTON.addresses.source, sourceUpdatedAt: null } });
    expect(layers.permits.status).toBe("available"); expect(layers.permits.data).toMatchObject({ coverageComplete: false, datasets: [{ status: "unavailable" }, { sourceUpdatedAt: "2024-02-05T00:00:00.000Z" }], records: [{ permitNumber: "P1", publishedStatus: "Closed" }] });
    expect(layers.permits.note).toContain("2024");
  });
  it("never treats incomplete GIS or street interpolation as a clear property", async () => {
    const r = { ...Object.fromEntries(HAMILTON.zoning.fields.map(k => [k, null])), OBJECTID: 1, ZONING_CODE: "C5" };
    mockFetch.mockImplementation(fakeProvider(HAMILTON.zoning, [r], { incomplete: true }));
    expect((await hamiltonLayers(null, "Hamilton", "ON", location)).zoning.status).toBe("unavailable");
    expect((await hamiltonLayers(null, "Hamilton", "ON", { ...location, accuracy: "street_interpolated" })).zoning.status).toBe("skipped");
  });
  it("retains boundary ambiguity and rejects foreign provider links", async () => {
    const r = { ...Object.fromEntries(HAMILTON.zoning.fields.map(k => [k, null])), OBJECTID: 1, ZONING_CODE: "C5", PARENT_BY_LAW_URL: "https://evil.example/prompt" };
    mockFetch.mockImplementation(fakeProvider(HAMILTON.zoning, [r, { ...r, OBJECTID: 2 }]));
    const result = (await hamiltonLayers(null, "Hamilton", "ON", location)).zoning;
    expect(result.status).toBe("ambiguous"); expect(JSON.stringify(result.data)).not.toContain("evil.example");
  });
  it("refuses incomplete snapshot batches and source changes before publication", async () => {
    let changes = false, metaReads = 0;
    mockFetch.mockImplementation(async (u: URL) => {
      const feed = HAMILTON.development;
      if (u.pathname.includes("/sharing/")) return respond(item(feed));
      if (!u.pathname.endsWith("/query")) return respond({ geometryType: "esriGeometryPoint", fields: feed.fields.map(name => ({ name })), editingInfo: { dataLastEditDate: changes && ++metaReads > 1 ? 2 : 1 } });
      if (u.searchParams.has("returnIdsOnly")) return respond({ objectIds: [1, 2] });
      return respond({ features: (changes ? [1, 2] : [1]).map(id => ({ attributes: { ...Object.fromEntries(feed.fields.map(k => [k, null])), OBJECTID: id }, geometry: { x: -79.83, y: 43.249 } })) });
    });
    await expect(fetchSnapshot("hamilton-development")).rejects.toThrow("incomplete");
    changes = true; await expect(fetchSnapshot("hamilton-development")).rejects.toThrow("changed during refresh");
  });
});

describe("Hamilton richer planning and servicing evidence", () => {
  it("preserves contradictory quarterly observations without asserting a current approval", async () => {
    const feed = HAMILTON.planningApplications;
    const base = { ...Object.fromEntries(feed.fields.map(k => [k, null])), OBJECTID: 10, PLANNING_APPLICATION_NUMBER: "UHOPA-17-001", APPLICATION_STATUS: "Appealed", APPEALED: "Yes", APPLICATION_SUBMITTED_DATE: Date.UTC(2017, 11, 6), YEAR_OF_APPLICATION: 2023, YEAR_QUARTER: "Q1", DECISION_DATE: Date.UTC(2023, 1, 8), APPEAL_DATE: Date.UTC(2023, 2, 9), latitude: location.latitude, longitude: location.longitude };
    const provider = fakeProvider(feed, [base, { ...base, OBJECTID: 11, YEAR_QUARTER: "Q2", APPLICATION_STATUS: "Approved" }]);
    mockFetch.mockImplementation(async (u: URL) => u.href.startsWith(feed.url) && !u.pathname.endsWith("/query") ? respond({ geometryType: "esriGeometryPoint", fields: feed.fields.map(name => ({ name })), advancedQueryCapabilities: { supportsQueryWithDistance: true } }) : provider(u));
    const result = (await hamiltonLayers(null, "Hamilton", "ON", location)).planningApplications;
    expect(result.status).toBe("available");
    expect(result.data).toMatchObject({ distinctApplicationNumbers: 1, totalNearbyRecords: 2, records: [{ stage: "appealed", publishedQuarter: "Q1", submittedAt: "2017-12-06T00:00:00.000Z", publishedYearOfApplicationField: 2023, appealAt: "2023-03-09T00:00:00.000Z" }, { stage: "approved", publishedQuarter: "Q2" }] });
    expect(result.note).toContain("no current status is inferred");
    mockFetch.mockImplementation(async (u: URL) => u.href.startsWith(feed.url) && u.pathname.endsWith("/query") ? respond({ count: 501, exceededTransferLimit: true, features: [] }) : u.href.startsWith(feed.url) ? respond({ geometryType: "esriGeometryPoint", fields: feed.fields.map(name => ({ name })), advancedQueryCapabilities: { supportsQueryWithDistance: true } }) : provider(u));
    expect((await hamiltonLayers(null, "Hamilton", "ON", location)).planningApplications.status).toBe("unavailable");
  });
  it("matches historic grant payments by civic address and former community, preserving project value", async () => {
    const feed = HAMILTON.heritageGrants;
    const r = { OBJECTID: 7, ADDRESS: "19 Victoria Street", COMMUNITY: "Dundas", YEAR_PAID: "2015", CONSTRUCTION_VALUE: 16800, GRANT_AMOUNT: 5000 };
    mockFetch.mockImplementation(fakeProvider(feed, [r, { ...r, OBJECTID: 8, COMMUNITY: "Hamilton" }]));
    const result = (await hamiltonLayers("19 Victoria St", "Dundas", "ON", null)).heritageGrants;
    expect(result.status).toBe("available"); expect(result.data).toMatchObject({ currency: "CAD", records: [{ recordId: "7", publishedYearPaid: 2015, publishedConstructionValue: 16800, grantAmount: 5000 }] });
    expect(result.note).toContain("not a current grant offer");
  });
  it("keeps unofficial rural boundaries, catchment-only scope and unperformed authority review explicit", async () => {
    const feed = HAMILTON.ruralSettlement;
    mockFetch.mockImplementation(fakeProvider(feed, [{ OBJECTID: 1, NAME: "Settlement", BOUNDARY_STATUS: "Unofficial", OMB_APPROVAL_DATE: null, ADD_DATE: null }]));
    const result = await hamiltonLayers(null, "Hamilton", "ON", location);
    expect(result.ruralSettlement.data).toMatchObject({ records: [{ publishedFields: { BOUNDARY_STATUS: "Unofficial" } }] });
    expect(result.hamiltonConservation).toMatchObject({ status: "not_supported", data: { screenPerformed: false, jurisdiction: "not_determined" } });
    expect(result.hamiltonConservation.note).toContain("not fetched or republished");
    mockFetch.mockImplementation(fakeProvider(HAMILTON.wastewaterCatchment, [{ OBJECTID: 1, SYSTEM: "Dundas" }]));
    const wastewater = (await hamiltonLayers(null, "Hamilton", "ON", location)).wastewaterCatchment;
    expect(wastewater.status).toBe("available"); expect(wastewater.note).toContain("not proof of a sewer connection");
  });
});

describe("Hamilton planning publication rights", () => {
  it("withholds quarterly observations when the actual catalogue licence is blank", async () => {
    const feed = HAMILTON.planningApplications;
    const provider = fakeProvider(feed, []);
    mockFetch.mockImplementation(async (u: URL) => u.pathname.endsWith(feed.item) ? respond({ ...item(feed), licenseInfo: "" }) : provider(u));
    const result = (await hamiltonLayers(null, "Hamilton", "ON", location)).planningApplications;
    expect(result.status).toBe("unavailable"); expect(result.data).toBeNull();
    expect(result.source?.licence).toBe("Dataset reuse licence unverified");
    expect(mockFetch.mock.calls.filter(([u]) => (u as URL).href.startsWith(feed.url + "/query"))).toHaveLength(0);
  });
});
