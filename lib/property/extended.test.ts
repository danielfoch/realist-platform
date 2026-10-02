import { describe, expect, it } from "vitest";
import { developmentStage, nearbyApplications, publishedDate, torontoHeritage } from "./extended";
import type { Row } from "./model";
const r = (n: string, x: string, status: string, date = "2026-01-01"): Row => ({ "APPLICATION#": n, STREET_NUM: x, STREET_NAME: "O'CONNOR", STREET_TYPE: "DR", X: "320601.587", Y: "4842324.669", STATUS: status, DATE_SUBMITTED: date });
describe("current Toronto heritage and nearby proposals", () => {
  it("keeps individual, district and listed designations distinct and exact-address scoped", async () => {
    expect((await torontoHeritage("16 Soho Street", "Toronto", "ON")).data).toMatchObject({ records: [{ publishedStatus: "Part IV", statusMeaning: "individual_designation", bylawNumber: "669-97" }] });
    expect((await torontoHeritage("17 Salisbury Avenue", "Toronto", "ON")).data).toMatchObject({ records: [{ publishedStatus: "Part V", statusMeaning: "heritage_conservation_district_designation" }] });
    expect((await torontoHeritage("16 Soho Road", "Toronto", "ON")).status).toBe("no_match");
    expect((await torontoHeritage("16 Soho Street", "Toronto", "BC")).status).toBe("not_supported");
  });
  it("groups multisite applications, includes older non-closed stages, and never means built by closed", () => {
    const data = nearbyApplications([r("a", "1880", "Appeal Received"), r("a", "1885", "Appeal Received"), r("b", "1880", "Under Review", "2008-01-01"), r("c", "1880", "Closed", "2008-01-01"), r("d", "1880", "Closed"), r("e", "1880", "Future New Stage", "2008-01-01"), { ...r("f", "1880", "Under Review"), X: null }], 43.72265, -79.303885, new Date("2026-10-02"));
    expect(data.applications.map(a => a.applicationNumber).sort()).toEqual(["a", "b", "d", "e"]);
    expect(data.applications.find(a => a.applicationNumber === "a")).toMatchObject({ stage: "appealed", nearbyAddresses: ["1880 O'CONNOR DR", "1885 O'CONNOR DR"] });
    expect(data.applications.find(a => a.applicationNumber === "d")?.stage).toBe("closed");
    expect(data.sourceRecordsWithoutUsableCoordinates).toBe(1);
    expect(data.applications.find(a => a.applicationNumber === "e")?.stage).toBe("unknown");
  });
  it("validates impossible DBF dates and preserves unknown stages", () => {
    expect(publishedDate("20240229")).toBe("2024-02-29"); expect(publishedDate("20230229")).toBeNull();
    expect(developmentStage("Final Approval Completed")).toBe("approved"); expect(developmentStage("Council Approved")).toBe("approved"); expect(developmentStage("Amend Drft Plan App")).toBe("unknown");
  });
});
