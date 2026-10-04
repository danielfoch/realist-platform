import { afterEach, describe, expect, it, vi } from "vitest";
import { owenSoundCoverage, owenSoundLayers, owenSoundMarket, owenSoundQuestions } from "./owen-sound-audit";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import { preShowingBrief } from "./brief";
import { layer } from "./model";
import { renderReport, type PropertyResult } from "./report";
afterEach(() => vi.unstubAllGlobals());
describe("Owen Sound current-source and property-file gaps", () => {
  it("requires explicit Ontario City identity and keeps other Grey municipalities separate", () => {
    expect(owenSoundMarket("City of Owen Sound", "ON")).toBe(true);
    for (const [city, province] of [["Owen Sound", "BC"], ["Owen Sound", ""], ["Grey County", "ON"], ["Meaford", "ON"]]) { expect(owenSoundLayers(city, province)).toEqual({}); expect(owenSoundQuestions(city, province)).toEqual([]); }
  });
  it("performs no local queries, counts, register extraction or paid requests", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const c = owenSoundCoverage(), layers = owenSoundLayers("Owen Sound", "Ontario");
    expect(c.datasets).toEqual([]); expect(c.complete).toBe(false); expect(c.withheld.every(g => g.records === null)).toBe(true);
    for (const l of Object.values(layers)) expect(l).toMatchObject({ status: "unavailable", source: null, data: { screenPerformed: false, featureQueriesPerformed: false, countsQueried: false, geometryQueried: false, registryExtracted: false, recordSearchRequested: false } });
    expect(c.audit.rightsFinding).toContain("no affirmative commercial data grant"); expect(c.audit.rightsFinding).toContain("independently verified original County"); expect(fetch).not.toHaveBeenCalled();
  });
  it("preserves conditional effect, notice conflicts, occupancy/permit distinction and service scope", () => {
    const layers = owenSoundLayers("Owen Sound", "ON"), c = owenSoundCoverage();
    expect(layers.zoning.note).toContain("conditional on OPA14"); expect(layers.zoning.note).toContain("2025-079"); expect(layers.officialPlan.note).toContain("November 24, 2026"); expect(c.audit.metadata.countyApprovalVerified).toBe(false);
    expect(layers.occupancyDocuments.note).toContain("occupancy may be issued"); expect(layers.occupancyDocuments.note).toContain("open permit alone does not establish unlawful occupancy"); expect(layers.owenSoundPropertyInquiry.note).toContain("two to three weeks"); expect(layers.servicingEvidence.note).toContain("camera investigation priced separately"); expect(layers.additionalUnits.note).toContain("undated"); expect(layers.shortTermRentalLicences.note).toContain("different addresses");
    expect(layers.owenSoundConservationRegulation.note).toContain("41/24"); expect(layers.owenSoundConservationRegulation.note).toContain("generated map products");
  });
  it("renders full useful report guidance while retaining historical County scope and incomplete market status", () => {
    const layers = { ...owenSoundLayers("Owen Sound", "ON"), greySettlementReference: layer("available", { records: [{ reportedName: "Owen Sound" }], currentPolicyVerified: false }), neighbourhood: layer("available", { censusYear: 2021 }) };
    const brief = preShowingBrief(layers, owenSoundQuestions("Owen Sound", "ON"));
    const html = renderReport({ success: true, data: { city: "Owen Sound", province: "ON" }, layers, brief, available: ["greySettlementReference", "neighbourhood"], missing: [], query: {}, notes: [] } as unknown as PropertyResult);
    expect(brief.sellerQuestions).toHaveLength(3);
    for (const s of ["owen_sound_current_planning", "OPA14", "2025-079", "Cloudpermit", "two to three weeks", "camera investigation", "different addresses", "owenSoundConservationRegulation"]) expect(html).toContain(s);
    expect(brief.documentsToRequest.some(d => d.reason.includes("County"))).toBe(true);
    const r = ontarioMarketRoadmap(), m = r.municipalities.find(m => m.city === "Owen Sound"); expect(m).toMatchObject({ stage: "partial_municipal_coverage", complete: false }); expect(m?.configuredLayers).toContain("greyHistoricalKarstReference"); expect(r.majorMarketsComplete).toBe(false);
  });
});
