import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bramptonCoverage, bramptonLayers, bramptonLocation, bramptonMetadata } from "./brampton";
import { BRAMPTON_FEEDS, BRAMPTON_GRANT, BRAMPTON_WITHHELD, type BramptonFeed } from "./brampton-sources";
import { peterboroughCoverage, peterboroughLayers } from "./peterborough-audit";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import type { Location, Row } from "./model";
const { json } = vi.hoisted(() => ({ json: vi.fn() }));
vi.mock("./http", async () => ({ ...await vi.importActual<typeof import("./http")>("./http"), fetchJson: json }));
const fixture: Record<string, Row> = JSON.parse(readFileSync(new URL("./fixtures/brampton-grant.json", import.meta.url), "utf8"));
const feed = (k: string) => BRAMPTON_FEEDS.find(f => f.key === k)!;
const l: Location = { address: "12 King St W", city: "Brampton", province: "ON", latitude: 43.7, longitude: -79.76, accuracy: "source_building_point", provider: "national-address-register" };
const record = (f: BramptonFeed, a: Row = {}) => ({ attributes: { ...Object.fromEntries(Object.keys(f.fields).map(k => [k, null])), [f.oid]: 1, ...a } });
const civic = { FULL_ADDRESS: "12 KING ST W", CIVIC_NUMBER: "12", STREET_NAME: "KING", STREET_TYPE: "ST", STREET_DIRECTION: "W", UNIT_NO: null, CITY: "BRAMPTON", PROVINCE: "ON" };
const permit = { ADDRESS: "12 King St W, Brampton, ON, L6X 1Y1", FOLDERRSN: 123, PERMITNUMBER: "26-001", STATUSDESC: "Closed", SECOND_UNIT: "Yes", DWELLINGS: "2", GFA: "130" };
function provider(records: Record<string, unknown[]> = {}, changes: Record<string, Row> = {}) {
  return async (u: URL) => {
    if (u.pathname.endsWith("/query")) {
      const f = BRAMPTON_FEEDS.find(f => u.href.split("?")[0] === f.url + "/query"); if (!f) throw Error("Unexpected source query");
      return u.searchParams.get("returnCountOnly") === "true" ? { count: 10, ...changes.count } : { features: records[f.key] ?? (f.key === "municipality" ? [record(f, { OBJECTID: 322 })] : f.key === "municipalAddresses" ? [record(f, civic)] : []), ...changes[f.key] };
    }
    if (u.pathname.endsWith("/search")) { const id = u.searchParams.get("q")?.match(/^id:([a-f0-9]{32}) AND \(/)?.[1]; if (!id) throw Error("Unexpected curation query"); return { ...fixture["curation:" + id], ...changes.curated }; }
    const url = u.origin + u.pathname, original = fixture[url]; if (!original) throw Error("Unexpected metadata");
    return { ...original, ...changes[url] };
  };
}
beforeEach(() => { json.mockReset().mockImplementation(provider()); });
describe("Brampton exact City property and activity evidence", () => {
  it("requires exact official curation, grants, publisher/root/child/schema before any factual query", async () => {
    for (const f of BRAMPTON_FEEDS) expect((await bramptonMetadata(f)).sourceUpdatedAt).toEqual(expect.toBeOneOf([null, expect.any(String)]));
    const f = feed("variance"), item = "https://www.arcgis.com/sharing/rest/content/items/" + f.item;
    for (const changes of [{ [item]: { owner: "copy" } }, { [item]: { orgId: "other" } }, { [item]: { licenseInfo: "Public access" } }, { [item]: { licenseInfo: "<a href='https://creativecommons.org/licenses/by/2.0/'>CC BY</a>" } }, { [item]: { url: f.rootUrl } }, { [item]: { description: "Unverified supplier" } }, { [f.rootUrl]: { serviceItemId: "invented" } }, { [f.url]: { fields: [] } }, { [f.url]: { name: "Draft" } }, { [f.url]: { geometryType: "esriGeometryPoint" } }, { curated: { total: 0, results: [] } }, { ["https://www.arcgis.com/sharing/rest/content/items/" + BRAMPTON_GRANT.planningParent]: { licenseInfo: "CC BY" } }, { ["https://www.arcgis.com/sharing/rest/content/items/" + BRAMPTON_GRANT.site]: { owner: "copy" } }]) {
      json.mockClear().mockImplementation(provider({}, changes)); await expect(bramptonMetadata(f)).rejects.toThrow(); expect(json.mock.calls.some(([u]) => u.pathname.endsWith("/query"))).toBe(false);
    }
  });
  it("rejects identity conflicts, unsuitable locations and City civic geometry as precise identity", async () => {
    expect(await bramptonLocation({ address: "12 King St W, Brampton, ON" })).toBeNull();
    expect((await bramptonLocation({ address: "12 King St W, Mississauga, ON", city: "Brampton" }))?.status).toBe("ambiguous");
    for (const location of [{ ...l, accuracy: "unknown" }, { ...l, provider: "brampton:municipalAddresses" }, { ...l, city: "Mississauga" }, { ...l, latitude: 44.2 }]) { json.mockClear(); const r = await bramptonLayers(l.address, "Brampton", "ON", location); expect(r.permits.status).toBe("skipped"); expect(json).not.toHaveBeenCalled(); }
    for (const records of [[], [record(feed("municipality"), { OBJECTID: 1 })], [record(feed("municipality"), { OBJECTID: 322 }), record(feed("municipality"), { OBJECTID: 323 })]]) { json.mockClear().mockImplementation(provider({ municipality: records })); const r = await bramptonLayers(l.address, "Brampton", "ON", l); expect(r.variance.status).toBe("skipped"); expect(json.mock.calls.filter(([u]) => u.pathname.endsWith("/query")).every(([u]) => u.pathname.endsWith("Common/MapServer/2/query"))).toBe(true); }
  });
  it("allows approximate positions only for complete unique civic attributes and exact histories", async () => {
    json.mockImplementation(provider({ permits: [record(feed("permits"), permit)] }));
    for (const accuracy of ["street_interpolated", "blockface_representative"]) { const r = await bramptonLayers(l.address, "Brampton", "ON", { ...l, accuracy }); expect(r.permits.status).toBe("available"); expect(r.variance.status).toBe("skipped"); expect(r.permits.data).toMatchObject({ spatialScreenPerformed: false, screenedPoint: null, finalInspectionVerified: false, records: [expect.objectContaining({ publishedDwellingsRaw: "2" })] }); }
    for (const a of [{ CITY: "MISSISSAUGA" }, { PROVINCE: "BC" }, { STREET_DIRECTION: "E" }, { STREET_TYPE: "RD" }, { CIVIC_NUMBER: "13" }, { UNIT_NO: "2" }]) { json.mockImplementation(provider({ municipalAddresses: [record(feed("municipalAddresses"), { ...civic, ...a })] })); expect((await bramptonLayers(l.address, "Brampton", "ON", l)).permits.status).toBe("skipped"); }
    json.mockImplementation(provider({ municipalAddresses: [record(feed("municipalAddresses"), civic), record(feed("municipalAddresses"), { ...civic, OBJECTID: 2 })] })); const r = await bramptonLayers(l.address, "Brampton", "ON", l); expect(r.municipalAddresses.status).toBe("ambiguous"); expect(r.permits.status).toBe("skipped");
  });
  it("verifies full permit municipality/province/postal/unit identity and exact safe folder joins", async () => {
    const a = record(feed("permitActivities"), { FOLDERRSN: 123, PROCESSRSN: 55, PROCESSDESC: "Final Inspection Building", STATUSDESC: "Pass", ACTIVITYDATE: 1760000000000 });
    json.mockImplementation(provider({ permits: [record(feed("permits"), permit)], permitActivities: [a] })); let r = await bramptonLayers(l.address, "Brampton", "ON", l);
    expect(r.permitActivities.data).toMatchObject({ exactPermitIdentityJoinPerformed: true, latestActivitySelectedAsCurrentStatus: false, finalInspectionVerified: false, occupancyVerified: false, records: [expect.objectContaining({ matchedPermitNumbers: ["26-001"], publishedStatus: "Pass" })] });
    for (const ADDRESS of ["12 King St W, Mississauga, ON, L6X 1Y1", "12 King St W, Brampton, BC, L6X 1Y1", "12 King St W", "Unit 2 12 King St W, Brampton, ON, L6X 1Y1", "12 King St W, Brampton, ON, bad"]) { json.mockImplementation(provider({ permits: [record(feed("permits"), { ...permit, ADDRESS })] })); r = await bramptonLayers(l.address, "Brampton", "ON", l); expect(r.permits.status).toBe("no_match"); expect(r.permitActivities.status).toBe("skipped"); }
    for (const permits of [[record(feed("permits"), { ...permit, FOLDERRSN: 123.5 })], [record(feed("permits"), permit), record(feed("permits"), { ...permit, OBJECTID: 2, PERMITNUMBER: "other" })]]) { json.mockImplementation(provider({ permits })); expect((await bramptonLayers(l.address, "Brampton", "ON", l)).permitActivities.status).toBe("skipped"); }
    json.mockImplementation(provider({ permits: [record(feed("permits"), permit)], permitActivities: [record(feed("permitActivities"), { FOLDERRSN: 999 })] })); expect((await bramptonLayers(l.address, "Brampton", "ON", l)).permitActivities.status).toBe("unavailable");
  });
  it("does not join truncated permits; retains partial/repeated/conflicting activity rows without status inference", async () => {
    const p = feed("permits"), a = feed("permitActivities"); json.mockImplementation(provider({ permits: Array.from({ length: 51 }, (_, i) => record(p, { ...permit, OBJECTID: i + 1 })) })); let r = await bramptonLayers(l.address, "Brampton", "ON", l); expect(r.permits.truncated).toBe(true); expect(r.permitActivities.status).toBe("skipped");
    json.mockImplementation(provider({ permits: [record(p, permit)], permitActivities: Array.from({ length: 51 }, (_, i) => record(a, { OBJECTID: i + 1, FOLDERRSN: 123, STATUSDESC: i % 2 ? "Pass" : "Fail", PROCESSRSN: 55 })) })); r = await bramptonLayers(l.address, "Brampton", "ON", l); expect(r.permitActivities.truncated).toBe(true); expect(r.permitActivities.data).toMatchObject({ queryCoverageComplete: false, absenceEstablished: false, latestActivitySelectedAsCurrentStatus: false }); expect((r.permitActivities.data as Row).records).toHaveLength(50);
  });
  it("retains separate application files/raw statuses and planning/heritage limits in reports", async () => {
    json.mockImplementation(provider({ planningApplications: [record(feed("planningApplications"), { FILE_NUMBER: "OZS-2026-0003", STATUS: "Deemed Complete" }), record(feed("planningApplications"), { POLY_ID: 2, FILE_NUMBER: "OZS-2023-0027", STATUS: "Closed Approved" })], heritageDetails: [record(feed("heritageDetails"), { ADDRESS: "12 KING ST W", HERITAGE_STATUS: "LISTED", CONSTRUCTION_DATE: "1873" })] }));
    const r = await bramptonLayers(l.address, "Brampton", "ON", l); expect((r.planningApplications.data as Row).records).toHaveLength(2); expect(r.planningApplications.data).toMatchObject({ currentApprovalVerified: false, currentConditionsVerified: false, currentAppealsVerified: false, legalPermissionsEstablished: false }); expect(r.heritageDetails.data).toMatchObject({ currentRegisterVerified: false, buildingAgeEstablished: false }); expect(r.zoning.status).toBe("unavailable"); expect(r.rentalLicences.status).toBe("unavailable");
    expect(preShowingBrief(r, []).documentsToRequest.some(d => d.document.includes("Brampton dual-zoning"))).toBe(true);
  });
  it("retries one enterprise ArcGIS 500 read and never retries access restrictions or claims absent data", async () => {
    for (const code of [500, 403]) { json.mockClear().mockImplementation(provider({}, { permits: { error: { code } } })); const r = await bramptonLayers(l.address, "Brampton", "ON", l); expect(r.permits.status).toBe("unavailable"); expect(json.mock.calls.filter(([u]) => u.href.startsWith(feed("permits").url + "/query"))).toHaveLength(code === 500 ? 2 : 1); if (code === 500) expect(json.mock.calls.filter(([u]) => u.href.startsWith(feed("permits").url + "/query"))[1].slice(1)).toEqual([8000, 0]); }
    json.mockImplementation(provider({}, { permits: { exceededTransferLimit: true } })); expect((await bramptonLayers(l.address, "Brampton", "ON", l)).permits.status).toBe("unavailable");
    json.mockImplementation(provider()); const r = await bramptonLayers(null, "Brampton", "ON", { ...l, accuracy: "caller_supplied", provider: "caller" }); expect(r.permits.status).toBe("skipped"); expect(r.permitActivities.status).toBe("skipped"); expect(r.variance.data).toMatchObject({ absenceEstablished: false });
  });
  it("audits bounded counts and excludes personal/cadastral fields and all withheld queries", async () => {
    const c = await bramptonCoverage(); expect(c.datasets).toHaveLength(15); expect(c.datasets.every(d => d.status === "verified")).toBe(true); expect(c.withheld).toHaveLength(8); expect(c.complete).toBe(false);
    for (const f of BRAMPTON_FEEDS) expect(Object.keys(f.fields).join(",")).not.toMatch(/BUILDER|CONTRACTOR|CITY_PLANNER|AGENT_COMPANY|APPLICANT_COMPANY|GEOMETRY|SHAPE|LOT_NUM|POLYGON_ID|GIS_ID/);
    for (const f of BRAMPTON_WITHHELD) expect(json.mock.calls.some(([u]) => u.href.startsWith(f.url + "/query"))).toBe(false);
    const m = ontarioMarketRoadmap().municipalities.find(m => m.city === "Brampton")!; expect(m.configuredLayers).toContain("heritage"); expect(m.configuredLayers).toContain("permitActivities"); expect(m.withheldLayers.some(g => g.layer === "zoning")).toBe(true);
  });
  it("keeps Peterborough reuse/planning gaps visible without any City record or count query", () => {
    const c = peterboroughCoverage(), r = peterboroughLayers("Peterborough", "ON"); expect(c.datasets).toHaveLength(0); expect(c.withheld).toHaveLength(16); expect(r.additionalUnits.data).toMatchObject({ recordsQueried: false, screenPerformed: false }); expect(r.currentPlanningInstruments.note).toContain("under appeal"); expect(json).not.toHaveBeenCalled(); expect(peterboroughLayers("Peterborough", "BC")).toEqual({});
    const m = ontarioMarketRoadmap().municipalities.find(m => m.city === "Peterborough")!; expect(m.stage).toBe("audited_reuse_gap"); expect(m.complete).toBe(false);
  });
});
