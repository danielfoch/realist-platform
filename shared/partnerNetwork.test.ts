import { describe, expect, it } from "vitest";
import {
  NETWORK_PARTNER_TYPES,
  PARTNER_NETWORK_AGREEMENT_VERSION,
  REAL_ESTATE_BOARDS,
  REFERRAL_TERMS,
  buildReferralAgreement,
  getReferralTerms,
  isNetworkPartnerType,
} from "./partnerNetwork";

describe("referral terms", () => {
  it("realtors owe 25% to Daniel Foch at Valery Real Estate Inc.", () => {
    const terms = getReferralTerms("realtor");
    expect(terms.feePercent).toBe(25);
    expect(terms.payeeName).toBe("Daniel Foch");
    expect(terms.payeeCompany).toBe("Valery Real Estate Inc.");
    expect(terms.monthlyFee).toBe(0);
  });

  it("mortgage brokers owe 50% to Nick Hill at BLD Financial", () => {
    const terms = getReferralTerms("mortgage_broker");
    expect(terms.feePercent).toBe(50);
    expect(terms.payeeName).toBe("Nick Hill");
    expect(terms.payeeCompany).toBe("BLD Financial");
    expect(terms.monthlyFee).toBe(0);
  });

  it("every network partner type has terms", () => {
    for (const type of NETWORK_PARTNER_TYPES) {
      expect(REFERRAL_TERMS[type].partnerType).toBe(type);
    }
  });

  it("type guard accepts only network partner types", () => {
    expect(isNetworkPartnerType("realtor")).toBe(true);
    expect(isNetworkPartnerType("mortgage_broker")).toBe(true);
    expect(isNetworkPartnerType("lawyer")).toBe(false);
    expect(isNetworkPartnerType("")).toBe(false);
    expect(isNetworkPartnerType(null)).toBe(false);
  });
});

describe("buildReferralAgreement", () => {
  const base = {
    signedName: "Jane Agent",
    brokerageName: "Acme Realty",
    marketCity: "Hamilton",
    marketRegion: "Ontario",
    signedAtIso: "2026-06-12T15:30:00.000Z",
  };

  it("realtor agreement names the payee, fee, market, and no-monthly-fee clause", () => {
    const agreement = buildReferralAgreement({
      ...base,
      partnerType: "realtor",
      realEstateBoard: "Cornerstone Association of REALTORS® (Hamilton/Waterloo)",
      licenseNumber: "4751234",
    });
    expect(agreement.version).toBe(PARTNER_NETWORK_AGREEMENT_VERSION);
    expect(agreement.text).toContain("25% of the gross commission");
    expect(agreement.text).toContain("Daniel Foch, Valery Real Estate Inc.");
    expect(agreement.text).toContain("Hamilton, Ontario");
    expect(agreement.text).toContain("no monthly fees");
    expect(agreement.text).toContain("Cornerstone Association");
    expect(agreement.text).toContain("license #4751234");
    expect(agreement.text).toContain("Signed electronically by Jane Agent on 2026-06-12");
  });

  it("mortgage broker agreement uses funded-deal language and BLD Financial", () => {
    const agreement = buildReferralAgreement({
      ...base,
      partnerType: "mortgage_broker",
      brokerageName: "North Lending Co.",
    });
    expect(agreement.text).toContain("50% of the gross compensation");
    expect(agreement.text).toContain("Nick Hill, BLD Financial");
    expect(agreement.text).toContain("transaction funds");
    expect(agreement.text).not.toContain("member of");
  });

  it("omits empty optional identity fields", () => {
    const agreement = buildReferralAgreement({
      ...base,
      partnerType: "realtor",
      realEstateBoard: null,
      licenseNumber: null,
    });
    expect(agreement.text).not.toContain("license #");
    expect(agreement.text).not.toContain("member of");
  });
});

describe("real estate boards", () => {
  it("includes the major Canadian boards and an escape hatch", () => {
    expect(REAL_ESTATE_BOARDS).toContain("Toronto Regional Real Estate Board (TRREB)");
    expect(REAL_ESTATE_BOARDS).toContain("Calgary Real Estate Board (CREB)");
    expect(REAL_ESTATE_BOARDS[REAL_ESTATE_BOARDS.length - 1]).toBe("Other / Not listed");
    expect(new Set(REAL_ESTATE_BOARDS).size).toBe(REAL_ESTATE_BOARDS.length);
  });
});
