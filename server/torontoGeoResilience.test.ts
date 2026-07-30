/**
 * resolveSite must survive unavailable geo layers.
 *
 * The multiplex underwriter returned "Underwrite failed — please try again." for
 * every address in production. Cause: the zoning, street-tree and heritage
 * tables are created by scripts/import-toronto-*.ts rather than by a migration,
 * and ensureTorontoGeoTables() was exported but called from nowhere — so on a
 * database where those imports had never run, the tables did not exist, the
 * queries threw, and the Promise.all in resolveSite rejected. Only screenTrca
 * had a try/catch; the other three took the whole request down.
 *
 * resolveSite already carried copy for this state ("Zoning layer not imported
 * yet — run scripts/import-toronto-geodata.ts"), so degrading was always the
 * intent. These tests hold that line.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { throwEverything: false, queries: [] as string[] };

vi.mock("./db", () => ({
  db: {
    execute: async (q: any) => {
      state.queries.push(String(q?.queryChunks ?? q));
      if (state.throwEverything) {
        // What postgres actually says when the import was never run.
        throw new Error('relation "toronto_zoning_polygons" does not exist');
      }
      return { rows: [] };
    },
  },
}));

// Geocoding is network I/O and irrelevant to this regression.
vi.mock("./enrichment", () => ({ resolveWard: async () => null }));

const { resolveSite, zoningDataLoaded } = await import("./torontoGeo");

beforeEach(() => {
  state.throwEverything = false;
  state.queries = [];
});

describe("zoningDataLoaded", () => {
  it("reports not-loaded when the table is missing rather than throwing", async () => {
    state.throwEverything = true;
    await expect(zoningDataLoaded()).resolves.toBe(false);
  });

  it("reports not-loaded when the table is empty", async () => {
    await expect(zoningDataLoaded()).resolves.toBe(false);
  });
});

describe("resolveSite with every geo layer unavailable", () => {
  it("resolves instead of throwing", async () => {
    state.throwEverything = true;
    // Coordinates supplied so no geocode request is attempted.
    await expect(
      resolveSite("204 Oakcrest Dr, Toronto", { lat: 43.6896, lng: -79.3126 }),
    ).resolves.toBeDefined();
  });

  it("degrades each screen to its documented no-data state", async () => {
    state.throwEverything = true;
    const site = await resolveSite("204 Oakcrest Dr, Toronto", { lat: 43.6896, lng: -79.3126 });

    expect(site.zoning).toBeNull();
    expect(site.zoningDataAvailable).toBe(false);
    expect(site.trees.status).toBe("no_data");
    expect(site.heritage.status).toBe("no_data");
    expect(site.trca.status).toBe("unavailable");
  });

  it("keeps the address and coordinates the caller passed in", async () => {
    state.throwEverything = true;
    const site = await resolveSite("204 Oakcrest Dr, Toronto", { lat: 43.6896, lng: -79.3126 });

    // The underwrite still needs these — losing them would break the report
    // header and the persisted row even though the screens came back empty.
    expect(site.address).toBe("204 Oakcrest Dr, Toronto");
    expect(site.lat).toBe(43.6896);
    expect(site.lng).toBe(-79.3126);
  });

  it("tells the user which layers are missing", async () => {
    state.throwEverything = true;
    const site = await resolveSite("204 Oakcrest Dr, Toronto", { lat: 43.6896, lng: -79.3126 });

    const notes = site.notes.join(" ");
    expect(notes).toContain("Zoning layer not imported yet");
    expect(notes).toMatch(/tree inventory not imported/i);
    expect(notes).toMatch(/Heritage register not imported/i);
  });
});
