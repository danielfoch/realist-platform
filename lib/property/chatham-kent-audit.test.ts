import { afterEach, describe, expect, it, vi } from "vitest";
import { chathamKentCoverage, chathamKentLayers, chathamKentMarket, chathamKentQuestions } from "./chatham-kent-audit";
import { preShowingBrief } from "./brief";
import { layer } from "./model";
import { renderReport, type PropertyResult } from "./report";
import { PROPERTY_OPENAPI } from "./openapi";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";

afterEach(() => vi.unstubAllGlobals());

describe("Chatham-Kent reuse audit and property due diligence", () => {
  it("selects named Ontario community scope without asserting containment", () => {
    for (const city of ["Chatham-Kent", "Municipality of Chatham-Kent", "Chatham", "Dresden", "Wheatley", "Wallaceburg"]) expect(chathamKentMarket(city, "ON")).toBe(true);
    for (const [city, province] of [["Chatham", "Massachusetts"], ["Chatham-Kent", "AB"], ["Kent", "ON"], ["Sarnia", "ON"], ["Chatham", ""]]) expect(chathamKentLayers(city, province)).toEqual({});
    expect(chathamKentCoverage().note).toContain("not municipal containment");
  });
  it("cannot turn metadata or public map access into fetched property evidence", () => {
    const fetch = vi.fn(() => { throw new Error("Unlicensed source query"); });
    vi.stubGlobal("fetch", fetch);
    const layers = chathamKentLayers("Chatham-Kent", "ON");
    for (const l of Object.values(layers)) {
      expect(l).toMatchObject({ status: "unavailable", source: null, retrievedAt: null, data: { coverageComplete: false, screenPerformed: false, recordsQueried: false, countsQueried: false, geometryQueried: false } });
      expect(l.data).not.toHaveProperty("records");
    }
    expect(layers.municipalDrainReference.note).toContain("no protected source was queried or bypassed");
    const coverage = chathamKentCoverage();
    expect(coverage.datasets).toEqual([]);
    expect(coverage.withheld.every(g => g.records === null)).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("asks for actual drain obligations without inferring cost or flood protection", () => {
    const layers = chathamKentLayers("Dresden", "Ontario");
    const brief = preShowingBrief(layers, chathamKentQuestions("Dresden", "Ontario"));
    expect(brief.findings).toEqual([]);
    expect(brief.documentsToRequest.some(d => d.document.includes("assessment schedule") && d.reason.includes("this property's assessed obligations"))).toBe(true);
    expect(brief.sellerQuestions.some(q => q.topic === "chatham_drain_liability" && q.question.includes("pending works"))).toBe(true);
    expect(brief.coverageGaps.some(g => g.layer === "municipalDrainObligations" && g.status === "incomplete")).toBe(true);
  });
  it("keeps drafts, incentives, protected data and authority rights separate", () => {
    const layers = chathamKentLayers("Chatham-Kent", "ON");
    const brief = preShowingBrief(layers, chathamKentQuestions("Chatham-Kent", "ON"));
    expect(layers.additionalUnits.note).toContain("Pre-approved designs");
    expect(layers.chathamConservationRegulation.note).toContain("consent for derivative products");
    expect(brief.documentsToRequest.some(d => d.reason.includes("Draft growth-management proposals do not establish adopted permission"))).toBe(true);
    expect(brief.documentsToRequest.some(d => d.reason.includes("LTVCA/SCRCA jurisdiction"))).toBe(true);
  });
  it("retains independent baseline evidence and all audit gaps in the report", () => {
    const layers = { neighbourhood: layer("available", { censusYear: 2021 }), ...chathamKentLayers("Chatham", "ON") };
    const brief = preShowingBrief(layers, chathamKentQuestions("Chatham", "ON"));
    const html = renderReport({ success: true, data: { address: "315 King Street West", city: "Chatham", province: "ON" }, layers, brief, available: ["neighbourhood"], missing: [], query: {}, notes: [] } as unknown as PropertyResult);
    expect(brief.findings).toHaveLength(1);
    expect(html).toContain("assessment schedule");
    expect(html).toContain("chatham-kent.ca/Pages/Terms-of-Use.aspx");
    expect(html).toContain("<dt>coverage Complete</dt><dd>false</dd>");
    expect(html).not.toContain("no_match");
  });
  it("records a reuse gap without declaring Chatham-Kent or Ontario complete", () => {
    const roadmap = ontarioMarketRoadmap();
    const market = roadmap.municipalities.find(m => m.city === "Chatham-Kent")!;
    expect(market).toMatchObject({ stage: "audited_reuse_gap", complete: false, configuredLayers: [] });
    expect(market.withheldLayers.some(l => l.layer === "municipalDrainObligations")).toBe(true);
    expect(roadmap.majorMarketsComplete).toBe(false);
    for (const key of ["chathamConservationRegulation", "municipalDrainObligations", "municipalDrainReference", "pumpingStationReference"]) {
      expect(PROPERTY_OPENAPI.components.schemas.PropertyResult.properties.layers.properties).toHaveProperty(key);
    }
  });
});
