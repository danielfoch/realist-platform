import { describe, expect, it } from "vitest";
import { layer } from "./model";
import { preShowingBrief } from "./brief";
import { renderReport, type PropertyResult } from "./report";
import { PROPERTY_SKILL } from "./skill";
describe("forensics report and actual Homies artifact contract", () => {
  it("escapes provider content and keeps full evidence, gaps and dates", () => {
    const layers = { permits: layer("available", { records: [{ description: '<script>alert(1)</script>', status: "Issued" }] }, { id: "test", name: "test", url: "https://example.com", licence: "public", attribution: "source" }, "dated evidence", "2020-01-01"), zoning: layer("not_supported") };
    const brief = preShowingBrief(layers, []);
    const html = renderReport({ success: true, data: { address: "16 Soho St", city: "Toronto", province: "ON", latitude: null, longitude: null }, layers, brief, available: ["permits"], missing: [{ layer: "zoning", status: "not_supported" }], query: { address: "16 Soho St, Toronto, ON" }, notes: [] } as unknown as PropertyResult);
    expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>"); expect(html).toContain("Issued"); expect(html).toContain("2020-01-01"); expect(html).toContain("not_supported");
    expect(brief.listingComparison).toMatchObject({ status: "not_provided", discrepancies: [] }); expect(brief.documentsToRequest.every(d => d.receiptStatus === "not_assessed")).toBe(true);
  });
  it("uses real harness review/share/update tools, a one-click starter, and the returned URL", () => {
    for (const tool of ['invoke_skill_tool', 'fs_write', 'share_artifact', 'update_artifact']) expect(PROPERTY_SKILL).toContain(tool);
    expect(PROPERTY_SKILL).toContain('Starter prompt: **Create a property forensics report for me.**'); expect(PROPERTY_SKILL).toContain('passing=true'); expect(PROPERTY_SKILL).toContain('Never invent an artifacts URL');
  });
  it("shows municipal reuse terms and keeps historical plans out of current-policy findings", () => {
    const source = { id:"mississauga:historicalOfficialPlan2010",name:"Historical plan",url:"https://example.com/source",licence:"Open Data Terms",licenceUrl:"https://example.com/terms",attribution:"source" };
    const layers={ historicalOfficialPlan2010:layer("available",{historical:true,currentPlanScreenPerformed:false},source,"Plan repealed March 24, 2026"),generalizedLandUse:layer("available",{records:[{generalizedLandUse:"Residential"}]}) };
    const brief=preShowingBrief(layers,[]);
    expect(brief.findings[0].summary).toContain("does not establish current");expect(brief.findings[1].summary).toContain("permitted uses are not supplied");expect(brief.documentsToRequest.some(x=>x.document.includes("2051"))).toBe(true);
    const html=renderReport({success:true,data:{address:"1416 Liveoak Dr",city:"Mississauga",province:"ON"},layers,brief,available:Object.keys(layers),missing:[],query:{},notes:[]} as unknown as PropertyResult);
    expect(html).toContain('href="https://example.com/terms"');expect(html).toContain("Source reuse terms");
    expect(PROPERTY_SKILL).toContain("layers are historical: that plan was repealed");
  });
});
