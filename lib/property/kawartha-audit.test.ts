import { afterEach, describe, expect, it, vi } from "vitest";
import { kawarthaCoverage, kawarthaLayers, kawarthaMarket, kawarthaQuestions } from "./kawartha-audit";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import { layer } from "./model";
import { renderReport, type PropertyResult } from "./report";
afterEach(() => vi.unstubAllGlobals());
describe("Kawartha source guidance and withheld scopes", () => {
  it("requires Ontario and exact City/community identity rather than the broad Kawarthas region", () => {
    for (const name of ["CITY OF KAWARTHA LAKES", "Lindsay", "Fenelon Falls", "Bobcaygeon", "Omemee"]) expect(kawarthaMarket(name, "ON")).toBe(true);
    for (const [name, province] of [["Kawartha Lakes", "BC"], ["Kawarthas", "ON"], ["Peterborough", "ON"], ["Ops", "ON"], ["Kawartha Lakes", ""]]) {
      expect(kawarthaLayers(name, province)).toEqual({}); expect(kawarthaQuestions(name, province)).toEqual([]);
    }
  });
  it("does not make municipal requests, count records or turn metadata/guidance into a successful screen", () => {
    const fetch = vi.fn(() => { throw Error("City records forbidden"); }); vi.stubGlobal("fetch", fetch);
    const layers = kawarthaLayers("Lindsay", "ON");
    for (const l of Object.values(layers)) expect(l).toMatchObject({ status: "unavailable", source: null, retrievedAt: null, data: { coverageComplete: false, screenPerformed: false, featureQueriesPerformed: false, countsQueried: false, geometryQueried: false, registryExtracted: false } });
    expect(fetch).not.toHaveBeenCalled();
    const c = kawarthaCoverage(); expect(c.datasets).toEqual([]); expect(c.complete).toBe(false); expect(c.audit.metadata.catalogueDatasets).toBe(22);
    expect(c.withheld.every(g => g.records === null)).toBe(true);
    expect(c.audit.rightsFinding).toContain("not establish permission or a categorical");
    expect(layers.parcel.note).toContain("signed data-sharing agreement");
  });
  it("keeps current rural instruments, authorized septic/building searches and offered ARU register separate", () => {
    const l = kawarthaLayers("Kawartha Lakes", "Ontario");
    expect(l.currentPlanningInstruments.note).toContain("outstanding review request");
    expect(l.currentPlanningInstruments.note).toContain("ruling itself was not reviewed");
    expect(l.additionalUnits.note).toContain("public ARU register");
    expect(l.additionalUnits.note).toContain("has not been extracted");
    expect(l.permits.note).toContain("owner authorization");
    const brief = preShowingBrief(l, kawarthaQuestions("Lindsay", "ON"));
    expect(brief.findings).toEqual([]);
    expect(brief.sellerQuestions).toHaveLength(3);
    expect(brief.documentsToRequest.some(d => d.reason.includes("retention/pre-amalgamation"))).toBe(true);
    expect(brief.documentsToRequest.some(d => d.reason.includes("rural appeal/review"))).toBe(true);
  });
  it("does not mislabel separately licensed OHN waterbodies or 2012 habitat scenarios as current regulation", () => {
    const l = kawarthaLayers("Kawartha Lakes", "ON");
    expect(l.kawarthaConservationRegulation.note).toContain("separate OGL grant");
    expect(l.kawarthaConservationRegulation.note).toContain("Ontario Hydro Network waterbody");
    expect(l.kawarthasHistoricalNaturalHeritage.note).toContain("OGL licensed");
    expect(l.kawarthasHistoricalNaturalHeritage.note).toContain("2012 inputs");
    expect(l.kawarthasHistoricalNaturalHeritage.note).toContain("conversion/integration remains pending");
  });
  it("retains independent baseline evidence and exposes source links, guidance and questions in the full report", () => {
    const layers = { neighbourhood: layer("available", { censusYear: 2021 }), ...kawarthaLayers("Lindsay", "ON") };
    const brief = preShowingBrief(layers, kawarthaQuestions("Lindsay", "ON"));
    const html = renderReport({ success: true, data: { address: null, city: "Lindsay", province: "ON" }, layers, brief, available: ["neighbourhood"], missing: [], query: {}, notes: [] } as unknown as PropertyResult);
    expect(brief.findings).toHaveLength(1);
    for (const s of ["kawarthaConservationRegulation", "OHN waterbody", "septicRecords", "owner authorization", "shorelineRoadAllowance", "kawartha_current_planning"]) expect(html).toContain(s);
    expect(html).not.toContain("no_match");
  });
  it("moves Kawartha Lakes to an audited gap without treating provincial baseline as complete municipal coverage", () => {
    const r = ontarioMarketRoadmap(), m = r.municipalities.find(m => m.city === "Kawartha Lakes")!;
    expect(m).toMatchObject({ stage: "audited_reuse_gap", complete: false, configuredLayers: [] });
    expect(m.withheldLayers.some(g => g.layer === "septicRecords")).toBe(true);
    expect(r.sharedBaseline.some(s => s.includes("original Crown lot"))).toBe(true);
    expect(r.majorMarketsComplete).toBe(false);
  });
});
