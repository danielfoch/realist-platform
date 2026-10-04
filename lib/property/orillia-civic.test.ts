import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { orilliaCivicAddress, orilliaCivicCoverage, orilliaCivicLayers, parseOrilliaDecisionOffers, parseOrilliaHeritage, validateOrilliaDecisions } from "./orillia-civic";
import { ORILLIA_GUIDANCE, ORILLIA_POLICY } from "./orillia-sources";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import { PROPERTY_SKILL } from "./skill";
import { PROPERTY_OPENAPI } from "./openapi";
import type { Row } from "./model";
const { html } = vi.hoisted(() => ({ html: vi.fn() }));
vi.mock("./http", () => ({ fetchText: html }));
const facts = JSON.parse(readFileSync("lib/property/fixtures/orillia/heritage-table-facts.json", "utf8")) as string[][];
const offers = JSON.parse(readFileSync("lib/property/fixtures/orillia/decision-offers.json", "utf8")) as { fileNumber: string; caseLabel: string; context: string; url: string }[];
const privacy = JSON.parse(readFileSync("lib/property/fixtures/orillia/privacy-content.json", "utf8")) as { text: string; links: string[] };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const policy = `<main id="site-content"><h1>Privacy</h1><div class="text">${esc(privacy.text).replace("Content standards", "<h2>Content standards</h2>")}${privacy.links.map(h => `<a href="${esc(h)}"></a>`).join("")}</div></main>`;
const heritage = `<main id="site-content"><h1>Municipal Heritage Committee</h1><div class="info"><h2>Municipal Register of Designated Properties</h2><div class="text"><table>${facts.map((r,i) => `<tr>${r.map(c => `<${i ? "td" : "th"}>${esc(c)}</${i ? "td" : "th"}>`).join("")}</tr>`).join("")}</table></div></div></main>`;
const adjustment = `<main id="site-content"><h1>Committee of Adjustment</h1>${offers.map(o => o.context.startsWith("Decisions - ") ? `<div><p>${esc(o.context)}</p><ul><li><a href="${esc(o.url)}">${esc(o.caseLabel)}</a></li></ul></div>` : `<div><p class="tab"><a>${esc(o.context)}</a></p><div class="info"><p>${esc(o.caseLabel)}</p><ul><li><a href="${esc(o.url)}">Decision</a></li></ul></div></div>`).join("")}</main>`;
const raw = readFileSync("lib/property/data/orillia-planning-decisions.json", "utf8");
const rows = (v: { data: unknown }) => (v.data as { records: Row[] }).records;
const screen = (address: string) => orilliaCivicLayers({ address });
beforeEach(() => { html.mockReset().mockImplementation((u: URL) => u.href === ORILLIA_POLICY ? policy : u.href === ORILLIA_GUIDANCE.heritage ? heritage : u.href === ORILLIA_GUIDANCE.adjustment ? adjustment : Promise.reject(Error("Unexpected source"))); });
describe("Orillia City heritage and decision references", () => {
  it("extracts only the original complete typed heritage table and explicit civic directions", () => {
    const all = parseOrilliaHeritage(heritage); expect(all).toHaveLength(28); expect(all.filter(r => r.address)).toHaveLength(25);
    expect(all.find(r => r.publishedDesignationBylaw === "1979-67")).toMatchObject({ publishedLocation: "26 Coldwater Street (East)", address: "26 Coldwater Street East" });
    expect(all.find(r => r.publishedDesignationBylaw === "1980-260, as amended")?.publishedDesignationBylaw).toContain("as amended");
    for (const a of ["19-27 Mississaga Street East", "191 and 201 Mississaga Street West", "39 Peter Street North and 31 Coldwater Street East", "Couchiching Beach Park"]) expect(orilliaCivicAddress(a)).toBeNull();
    for (const h of [heritage.replace("Designation By-law and Detail(s)", "Status"), heritage.replace("<td>1978-271</td>", "<td>1978-271</td><td>Owner</td>"), heritage.replace("<h2>Municipal Register", "<h2>Historical Register")]) expect(() => parseOrilliaHeritage(h)).toThrow();
  });
  it("keeps City bylaw references distinct from complete statutory register and dates", async () => {
    const r = (await screen("50 Andrew St S, Orillia, ON")).orilliaDesignatedHeritageReference;
    expect(r.status).toBe("available"); expect(rows(r)[0]).toMatchObject({ publishedDesignationBylaw: "2001-34", publishedLocation: "50 Andrew Street South" });
    expect(r.data).toMatchObject({ fullStatutoryRegisterVerified: false, designationInstrumentsVerified: false, sourceObservationDate: null, sourcePointGeometryReused: false }); expect(r.sourceUpdatedAt).toBeNull();
    expect(r.source?.licence).not.toContain("Government Licence");
  });
  it("binds every selected original case label/context to its offered City PDF", () => {
    expect(parseOrilliaDecisionOffers(adjustment)).toEqual(offers);
    expect(() => parseOrilliaDecisionOffers(adjustment.replace("media-001-ca.cdn.govstack.com", "copy.example"))).toThrow();
    expect(() => parseOrilliaDecisionOffers(adjustment.replace("Committee of Adjustment</h1>", "Copied Decisions</h1>"))).toThrow();
  });
  it("keeps all 16 typed PDF headers, checked outcomes and source identities intact", () => {
    const s = validateOrilliaDecisions(raw); expect(s.records).toHaveLength(16); expect(s.records.filter(r => r.address)).toHaveLength(14); expect(s.records.filter(r => r.documentIdentityConflict)).toHaveLength(2);
    expect(() => validateOrilliaDecisions(raw.replace('"Denied"', '"Approved"'))).toThrow();
    expect(s.records.every(r => Object.keys(r).every(k => !/owner|agent|applicant|signature|description/i.test(k)))).toBe(true);
    expect(s.records.find(r => r.documentFileNumber === "B04-26")).toMatchObject({ publishedDecisionCalendarDate: "2026-08-27", publishedOutcome: "Denied", sourcePage: 1 });
  });
  it("preserves a denied variance alongside an approved-with-conditions consent", async () => {
    const r = (await screen("353 Old Muskoka Rd, Orillia, ON")).orilliaDecisionObservations;
    expect(r.status).toBe("available"); expect(rows(r)).toHaveLength(2);
    expect(rows(r).map(r => [r.documentFileNumber,r.publishedOutcome])).toEqual([["A03-26","Denied"],["B02-26","Approved with conditions"]]);
    expect(r.data).toMatchObject({ conditionsSatisfiedVerified: false, consentRegistrationVerified: false, expiryVerified: false, appealOutcomesVerified: false, currentOperativePermissionVerified: false, currentPDFBytesVerified: false });
  });
  it("retains swapped file links and omitted East direction as ambiguous evidence", async () => {
    for (const address of ["51 James Street East, Orillia, ON", "51 James Street, Orillia, ON"]) {
      const r = (await screen(address)).orilliaDecisionObservations; expect(r.status).toBe("ambiguous"); expect(rows(r)).toHaveLength(2);
      expect(rows(r).every(r => r.documentIdentityConflict && r.documentPublishedAddress === "51 James Street East")).toBe(true);
      expect(r.data).toHaveProperty("documentIdentityResolved",false);
      const a=rows(r).find(r=>r.documentFileNumber==="A02-26")!;
      expect((a.pageReferences as Row[])[0].fileNumber).toBe("B01-26"); expect(a.sourceLabelConflicts).toContain("page_address_differs_from_document");
    }
  });
  it("does not allocate multi-address documents, blank/range heritage rows or wrong directions", async () => {
    for (const address of ["191 Mississaga St W, Orillia, ON", "201 Mississaga St W, Orillia, ON", "39 Peter St N, Orillia, ON", "31 Coldwater St E, Orillia, ON"]) expect((await screen(address)).orilliaDecisionObservations.status).toBe("no_match");
    expect((await screen("50 Andrew St N, Orillia, ON")).orilliaDesignatedHeritageReference.status).toBe("no_match");
    const n = (await screen("999999 Barrie Rd, Orillia, ON")).orilliaDecisionObservations; expect(n.data).toMatchObject({ absenceEstablished:false, completePlanningHistorySearched:false });
  });
  it("withholds records and counts on full permission or selected source drift independently", async () => {
    html.mockImplementation((u:URL)=>u.href===ORILLIA_POLICY?policy.replace("Content standards</h2>","Content standards</h2><p>New restriction.</p>"):u.href===ORILLIA_GUIDANCE.heritage?heritage:adjustment);
    const r=await screen("50 Andrew St S, Orillia, ON"); expect(Object.values(r).every(v=>v.status==="unavailable"&&v.data===null)).toBe(true);
    expect((await orilliaCivicCoverage()).datasets.every(d=>d.records===null)).toBe(true);
    html.mockImplementation((u:URL)=>u.href===ORILLIA_POLICY?policy:u.href===ORILLIA_GUIDANCE.heritage?heritage:adjustment.replace("a10-26-6-victoria-crescent-decision-minor-variance.pdf","changed-original.pdf"));
    const d=await screen("6 Victoria Cres, Orillia, ON"); expect(d.orilliaDecisionObservations.status).toBe("unavailable"); expect(d.orilliaDesignatedHeritageReference.status).toBe("no_match");
  });
  it("skips coordinate-only/unit/conflicting identity before source reads", async () => {
    for (const input of [{city:"Orillia",lat:44.61,lng:-79.42},{address:"50 Andrew St S Unit 2, Orillia, ON"},{address:"50 Andrew St S, Severn, ON",city:"Orillia"},{address:"50 Andrew St S, Orillia, BC",province:"ON"}]) {
      const r=await orilliaCivicLayers(input); expect(Object.values(r).every(v=>["skipped","ambiguous"].includes(v.status)&&v.data===null)).toBe(true);
    }
    expect(html).not.toHaveBeenCalled(); expect(await screen("50 Andrew St S, Barrie, ON")).toEqual({});
  });
  it("retains distinct coverage scopes and native report document guidance", async () => {
    const c=await orilliaCivicCoverage(); expect(c.complete).toBe(false); expect(c.datasets.map(d=>d.records)).toEqual([28,16]);
    const layers=await screen("50 Andrew St S, Orillia, ON"); const b=preShowingBrief({...layers,orilliaPropertyFiles:{status:"unavailable",data:null,source:null,retrievedAt:null,sourceUpdatedAt:null,note:null}},[]);
    expect(b.findings.some(f=>f.summary.includes("designated-property web table"))).toBe(true); expect(b.documentsToRequest.find(d=>d.document.includes("operative planning"))?.evidenceLayers).toContain("orilliaDecisionObservations");
    const m=ontarioMarketRoadmap().municipalities.find(m=>m.city==="Orillia")!;expect(m.complete).toBe(false);expect(m.configuredLayers).toContain("orilliaDecisionObservations");
    expect(PROPERTY_SKILL).toContain("swaps A02-26/B01-26");expect(PROPERTY_SKILL).toContain("share_artifact");expect(PROPERTY_OPENAPI.components.schemas.PropertyResult.properties.layers.properties).toHaveProperty("orilliaDesignatedHeritageReference");
  });
});
