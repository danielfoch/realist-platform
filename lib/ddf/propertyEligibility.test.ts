import { describe, expect, it } from "vitest";
import { hasRentableStructure, isVacantLandLikeProperty } from "./propertyEligibility";

describe("property eligibility", () => {
  it("flags vacant land-like property classifications", () => {
    expect(isVacantLandLikeProperty({ PropertySubType: "Vacant Land" })).toBe(true);
    expect(isVacantLandLikeProperty({ propertySubType: "Residential Lot" })).toBe(true);
    expect(isVacantLandLikeProperty({ StructureType: "No Building" })).toBe(true);
  });

  it("allows structured rental property classifications", () => {
    expect(isVacantLandLikeProperty({ PropertySubType: "Single Family", StructureType: "House" })).toBe(false);
    expect(hasRentableStructure({ propertyType: "Apartment", details: { propertyType: "Condo" } })).toBe(true);
  });

  it("detects land-only descriptions when the classification is vague", () => {
    expect(isVacantLandLikeProperty({ propertyType: "Other", publicRemarks: "Vacant lot ready for development." })).toBe(true);
  });
});
