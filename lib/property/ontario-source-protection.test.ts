import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/ontario-source-protection-source.json";
import fabric from "./fixtures/ontario-fabric-source.json";
import { ontarioSourceProtectionCoverage, ontarioSourceProtectionLayer, spaQueryRecords } from "./ontario-source-protection";
import { validSpaCatalogue, validSpaItem, validSpaMetadata, verifySpaSource } from "./ontario-source-protection-rights";
import { SPA_FIELDS, SPA_ITEM, SPA_LICENCE, SPA_OFFER, SPA_ROOT, SPA_SOURCE } from "./ontario-source-protection-sources";
import { preShowingBrief } from "./brief";
import type { Location, Row } from "./model";

vi.mock("./ontario-source-protection-rights", async original => ({ ...await original<object>(), verifySpaSource: vi.fn() }));
const point: Location = { address: null, city: "Stratford", province: "ON", latitude: 43.37, longitude: -80.982, accuracy: "caller_supplied", provider: "caller" };
const vintage = { catalogueMetadataModifiedAt: null, catalogueRefreshFrequency: null, catalogueResourcePublicationDate: null, catalogueResourceRangeStart: null, catalogueResourceRangeEnd: null, itemMetadataModifiedEpochMilliseconds: null, publishedDataLastEditEpochMilliseconds: null, liveServiceObservationDate: null, dateFieldTimezoneVerified: false, currentPlanPolicyDateVerified: false } as const;
beforeEach(() => { vi.mocked(verifySpaSource).mockResolvedValue(vintage); });
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });
describe("independent original generalized source-protection rights", () => {
  it("requires exact active English MECP catalogue, explicit originating grant and typed child", () => {
    expect(validSpaCatalogue(fixture.catalogue)).toBe(true);
    for (const changes of [{ private: true }, { state: "deleted" }, { resources: [] }, { owner_org: "natural-resources" }, { license_id: "copyright" }]) expect(validSpaCatalogue({ ...fixture.catalogue, result: { ...fixture.catalogue.result, ...changes } })).toBe(false);
    expect(validSpaItem(fixture.item)).toBe(true);
    for (const changes of [{ url: SPA_ROOT }, { owner: "copy" }, { orgId: "copy" }, { access: "private" }, { licenseInfo: "" }, { licenseInfo: `<a href="${SPA_LICENCE}">Open Government Licence – Ontario</a> Non-commercial only` }]) expect(validSpaItem({ ...fixture.item, ...changes })).toBe(false);
    expect(validSpaMetadata(fixture.root, fixture.child)).toBe(true);
    for (const changes of [{ id: 3 }, { copyrightText: "" }, { geometryType: "esriGeometryPoint" }, { fields: fixture.child.fields.map(f => f.name === "SPP_ID" ? { ...f, type: "esriFieldTypeString" } : f) }]) expect(validSpaMetadata(fixture.root, { ...fixture.child, ...changes })).toBe(false);
    expect(validSpaMetadata({ ...fixture.root, mapName: "service06" }, fixture.child)).toBe(false);
  });
  it("checks full licence and exact native offered child thumbnail before reuse", async () => {
    const actual = await vi.importActual<typeof import("./ontario-source-protection-rights")>("./ontario-source-protection-rights");
    let changed = false;
    vi.stubGlobal("fetch", vi.fn(async (u: URL) => {
      if (u.href === SPA_LICENCE) return new Response(changed ? fabric.grantBodyHtml.replace("<h2>", "<p>Additional restriction</p><h2>") : fabric.grantBodyHtml);
      if (u.href === SPA_OFFER) return new Response(`<meta name="twitter:image" content="https://www.arcgis.com/sharing/rest/content/items/${SPA_ITEM}_2/info/thumbnail/thumbnail.png">`);
      return new Response(JSON.stringify(u.hostname === "data.ontario.ca" ? fixture.catalogue : u.pathname.endsWith(`/${SPA_ITEM}`) ? fixture.item : u.origin + u.pathname === SPA_SOURCE.url ? fixture.child : fixture.root));
    }));
    expect(await actual.verifySpaSource()).toMatchObject({ currentPlanPolicyDateVerified: false, dateFieldTimezoneVerified: false, liveServiceObservationDate: null });
    changed = true; await expect(actual.verifySpaSource()).rejects.toThrow("grant or source binding");
  });
});
describe("bounded generalized references and historical lookup labels", () => {
  it("retains native Stratford IDs/accuracy and dated historical names without legal or water conclusions", async () => {
    const fetch = vi.fn(async (u: URL) => {
      expect(u.origin + u.pathname).toBe(SPA_SOURCE.url + "/query"); expect(u.searchParams.get("returnGeometry")).toBe("false"); expect(u.searchParams.get("resultRecordCount")).toBe("51"); expect(u.searchParams.get("outFields")).toBe(Object.keys(SPA_FIELDS).join(","));
      return new Response(JSON.stringify(fixture.stratford));
    }); vi.stubGlobal("fetch", fetch);
    const l = await ontarioSourceProtectionLayer(point);
    expect(l).toMatchObject({ status: "available", sourceUpdatedAt: null, data: { queryCoverageComplete: true, coverageComplete: false, absenceEstablished: false, sourceGeometryReused: false, legalBoundaryScreenPerformed: false, vulnerableAreaScreenPerformed: false, waterQualityAssessed: false, lookup: { documentCopyrightYear: 2012, currentNamesVerified: false }, records: [{ reportedSourceProtectionAreaId: 45, reportedSourceProtectionRegionId: 27, historicalAreaName: "Upper Thames River", historicalRegionName: "Thames, Sydenham and Region", historicalAreaRegionIdsAgree: true, reportedLocationAccuracy: "Within 200 metres", currentLegalBoundaryVerified: false, recordEffectiveEpochMilliseconds: 1150156800000 }] } });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(spaQueryRecords(fixture.hamilton).records[0]).toMatchObject({ historicalAreaName: "Hamilton", historicalRegionName: "Halton-Hamilton" });
    const brief = preShowingBrief({ ontarioSourceProtectionAreaReference: l }, []); expect(brief.findings[0].summary).toContain("historical 2012"); expect(brief.documentsToRequest.some(d => d.reason.includes("WHPA/IPZ/SGRA/HVA"))).toBe(true);
    expect(JSON.stringify(l.data)).not.toContain("AREA_LAMBERT_KM"); expect(JSON.stringify(l.data)).not.toContain('"geometry":');
  });
  it("keeps complete empty evidence distinct from absence and rejects malformed/incomplete empties", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(fixture.empty))));
    expect(await ontarioSourceProtectionLayer(point)).toMatchObject({ status: "no_match", data: { queryCoverageComplete: true, absenceEstablished: false } });
    for (const changes of [{ exceededTransferLimit: true }, { fields: [] }, { features: "[]" }, { objectIdFieldName: "FID" }, { displayFieldName: "copy" }]) expect(() => spaQueryRecords({ ...fixture.empty, ...changes })).toThrow();
  });
  it("rejects invalid typed IDs, epochs, labels and duplicates while retaining unknown historical IDs", () => {
    const first = fixture.stratford.features[0];
    for (const changes of [{ OBJECTID: "2257" }, { OGF_ID: -1 }, { SPP_ID: "45" }, { SPR_ID: 27.5 }, { LEAD_SPA: true }, { EFFECTIVE_DATETIME: "2006" }]) expect(() => spaQueryRecords({ ...fixture.stratford, features: [{ attributes: { ...first.attributes, ...changes } }] })).toThrow();
    expect(() => spaQueryRecords({ ...fixture.stratford, features: [first, first] })).toThrow();
    const unknown = spaQueryRecords({ ...fixture.stratford, features: [{ attributes: { ...first.attributes, SPP_ID: 999, SPR_ID: 999, LEAD_SPA: "?" } }] }).records[0];
    expect(unknown).toMatchObject({ reportedSourceProtectionAreaId: 999, historicalAreaName: null, historicalRegionName: null, historicalAreaRegionIdsAgree: null, reportedAdministrativeLeadLabel: "?" });
  });
  it("preserves multiple/capped reference matches and historical crosswalk disagreement as ambiguous", async () => {
    const a = fixture.stratford.features[0].attributes;
    let response: Row = { ...fixture.stratford, features: [fixture.stratford.features[0], { attributes: { ...a, OBJECTID: 9999 } }] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(response))));
    expect(await ontarioSourceProtectionLayer(point)).toMatchObject({ status: "ambiguous", truncated: false, data: { queryCoverageComplete: true } });
    response = { ...fixture.stratford, features: Array.from({ length: 51 }, (_, i) => ({ attributes: { ...a, OBJECTID: i + 1 } })) };
    expect(await ontarioSourceProtectionLayer(point)).toMatchObject({ status: "ambiguous", truncated: true, data: { queryCoverageComplete: false, sourceQueryRecordCount: 51 } }); expect(spaQueryRecords(response).records).toHaveLength(50);
    response = { ...fixture.stratford, features: [{ attributes: { ...a, SPR_ID: 14 } }] };
    expect(await ontarioSourceProtectionLayer(point)).toMatchObject({ status: "ambiguous", data: { records: [{ historicalAreaRegionIdsAgree: false, currentNamesVerified: false }] } });
  });
  it("skips missing/imprecise/non-Ontario points and fails closed before records on grant changes", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    for (const p of [null, { ...point, province: "PE" }, { ...point, accuracy: "source_street_point" }, { ...point, latitude: NaN }]) expect(["skipped", "not_supported"]).toContain((await ontarioSourceProtectionLayer(p as Location | null)).status);
    expect(verifySpaSource).not.toHaveBeenCalled();
    vi.mocked(verifySpaSource).mockRejectedValue(Error("changed")); expect((await ontarioSourceProtectionLayer(point)).status).toBe("unavailable"); expect((await ontarioSourceProtectionCoverage()).datasets[0]).toMatchObject({ status: "unavailable", records: null }); expect(fetch).not.toHaveBeenCalled();
  });
  it("counts original generalized rows once and rejects string/negative counts", async () => {
    let count: unknown = fixture.count.count;
    vi.stubGlobal("fetch", vi.fn(async (u: URL) => { expect(u.searchParams.get("returnCountOnly")).toBe("true"); return new Response(JSON.stringify({ count })); }));
    expect((await ontarioSourceProtectionCoverage()).datasets[0]).toMatchObject({ records: 118, status: "verified", sourceUpdatedAt: null });
    for (const bad of ["118", -1]) { count = bad; expect((await ontarioSourceProtectionCoverage()).datasets[0]).toMatchObject({ status: "unavailable", records: null }); }
  });
});
