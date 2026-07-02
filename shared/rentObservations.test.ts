import { describe, expect, it } from "vitest";
import {
  ddfLeaseToRentObservation,
  ddfLeaseExternalId,
  type DdfLeaseListing,
} from "./rentObservations";

const BASE: DdfLeaseListing = {
  ListingKey: "X1234567",
  ListPrice: 2350,
  TransactionType: "For rent",
  PropertySubType: "Apartment",
  BedroomsTotal: 2,
  BathroomsTotalInteger: 1,
  LivingArea: 850,
  LivingAreaUnits: "square feet",
  UnparsedAddress: "101-55 King St W, Hamilton, ON L8P 1A1",
  City: "Hamilton",
  StateOrProvince: "Ontario",
  Latitude: 43.2557,
  Longitude: -79.8711,
  OriginalEntryTimestamp: "2026-05-20T14:00:00Z",
};

describe("ddfLeaseToRentObservation", () => {
  it("maps a residential lease listing to a rent observation", () => {
    const row = ddfLeaseToRentObservation(BASE)!;
    expect(row).toMatchObject({
      externalId: "ddf-lease:X1234567",
      city: "Hamilton",
      province: "Ontario",
      bedrooms: "2",
      bathrooms: "1",
      rent: 2350,
      squareFootage: 850,
      lat: 43.2557,
      lng: -79.8711,
      sourcePlatform: "crea_ddf",
    });
    expect(row.listingDate?.toISOString()).toBe("2026-05-20T14:00:00.000Z");
  });

  it("converts metric living area to square feet", () => {
    const row = ddfLeaseToRentObservation({ ...BASE, LivingArea: 80, LivingAreaUnits: "square metres" })!;
    expect(row.squareFootage).toBe(861);
  });

  it("keeps bachelor units (0 bedrooms)", () => {
    const row = ddfLeaseToRentObservation({ ...BASE, BedroomsTotal: 0 })!;
    expect(row.bedrooms).toBe("0");
  });

  it("rejects non-residential subtypes", () => {
    for (const subType of ["Commercial Mix", "Retail", "Offices", "Parking", "Industrial", "Warehouse"]) {
      expect(ddfLeaseToRentObservation({ ...BASE, PropertySubType: subType })).toBeNull();
    }
  });

  it("rejects prices outside the monthly-rent sanity band", () => {
    expect(ddfLeaseToRentObservation({ ...BASE, ListPrice: 35 })).toBeNull(); // per-sqft / daily
    expect(ddfLeaseToRentObservation({ ...BASE, ListPrice: 250000 })).toBeNull(); // annual commercial
    expect(ddfLeaseToRentObservation({ ...BASE, ListPrice: undefined })).toBeNull();
  });

  it("rejects listings missing location or bedrooms", () => {
    expect(ddfLeaseToRentObservation({ ...BASE, City: undefined })).toBeNull();
    expect(ddfLeaseToRentObservation({ ...BASE, StateOrProvince: undefined })).toBeNull();
    expect(ddfLeaseToRentObservation({ ...BASE, BedroomsTotal: undefined })).toBeNull();
  });

  it("tolerates missing optional fields", () => {
    const row = ddfLeaseToRentObservation({
      ListingKey: "Y1",
      ListPrice: 1800,
      BedroomsTotal: 1,
      City: "Halifax",
      StateOrProvince: "Nova Scotia",
    })!;
    expect(row.address).toBeNull();
    expect(row.bathrooms).toBeNull();
    expect(row.squareFootage).toBeNull();
    expect(row.lat).toBeNull();
    expect(row.listingDate).toBeNull();
  });

  it("rounds fractional rents", () => {
    expect(ddfLeaseToRentObservation({ ...BASE, ListPrice: 2349.5 })!.rent).toBe(2350);
  });
});

describe("ddfLeaseExternalId", () => {
  it("namespaces the listing key", () => {
    expect(ddfLeaseExternalId("ABC")).toBe("ddf-lease:ABC");
  });
});
