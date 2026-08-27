import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DdfListing } from "@/lib/ddf/client";
import {
  rentSourceLabel,
  underwriteDdfListing,
  underwriteFromSnapshot,
  type RentMemo,
} from "./underwriteListing";
import { calculateListingYield } from "./investmentMetrics";

vi.mock("@/lib/rents/estimator", () => ({
  getRentEstimate: vi.fn(),
}));

import { getRentEstimate } from "@/lib/rents/estimator";
const mockedGetRentEstimate = vi.mocked(getRentEstimate);

function listing(overrides: Partial<DdfListing> = {}): DdfListing {
  return {
    ListingKey: "K1",
    ListingId: "X100",
    ListPrice: 600000,
    BedroomsTotal: 2,
    City: "Toronto",
    StateOrProvince: "Ontario",
    PropertySubType: "Single Family",
    TaxAnnualAmount: 4800,
    ...overrides,
  };
}

beforeEach(() => {
  mockedGetRentEstimate.mockReset();
  mockedGetRentEstimate.mockResolvedValue(null);
});

describe("rentSourceLabel", () => {
  it("labels every ladder rung", () => {
    expect(rentSourceLabel("ddf_actual")).toBe("Actual rent");
    expect(rentSourceLabel("comps_radius")).toBe("Rent comps");
    expect(rentSourceLabel("city_comps")).toBe("Rent comps");
    expect(rentSourceLabel("city_aggregate")).toBe("City median");
    expect(rentSourceLabel("cmhc_city")).toBe("CMHC average");
    expect(rentSourceLabel("snapshot")).toBe("Recent snapshot");
    expect(rentSourceLabel("default")).toBe("Estimate");
  });
});

describe("underwriteDdfListing", () => {
  it("uses the listing's actual rent when present", async () => {
    const result = await underwriteDdfListing(listing({ TotalActualRent: 3200 }));
    expect(result).not.toBeNull();
    expect(result!.estimatedRent).toBe(3200);
    expect(result!.rentSource).toBe("ddf_actual");
    expect(mockedGetRentEstimate).not.toHaveBeenCalled();
  });

  it("falls to the comp estimator, then matches the engine's yields exactly", async () => {
    mockedGetRentEstimate.mockResolvedValue({
      monthlyRent: 2800,
      method: "comps_radius",
    } as Awaited<ReturnType<typeof getRentEstimate>>);

    const subject = listing();
    const result = await underwriteDdfListing(subject);
    expect(result).not.toBeNull();
    expect(result!.rentSource).toBe("comps_radius");

    const engine = calculateListingYield(600000, 2800, 4800, 0);
    expect(result!.grossYield).toBe(engine.grossYield);
    expect(result!.netYield).toBe(engine.netYield);
    expect(result!.noi).toBe(engine.estimatedNoi);
    expect(result!.cashFlowMonthly).not.toBeNull();
  });

  it("falls to the CMHC baseline when the estimator has nothing", async () => {
    const result = await underwriteDdfListing(listing());
    expect(result).not.toBeNull();
    expect(result!.rentSource).toBe("cmhc_city");
    expect(result!.estimatedRent).toBe(2400); // Toronto 2-bed CMHC average
  });

  it("survives an estimator failure and keeps descending the ladder", async () => {
    mockedGetRentEstimate.mockRejectedValue(new Error("db unreachable"));
    const result = await underwriteDdfListing(listing());
    expect(result).not.toBeNull();
    expect(result!.rentSource).toBe("cmhc_city");
  });

  it("memoizes estimator calls per province×city×beds×units", async () => {
    mockedGetRentEstimate.mockResolvedValue({
      monthlyRent: 2500,
      method: "city_comps",
    } as Awaited<ReturnType<typeof getRentEstimate>>);

    const memo: RentMemo = new Map();
    await underwriteDdfListing(listing({ ListingKey: "A" }), memo);
    await underwriteDdfListing(listing({ ListingKey: "B" }), memo);
    expect(mockedGetRentEstimate).toHaveBeenCalledTimes(1);
  });

  it("returns null for price-less and vacant-land-like listings", async () => {
    expect(await underwriteDdfListing(listing({ ListPrice: undefined }))).toBeNull();
    expect(
      await underwriteDdfListing(listing({ PropertySubType: "Vacant Land" })),
    ).toBeNull();
  });
});

describe("underwriteFromSnapshot", () => {
  it("keeps stored yields and re-derives cash flow through the engine", () => {
    const result = underwriteFromSnapshot({
      listPrice: "600000",
      estimatedMonthlyRent: "2800",
      grossYield: "5.6",
      netYield: "3.1",
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedRent).toBe(2800);
    expect(result!.grossYield).toBe(5.6);
    expect(result!.netYield).toBe(3.1);
    expect(result!.rentSource).toBe("snapshot");
    expect(result!.cashFlowMonthly).not.toBeNull();
  });

  it("returns null without a usable price or rent", () => {
    expect(underwriteFromSnapshot({ listPrice: null, estimatedMonthlyRent: 2000, grossYield: null, netYield: null })).toBeNull();
    expect(underwriteFromSnapshot({ listPrice: 500000, estimatedMonthlyRent: 0, grossYield: null, netYield: null })).toBeNull();
  });
});
