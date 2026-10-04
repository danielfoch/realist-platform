import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import native from "./fixtures/grey-native.json";
import { GREY_FEEDS, GREY_GRANT } from "./grey-sources";
import { greyCoverage, greyLayers, greyMarket, greyQueryRecords, greyTermsHash, validGreySource } from "./grey";
import type { Location, Row } from "./model";
vi.mock("./niagara", () => ({ niagaraMetadata: vi.fn(async () => ({ sourceUpdatedAt: null })) }));
let fixture: typeof native;
let failure: string | null;
const fetchMock = vi.fn(async (u: URL) => {
  const url = new URL(u), path = url.pathname;
  if (failure && path.includes(failure)) return new Response("{}", { status: 503 });
  let data: unknown;
  if (path.includes("LIO_Open03") && path.endsWith("/query")) data = fixture.containment;
  else if (path.endsWith(`/${GREY_GRANT.site}`)) data = fixture.site.item;
  else if (path.endsWith(`/${GREY_GRANT.site}/data`)) data = fixture.site.data;
  else if (path.endsWith(`/${GREY_GRANT.termsItem}`)) data = fixture.termsItem;
  else if (path.endsWith(`/${GREY_GRANT.termsItem}/data`)) data = fixture.termsData;
  else for (const f of GREY_FEEDS) {
    const saved = fixture.feeds[f.key as keyof typeof fixture.feeds];
    if (path.endsWith(`/${f.item}`)) data = saved.item;
    else if (path === new URL(f.root).pathname) data = fixture.roots[f.kind];
    else if (path === new URL(f.source.url).pathname) data = saved.metadata;
    else if (path === new URL(f.source.url).pathname + "/query") data = url.searchParams.has("returnCountOnly") ? saved.count : saved.query;
    if (data) break;
  }
  if (!data) throw Error("Unexpected source " + path);
  return Response.json(data);
});
const point = (changes: Partial<Location> = {}): Location => ({ address: null, city: "Owen Sound", province: "ON", latitude: 44.568, longitude: -80.941, accuracy: "caller_supplied", provider: "caller", ...changes });
const request = { lat: 44.568, lng: -80.941, city: "Owen Sound", province: "ON" };
const queryCalls = () => fetchMock.mock.calls.map(([u]) => new URL(u)).filter(u => u.pathname.endsWith("/query"));
beforeEach(() => { fixture = structuredClone(native); failure = null; fetchMock.mockClear(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());
describe("individually licensed Grey County reference queries", () => {
  it("pins the complete terms and exact item/typed-source bindings", () => {
    expect(greyTermsHash(fixture.termsData)).toBe(GREY_GRANT.termsHash);
    for (const f of GREY_FEEDS) {
      const n = fixture.feeds[f.key as keyof typeof fixture.feeds];
      expect(validGreySource(f, n.item, fixture.roots[f.kind], n.metadata)).toBe(true);
      for (const patch of [{ licenseInfo: "" }, { url: f.root }, { owner: "third_party" }, { access: "private" }, { description: "new data vintage" }]) expect(validGreySource(f, { ...n.item, ...patch }, fixture.roots[f.kind], n.metadata)).toBe(false);
      expect(validGreySource(f, n.item, fixture.roots[f.kind], { ...n.metadata, fields: [] })).toBe(false);
    }
  });
  it("returns native settlement/land-use observations and honest complete empty references", async () => {
    const l = await greyLayers(request, point());
    expect(l.greyMunicipalContainment.status).toBe("available"); expect(l.greySettlementReference.status).toBe("available"); expect(l.greyHistoricalLandUseReference.status).toBe("available");
    for (const f of GREY_FEEDS) {
      const d = l[f.key].data as Row;
      expect(d).toMatchObject({ coverageComplete: false, absenceEstablished: false, currentPolicyVerified: false, developmentPermissionEstablished: false, sourceGeometryReused: false, parcelWideScreenPerformed: false, waterQualityAssessed: false, queryCoverageComplete: true });
      if (["greyHistoricalKarstReference", "greyHistoricalWoodlandReference", "greyHistoricalValleylandReference"].includes(f.key)) expect(l[f.key].status).toBe("no_match");
    }
    for (const u of queryCalls()) { expect(u.searchParams.get("returnGeometry")).toBe("false"); expect(u.searchParams.get("resultRecordCount")).toBe("51"); expect(u.searchParams.get("outFields")).not.toMatch(/area|length|editor|user|PIN|roll/i); }
  });
  it("requires explicit Ontario municipal identity and skips interpolated/self-supplied/invalid points", async () => {
    expect(greyMarket("City of Owen Sound", "ON")).toBe("Owen Sound"); expect(greyMarket("Town of The Blue Mountains", "ON")).toBe("The Blue Mountains");
    for (const [city, province] of [["Grey County", "ON"], ["Owen Sound", "BC"], ["Owen Sound", ""]]) expect(greyMarket(city, province)).toBeNull();
    for (const changes of [{ accuracy: "street_interpolated" }, { provider: "grey:reference" }, { latitude: NaN }, { city: "Meaford" }, { province: "BC" }, { latitude: 55 }]) { const l = await greyLayers(request, point(changes)); expect(l.greyMunicipalContainment.status).toBe("skipped"); }
    expect(queryCalls()).toHaveLength(0); expect(await greyLayers({ ...request, city: "Grey County" }, point())).toEqual({});
  });
  it("does not query County references when the original municipal polygon disagrees or is incomplete", async () => {
    fixture.containment.features[0].attributes.MUNICIPAL_NAME = "MEAFORD";
    const l = await greyLayers(request, point()); expect(l.greyMunicipalContainment.status).toBe("ambiguous"); expect(GREY_FEEDS.every(f => l[f.key].status === "skipped")).toBe(true);
    expect(queryCalls()).toHaveLength(1);
  });
  it("fails closed before County queries when full terms or a dataset grant changes", async () => {
    fixture.termsData.values.layout.sections[0].rows[0].cards[0].component.settings.markdown += " Modified grant";
    const l = await greyLayers(request, point()); expect(GREY_FEEDS.every(f => l[f.key].status === "unavailable")).toBe(true); expect(queryCalls()).toHaveLength(1);
    fixture = structuredClone(native); fixture.feeds.greySettlementReference.item.licenseInfo = ""; fetchMock.mockClear();
    const next = await greyLayers(request, point()); expect(next.greySettlementReference.status).toBe("unavailable"); expect(next.greyHistoricalLandUseReference.status).toBe("available"); expect(queryCalls().some(u => u.pathname.includes("FeatureServer/4"))).toBe(false);
  });
  it("rejects malformed or untyped empty municipal gates before County queries", async () => {
    const valid = structuredClone(fixture.containment);
    for (const patch of [{ features: null }, { features: [null] }, { features: [], fields: [] }, { features: [valid.features[0], null] }]) {
      fixture.containment = { ...valid, ...patch } as unknown as typeof valid; fetchMock.mockClear();
      const l = await greyLayers(request, point()); expect(l.greyMunicipalContainment.status).toBe("unavailable"); expect(GREY_FEEDS.every(f => l[f.key].status === "skipped")).toBe(true); expect(queryCalls()).toHaveLength(1);
    }
  });
  it("rejects malformed dates, OIDs, typed empties, extra attributes, geometry and duplicate rows", () => {
    const f = GREY_FEEDS[0], q = fixture.feeds.greySettlementReference.query;
    for (const patch of [{ EDIT_DATE: "2026-01-01" }, { OBJECTID: 0 }, { EDIT_DATE: 1.2 }, { owner: "private" }]) { const r = structuredClone(q) as Row; r.features = [{ attributes: { ...q.features[0].attributes, ...patch } }]; expect(() => greyQueryRecords(r, f)).toThrow(); }
    expect(() => greyQueryRecords({ ...q, fields: [], features: [] }, f)).toThrow();
    for (const features of [null, {}, [null], [q.features[0], null]]) expect(() => greyQueryRecords({ ...q, features }, f)).toThrow();
    expect(() => greyQueryRecords({ ...q, features: [q.features[0], q.features[0]] }, f)).toThrow();
    expect(() => greyQueryRecords({ ...q, features: [{ ...q.features[0], geometry: { x: 1 } }] }, f)).toThrow();
    expect(() => greyQueryRecords({ ...q, objectIdFieldName: undefined }, f)).toThrow();
  });
  it("preserves overlapping/capped ambiguity and rejects incomplete empty results", async () => {
    const q = fixture.feeds.greyHistoricalLandUseReference.query;
    q.features.push({ attributes: { ...q.features[0].attributes, OBJECTID: 99999 } });
    const l = await greyLayers(request, point()); expect(l.greyHistoricalLandUseReference.status).toBe("ambiguous"); expect((l.greyHistoricalLandUseReference.data as Row).queryCoverageComplete).toBe(true);
    expect(() => greyQueryRecords({ ...q, features: [], exceededTransferLimit: true }, GREY_FEEDS[1])).toThrow();
    const capped = greyQueryRecords({ ...q, features: Array.from({ length: 51 }, (_, i) => ({ attributes: { ...q.features[0].attributes, OBJECTID: i + 1 } })) }, GREY_FEEDS[1]); expect(capped.truncated).toBe(true); expect(capped.records).toHaveLength(50);
  });
  it("keeps upstream failures unavailable and counts five unique feeds only once", async () => {
    const c = await greyCoverage(); expect(c.datasets.map(d => d.records)).toEqual([56, 6734, 380, 3222, 37]); expect(c.complete).toBe(false); expect(c.municipalityReference.countIncludedHere).toBe(false);
    failure = "MapServer/9/query"; const l = await greyLayers(request, point()); expect(l.greyHistoricalKarstReference.status).toBe("unavailable"); expect(l.greyHistoricalKarstReference.data).toBeNull();
    fixture.feeds.greySettlementReference.count.count = -1; const bad = await greyCoverage(); expect(bad.datasets[0]).toMatchObject({ status: "unavailable", records: null });
  });
});
