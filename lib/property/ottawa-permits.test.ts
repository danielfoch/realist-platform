import { beforeEach, describe, expect, it, vi } from "vitest";
import { ottawaPermitCoverage, ottawaPermits } from "./ottawa-permits";
import type { Location, Row } from "./model";
const load = vi.hoisted(() => vi.fn());
vi.mock("./snapshots", () => ({ loadSnapshot: load }));
let vintage = 0;
const record = (id: number, address = "50 Laxford Dr", community: string | null = "Kanata"): Row => ({ OBJECTID: id, permitNumber: "CON-2024-009110", address, community, publishedIssuedDate: "2025-01-02", reportingPeriodStart: "2025-01-01", reportingPeriodEnd: "2025-01-31", description: "Construct an additional dwelling unit in the basement", publishedWorkValueCAD: 50000, publishedWorkArea: 100, publishedWorkAreaUnit: "square_metres", sourceItemId: "05046d836248455d92cbc0543ce4c022" });
function snapshot(records: Row[]) { return { dataset: "ottawa-permits", delivery: "compiled_fallback", rowCount: records.length, records, retrievedAt: new Date(Date.UTC(2026, 9, 2, 0, 0, ++vintage)).toISOString(), sourceUpdatedAt: null, reportingPeriods: ["2025-01"], sourceFiles: [] }; }
beforeEach(() => { load.mockReset(); });
describe("Ottawa civic permit evidence", () => {
  it("returns work measures and explicit incomplete history without current-status claims", async () => {
    load.mockResolvedValue(snapshot([record(1), record(2)]));
    const r = await ottawaPermits("50 Laxford Drive", "Kanata", null);
    expect(r.status).toBe("available"); expect(r.data).toMatchObject({ matchedObservations: 2, distinctMatchedPermitNumbers: 1, scope: "building_level", coverageComplete: false, historyBefore2024Searched: false, currentPermitStatusVerified: false });
    expect(r.sourceUpdatedAt).toBeNull(); expect(r.note).toContain("not the property's legal unit count");
  });
  it("does not guess a former municipality or ignore street direction", async () => {
    load.mockResolvedValue(snapshot([record(1), record(2, "50 Laxford Dr", "Nepean")]));
    expect((await ottawaPermits("50 Laxford Dr", "Ottawa", null)).status).toBe("ambiguous");
    const location = { provider: "ottawa:addresses", municipalAddress: { community: "Kanata" } } as Location;
    expect((await ottawaPermits("50 Laxford Dr", "Ottawa", location)).data).toMatchObject({ matchedObservations: 1, resolvedFormerMunicipality: "kanata" });
    load.mockResolvedValue(snapshot([record(1, "99 Fourth Ave W")]));
    expect((await ottawaPermits("99 Fourth Ave E", "Ottawa", null)).status).toBe("no_match");
  });
  it("matches explicit civic-address lines while excluding unknown communities and unit/lot identifiers", async () => {
    load.mockResolvedValue(snapshot([record(1, "50 Laxford Dr\n52 Laxford Dr"), record(2, "50 Laxford Dr", null), record(3, "Unit/Lot 3 - 50 Laxford Dr")]));
    expect((await ottawaPermits("52 Laxford Dr", "Kanata", null)).data).toMatchObject({ matchedObservations: 1 });
    expect((await ottawaPermits("50 Laxford Dr", "Kanata", null)).data).toMatchObject({ matchedObservations: 1 });
    expect((await ottawaPermits("Unit 2, 50 Laxford Dr", "Kanata", null)).status).toBe("skipped");
  });
  it("bounds visible results and distinguishes an empty selection from missing snapshots", async () => {
    load.mockResolvedValue(snapshot(Array.from({ length: 51 }, (_, i) => record(i))));
    const r = await ottawaPermits("50 Laxford Dr", "Kanata", null); expect(r.truncated).toBe(true); expect((r.data as { records: Row[] }).records).toHaveLength(50);
    expect((await ottawaPermits("52 Laxford Dr", "Kanata", null)).data).toMatchObject({ absenceEstablished: false });
    load.mockResolvedValue(null); expect((await ottawaPermits("50 Laxford Dr", "Kanata", null)).status).toBe("unavailable");
    expect(await ottawaPermitCoverage()).toMatchObject({ status: "unavailable", records: null, coverageComplete: false });
  });
});
