import { describe, expect, it } from "vitest";
import {
  analysisQuality,
  clampInputs,
  editedFields,
  houseDefaults,
  readTheDeal,
  solveOfferPrice,
  underwrite,
} from "./underwriter";

const facts = { price: 899_000, units: 3, monthlyRent: 6200, annualPropertyTax: 6100 };

describe("houseDefaults", () => {
  it("opens on the facts we have and sensible values for the rest", () => {
    const inputs = houseDefaults(facts);
    expect(inputs).toMatchObject({ price: 899_000, monthlyRent: 6200, units: 3, downPaymentPercent: 20, interestRate: 5.5, vacancyPercent: 5 });
    expect(inputs.annualPropertyTax).toBe(6100);
    expect(inputs.closingCosts).toBe(17_980);
  });

  it("estimates tax at 1% when the listing doesn't report it", () => {
    expect(houseDefaults({ price: 500_000 }).annualPropertyTax).toBe(5000);
  });

  it("starts from what the market has taught, where there is evidence", () => {
    const inputs = houseDefaults(facts, { vacancyPercent: { value: 3.5, sampleSize: 41, scopeLabel: "Hamilton" } });
    expect(inputs.vacancyPercent).toBe(3.5);
    expect(inputs.managementPercent).toBe(8);
  });
});

describe("editedFields", () => {
  it("reports exactly what the person changed", () => {
    const defaults = houseDefaults(facts);
    expect(editedFields(defaults, defaults)).toEqual([]);
    expect(editedFields(defaults, { ...defaults, monthlyRent: 6600, vacancyPercent: 3 })).toEqual(["monthlyRent", "vacancyPercent"]);
  });
});

describe("solveOfferPrice", () => {
  const inputs = houseDefaults(facts);

  it("finds the price where the deal stops costing money each month", () => {
    expect(underwrite(inputs).monthlyCashFlow!).toBeLessThan(0);
    const offer = solveOfferPrice(inputs, { metric: "cash_flow", value: 0 })!;
    expect(offer).toBeLessThan(inputs.price);
    const at = underwrite({ ...inputs, price: offer, closingCosts: (inputs.closingCosts * offer) / inputs.price, annualInsurance: (inputs.annualInsurance * offer) / inputs.price });
    expect(at.monthlyCashFlow!).toBeGreaterThanOrEqual(0);
    // …and it is the HIGHEST such price: a bit more and it goes negative again.
    const above = offer + 2000;
    const over = underwrite({ ...inputs, price: above, closingCosts: (inputs.closingCosts * above) / inputs.price, annualInsurance: (inputs.annualInsurance * above) / inputs.price });
    expect(over.monthlyCashFlow!).toBeLessThan(0);
  });

  it("solves for a lender's coverage test and a target return", () => {
    const forDscr = solveOfferPrice(inputs, { metric: "dscr", value: 1.2 })!;
    const forCashFlow = solveOfferPrice(inputs, { metric: "cash_flow", value: 0 })!;
    expect(forDscr).toBeLessThan(forCashFlow);
    expect(solveOfferPrice(inputs, { metric: "cap_rate", value: 6 })!).toBeLessThan(inputs.price);
  });

  it("says so when no price gets there", () => {
    expect(solveOfferPrice({ ...inputs, monthlyRent: 0 }, { metric: "cash_flow", value: 0 })).toBeNull();
    expect(solveOfferPrice(inputs, { metric: "cap_rate", value: 500 })).toBeNull();
  });
});

describe("readTheDeal", () => {
  it("speaks plainly about negative carry, thin deals and good ones", () => {
    const inputs = houseDefaults(facts);
    expect(readTheDeal(underwrite(inputs))).toMatchObject({ tone: "bad" });
    expect(readTheDeal(underwrite(inputs)).headline).toMatch(/^You'd feed it \$/);
    expect(readTheDeal(underwrite({ ...inputs, price: 600_000, closingCosts: 12_000 }))).toMatchObject({ tone: "good" });
    expect(readTheDeal(underwrite({ ...inputs, monthlyRent: 0 })).tone).toBe("neutral");
  });
});

describe("analysisQuality", () => {
  it("counts plausible, complete work — and rewards depth", () => {
    const inputs = houseDefaults(facts);
    const result = underwrite(inputs);
    // A call on untouched numbers is a glance; working the deal is what scores.
    expect(analysisQuality(result, [])).toEqual({ score: 0.25, eligible: true });
    expect(analysisQuality(result, ["monthlyRent"])).toEqual({ score: 0.7, eligible: true });
    expect(analysisQuality(result, ["monthlyRent", "vacancyPercent", "interestRate"])).toEqual({ score: 1, eligible: true });
  });

  it("refuses fantasy numbers and empty shells", () => {
    const fantasy = underwrite({ ...houseDefaults(facts), monthlyRent: 90_000 });
    expect(analysisQuality(fantasy, ["monthlyRent"]).eligible).toBe(false);
    expect(analysisQuality(underwrite({ ...houseDefaults(facts), monthlyRent: 0 }), []).eligible).toBe(false);
  });
});

describe("clampInputs", () => {
  it("accepts a real analysis and rejects anything malformed or out of range", () => {
    const inputs = houseDefaults(facts);
    expect(clampInputs({ ...inputs })).toEqual(inputs);
    expect(clampInputs({ ...inputs, interestRate: 400 })).toBeNull();
    expect(clampInputs({ ...inputs, price: "lots" })).toBeNull();
    const missing: Record<string, unknown> = { ...inputs };
    delete missing.vacancyPercent;
    expect(clampInputs(missing)).toBeNull();
  });
});

describe("learned rent adjustment", () => {
  const learned = { rentVsEstimate: { value: 0.93, sampleSize: 23, scopeLabel: "Hamilton" } };

  it("moves OUR estimate to where the market's investors land", () => {
    const inputs = houseDefaults({ price: 700_000, monthlyRent: 5000, rentIsEstimate: true }, learned);
    expect(inputs.monthlyRent).toBe(4650);
  });

  it("never touches a rent the building actually reports", () => {
    expect(houseDefaults({ price: 700_000, monthlyRent: 5000, rentIsEstimate: false }, learned).monthlyRent).toBe(5000);
    expect(houseDefaults({ price: 700_000, monthlyRent: 5000 }, learned).monthlyRent).toBe(5000);
  });

  it("ignores a ratio outside sane bounds", () => {
    const wild = { rentVsEstimate: { value: 0.3, sampleSize: 9, scopeLabel: "Nowhere" } };
    expect(houseDefaults({ price: 700_000, monthlyRent: 5000, rentIsEstimate: true }, wild).monthlyRent).toBe(5000);
  });
});
