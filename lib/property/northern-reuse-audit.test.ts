import { afterEach, describe, expect, it, vi } from "vitest";
import { northernAuditCoverage, northernAuditLayers, northernAuditQuestions, northernReuseAudit } from "./northern-reuse-audit";
import { preShowingBrief } from "./brief";
import { layer } from "./model";
import { renderReport, type PropertyResult } from "./report";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";

afterEach(() => vi.unstubAllGlobals());

describe("northern markets with restrictive originating grants", () => {
  it("requires Ontario and a known municipality, preserving Canadian Sault identity", () => {
    expect(northernReuseAudit("CITY OF NORTH BAY", "Ontario")?.city).toBe("North Bay");
    expect(northernReuseAudit("Sault Ste Marie", "ON")?.city).toBe("Sault Ste. Marie");
    expect(northernReuseAudit("CITY OF TIMMINS", "ON")?.city).toBe("Timmins");
    expect(northernReuseAudit("Timmins", "QC")).toBeNull();
    for (const [city, province] of [["North Bay", "AB"], ["Sault Ste. Marie", "Michigan"], ["North Bay Village", "ON"], ["Sault", "ON"], ["Thunder Bay", "ON"]]) {
      expect(northernAuditLayers(city, province)).toEqual({});
      expect(northernAuditQuestions(city, province)).toEqual([]);
    }
  });
  it("cannot turn public map access into fetched property evidence, counts or a clean no-match", () => {
    const fetch = vi.fn(() => { throw new Error("Forbidden municipal request"); });
    vi.stubGlobal("fetch", fetch);
    for (const city of ["North Bay", "Sault Ste. Marie", "Timmins"]) {
      const layers = northernAuditLayers(city, "ON");
      expect(layers.zoning.status).toBe("unavailable");
      expect(layers.permits.status).toBe("unavailable");
      for (const value of Object.values(layers)) {
        expect(value).toMatchObject({ status: "unavailable", source: null, retrievedAt: null, data: { coverageComplete: false, screenPerformed: false, recordsQueried: false, countsQueried: false, geometryQueried: false } });
        expect(value.data).not.toHaveProperty("records");
      }
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(northernAuditCoverage().every(g => !g.complete && !g.datasets.length && g.withheld.every(s => s.records === null))).toBe(true);
  });
  it("keeps held licensing and conflicting ADU guidance separate from legal units and heritage", () => {
    const layers = northernAuditLayers("North Bay", "ON");
    const brief = preShowingBrief(layers, northernAuditQuestions("North Bay", "ON"));
    expect(brief.findings).toHaveLength(0);
    expect(brief.coverageGaps.some(g => g.layer === "additionalUnits" && g.status === "incomplete")).toBe(true);
    expect(brief.documentsToRequest.some(d => d.reason.includes("inconsistent City ADU") && d.reason.includes("statutory designation"))).toBe(true);
    expect(layers.rentalLicences.note).toContain("Do not infer no licensing requirement");
    expect(layers.northbayConservationRegulation.note).toContain("prohibit data scraping");
  });
  it("keeps applicant inspection results, old map labels and draft plans as unresolved scopes", () => {
    const layers = northernAuditLayers("Sault Ste. Marie", "ON");
    const brief = preShowingBrief(layers, northernAuditQuestions("Sault Ste. Marie", "ON"));
    expect(layers.permits.note).toContain("Applicant-only");
    expect(layers.saultConservationRegulation.note).toContain("HTTP403 without bypass");
    expect(brief.documentsToRequest.some(d => d.reason.includes("legacy 2019/176_06"))).toBe(true);
    expect(brief.documentsToRequest.some(d => d.reason.includes("adopted plan from the proposed draft"))).toBe(true);
  });
  it("retains independent baseline evidence and exposes full unresolved scopes in the report", () => {
    const layers = { neighbourhood: layer("available", { censusYear: 2021 }), ...northernAuditLayers("North Bay", "ON") };
    const brief = preShowingBrief(layers, northernAuditQuestions("North Bay", "ON"));
    const html = renderReport({ success: true, data: { address: "200 McIntyre St E", city: "North Bay", province: "ON" }, layers, brief, available: ["neighbourhood"], missing: Object.keys(layers).filter(k => k !== "neighbourhood").map(layer => ({ layer, status: "unavailable" })), query: {}, notes: [] } as unknown as PropertyResult);
    expect(brief.findings).toHaveLength(1);
    expect(html).toContain("200 McIntyre St E");
    expect(html).toContain("northbay.ca/legal/");
    expect(html).toContain("shortTermRentalLicences");
    expect(html).toContain("<dt>coverage Complete</dt><dd>false</dd>");
    expect(html).not.toContain("no_match");
  });
  it("keeps Timmins City guidance, original transport failures and restricted AMIS separate from property evidence", () => {
    const a = northernReuseAudit("Timmins", "ON")!;
    expect(a.rightsFinding).toContain("no compatible specific commercial redistribution grant");
    expect(a.rightsFinding).not.toContain("noncommercial-only");
    expect(a.metadata.unresolvedTransport).toContain("HTTP403");
    const layers = northernAuditLayers("Timmins", "ON");
    expect(layers.abandonedMineRecords.note).toContain("prior written permission");
    expect(layers.heritage.note).toContain("Schedule B");
    expect(layers.sitePlanDrawings.note).toContain("signed/registered");
    const brief = preShowingBrief(layers, northernAuditQuestions("Timmins", "ON"));
    expect(brief.findings).toHaveLength(0);
    expect(brief.documentsToRequest.some(d => d.reason.includes("2019 ZIP label"))).toBe(true);
    expect(brief.documentsToRequest.some(d => d.reason.includes("Neither screen was performed"))).toBe(true);
  });
  it("moves audited centres to audited reuse gaps without declaring major-market completion", () => {
    const roadmap = ontarioMarketRoadmap();
    expect(roadmap.majorMarketsComplete).toBe(false);
    for (const city of ["North Bay", "Sault Ste. Marie", "Timmins"]) {
      const market = roadmap.municipalities.find(m => m.city === city)!;
      expect(market).toMatchObject({ stage: "audited_reuse_gap", complete: false, configuredLayers: [] });
      expect(market.withheldLayers.some(g => g.layer === "zoning")).toBe(true);
      expect(market.withheldLayers.some(g => g.layer === "permits")).toBe(true);
    }
  });
});
