import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixtures from "./fixtures/ontario-wells-source.json";
import { ontarioWellRecordsCoverage, ontarioWellRecordsLayer, wellQueryRecords } from "./ontario-wells";
import { validWellCatalogue, validWellLineage, validWellMetadata, verifyWellSource } from "./ontario-wells-rights";
import { WELL_APP, WELL_FIELDS, WELL_SOURCE } from "./ontario-wells-sources";
import { preShowingBrief } from "./brief";
import type { Location, Row } from "./model";

vi.mock("./ontario-wells-rights", async original => ({ ...await original<object>(), verifyWellSource: vi.fn() }));
const point: Location = { address: null, city: "Orillia", province: "ON", latitude: 44.6181, longitude: -79.4208, accuracy: "caller_supplied", provider: "caller" };
const fields = Object.entries(WELL_FIELDS).map(([name, type]) => ({ name, type }));
const feature = (id = 123, lng = -79.421, lat = 44.6182) => ({ attributes: { OBJECTID: id, BORE_HOLE_ID: 1001, WELL_ID: "0012345", WELL_COMPLETED_DATE: "1940/07/17", RECEIVED_DATE: "1940/09/17", FINAL_STATUS_DESCR: "Water Supply", USE1: " ", USE2: "Municipal", MOE_COUNTY_DESCR: "SIMCOE", MOE_MUNICIPALITY_DESCR: "ORILLIA CITY", DEPTH_M: 23.1648, COMPLETED_YEAR: 1940, GEOGRAPHIC_TOWNSHIP_NAME: "ORILLIA", OWNER: "CONFIDENTIAL", CONTRACTOR: "PRIVATE", PATH: "original-personal-document.pdf" }, geometry: { x: lng, y: lat } });
const query = (features = [feature()]): Row => ({ fields, spatialReference: { wkid: 4326 }, features });
beforeEach(() => { vi.mocked(verifyWellSource).mockClear(); vi.mocked(verifyWellSource).mockResolvedValue({ catalogueMetadataModifiedAt: "2026-08-13", catalogueRefreshFrequency: "biannually", downloadPublicationDate: "2026-07-31", downloadRangeStart: "1899-01-01", downloadRangeEnd: "2026-06-30", liveServiceObservationDate: null }); });
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe("Ontario well source binding", () => {
  it("requires the active original publisher, specific dataset grant and audited resources", () => {
    expect(validWellCatalogue(fixtures.catalogue)).toBe(true);
    for (const changed of [{ owner_org: "other" }, { private: true }, { name: "petroleum-wells" }, { license_id: "viewing-only" }, { license_url: "https://example.org" }, { resources: [] }, { notes: "unlinked source" }, { state: "deleted" }]) expect(validWellCatalogue({ ...fixtures.catalogue, result: { ...fixtures.catalogue.result, ...changed } })).toBe(false);
    const copy = structuredClone(fixtures.catalogue); copy.result.resources[1].url = "https://example.org/copied.zip"; expect(validWellCatalogue(copy)).toBe(false);
  });
  it("requires the official iframe, audited app revision and original live endpoint fingerprint", () => {
    const offer = `<iframe src="${WELL_APP}"></iframe>`, index = '<title>Well Records</title><script src="assets/index-CCQIzaLj.js"></script>', hash = "f2447ff2cddbdccc2fa7f5e2fdadd2fd4fe8cb5863c1d47dbf6a0a5659383c07";
    expect(validWellLineage(offer, index, hash, true)).toBe(true);
    for (const args of [["", index, hash, true], [offer + offer, index, hash, true], [offer, index, "changed", true], [offer, index, hash, false], [offer, index.replace("CCQIzaLj", "new"), hash, true]] as const) expect(validWellLineage(args[0], args[1], args[2], args[3])).toBe(false);
  });
  it("requires the Wells point child, exact selected field types and distance-query capability", () => {
    expect(validWellMetadata(fixtures.root, fixtures.metadata)).toBe(true);
    for (const changed of [{ id: 1 }, { name: "Wells_Report" }, { geometryType: "esriGeometryPolygon" }, { fields: [] }, { advancedQueryCapabilities: { supportsQueryWithDistance: false } }]) expect(validWellMetadata(fixtures.root, { ...fixtures.metadata, ...changed })).toBe(false);
  });
});

