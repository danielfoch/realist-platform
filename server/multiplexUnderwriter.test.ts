/**
 * Listing ingestion + tier/gradient plumbing for the multiplex underwriter.
 *
 * Everything with I/O is mocked: the database (assumptions read as empty so
 * defaults apply), the CREA DDF feed, site resolution, ward lookup, and the
 * report writer. What is under test is the orchestration — a listing ref
 * becomes address/lot/price inputs, non-Toronto listings are routed rather than
 * thrown, and the result carries ward, zoningTier and mliGradient.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  ddfConfigured: true,
  listing: null as Record<string, unknown> | null,
  ward: { city: "Toronto", code: "14", name: "Toronto–Danforth" } as { city: string; code: string; name: string | null } | null,
  counts: { zoningPolygons: 12_340, wards: 25, streetTrees: 500_000, heritageProperties: 9_000 },
};

vi.mock("./db", () => ({
  db: {
    execute: async () => ({ rows: [] }),
    insert: () => { throw new Error("persist must be off in these tests"); },
    select: () => { throw new Error("no selects expected"); },
  },
}));
vi.mock("./auth", () => ({ isAdmin: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("./accountVerification", () => ({ requireVerified: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("./usageLimits", () => ({
  consumeDailyUsage: async () => ({ allowed: true, limit: 30, remaining: 29, degraded: false }),
  grantDailyUnlock: async () => {},
  hasDailyUnlock: async () => false,
}));
vi.mock("./dealIntent", () => ({ recordDealIntent: async () => {}, captureDealLead: async () => {} }));
vi.mock("./enrichment", () => ({ resolveWard: async () => state.ward }));
vi.mock("./creaDdf", () => ({
  isDdfConfigured: () => state.ddfConfigured,
  searchDdfByMlsNumber: async (mls: string) => (state.listing && state.listing.ListingId === mls ? state.listing : null),
  getDdfListing: async (key: string) => (state.listing && state.listing.ListingKey === key ? state.listing : null),
}));
vi.mock("./torontoGeo", () => ({
  ensureTorontoGeoTables: async () => {},
  getTorontoGeoLayerCounts: async () => state.counts,
  resolveSite: async (address: string, geo: { lat: number; lng: number } | null) => ({
    address,
    lat: geo?.lat ?? 43.66,
    lng: geo?.lng ?? -79.34,
    geocodeProvider: geo ? "client" : "nominatim",
    zoning: { zoneCode: "R (d0.6)", zoneCategory: "Residential", certainty: "verified" },
    zoningDataAvailable: true,
    trees: { status: "ok", cityTreeConflict: false, treesWithinTightRadius: 0, treesWithinContextRadius: 1, nearest: null, privateTreeCaution: "" },
    heritage: { status: "ok", listed: false, match: null },
    trca: { status: "ok", regulated: false, detail: null, fromCache: false },
    notes: [],
  }),
}));
vi.mock("./multiplexReportWriter", () => ({
  writeMultiplexReport: async () => ({
    source: "template",
    report: {
      siteSummary: "", zoningSummary: "", varianceNarrative: "", riskNarrative: "",
      recommendation: { bestPath: "", dealKillers: [], verifyWithProfessionals: [], nextSteps: [] },
    },
  }),
}));

const mod = await import("./multiplexUnderwriter");
const {
  executeMultiplexUnderwriter,
  getMultiplexDataHealth,
  isTorontoCity,
  parseListingRef,
  resolveListingForUnderwrite,
  summarizeDdfListing,
  underwriteRequestSchema,
} = mod;

const LOGAN: Record<string, unknown> = {
  ListingKey: "27654321",
  ListingId: "E9876543",
  StreetNumber: "123",
  StreetName: "Logan",
  StreetSuffix: "Ave",
  UnparsedAddress: "123 Logan Ave, Toronto, ON M4M 2N2",
  City: "Toronto",
  StateOrProvince: "ON",
  PostalCode: "M4M 2N2",
  Latitude: 43.6612,
  Longitude: -79.3421,
  ListPrice: 1_450_000,
  NumberOfUnitsTotal: 2,
  TotalActualRent: 4_800,
  TaxAnnualAmount: 6_200,
  LotFrontage: 7.62,
  LotDepth: 36.58,
  LotSizeDimensions: "7.62 x 36.58 M",
  PublicRemarks: "Detached on a laneway lot. ".repeat(30),
  Media: [
    { MediaURL: "https://cdn.example/2.jpg", Order: 2 },
    { MediaURL: "https://cdn.example/1.jpg", Order: 1, PreferredPhotoYN: true },
  ],
};

beforeEach(() => {
  state.ddfConfigured = true;
  state.listing = { ...LOGAN };
  state.ward = { city: "Toronto", code: "14", name: "Toronto–Danforth" };
});

describe("parseListingRef", () => {
  it("accepts board-prefixed and numeric MLS numbers", () => {
    expect(parseListingRef("C1234567")).toEqual({ kind: "mls", mlsNumber: "C1234567" });
    expect(parseListingRef(" w5551234 ")).toEqual({ kind: "mls", mlsNumber: "W5551234" });
    expect(parseListingRef("40512345")).toEqual({ kind: "mls", mlsNumber: "40512345" });
  });

  it("extracts the ListingKey from a realtor.ca URL", () => {
    expect(parseListingRef("https://www.realtor.ca/real-estate/27654321/123-logan-ave-toronto-south-riverdale")).toEqual({ kind: "listingKey", listingKey: "27654321" });
    expect(parseListingRef("realtor.ca/real-estate/27654321")).toEqual({ kind: "listingKey", listingKey: "27654321" });
  });

  it("rejects junk", () => {
    expect(parseListingRef("")).toBeNull();
    expect(parseListingRef("123 Logan Ave")).toBeNull();
    expect(parseListingRef("https://example.com/whatever")).toBeNull();
  });
});

describe("isTorontoCity", () => {
  it("covers Toronto and the pre-amalgamation names", () => {
    for (const c of ["Toronto", "toronto", "Toronto C08", "Toronto (Riverdale)", "Etobicoke", "Scarborough", "North York", "East York", "York"]) {
      expect(isTorontoCity(c), c).toBe(true);
    }
  });
  it("excludes the 905 and blanks", () => {
    for (const c of ["Mississauga", "Vaughan", "Markham", "Yorkville, NY", "", undefined, null]) {
      expect(isTorontoCity(c as string), String(c)).toBe(false);
    }
  });
});

describe("summarizeDdfListing", () => {
  it("returns only the compact fields, with metres converted and the excerpt capped", () => {
    const s = summarizeDdfListing(LOGAN as any);
    expect(s.mlsNumber).toBe("E9876543");
    expect(s.listingKey).toBe("27654321");
    expect(s.address).toBe("123 Logan Ave");
    expect(s.city).toBe("Toronto");
    expect(s.postalCode).toBe("M4M 2N2");
    expect(s.listPrice).toBe(1_450_000);
    expect(s.numberOfUnits).toBe(2);
    expect(s.lot.source).toBe("fields");
    expect(s.lot.frontageFt).toBeCloseTo(25, 0);
    expect(s.lot.depthFt).toBeCloseTo(120, 0);
    expect(s.photoUrl).toBe("https://cdn.example/1.jpg");
    expect(s.sourceUrl).toBe("https://www.realtor.ca/real-estate/27654321");
    expect(s.publicRemarksExcerpt!.length).toBeLessThanOrEqual(300);
    // No raw DDF passthrough.
    expect((s as any).PublicRemarks).toBeUndefined();
    expect((s as any).Media).toBeUndefined();
  });
});

describe("resolveListingForUnderwrite", () => {
  it("throws ListingSourceUnavailable when the feed is not configured", async () => {
    state.ddfConfigured = false;
    await expect(resolveListingForUnderwrite("E9876543")).rejects.toMatchObject({ name: "ListingSourceUnavailable" });
  });
  it("throws ListingRefInvalid / ListingNotFound as typed errors", async () => {
    await expect(resolveListingForUnderwrite("not a ref")).rejects.toMatchObject({ name: "ListingRefInvalid" });
    await expect(resolveListingForUnderwrite("C0000000")).rejects.toMatchObject({ name: "ListingNotFound" });
  });
  it("resolves by MLS and by URL", async () => {
    expect((await resolveListingForUnderwrite("E9876543")).address).toBe("123 Logan Ave");
    expect((await resolveListingForUnderwrite("https://www.realtor.ca/real-estate/27654321/x")).address).toBe("123 Logan Ave");
  });
});

describe("underwriteRequestSchema", () => {
  it("requires one of address / mlsNumber / listingUrl", () => {
    expect(underwriteRequestSchema.safeParse({}).success).toBe(false);
    expect(underwriteRequestSchema.safeParse({ mlsNumber: "E9876543" }).success).toBe(true);
    expect(underwriteRequestSchema.safeParse({ listingUrl: "https://www.realtor.ca/real-estate/27654321/x" }).success).toBe(true);
    expect(underwriteRequestSchema.safeParse({ address: "123 Logan Ave" }).success).toBe(true);
    expect(underwriteRequestSchema.safeParse({ listingUrl: "not-a-url" }).success).toBe(false);
  });
});

describe("executeMultiplexUnderwriter from a listing", () => {
  it("fills address, coordinates, price and lot from the feed and returns tier + gradient", async () => {
    const out = await executeMultiplexUnderwriter({ mlsNumber: "E9876543", laneAccess: true }, { persist: false });
    expect(out.status).toBe("complete");
    if (out.status !== "complete") return;

    expect(out.listing?.mlsNumber).toBe("E9876543");
    expect(out.site.address).toBe("123 Logan Ave");
    expect(out.site.lat).toBeCloseTo(43.6612, 4);

    const u = out.underwrite;
    expect(u.ward).toEqual({ number: 14, name: "Toronto–Danforth" });
    expect(u.sixplex).toMatchObject({ eligible: true, certainty: "verified" });
    expect(u.zoningTier.code).toBe("6+1");
    expect(u.zoningTier.headline).toMatch(/Ward 14 \(Toronto–Danforth\) is a By-law 654-2025 sixplex ward/);
    expect(u.zoningTier.suite).toBe("laneway");

    expect(u.mliGradient).not.toBeNull();
    expect(u.mliGradient!.configKey).toBeTruthy();
    expect(u.mliGradient!.purpose).toBe("construction");
    if (u.mliGradient!.eligible) {
      expect(u.mliGradient!.rows.map((r) => r.points)).toEqual([0, 50, 70, 100]);
      const cfg = u.configs.find((c) => c.config.key === u.mliGradient!.configKey)!;
      expect(u.mliGradient!.lendingValue).toBe(cfg.rentalHold.stabilizedValue);
      expect(u.mliGradient!.noi).toBe(cfg.rentalHold.noi);
    }

    expect(u.assumptionNotes.some((n) => /Lot dimensions taken from the listing feed/.test(n))).toBe(true);
    expect(u.assumptionNotes.some((n) => /asking price of \$1,450,000/.test(n))).toBe(true);
    expect((u as any).listing?.listingKey).toBe("27654321");
  });

  it("keeps caller-supplied dimensions over the feed's", async () => {
    const out = await executeMultiplexUnderwriter(
      { mlsNumber: "E9876543", lotFrontageFt: 30, lotDepthFt: 100, purchasePrice: 1_000_000 },
      { persist: false },
    );
    expect(out.status).toBe("complete");
    if (out.status !== "complete") return;
    expect(out.underwrite.assumptionNotes.some((n) => /taken from the listing feed/.test(n))).toBe(false);
    expect(out.underwrite.zoningTier.code).toBe("6"); // 100 ft depth: no laneway suite
  });

  it("routes a non-Toronto listing to outside_coverage instead of throwing", async () => {
    state.listing = { ...LOGAN, City: "Mississauga" };
    const out = await executeMultiplexUnderwriter({ mlsNumber: "E9876543" }, { persist: false });
    expect(out.status).toBe("outside_coverage");
    if (out.status !== "outside_coverage") return;
    expect(out.listing.city).toBe("Mississauga");
    expect(out.message).toMatch(/outside the City of Toronto/);
  });

  it("stops at needs_lot_dimensions when the listing has no lot data", async () => {
    state.listing = { ...LOGAN, LotFrontage: undefined, LotDepth: undefined, LotSizeDimensions: undefined };
    const out = await executeMultiplexUnderwriter({ mlsNumber: "E9876543" }, { persist: false });
    expect(out.status).toBe("needs_lot_dimensions");
    if (out.status !== "needs_lot_dimensions") return;
    expect(out.listing?.lot.source).toBe("none");
  });

  it("gives a verified 4+1 outside the sixplex wards", async () => {
    state.ward = { city: "Toronto", code: "3", name: "Etobicoke–Lakeshore" };
    const out = await executeMultiplexUnderwriter(
      { address: "10 Example St", lat: 43.6, lng: -79.5, lotFrontageFt: 30, lotDepthFt: 130, laneAccess: false },
      { persist: false },
    );
    expect(out.status).toBe("complete");
    if (out.status !== "complete") return;
    expect(out.underwrite.ward?.number).toBe(3);
    expect(out.underwrite.zoningTier.code).toBe("4+1");
    expect(out.underwrite.zoningTier.certainty).toBe("verified");
    expect(out.underwrite.maxUnitsAsOfRight).toBe(4);
  });
});

describe("getMultiplexDataHealth", () => {
  it("reports layer counts, ward detection mode, sixplex wards and feed status", async () => {
    const h = await getMultiplexDataHealth({ force: true });
    expect(h).toMatchObject({ zoningPolygons: 12_340, wards: 25, wardDetection: "verified", ddfIngestion: true });
    expect(h.sixplexWards).toEqual([4, 9, 10, 11, 12, 13, 14, 19, 23]);
  });
  it("falls back to the FSA heuristic label when the wards layer is empty", async () => {
    state.counts = { ...state.counts, wards: 0 };
    state.ddfConfigured = false;
    const h = await getMultiplexDataHealth({ force: true });
    expect(h.wardDetection).toBe("inferred_fsa_fallback");
    expect(h.ddfIngestion).toBe(false);
    state.counts = { ...state.counts, wards: 25 };
  });
});
