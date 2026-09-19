import { describe, expect, it } from "vitest";
import { MIN_PURSUED, describeBuyBox, fitsBuyBox, learnBuyBox, type ThesisExample } from "./thesis";

const call = (verdict: ThesisExample["verdict"], city: string, price: number, units: number, capRate: number, monthlyCashFlow: number): ThesisExample => ({
  verdict, city, province: "ON", price, units, capRate, monthlyCashFlow, downPaymentPercent: 25,
});

const history: ThesisExample[] = [
  call("pursue", "Hamilton", 640_000, 3, 6.5, 360),
  call("pursue", "Hamilton", 710_000, 3, 6.1, 120),
  call("pursue", "St. Catharines", 585_000, 2, 6.9, 410),
  call("pursue", "Hamilton", 760_000, 4, 5.9, -150),
  call("watch", "Hamilton", 690_000, 3, 5.4, -90),
  call("pass", "Toronto", 1_250_000, 3, 3.9, -2100),
  call("pass", "Hamilton", 820_000, 2, 4.6, -900),
  call("pass", "Hamilton", 899_000, 3, 4.8, -700),
  { ...call("pursue", "Toronto", 1_900_000, 6, 0, 0), source: "multiplex" },
  { ...call(null, "Oshawa", 500_000, 1, 5, 0) },
];

describe("learnBuyBox", () => {
  it("waits for a pattern before claiming one", () => {
    expect(learnBuyBox(history.filter((example) => example.verdict !== "pursue"))).toBeNull();
    expect(learnBuyBox(history.slice(0, MIN_PURSUED - 1))).toBeNull();
  });

  it("finds where they look, what they pay, and the return that turns a no into a yes", () => {
    const box = learnBuyBox(history)!;
    expect(box).toMatchObject({ calls: 8, pursued: 4, unitsLow: 2, unitsHigh: 4, typicalDownPercent: 25 });
    expect(box.markets.map((market) => market.city)).toEqual(["Hamilton", "St. Catharines"]);
    // The middle half of what they'd pay — the $1.25M they passed on doesn't stretch it.
    expect(box.priceLow).toBe(640_000);
    expect(box.priceHigh).toBe(710_000);
    // They say yes from about 6%, and have passed around 4.6%.
    expect(box.minCapRate).toBe(6.1);
    expect(box.passedAtCapRate).toBe(4.6);
    // The worst carry they still said yes to.
    expect(box.carryFloor).toBe(-150);
  });

  it("ignores multiplex sites (a different kind of deal) and analyses with no call", () => {
    const box = learnBuyBox(history)!;
    expect(box.markets.some((market) => market.city === "Toronto")).toBe(false);
    expect(box.markets.some((market) => market.city === "Oshawa")).toBe(false);
  });
});

describe("describeBuyBox", () => {
  it("reads like the person describing themselves", () => {
    expect(describeBuyBox(learnBuyBox(history)!)).toBe(
      "You pursue 2–4 unit properties in Hamilton and St. Catharines, between $640K and $710K, at a cap rate of 6.1% or better. You pass around 4.6%. You'll carry up to $150 a month for the right one.",
    );
  });

  it("notices someone who never buys negative carry", () => {
    const strict = learnBuyBox(history.map((example) => (example.monthlyCashFlow != null && example.verdict === "pursue" ? { ...example, monthlyCashFlow: Math.abs(example.monthlyCashFlow) } : example)))!;
    expect(describeBuyBox(strict)).toMatch(/You don't buy negative carry\.$/);
  });
});

describe("fitsBuyBox", () => {
  const box = learnBuyBox(history)!;
  it("suggests generously at the edges, and never outside the market", () => {
    expect(fitsBuyBox(box, { city: "Hamilton", price: 675_000, units: 3, netYield: 6.4 })).toBe(true);
    expect(fitsBuyBox(box, { city: "hamilton", price: 800_000, units: 4, netYield: 5.7 })).toBe(true);
    expect(fitsBuyBox(box, { city: "Hamilton", price: 675_000, units: 3, netYield: 4.9 })).toBe(false);
    expect(fitsBuyBox(box, { city: "Hamilton", price: 1_200_000, units: 3, netYield: 7 })).toBe(false);
    expect(fitsBuyBox(box, { city: "Calgary", price: 675_000, units: 3, netYield: 7 })).toBe(false);
    expect(fitsBuyBox(box, { city: "Hamilton", price: 675_000, units: 12, netYield: 7 })).toBe(false);
  });
});

describe("describeBuyBox for the agent", () => {
  it("talks about the member, not to them", () => {
    const sentence = describeBuyBox(learnBuyBox(history)!, "agent");
    expect(sentence).toMatch(/^Pursues 2–4 unit properties in Hamilton and St\. Catharines/);
    expect(sentence).toContain("Passes around 4.6%.");
    expect(sentence).toContain("Will carry up to $150 a month");
    expect(sentence).not.toMatch(/\bYou\b/);
  });
});
