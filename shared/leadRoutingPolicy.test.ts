import { describe, expect, it } from "vitest";
import {
  IN_HOUSE_BROKERAGE,
  IN_HOUSE_RADIUS_KM,
  isWithinInHouseRadius,
  normalizeCity,
  routeLead,
} from "./leadRoutingPolicy";

describe("in-house radius", () => {
  it("Toronto is in-house", () => {
    expect(isWithinInHouseRadius(43.6532, -79.3832)).toBe(true);
  });

  it("Hamilton is in-house (~60 km)", () => {
    expect(isWithinInHouseRadius(43.2557, -79.8711)).toBe(true);
  });

  it("Barrie is in-house (~90 km)", () => {
    expect(isWithinInHouseRadius(44.3894, -79.6903)).toBe(true);
  });

  it("Ottawa is a referral (~350 km)", () => {
    expect(isWithinInHouseRadius(45.4215, -75.6972)).toBe(false);
  });

  it("London ON is a referral (~170 km)", () => {
    expect(isWithinInHouseRadius(42.9849, -81.2453)).toBe(false);
  });
});

describe("routeLead", () => {
  it("coordinates inside the radius go in-house to Valery", () => {
    const decision = routeLead({ lat: 43.7, lng: -79.4 });
    expect(decision.channel).toBe("in_house");
    expect(decision.reason).toContain(IN_HOUSE_BROKERAGE);
  });

  it("coordinates outside the radius go to a referral partner", () => {
    expect(routeLead({ lat: 49.2827, lng: -123.1207 }).channel).toBe("referral_partner"); // Vancouver
    expect(routeLead({ lat: 44.6488, lng: -63.5752 }).channel).toBe("referral_partner"); // Halifax
  });

  it("coordinates win over city names", () => {
    // Says Toronto, located in Calgary
    expect(routeLead({ lat: 51.0447, lng: -114.0719, city: "Toronto" }).channel).toBe("referral_partner");
  });

  it("known in-house city names route in-house without coordinates", () => {
    expect(routeLead({ city: "Toronto", province: "Ontario" }).channel).toBe("in_house");
    expect(routeLead({ city: "  KITCHENER " }).channel).toBe("in_house");
  });

  it("Ontario cities outside the zone are referrals", () => {
    expect(routeLead({ city: "Ottawa", province: "Ontario" }).channel).toBe("referral_partner");
    expect(routeLead({ city: "Sudbury", province: "Ontario" }).channel).toBe("referral_partner");
  });

  it("out-of-province leads are referrals", () => {
    expect(routeLead({ city: "Moncton", province: "New Brunswick" }).channel).toBe("referral_partner");
    expect(routeLead({ province: "Alberta" }).channel).toBe("referral_partner");
  });

  it("unknown locations default to referral", () => {
    expect(routeLead({}).channel).toBe("referral_partner");
  });

  it("radius constant matches the 2-hour-drive decision", () => {
    expect(IN_HOUSE_RADIUS_KM).toBe(160);
  });

  it("normalizeCity collapses case and whitespace", () => {
    expect(normalizeCity("  St.  Catharines ")).toBe("st. catharines");
  });
});
