import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { orilliaCoverage, orilliaLayers, orilliaMatchAddress, orilliaPolicyHash, orilliaReportOffer, validateOrilliaSnapshot } from "./orillia";
import { ORILLIA_FILES, ORILLIA_POLICY, ORILLIA_POLICY_HASH, ORILLIA_OFFER } from "./orillia-sources";
import { preShowingBrief } from "./brief";
import { ontarioMarketRoadmap } from "./ontario-market-roadmap";
import { PROPERTY_SKILL } from "./skill";
import { PROPERTY_OPENAPI } from "./openapi";
import type { Row } from "./model";
const { html } = vi.hoisted(() => ({ html: vi.fn() }));
vi.mock("./http", async () => ({ ...await vi.importActual<typeof import("./http")>("./http"), fetchText: html }));
const policyContent = JSON.parse(readFileSync(new URL("./fixtures/orillia/privacy-content.json", import.meta.url), "utf8")) as { text: string; links: string[] };
const offeredYears = JSON.parse(readFileSync(new URL("./fixtures/orillia/offered-months.json", import.meta.url), "utf8")) as { heading: string; months: { name: string; url: string }[] }[];
// Self-authored test markup around published information; no City site code/design.
const policy = `<main id="site-content"><h1>Privacy</h1><div class="text">${policyContent.text.replace("Content standards", "<h2>Content standards</h2>")}${policyContent.links.map(href => `<a href="${href}"></a>`).join("")}</div></main>`;
const offer = `<main id="site-content"><h1>Permits and Inspections</h1>${offeredYears.map(y => `<div class="info"><p class="heading">${y.heading}</p>${y.months.map(m => `<a href="${m.url}">${m.name}</a>`).join("")}</div>`).join("")}</main>`;
const raw = readFileSync(new URL("./data/orillia-monthly-reports.json", import.meta.url), "utf8");
const screen = (address = "247 Barrie Road, Orillia, ON") => orilliaLayers({ address });
const records = (value: { data: unknown }) => (value.data as { records: Row[] }).records;
beforeEach(() => { html.mockReset().mockImplementation((u: URL) => u.href === ORILLIA_POLICY ? policy : u.href === ORILLIA_OFFER ? offer : Promise.reject(Error("Unexpected source"))); });
describe("Orillia original City monthly observations", () => {
  it("binds full current policy text/links and each original month-to-file offer", () => {
    expect(orilliaPolicyHash(policy)).toBe(ORILLIA_POLICY_HASH); expect(orilliaReportOffer(offer)).toHaveLength(30);
    expect(orilliaPolicyHash(policy.replace("Content standards</h2>", "Content standards</h2><p>New commercial restriction.</p>"))).not.toBe(ORILLIA_POLICY_HASH);
    expect(orilliaPolicyHash(policy.replace("/laws/statute/90f31", "/laws/statute/different"))).not.toBe(ORILLIA_POLICY_HASH);
    for (const changed of [offer.replace(ORILLIA_FILES[0].url, "https://copy.invalid/report.pdf"), offer.replace(ORILLIA_FILES[0].url, ORILLIA_FILES[1].url), offer.replace(`${ORILLIA_FILES[0].url}">March`, `${ORILLIA_FILES[0].url}">April`)]) expect(() => orilliaReportOffer(changed)).toThrow();
  });
  it("allows new offered months without claiming to have searched their PDFs", async () => {
    html.mockImplementation((u: URL) => u.href === ORILLIA_POLICY ? policy : offer.replace(`${ORILLIA_FILES.at(-1)!.url}">August</a>`, `${ORILLIA_FILES.at(-1)!.url}">August</a><a href="https://media-001-ca.cdn.govstack.com/orilliarecreation-004-ca/media/newfile/0926-public.pdf">September</a>`));
    const c = await orilliaCoverage(); expect(c.pendingReportingPeriods).toEqual(["2026-09"]); expect(c.reportingPeriods).not.toContain("2026-09"); expect(c.currentPDFBytesVerified).toBe(false);
  });
  it("withholds rows and counts on a policy, original file link or source outage", async () => {
    for (const changed of [policy.replace("Content standards</h2>", "Content standards</h2><p>New restriction.</p>"), "failed"]) {
      html.mockImplementation((u: URL) => u.href === ORILLIA_POLICY ? changed : offer);
      const r = await screen(); expect(r.orilliaPermitObservations.status).toBe("unavailable"); expect(r.orilliaInspectionObservations.data).toBeNull();
      const c = await orilliaCoverage(); expect(c.datasets.every(d => d.records === null && d.status === "unavailable")).toBe(true);
    }
    html.mockRejectedValue(Error("Source unavailable")); expect((await screen()).orilliaPermitObservations.data).toBeNull();
  });
  it("validates all detailed rows and distinguishes counts from unique properties", async () => {
    const s = validateOrilliaSnapshot(raw); expect(s.permits).toHaveLength(1181); expect(s.inspections).toHaveLength(1810);
    expect(s.permits.filter(r => r.address)).toHaveLength(1009); expect(s.inspections.filter(r => r.address)).toHaveLength(1639);
    expect(s.inspections.filter(r => r.publishedSection === "OCCUPANCY INSPECTIONS")).toHaveLength(416);
    expect(() => validateOrilliaSnapshot(raw.replace('"247 BARRIE RD"', '"248 BARRIE RD"'))).toThrow();
    expect(() => validateOrilliaSnapshot(raw.replace('"permitNumber":', '"Roll #":"435202021312900","permitNumber":'))).toThrow();
    const c = await orilliaCoverage(); expect(c.datasets.map(d => d.records)).toEqual([1181,1810]); expect(c.sourceFiles).toHaveLength(30); expect(c.complete).toBe(false);
    expect(c.datasets.every(d => d.source.licence.includes("Content standards") && !d.source.licence.includes("Government Licence"))).toBe(true);
  });
  it("returns exact building observations with source PDF, page, raw labels and snapshot vintage", async () => {
    const r = await screen(), p = r.orilliaPermitObservations; expect(p.status).toBe("available");
    const august = records(p).filter(x => x.reportingPeriod === "2026-08"); expect(august).toHaveLength(3);
    expect(august.find(x => x.permitNumber === "PRM-2026-0277")).toMatchObject({ publishedPermitType: "Renovation: Residential", publishedConstructionType: "Alteration/Renovat", publishedIssuedCalendarDate: "2026-08-21", sourcePage: 5 });
    expect(august.every(x => x.sourceUrl === ORILLIA_FILES.at(-1)!.url && x.sourceFileSha256 === ORILLIA_FILES.at(-1)!.sha256)).toBe(true);
    expect(p.data).toMatchObject({ coverageComplete: false, currentPermitStatusVerified: false, currentPDFBytesVerified: false, inspectionOutcomeVerified: false, occupancyPermissionVerified: false, legalUnitsVerified: false, absenceEstablished: false, delivery: "reviewed_compiled_snapshot" });
    expect(p.retrievedAt).toBe(validateOrilliaSnapshot(raw).retrievedAt); expect(p.sourceUpdatedAt).toBeNull();
    expect(new Set(html.mock.calls.map(([u]) => (u as URL).href))).toEqual(new Set([ORILLIA_POLICY,ORILLIA_OFFER]));
  });
  it("preserves older permit references and final/occupancy list headings without outcomes", async () => {
    const r = await screen("201 Woodside Dr, Orillia, ON"), i = r.orilliaInspectionObservations; expect(i.status).toBe("available");
    expect(records(i).find(x => x.inspectionNumber === "INSP-57472")).toMatchObject({ reportingPeriod: "2026-08", permitNumber: "PRM-2018-0164", publishedIssuedCalendarDate: "2018-04-10", publishedInspectionDate: "2026-08-26 08:30 - 09:00", publishedSection: "FINAL INSPECTIONS" });
    expect((i.data as Row).inspectionOutcomeVerified).toBe(false); expect((i.data as Row).occupancyPermissionVerified).toBe(false);
    const s = validateOrilliaSnapshot(raw); expect(s.inspections.find(x => x.inspectionNumber === "INSP-45813")?.publishedSection).toBe("OCCUPANCY INSPECTIONS");
  });
  it("never guesses clipped addresses, directions, ranges or unit identities", async () => {
    for (const a of ["399 HOMEWOOD A", "32-40 MATCHEDASH ST", "29 - 580 WEST ST S", "1 HUNTER VALLEY R"]) expect(orilliaMatchAddress(a,false)).toBeNull();
    expect(orilliaMatchAddress("109 BRANT ST E",true)).toBeNull();
    const exact = await screen("109 Brant St E, Orillia, ON"), wrong = await screen("109 Brant St W, Orillia, ON");
    expect(records(exact.orilliaPermitObservations).some(x => x.permitNumber === "PRM-2026-0293")).toBe(true); expect(records(wrong.orilliaPermitObservations).some(x => x.permitNumber === "PRM-2026-0293")).toBe(false);
    const clipped = await screen("399 Homewood Ave, Orillia, ON"); expect(records(clipped.orilliaPermitObservations).some(x => x.permitNumber === "PRM-2026-0287")).toBe(false);
  });
  it("leaves no-match unknown and skips coordinates, units and identity conflicts before source reads", async () => {
    const n = await screen("999999 Barrie Rd, Orillia, ON"); expect(n.orilliaPermitObservations.status).toBe("no_match"); expect(n.orilliaPermitObservations.data).toHaveProperty("absenceEstablished",false);
    html.mockClear();
    for (const input of [{ city: "Orillia", lat:44.61, lng:-79.421 }, { address:"247 Barrie Rd Unit 2, Orillia, ON", city:"Orillia" }, { address:"247 Barrie Rd, Severn, ON", city:"Orillia" }, { address:"247 Barrie Rd, Orillia, BC",province:"ON" }]) {
      const r=await orilliaLayers(input); expect(["skipped","ambiguous"]).toContain(r.orilliaPermitObservations.status); expect(r.orilliaPermitObservations.data).toBeNull();
    }
    expect(html).not.toHaveBeenCalled(); expect(await orilliaLayers({address:"247 Barrie Rd, Barrie, ON"})).toEqual({});
  });
  it("omits personal/assessment fields and preserves malformed or clipped measures", () => {
    const s=validateOrilliaSnapshot(raw);
    for (const k of ["permits","inspections"] as const) for (const r of s[k]) expect(Object.keys(r).some(k => /roll|owner|contractor|assessment/i.test(k))).toBe(false);
    expect(s.permits.find(x=>x.permitNumber==="PRM-2025-0476")?.publishedProjectValue).toBeNull();
    expect(s.permits[0].publishedProjectValue).toBe("150000");
    expect(s.permits.find(x=>x.recordId==="2026-08:5:16")).toMatchObject({publishedIssuedCalendarDate:"2026-08-14",publishedIssuedDate:"2026-08-14 16:04"});
    expect(s.permits.find(x=>x.permitNumber==="PRM-2023-0485")?.publishedWorkMeasure).toBe("1,050 ft, 320.041 m");
  });
  it("keeps City gaps, native artifact instructions and incomplete market status visible", async () => {
    const layers=await screen(), brief=preShowingBrief(layers, []);
    expect(brief.findings.some(f=>f.summary.includes("Orillia permit report observations"))).toBe(true); expect(brief.documentsToRequest.filter(d=>d.document.startsWith("Orillia"))).toHaveLength(3);
    expect(layers.orilliaPropertyFiles.source).toBeNull(); expect(layers.orilliaPropertyFiles.retrievedAt).toBeNull();
    const m=ontarioMarketRoadmap().municipalities.find(m=>m.city==="Orillia")!;expect(m.complete).toBe(false);expect(m.configuredLayers).toContain("orilliaInspectionObservations");expect(m.withheldLayers.some(x=>x.layer==="completePermitHistory")).toBe(true);
    expect(PROPERTY_SKILL).toContain("Orillia adds two");expect(PROPERTY_SKILL).toContain("fs_write");expect(PROPERTY_SKILL).toContain("share_artifact");
    expect(PROPERTY_OPENAPI.components.schemas.PropertyResult.properties.layers.properties).toHaveProperty("orilliaPermitObservations");
  });
});
