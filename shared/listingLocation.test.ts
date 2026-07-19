import { describe, expect, it } from "vitest";

import { isTorontoListingAddress } from "./listingLocation";

describe("isTorontoListingAddress", () => {
  it("recognizes Toronto and its former municipalities", () => {
    expect(isTorontoListingAddress({ city: "Toronto" })).toBe(true);
    expect(isTorontoListingAddress({ city: "Toronto C01" })).toBe(true);
    expect(isTorontoListingAddress({ city: "Etobicoke" })).toBe(true);
    expect(isTorontoListingAddress({ city: "Scarborough" })).toBe(true);
  });

  it("uses Toronto postal codes as a fallback", () => {
    expect(isTorontoListingAddress({ zip: "M5H 1A1" })).toBe(true);
  });

  it("does not match municipalities outside Toronto", () => {
    expect(isTorontoListingAddress({ city: "Mississauga", zip: "L5B 4M7" })).toBe(false);
    expect(isTorontoListingAddress({ city: "Vaughan" })).toBe(false);
  });
});
