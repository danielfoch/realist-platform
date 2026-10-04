import { afterEach, describe, expect, it, vi } from "vitest";
import { stratfordCoverage, stratfordLayers, stratfordMarket, stratfordQuestions } from "./stratford-audit";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import { preShowingBrief } from "./brief";
import { layer } from "./model";
import { renderReport, type PropertyResult } from "./report";
afterEach(() => vi.unstubAllGlobals());
describe("Stratford/Perth source-guidance audit", () => {
  it("requires explicit Ontario identity without inferring a County or PEI market", () => {
    expect(stratfordMarket("CITY OF STRATFORD", "ON")).toBe(true);
    for (const [name, province] of [["Stratford", "PE"], ["Perth County", "ON"], ["North Perth", "ON"], ["St. Marys", "ON"], ["Stratford", ""]]) { expect(stratfordLayers(name, province)).toEqual({}); expect(stratfordQuestions(name, province)).toEqual([]); }
  });
  it("does not query/count local records and preserves original provincial/map-product scope exceptions", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const l = stratfordLayers("Stratford", "Ontario"), c = stratfordCoverage();
    expect(c.datasets).toEqual([]); expect(c.complete).toBe(false); expect(c.withheld.every(g => g.records === null)).toBe(true);
    for (const v of Object.values(l)) expect(v).toMatchObject({ status: "unavailable", source: null, data: { screenPerformed: false, featureQueriesPerformed: false, countsQueried: false, geometryQueried: false, recordSearchRequested: false } });
    expect(c.audit.rightsFinding).toContain("independently licensed"); expect(l.stratfordConservationRegulation.note).toContain("allowing attributed generated map products"); expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps unit/vintage conflicts, paid partial report scope, survey variation and County plan applicability visible", () => {
    const l = stratfordLayers("Stratford", "ON"), c = stratfordCoverage();
    expect(l.additionalUnits.note).toContain("three total units"); expect(l.additionalUnits.note).toContain("implying four"); expect(l.additionalUnits.note).toContain("no verified unambiguous"); expect(c.audit.metadata.aruDocumentDateVerified).toBe(false);
    expect(l.zoning.note).toContain("Final for Council Adoption"); expect(l.zoning.note).toContain("older second-suite"); expect(l.permits.note).toContain("paid Zoning and Building"); expect(l.permits.note).toContain("complete historic");
    expect(l.propertySurveyRecords.note).toContain("five days"); expect(l.propertySurveyRecords.note).toContain("three"); for (const name of ["North Perth", "West Perth", "Perth East", "Perth South"]) expect(l.countyPlanningReference.note).toContain(name); expect(l.officialPlan.note).toContain("not automatically Stratford");
    const combined = preShowingBrief({ ...l, ontarioLotFabricReference: layer("available", { records: [] }) }, stratfordQuestions("Stratford", "ON"));
    expect(combined.sellerQuestions).toHaveLength(3); expect(combined.documentsToRequest.some(d => d.reason.includes("three/five-day"))).toBe(true); expect(combined.documentsToRequest.some(d => d.reason.includes("Confirm municipal survey-release eligibility"))).toBe(true);
  });
  it("preserves independent findings and full report details without claiming a complete market", () => {
    const layers = { neighbourhood: layer("available", { censusYear: 2021 }), ...stratfordLayers("Stratford", "ON") }, brief = preShowingBrief(layers, stratfordQuestions("Stratford", "ON"));
    const html = renderReport({ success: true, data: { city: "Stratford", province: "ON" }, layers, brief, available: ["neighbourhood"], missing: [], query: {}, notes: [] } as unknown as PropertyResult);
    expect(brief.findings).toHaveLength(1); for (const s of ["stratford_current_planning_and_units", "three-total-unit", "Zoning and Building Information Report", "stratfordConservationRegulation", "City Centre Core"]) expect(html).toContain(s);
    const r = ontarioMarketRoadmap(); expect(r.municipalities.find(m => m.city === "Stratford")).toMatchObject({ stage: "audited_reuse_gap", complete: false, configuredLayers: [] }); expect(r.municipalities.find(m => m.city === "Owen Sound")?.stage).toBe("partial_municipal_coverage"); expect(r.majorMarketsComplete).toBe(false); expect(r.sharedBaseline.some(s => s.includes("source-protection"))).toBe(true);
  });
});