describe("Ontario nearby reported well context", () => {
  it("projects only reported facts, keeps raw dates and measures the approximate map point correctly", () => {
    const result = wellQueryRecords(query(), point);
    expect(result.records[0]).toMatchObject({ wellId: "0012345", reportedCompletionDate: "1940/07/17", reportedReceivedDate: "1940/09/17", reportedUses: [null, "Municipal"], reportedDepthMeters: 23.1648, distanceToPublishedMapPointMeters: 19 });
    expect(JSON.stringify(result)).not.toMatch(/CONFIDENTIAL|PRIVATE|original-personal-document|CONTRACTOR|PATH|OWNER/);
    expect(result.coverageComplete).toBe(true);
  });
  it("filters points outside the stated radius instead of associating them with the property", () => {
    expect(wellQueryRecords(query([feature(1, -79.5, 44.6)]), point).records).toEqual([]);
    expect(() => wellQueryRecords({ ...query([feature(1, -79.5, 44.6)]), exceededTransferLimit: true }, point)).toThrow("cannot establish no match");
  });
  it("rejects duplicate identities, untyped fields, invalid coordinates, datum changes and invented values", () => {
    for (const r of [query([feature(), feature()]), { ...query(), fields: fields.slice(1) }, { ...query(), spatialReference: { wkid: 3857 } }, query([feature(1, Number.NaN)]), query([{ ...feature(), attributes: { ...feature().attributes, DEPTH_M: "23" } } as never])]) expect(() => wellQueryRecords(r, point)).toThrow();
  });
  it("labels a capped selection incomplete and never implies it is the nearest 50 or complete history", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(query(Array.from({ length: 51 }, (_, i) => feature(i + 1)))))));
    const result = await ontarioWellRecordsLayer(point);
    expect(result).toMatchObject({ status: "available", truncated: true, sourceUpdatedAt: null, data: { coverageComplete: false, nearestRankingComplete: false, subjectWellConnectionVerified: false, waterQualityAssessed: false, sourceQueryRecordCount: 51 } });
    expect((result.data as Row).records).toHaveLength(50);
    const brief = preShowingBrief({ ontarioWellRecords: result }, []);
    expect(brief.coverageGaps).toMatchObject([{ layer: "ontarioWellRecords", status: "incomplete" }]);
    expect(brief.findings[0].summary).toContain("approximate proximity");
    expect(brief.documentsToRequest.some(d => d.document.includes("Confirmed subject-well"))).toBe(true);
  });
  it("keeps complete no-match distinct from an unverified or incomplete query", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(query([])))));
    expect(await ontarioWellRecordsLayer(point)).toMatchObject({ status: "no_match", data: { coverageComplete: true }, sourceUpdatedAt: null });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ features: [] }))));
    expect((await ontarioWellRecordsLayer(point)).status).toBe("unavailable");
  });
  it("does not query ambiguous, approximate, missing, outside-bound or non-Ontario points", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect((await ontarioWellRecordsLayer(null)).status).toBe("skipped");
    for (const changed of [{ accuracy: "street_interpolated" }, { accuracy: "ambiguous" }, { latitude: 60 }, { longitude: Number.NaN }]) expect((await ontarioWellRecordsLayer({ ...point, ...changed })).status).toBe("skipped");
    expect((await ontarioWellRecordsLayer({ ...point, province: "BC" })).status).toBe("not_supported");
    expect(fetch).not.toHaveBeenCalled(); expect(verifyWellSource).not.toHaveBeenCalled();
  });
  it("does not query records or counts if the original source grant or lineage fails", async () => {
    vi.mocked(verifyWellSource).mockRejectedValue(new Error("grant changed"));
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect((await ontarioWellRecordsLayer(point)).status).toBe("unavailable");
    expect(await ontarioWellRecordsCoverage()).toMatchObject({ datasets: [{ status: "unavailable", records: null }] });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("counts only the original Wells child and preserves unknown live observation vintage", async () => {
    const fetch = vi.fn(async (url: URL) => { expect(url.pathname).toBe("/arcgis2/rest/services/MOE/Wells/MapServer/0/query"); return new Response(JSON.stringify({ count: 988388 })); }); vi.stubGlobal("fetch", fetch);
    expect(await ontarioWellRecordsCoverage()).toMatchObject({ datasets: [{ status: "verified", source: WELL_SOURCE, records: 988388, sourceUpdatedAt: null, vintage: { liveServiceObservationDate: null } }] });
    expect(fetch).toHaveBeenCalledOnce(); expect(String(fetch.mock.calls[0][0])).toContain("/MapServer/0/query?");
  });
});
