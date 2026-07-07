import { describe, expect, it } from "vitest";
import {
  getLeadRoutingChannel,
  isValeryTorontoServiceZone,
  shouldNotifyPartnerClaims,
} from "./referralRoutingPolicy";

describe("referral routing policy", () => {
  it("keeps Toronto-drive-zone Ontario leads with Valery", () => {
    expect(getLeadRoutingChannel({ city: "Toronto", region: "Ontario" })).toBe("valery");
    expect(getLeadRoutingChannel({ city: "Hamilton", region: "ON" })).toBe("valery");
    expect(isValeryTorontoServiceZone("Oshawa", "Ontario")).toBe(true);
    expect(shouldNotifyPartnerClaims({ city: "Mississauga", region: "Ontario" })).toBe(false);
  });

  it("routes out-of-province leads to partner referrals", () => {
    expect(getLeadRoutingChannel({ city: "Calgary", region: "Alberta" })).toBe("partner_referral");
    expect(getLeadRoutingChannel({ city: "Vancouver", region: "British Columbia" })).toBe("partner_referral");
    expect(shouldNotifyPartnerClaims({ city: "Montreal", region: "Quebec" })).toBe(true);
  });

  it("holds Ontario outside the explicit Valery zone for manual review", () => {
    expect(getLeadRoutingChannel({ city: "Ottawa", region: "Ontario" })).toBe("manual_review");
    expect(shouldNotifyPartnerClaims({ city: "Ottawa", region: "Ontario" })).toBe(false);
  });

  it("holds missing province data for manual review", () => {
    expect(getLeadRoutingChannel({ city: "Halifax", region: "" })).toBe("manual_review");
    expect(shouldNotifyPartnerClaims({ city: "Halifax", region: null })).toBe(false);
  });
});
