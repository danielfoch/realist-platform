import { describe, expect, it } from "vitest";
import {
  areComplementaryRoles,
  createJvListingSchema,
  findJvListingMatches,
  isJvListingMatch,
  jvInvestmentRangesOverlap,
  jvListingSearchSchema,
  jvLocationsOverlap,
} from "./jvPartnerMatching";
import { insertJvPartnerListingSchema, insertJvPartnerMatchSchema, type JvPartnerListing } from "./schema";

function makeListing(overrides: Partial<JvPartnerListing>): JvPartnerListing {
  return {
    id: "listing-1",
    userId: "user-1",
    title: "Test listing",
    description: null,
    partnerRoleOffered: "land",
    city: "Toronto",
    province: "ON",
    investmentMin: null,
    investmentMax: null,
    status: "active",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("areComplementaryRoles", () => {
  it("matches land with capital and development", () => {
    expect(areComplementaryRoles("land", "capital")).toBe(true);
    expect(areComplementaryRoles("land", "development")).toBe(true);
  });

  it("is symmetric for land/capital", () => {
    expect(areComplementaryRoles("capital", "land")).toBe(true);
  });

  it("connects realtors with every role", () => {
    expect(areComplementaryRoles("realtor", "gc")).toBe(true);
    expect(areComplementaryRoles("gc", "realtor")).toBe(true);
  });

  it("does not match a role with itself", () => {
    expect(areComplementaryRoles("capital", "capital")).toBe(false);
    expect(areComplementaryRoles("land", "land")).toBe(false);
  });

  it("rejects unknown roles", () => {
    expect(areComplementaryRoles("unknown", "land")).toBe(false);
  });
});

describe("jvLocationsOverlap", () => {
  it("matches on the same province", () => {
    expect(jvLocationsOverlap(
      { city: "Toronto", province: "ON" },
      { city: "Ottawa", province: "ON" },
    )).toBe(true);
  });

  it("normalizes case and whitespace", () => {
    expect(jvLocationsOverlap(
      { city: " toronto ", province: "on" },
      { city: "Ottawa", province: " ON " },
    )).toBe(true);
  });

  it("does not match different provinces", () => {
    expect(jvLocationsOverlap(
      { city: "Toronto", province: "ON" },
      { city: "Vancouver", province: "BC" },
    )).toBe(false);
  });

  it("falls back to city when a province is missing", () => {
    expect(jvLocationsOverlap(
      { city: "Toronto", province: null },
      { city: "Toronto", province: "ON" },
    )).toBe(true);
  });

  it("does not match when nothing overlaps", () => {
    expect(jvLocationsOverlap(
      { city: null, province: null },
      { city: "Toronto", province: "ON" },
    )).toBe(false);
  });
});

describe("jvInvestmentRangesOverlap", () => {
  it("treats missing ranges as open-ended", () => {
    expect(jvInvestmentRangesOverlap(
      { investmentMin: null, investmentMax: null },
      { investmentMin: 100000, investmentMax: 500000 },
    )).toBe(true);
  });

  it("matches overlapping ranges", () => {
    expect(jvInvestmentRangesOverlap(
      { investmentMin: 100000, investmentMax: 500000 },
      { investmentMin: 400000, investmentMax: 900000 },
    )).toBe(true);
  });

  it("matches touching ranges", () => {
    expect(jvInvestmentRangesOverlap(
      { investmentMin: 100000, investmentMax: 500000 },
      { investmentMin: 500000, investmentMax: 900000 },
    )).toBe(true);
  });

  it("rejects disjoint ranges", () => {
    expect(jvInvestmentRangesOverlap(
      { investmentMin: 100000, investmentMax: 200000 },
      { investmentMin: 500000, investmentMax: 900000 },
    )).toBe(false);
  });

  it("treats a one-sided bound as open-ended", () => {
    expect(jvInvestmentRangesOverlap(
      { investmentMin: 500000, investmentMax: null },
      { investmentMin: null, investmentMax: 600000 },
    )).toBe(true);
    expect(jvInvestmentRangesOverlap(
      { investmentMin: 700000, investmentMax: null },
      { investmentMin: null, investmentMax: 600000 },
    )).toBe(false);
  });
});

describe("findJvListingMatches", () => {
  const landListing = makeListing({ id: "land-1", userId: "owner-1", partnerRoleOffered: "land", province: "ON" });

  it("matches complementary roles in the same province", () => {
    const capital = makeListing({ id: "cap-1", userId: "owner-2", partnerRoleOffered: "capital", province: "ON" });
    expect(findJvListingMatches(landListing, [capital])).toEqual([capital]);
  });

  it("excludes the same listing and listings by the same owner", () => {
    const self = makeListing({ id: "land-1", userId: "owner-1", partnerRoleOffered: "capital" });
    const sameOwner = makeListing({ id: "cap-2", userId: "owner-1", partnerRoleOffered: "capital" });
    expect(findJvListingMatches(landListing, [self, sameOwner])).toEqual([]);
  });

  it("excludes closed listings", () => {
    const closed = makeListing({ id: "cap-3", userId: "owner-2", partnerRoleOffered: "capital", status: "closed" });
    expect(isJvListingMatch(landListing, closed)).toBe(false);
  });

  it("excludes listings in other provinces", () => {
    const bc = makeListing({ id: "cap-4", userId: "owner-2", partnerRoleOffered: "capital", province: "BC" });
    expect(findJvListingMatches(landListing, [bc])).toEqual([]);
  });

  it("excludes listings with disjoint investment ranges", () => {
    const rich = makeListing({
      id: "cap-5",
      userId: "owner-2",
      partnerRoleOffered: "capital",
      investmentMin: 5000000,
      investmentMax: 10000000,
    });
    const smallLand = { ...landListing, investmentMin: 100000, investmentMax: 500000 };
    expect(findJvListingMatches(smallLand, [rich])).toEqual([]);
  });
});

describe("createJvListingSchema", () => {
  it("accepts a minimal valid listing", () => {
    const parsed = createJvListingSchema.parse({ title: "Land in Durham", partnerRoleOffered: "land" });
    expect(parsed.title).toBe("Land in Durham");
    expect(parsed.partnerRoleOffered).toBe("land");
  });

  it("rejects an invalid role", () => {
    expect(() => createJvListingSchema.parse({ title: "X", partnerRoleOffered: "money" })).toThrow();
  });

  it("rejects a missing title", () => {
    expect(() => createJvListingSchema.parse({ partnerRoleOffered: "land" })).toThrow();
    expect(() => createJvListingSchema.parse({ title: "  ", partnerRoleOffered: "land" })).toThrow();
  });

  it("rejects investmentMin greater than investmentMax", () => {
    expect(() => createJvListingSchema.parse({
      title: "Deal",
      partnerRoleOffered: "capital",
      investmentMin: 500000,
      investmentMax: 100000,
    })).toThrow();
  });

  it("rejects negative investment amounts", () => {
    expect(() => createJvListingSchema.parse({
      title: "Deal",
      partnerRoleOffered: "capital",
      investmentMin: -5,
    })).toThrow();
  });
});

describe("jvListingSearchSchema", () => {
  it("coerces numeric query params", () => {
    const parsed = jvListingSearchSchema.parse({ role: "capital", investmentMin: "100000" });
    expect(parsed.investmentMin).toBe(100000);
  });

  it("accepts an empty query", () => {
    expect(jvListingSearchSchema.parse({})).toEqual({});
  });
});

describe("insert schemas (drizzle-zod)", () => {
  it("validates a listing insert and omits generated fields", () => {
    const parsed = insertJvPartnerListingSchema.parse({
      userId: "user-1",
      title: "Capital partner",
      partnerRoleOffered: "capital",
      province: "ON",
    });
    expect(parsed.status).toBeUndefined();
    expect("id" in parsed).toBe(false);
    expect("createdAt" in parsed).toBe(false);
  });

  it("requires userId and title on listing insert", () => {
    expect(() => insertJvPartnerListingSchema.parse({ partnerRoleOffered: "capital" })).toThrow();
  });

  it("validates a match insert", () => {
    const parsed = insertJvPartnerMatchSchema.parse({
      listingId: "listing-1",
      matchedUserId: "user-2",
    });
    expect(parsed.matchType).toBeUndefined();
    expect("id" in parsed).toBe(false);
  });

  it("requires listingId and matchedUserId on match insert", () => {
    expect(() => insertJvPartnerMatchSchema.parse({ matchType: "auto" })).toThrow();
  });
});
