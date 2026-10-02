import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "./http";
import { trcaLayer } from "./trca";
import type { Location } from "./model";
vi.mock("./http", async importOriginal => ({ ...await importOriginal<typeof import("./http")>(), fetchJson: vi.fn() }));
const point: Location = { address: null, city: "Toronto", province: "ON", latitude: 43.7, longitude: -79.4, accuracy: "source_building_point", provider: "NAR" };
const metadata = { name: "RegulationLimit_2025", fields: [{ name: "OBJECTID" }, { name: "criteria_layers_contribution" }] };
beforeEach(() => vi.mocked(fetchJson).mockReset());
describe("licensed TRCA 2025 point screening", () => {
  it("keeps the official version, contributing criteria and building-point scope", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({ ...metadata, editingInfo: { dataLastEditDate: 1777484302809 } }).mockResolvedValueOnce({ fields: metadata.fields, features: [{ attributes: { OBJECTID: 123, criteria_layers_contribution: "Floodplain" } }] });
    expect(await trcaLayer(point)).toMatchObject({ status: "available", data: { mappingVersion: "2025", geometryScope: "building_point", records: [{ recordId: "123", publishedCriteria: "Floodplain" }] } });
  });
  it("does not make an absence finding from a changed version or transfer limit", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({ name: "RegulationLimit_2026" }); expect((await trcaLayer(point)).status).toBe("unavailable");
    vi.mocked(fetchJson).mockResolvedValueOnce(metadata).mockResolvedValueOnce({ exceededTransferLimit: true }); expect((await trcaLayer(point)).status).toBe("unavailable");
  });
  it("accepts ArcGIS empty results without a repeated field list, without claiming regulation is absent", async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce(metadata).mockResolvedValueOnce({ features: [] });
    const result = await trcaLayer(point); expect(result.status).toBe("no_match"); expect(result.note).toContain("Unmapped features");
  });
  it("skips street interpolation and places outside the envelope without fetching", async () => {
    expect((await trcaLayer({ ...point, accuracy: "street" })).status).toBe("skipped");
    expect((await trcaLayer({ ...point, latitude: 45.4 })).status).toBe("not_supported"); expect(fetchJson).not.toHaveBeenCalled();
  });
});
