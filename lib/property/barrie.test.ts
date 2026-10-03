import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { barrieCoverage, barrieLayers, barrieLocation, barrieMarket, barrieMetadata } from "./barrie";
import { BARRIE_FEEDS, BARRIE_GRANT, BARRIE_WITHHELD, type BarrieFeed } from "./barrie-sources";
import type { Location, Row } from "./model";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
const { json, bytes } = vi.hoisted(() => ({ json: vi.fn(), bytes: vi.fn() }));
vi.mock("./http", async () => ({ ...await vi.importActual<typeof import("./http")>("./http"), fetchJson: json, fetchBytes: bytes }));
const fixture: Record<string, Row> = JSON.parse(readFileSync(new URL("./fixtures/barrie-grant.json", import.meta.url), "utf8"));
const licence = readFileSync(new URL("./fixtures/barrie-licence.pdf", import.meta.url));
const feed = (k: string) => BARRIE_FEEDS.find(f => f.key === k)!;
const location: Location = { address: "12 King St W", city: "Barrie", province: "ON", latitude: 44.39, longitude: -79.68, accuracy: "source_building_point", provider: "national-address-register" };
const record = (f: BarrieFeed, a: Row = {}, g: Row = { x: -79.68, y: 44.39 }) => ({ attributes: { ...Object.fromEntries(Object.keys(f.fields).map(k => [k, null])), [f.oid]: 1, ...a }, geometry: g });
const civic = { FULLADDR: "12 KING ST W", ADDRNUMBER: "12", SSTRNAME: "KING", SSTRSUFF: "ST", SSTRDIR: "W", UNITNUMBER: null, STATUS: "Current" };
function provider(records: Record<string, unknown[]> = {}, changes: Record<string, Row | undefined> = {}) {
  return async (u: URL) => {
    if (u.pathname.endsWith("/query")) {
      const f = BARRIE_FEEDS.find(f => u.href.split("?")[0] === f.url + "/query"); if (!f) throw Error("Unexpected source query");
      return u.searchParams.get("returnCountOnly") === "true" ? { count: 10, ...changes.count } : { spatialReference: { wkid: 4326 }, features: records[f.key] ?? (f.key === "municipality" ? [record(f)] : f.key === "addresses" ? [record(f, civic)] : []), ...changes[f.key] };
    }
    if (u.pathname.endsWith("/search")) {
      const id = u.searchParams.get("q")?.match(/^id:([a-f0-9]{32}) AND group:/)?.[1];
      if (!id || !u.searchParams.get("q")?.endsWith(BARRIE_GRANT.group)) throw Error("Unexpected catalogue query");
      return { ...fixture["curation:" + id], ...changes.curated };
    }
    const original = fixture[u.origin + u.pathname]; if (!original) throw Error("Unexpected metadata");
    const kind = u.pathname.endsWith(BARRIE_GRANT.site + "/data") ? "siteData" : u.pathname.endsWith(BARRIE_GRANT.site) ? "site" : u.pathname.includes("/groups/") ? "group" : u.pathname.includes("/sharing/") ? "item" : u.pathname.endsWith("/MapServer") ? "root" : "metadata";
    return { ...original, ...changes[kind] };
  };
}
beforeEach(() => { json.mockReset().mockImplementation(provider()); bytes.mockReset().mockResolvedValue(licence); });
afterEach(() => vi.restoreAllMocks());
describe("Barrie City-licensed property references", () => {
  it("requires the complete grant, explicit official offer, exact curated publisher/root/typed child before records", async () => {
    for (const f of BARRIE_FEEDS) expect(await barrieMetadata(f)).toEqual({ sourceUpdatedAt: null });
    for (const change of [{ item: { owner: "copy" } }, { item: { orgId: "other" } }, { item: { url: feed("zoning").rootUrl } }, { item: { access: "private" } }, { item: { licenseInfo: "public access" } }, { item: { description: "Unverified supplier lineage" } }, { root: { serviceItemId: "invented" } }, { root: { layers: [] } }, { metadata: { name: "Draft zoning" } }, { metadata: { geometryType: "esriGeometryPoint" } }, { metadata: { copyrightText: "Third party" } }, { metadata: { fields: [] } }, { metadata: { objectIdField: "other" } }, { curated: { total: 0, results: [] } }, { site: { owner: "copy" } }, { group: { orgId: "other" } }]) {
      json.mockClear().mockImplementation(provider({}, change)); await expect(barrieMetadata(feed("zoning"))).rejects.toThrow(); expect(json.mock.calls.some(([u]) => u.pathname.endsWith("/query"))).toBe(false);
    }
    bytes.mockResolvedValue(Buffer.from("Open Government Licence Barrie")); await expect(barrieMetadata(feed("addresses"))).rejects.toThrow();
  });
  it("does not substitute generic copyright or an unlinked licence title for the City's full offer and catalogue binding", async () => {
    const d = fixture["https://www.arcgis.com/sharing/rest/content/items/" + BARRIE_GRANT.site + "/data"];
    for (const change of [{ values: {} }, { values: { ...d.values as Row, customHostname: "copy.invalid" } }, { values: { ...d.values as Row, layout: { text: "Open Government Licence" } } }, { catalogV2: { scopes: { item: { filters: [] } } } }]) { json.mockImplementation(provider({}, { siteData: change })); await expect(barrieMetadata(feed("permits"))).rejects.toThrow(); }
  });
  it("rejects embedded City/province conflicts and does not use generic City civic geometry as precise identity", async () => {
    expect(barrieMarket("City of Barrie", "Ontario")).toBe(true); expect(barrieMarket("Barrie", "NS")).toBe(false);
    expect(await barrieLocation({ address: "12 King St W, Barrie, ON" })).toBeNull();
    expect((await barrieLocation({ address: "12 King St W, Springwater, ON", city: "Barrie" }))?.status).toBe("ambiguous");
    expect((await barrieLocation({ address: "12 King St W, Barrie, BC", province: "ON" }))?.status).toBe("ambiguous");
    for (const l of [{ ...location, accuracy: "unknown" }, { ...location, provider: "barrie:addresses" }, { ...location, city: "Springwater" }, { ...location, latitude: 43 }]) { json.mockClear(); const r = await barrieLayers(location.address, "Barrie", "ON", l); expect(r.permits.status).toBe("skipped"); expect(json).not.toHaveBeenCalled(); }
  });
  it("requires one complete City reference polygon for precise spatial reads, without claiming current annex boundaries", async () => {
    for (const records of [[], [record(feed("municipality"), { OBJECTID: 2 })], [record(feed("municipality")), record(feed("municipality"), { OBJECTID: 2 })]]) {
      json.mockClear().mockImplementation(provider({ municipality: records })); const r = await barrieLayers(location.address, "Barrie", "ON", location); expect(r.zoning.status).toBe("skipped"); expect(json.mock.calls.filter(([u]) => u.pathname.endsWith("/query")).every(([u]) => u.pathname.endsWith("AdministrativeArea/MapServer/1/query"))).toBe(true);
    }
    json.mockImplementation(provider({}, { municipality: { exceededTransferLimit: true } })); expect((await barrieLayers(location.address, "Barrie", "ON", location)).permits.status).toBe("skipped");
    json.mockImplementation(provider()); expect((await barrieLayers(location.address, "Barrie", "ON", location)).municipality.data).toMatchObject({ currentLegalBoundaryVerified: false, annex2026CoverageVerified: false });
  });
  it("requires full Current civic components and blank unit before exact histories; approximate independent positions remain address-only", async () => {
    json.mockImplementation(provider({ permits: [record(feed("permits"), { Full_Address: "12 KING ST W", RECORD_ID: "PMT18-00856", RECORD_STATUS: "Issued", Date_Status: "2018.07.19" })], additionalUnits: [record(feed("additionalUnits"), { ADDR_FULL_LINE_BARRIE: "12 KING ST W", REGISTRATION_STATUS: "Registered", UNIT_NUMBER: "2" })] }));
    let r = await barrieLayers(location.address, "Barrie", "ON", { ...location, accuracy: "street_interpolated" }); expect(r.permits.status).toBe("available"); expect(r.additionalUnits.status).toBe("available"); expect(r.zoning.status).toBe("skipped"); expect(r.nearbyPermitApplications.status).toBe("skipped"); const blockface = await barrieLayers(location.address, "Barrie", "ON", { ...location, accuracy: "blockface_representative" }); expect(blockface.permits.status).toBe("available"); expect(blockface.zoning.status).toBe("skipped"); expect(blockface.permits.data).toMatchObject({ screenedPoint: null, spatialScreenPerformed: false }); expect(r.permits.data).toMatchObject({ screenedPoint: null, spatialScreenPerformed: false, finalInspectionVerified: false, records: [expect.objectContaining({ publishedStatusDateRaw: "2018.07.19" })] }); expect(r.additionalUnits.data).toMatchObject({ currentUnitLegalityVerified: false, records: [expect.objectContaining({ publishedRegistrationStatus: "Registered", publishedUnitNumber: "2" })] });
    for (const a of [{ STATUS: "Proposed" }, { ADDRNUMBER: "13" }, { SSTRDIR: "E" }, { SSTRSUFF: "RD" }, { UNITNUMBER: "2" }, { FULLADDR: "12-14 KING ST W" }]) { json.mockImplementation(provider({ addresses: [record(feed("addresses"), { ...civic, ...a })] })); r = await barrieLayers(location.address, "Barrie", "ON", location); expect(r.municipalAddresses.status).toBe("no_match"); expect(r.permits.status).toBe("skipped"); }
  });
  it("keeps anonymous nearby application/landmark observations separate from the property and rejects unusable source geometry", async () => {
    const f = feed("nearbyPermitApplications"), h = feed("culturalHeritage"); json.mockImplementation(provider({ nearbyPermitApplications: [record(f, { Sub_Type: "Residential Deck", RECORD_STATUS: "Under Review", Date_Opened: "2018.07.31" })], culturalHeritage: [record(h, { TYPE: "SCULPTURE", YEARBUILT: "1987", TITLE: "Spirit Catcher" })] }));
    const r = await barrieLayers(location.address, "Barrie", "ON", location); expect(r.nearbyPermitApplications.data).toMatchObject({ scope: "nearby_observations_not_subject_property", subjectPropertyAssignmentEstablished: false, publishedApplicationFileNumber: null, publishedApplicationAddress: null, radiusM: 100, records: [expect.objectContaining({ distanceM: 0, publishedOpenedDateRaw: "2018.07.31" })] }); expect(r.culturalHeritage.data).toMatchObject({ fullHeritageScreenPerformed: false, subjectBuildingConstructionYearEstablished: false, records: [expect.objectContaining({ publishedFeatureYearBuiltRaw: "1987" })] });
    json.mockImplementation(provider({ nearbyPermitApplications: [record(f, {}, { x: -79.5, y: 44.5 })] })); expect((await barrieLayers(location.address, "Barrie", "ON", location)).nearbyPermitApplications.status).toBe("no_match");
    json.mockImplementation(provider({ nearbyPermitApplications: [record(f, {}, { x: "bad", y: 44.39 })] })); expect((await barrieLayers(location.address, "Barrie", "ON", location)).nearbyPermitApplications.status).toBe("unavailable");
    json.mockImplementation(provider({}, { nearbyPermitApplications: { spatialReference: { wkid: 3857 }, features: [record(f)] } })); expect((await barrieLayers(location.address, "Barrie", "ON", location)).nearbyPermitApplications.status).toBe("unavailable");
  });
  it("retains published approval/appeal/zone/plan references without legal conclusions and keeps current and Nov2026 wards separate", async () => {
    json.mockImplementation(provider({ zoning: [record(feed("zoning"), { ZONING: "RA2-2", SPECIAL: "SP-684", HOLD: "H-171", LASTUPDATE: 1751582458000 })], planningApplications: [record(feed("planningApplications"), { File_No: "D30-023-2022", Status: "APPROVED", LPAT_Appeal: "Yes", Total_Residential_Units: 400 })], majorTransitStationArea: [record(feed("majorTransitStationArea"), { REFERENCE: "Official Plan 2022", STATUS: "Approved" })], futureWard2026: [record(feed("futureWard2026"), { WARD_NO: 3 })] }));
    const r = await barrieLayers(location.address, "Barrie", "ON", location); expect(r.zoning.data).toMatchObject({ currentApplicabilityVerified: false, communityPlanningPermitDistrictScreenPerformed: false, legalPermissionsEstablished: false, records: [expect.objectContaining({ publishedSpecialProvision: "SP-684", publishedHold: "H-171", publishedRecordEditDate: "2025-07-03T22:40:58.000Z" })] }); expect(r.zoning.sourceUpdatedAt).toBeNull(); expect(r.planningApplications.data).toMatchObject({ currentApprovalVerified: false, currentAppealsVerified: false, linkedPlanDocumentsCopied: false, records: [expect.objectContaining({ publishedAppealField: "Yes", publishedResidentialUnits: 400 })] }); expect(r.futureWard2026.data).toMatchObject({ treatedAsCurrentWard: false }); expect(r.communityPlanningPermit.status).toBe("unavailable"); expect(r.heritage.status).toBe("unavailable");
    const b = preShowingBrief(r, []); expect(b.findings.find(x => x.layer === "zoning")?.summary).toContain("Allandale"); expect(b.documentsToRequest.some(x => x.document.includes("Barrie"))).toBe(true);
  });
  it("bounds results and retains independent failures, unknown dates, no-match and empty-feed limits", async () => {
    const f = feed("permits"); json.mockImplementation(provider({ permits: Array.from({ length: 51 }, (_, i) => record(f, { OBJECTID: i + 1, Full_Address: "12 KING ST W" })) }, { zoning: { error: { code: 500 } } }));
    let r = await barrieLayers(location.address, "Barrie", "ON", location); expect(r.permits.truncated).toBe(true); expect((r.permits.data as Row).records).toHaveLength(50); expect(r.permits.data).toMatchObject({ queryCoverageComplete: false, absenceEstablished: false }); expect(r.zoning.status).toBe("unavailable");
    json.mockImplementation(provider({}, { permits: { exceededTransferLimit: true } })); expect((await barrieLayers(location.address, "Barrie", "ON", location)).permits.status).toBe("unavailable");
    json.mockImplementation(provider({ permits: [record(f, { Full_Address: 12 })] })); expect((await barrieLayers(location.address, "Barrie", "ON", location)).permits.status).toBe("unavailable");
    json.mockImplementation(provider()); r = await barrieLayers(location.address, "Barrie", "ON", location); expect(r.employmentArea.status).toBe("no_match"); expect(r.employmentArea.data).toMatchObject({ absenceEstablished: false });
  });
  it("excludes personal/cadastral fields and withheld reads/counts, and skips address history for coordinates-only", async () => {
    const r = await barrieLayers(null, "Barrie", "ON", { ...location, accuracy: "caller_supplied", provider: "caller" }); expect(r.permits.status).toBe("skipped"); expect(r.additionalUnits.status).toBe("skipped");
    const c = await barrieCoverage(); expect(c.datasets).toHaveLength(18); expect(c.datasets.every(x => x.status === "verified")).toBe(true); expect(c.withheld).toHaveLength(12); expect(c.complete).toBe(false);
    const queries = json.mock.calls.filter(([u]) => u.pathname.endsWith("/query")); expect(queries.every(([u]) => !/\*|OWNER|PARCELID|COUNCILLOR|URL_IMAGE|File_Manager|Legal_Plan|LASTEDITOR/i.test(u.searchParams.get("outFields") ?? ""))).toBe(true); expect(queries.filter(([u]) => u.pathname.includes("/AddressVW/")).every(([u]) => u.searchParams.get("where")?.includes("Current"))).toBe(true);
    for (const f of BARRIE_WITHHELD) expect(json.mock.calls.some(([u]) => u.href.startsWith(f.url + "/query"))).toBe(false);
    json.mockImplementation(provider({}, { count: { count: -1 } })); expect((await barrieCoverage()).datasets.every(x => x.status === "unavailable" && x.records === null)).toBe(true);
    const m = ontarioMarketRoadmap().municipalities.find(m => m.city === "Barrie")!; expect(m.configuredLayers).toContain("additionalUnits"); expect(m.withheldLayers.some(x => x.layer === "communityPlanningPermit")).toBe(true); expect(m.complete).toBe(false);
  });
});
