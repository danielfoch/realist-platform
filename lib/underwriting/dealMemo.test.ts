import { describe, expect, it } from "vitest";
import { sensitivities, templateMemo } from "./dealMemo";
import { houseDefaults, underwrite } from "./underwriter";

const negativeCarry = houseDefaults({ price: 899_000, units: 3, monthlyRent: 6200, annualPropertyTax: 6100 });
const pencils = houseDefaults({ price: 600_000, units: 3, monthlyRent: 6200, annualPropertyTax: 6100 });

describe("sensitivities", () => {
  it("answers the questions a lender asks", () => {
    const what = sensitivities(negativeCarry);
    expect(what.cashFlowRatePlus1!).toBeLessThan(underwrite(negativeCarry).monthlyCashFlow!);
    expect(what.cashFlowRentMinus10!).toBeLessThan(underwrite(negativeCarry).monthlyCashFlow!);
    expect(what.pricePerUnit).toBe(299_667);
    expect(what.rentToPricePercent).toBe(0.69);
    // Break-even rent really is break-even: a little less goes negative.
    const rent = what.breakEvenRent!;
    expect(underwrite({ ...negativeCarry, monthlyRent: rent }).monthlyCashFlow!).toBeGreaterThanOrEqual(0);
    expect(underwrite({ ...negativeCarry, monthlyRent: rent - 20 }).monthlyCashFlow!).toBeLessThan(0);
    expect(rent).toBeGreaterThan(negativeCarry.monthlyRent);
  });
});

describe("templateMemo", () => {
  it("tells someone plainly when a deal only works at a lower price", () => {
    const memo = templateMemo({ city: "Toronto", propertyType: "Triplex", rentSourceLabel: "Rent comps", taxFromListing: true }, negativeCarry);
    expect(memo.headline).toBe("It works at a lower price.");
    expect(memo.watch.join(" ")).toMatch(/Negative carry/);
    expect(memo.watch.join(" ")).toMatch(/estimate \(rent comps\)/);
    expect(memo.offer.breakEven!).toBeLessThan(negativeCarry.price);
    expect(memo.offer.lenderReady!).toBeLessThan(memo.offer.breakEven!);
    expect(memo.offer.line).toMatch(/^Break-even is \$/);
  });

  it("recognises a deal that pencils, and says why", () => {
    const memo = templateMemo({ city: "Hamilton", rentSourceLabel: "Actual rent", yearBuilt: 1924 }, pencils);
    expect(memo.headline).toBe("This one pencils.");
    expect(memo.working.join(" ")).toMatch(/carries itself/);
    expect(memo.working.join(" ")).toMatch(/reported actual rent/);
    expect(memo.beforeYouOffer.join(" ")).toMatch(/Built 1924.*knob-and-tube/);
    expect(memo.beforeYouOffer[0]).toMatch(/rent roll/);
  });

  it("calls out optimistic inputs the person chose", () => {
    const memo = templateMemo({ taxFromListing: false, rentEdited: true }, { ...pencils, managementPercent: 0, vacancyPercent: 1, annualAppreciationPercent: 9 });
    const watch = memo.watch.join(" ");
    expect(watch).toMatch(/management at zero/);
    expect(watch).toMatch(/Vacancy at 1%/);
    expect(watch).toMatch(/inferred at 1% of price/);
    expect(watch).toMatch(/Most of the .* IRR is appreciation/);
  });

  it("never states a figure the engine didn't produce", () => {
    const memo = templateMemo({ city: "Toronto", rentSourceLabel: "Rent comps" }, negativeCarry);
    const result = underwrite(negativeCarry);
    expect(memo.summary).toContain(`${result.capRate?.toFixed(1)}% cap rate`);
    expect(memo.summary).toContain("$899,000");
  });
});
