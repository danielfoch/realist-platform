import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeMock: vi.fn(),
}));

vi.mock("./db", () => ({
  db: { execute: mocks.executeMock },
}));

import { resolveSite } from "./torontoGeo";

describe("resolveSite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses provided lat/lng and skips server-side geocoding", async () => {
    mocks.executeMock.mockImplementation(async (query: any) => {
      const text = typeof query === "object" && query !== null ? String(query) : String(query);
      if (text.includes("FROM geocode_cache")) {
        throw new Error("Server geocoder should not be called when lat/lng are provided");
      }
      if (text.includes("FROM toronto_zoning_polygons")) {
        return { rows: [] };
      }
      if (text.includes("SELECT 1 FROM toronto_zoning_polygons")) {
        return { rows: [{ "?column?": 1 }] };
      }
      if (text.includes("FROM toronto_street_trees")) {
        return { rows: [] };
      }
      if (text.includes("SELECT 1 FROM toronto_street_trees")) {
        return { rows: [] };
      }
      if (text.includes("FROM toronto_heritage_properties")) {
        return { rows: [] };
      }
      if (text.includes("SELECT 1 FROM toronto_heritage_properties")) {
        return { rows: [] };
      }
      if (text.includes("FROM geo_screen_cache")) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const site = await resolveSite("123 Main St, Toronto", { lat: 43.7, lng: -79.4 });

    expect(site.lat).toBe(43.7);
    expect(site.lng).toBe(-79.4);
    expect(site.geocodeProvider).toBe("client");
  });

});
