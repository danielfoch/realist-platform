import { afterEach, describe, expect, it, vi } from "vitest";
import { woodstockCoverage, woodstockLayers, woodstockMarket, woodstockQuestions } from "./woodstock-audit";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import { preShowingBrief } from "./brief";
import { layer } from "./model";
import { renderReport, type PropertyResult } from "./report";
afterEach(() => vi.unstubAllGlobals());
describe("Woodstock source-guidance audit", () => {
  it("requires explicit Ontario City identity and leaves other Oxford markets unaudited", () => {
    expect(woodstockMarket("CITY OF WOODSTOCK", "ON")).toBe(true);
    for (const [name, province] of [["Woodstock", "NB"], ["Oxford County", "ON"], ["Tillsonburg", "ON"], ["Woodstock", ""]]) { expect(woodstockLayers(name, province)).toEqual({}); expect(woodstockQuestions(name, province)).toEqual([]); }
  });
  it("does not query/count municipal records or extend scoped contractor/main-site restrictions to all open data", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const l = woodstockLayers("Woodstock", "ON"), c = woodstockCoverage();
    expect(c.datasets).toEqual([]); expect(c.audit.metadata.catalogueEntries).toBe(22); expect(c.complete).toBe(false);
    expect(c.audit.rightsFinding).toContain("not a categorical ban"); expect(c.audit.rightsFinding).toContain("not automatically assigned");
    expect(c.withheld.every(g => g.records === null)).toBe(true);
    for (const v of Object.values(l)) expect(v).toMatchObject({ status: "unavailable", source: null, data: { screenPerformed: false, featureQueriesPerformed: false, countsQueried: false, geometryQueried: false, recordSearchRequested: false } });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps survey-release conflict, separate compliance access, ARU eligibility and planning vintages explicit", () => {
    const l = woodstockLayers("Woodstock", "Ontario"); expect(l.propertySurveyRecords.note).toContain("guidance conflicts"); expect(l.permits.note).toContain("separate Legal Compliance Letter"); expect(l.additionalUnits.note).toContain("subject to restrictions"); expect(l.zoning.note).toContain("September 30, 2025"); expect(l.zoning.note).toContain("Q2 2026"); expect(l.heritage.note).toContain("final appeal outcome"); expect(l.contourReference.note).toContain("whole mixed source");
    const b = preShowingBrief(l, woodstockQuestions("Woodstock", "ON")); expect(b.findings).toEqual([]); expect(b.sellerQuestions).toHaveLength(3); expect(b.documentsToRequest.some(d => d.reason.includes("conflicting survey-release"))).toBe(true);
  });
  it("preserves independent evidence and puts original source-guidance details in the full report", () => {
    const layers = { neighbourhood: layer("available", { censusYear: 2021 }), ...woodstockLayers("Woodstock", "ON") }, brief = preShowingBrief(layers, woodstockQuestions("Woodstock", "ON"));
    const html = renderReport({ success: true, data: { city: "Woodstock", province: "ON" }, layers, brief, available: ["neighbourhood"], missing: [], query: {}, notes: [] } as unknown as PropertyResult);
    expect(brief.findings).toHaveLength(1); for (const s of ["propertySurveyRecords", "Legal Compliance Letter", "woodstock_current_planning", "whole mixed source", "September 30, 2025"]) expect(html).toContain(s);
  });
  it("marks Woodstock an audited gap without claiming any major market complete", () => {
    const r = ontarioMarketRoadmap(); expect(r.municipalities.find(m => m.city === "Woodstock")).toMatchObject({ stage: "audited_reuse_gap", complete: false, configuredLayers: [] }); expect(r.municipalities.find(m => m.city === "Tillsonburg")?.stage).toBe("queued"); expect(r.majorMarketsComplete).toBe(false); expect(r.sharedBaseline.some(s => s.includes("lidar"))).toBe(true);
  });
});
