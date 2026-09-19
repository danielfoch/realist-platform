import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { houseDefaults, solveOfferPrice, underwrite } from "@/lib/underwriting/underwriter";
import { askRealist, findUnbackedFigures, runTool, type AskContext, type MessagesClient } from "./askRealist";

const inputs = houseDefaults({ price: 899_000, units: 3, monthlyRent: 6200, annualPropertyTax: 6100, province: "ON", city: "Toronto" });
const context: AskContext = {
  deal: { address: "12 Main St, Toronto, ON", city: "Toronto", province: "ON", propertyType: "Triplex", rentSourceLabel: "Rent comps" },
  inputs,
  remarks: "Legal triplex, separately metered. Sold as-is, estate sale.",
  decisionLine: { pursueAt: 6.1, passAt: 4.7, calls: 23, scopeLabel: "Toronto" },
  buyBox: "You pursue 2–4 unit properties in Hamilton, between $640K and $710K, at a cap rate of 6.1% or better.",
};

const text = (value: string): Anthropic.Message => ({ content: [{ type: "text", text: value }], stop_reason: "end_turn" }) as unknown as Anthropic.Message;
const toolUse = (id: string, name: string, input: unknown): Anthropic.Message =>
  ({ content: [{ type: "tool_use", id, name, input }], stop_reason: "tool_use" }) as unknown as Anthropic.Message;

/** A model that says whatever the script says, and records what it was shown. */
function scripted(replies: Array<Anthropic.Message | ((seen: Anthropic.MessageParam[]) => Anthropic.Message)>) {
  const seen: Anthropic.MessageParam[][] = [];
  const client: MessagesClient = {
    messages: {
      create: async (body) => {
        seen.push(structuredClone(body.messages));
        const next = replies.shift();
        if (!next) throw new Error("script ran out");
        return typeof next === "function" ? next(body.messages) : next;
      },
    },
  };
  return { client, seen };
}

describe("runTool", () => {
  it("re-underwrites on the real engine, moving price-linked costs with the price", () => {
    const { result } = runTool("underwrite_scenario", { changes: { price: 800_000, downPaymentPercent: 30 }, label: "lower price, 30% down" }, context);
    const scenario = result as { results: { monthlyCashFlow: number }; assumptions: typeof inputs };
    const expected = underwrite({ ...inputs, price: 800_000, downPaymentPercent: 30, closingCosts: scenario.assumptions.closingCosts, annualInsurance: scenario.assumptions.annualInsurance });
    expect(scenario.results.monthlyCashFlow).toBe(expected.monthlyCashFlow);
    expect(scenario.assumptions.closingCosts).toBeLessThan(inputs.closingCosts);
  });

  it("refuses values outside what the underwriter itself allows", () => {
    const { result } = runTool("underwrite_scenario", { changes: { interestRate: 900, madeUpField: 3 } }, context);
    expect((result as { ignoredOutOfRange: string[] }).ignoredOutOfRange.sort()).toEqual(["interestRate", "madeUpField"]);
  });

  it("solves for an offer with the same solver the page uses", () => {
    const { result } = runTool("solve_offer_price", { metric: "cash_flow", value: 0 }, context);
    expect((result as { highestPriceMeetingTarget: number }).highestPriceMeetingTarget).toBe(solveOfferPrice(inputs, { metric: "cash_flow", value: 0 }));
  });

  it("reports results at the solved price that agree with the solve — break-even means break-even", () => {
    const { result } = runTool("solve_offer_price", { metric: "cash_flow", value: 0 }, context);
    const solved = result as { highestPriceMeetingTarget: number; atThatPrice: { monthlyCashFlow: number } };
    expect(solved.highestPriceMeetingTarget).toBeLessThan(inputs.price);
    expect(solved.atThatPrice.monthlyCashFlow).toBeGreaterThanOrEqual(0);
    expect(solved.atThatPrice.monthlyCashFlow).toBeLessThan(25);
    const coverage = runTool("solve_offer_price", { metric: "dscr", value: 1.2 }, context).result as { atThatPrice: { debtCoverage: number } };
    expect(coverage.atThatPrice.debtCoverage).toBeGreaterThanOrEqual(1.2);
  });

  it("hands over the market's decision line and the member's buy box", () => {
    const { result } = runTool("market_context", {}, context);
    expect(result).toMatchObject({ howThisMarketDecides: { pursueAt: 6.1 }, thisMembersBuyBox: context.buyBox });
  });
});

describe("askRealist", () => {
  it("answers from tool results: the model asks, the engine computes", async () => {
    const breakEven = solveOfferPrice(inputs, { metric: "cash_flow", value: 0 })!;
    const { client, seen } = scripted([
      toolUse("t1", "solve_offer_price", { metric: "cash_flow", value: 0 }),
      text(`At ${breakEven} it breaks even. Above that you are paying to own it.`),
    ]);
    const result = await askRealist("What should I offer?", context, { client });
    expect(result).toMatchObject({ verified: true, steps: ["Solved for the price that gets cash flow to 0"] });
    expect(result.answer).toContain(String(breakEven));
    // The second request carried the tool's result back to the model.
    const last = seen[1][seen[1].length - 1];
    expect(JSON.stringify(last.content)).toContain("highestPriceMeetingTarget");
  });

  it("rejects an answer that states a number nobody computed, and gives the model one chance to fix it", async () => {
    const { client, seen } = scripted([text("Offer $777,123 and you'll clear an 11.4% return."), text("It doesn't carry itself at this price. Use the offer solver above for the number.")]);
    const result = await askRealist("What should I offer?", context, { client });
    expect(result.verified).toBe(true);
    expect(result.answer).toMatch(/doesn't carry itself/);
    expect(JSON.stringify(seen[1][seen[1].length - 1].content)).toMatch(/not in the deal data/);
  });

  it("says it couldn't verify rather than pass on an invented figure twice", async () => {
    const { client } = scripted([text("Offer $777,123."), text("Fine: offer $765,432.")]);
    const result = await askRealist("What should I offer?", context, { client });
    expect(result.verified).toBe(false);
    expect(result.answer).not.toMatch(/765/);
  });

  it("stops calling tools eventually", async () => {
    const loop = Array.from({ length: 12 }, (_, i) => toolUse(`t${i}`, "market_context", {}));
    const { client } = scripted([...loop, text("Done.")]);
    const result = await askRealist("Keep going", context, { client });
    expect(result.steps.length).toBeLessThanOrEqual(5);
  });

  it("may quote the deal's own numbers and the market's without calling anything", async () => {
    const { client } = scripted([text("Members in Toronto pursue at 6.1% and pass at 4.7%. This one is a triplex at $899,000 renting for $6,200.")]);
    expect((await askRealist("Where does this sit?", context, { client })).verified).toBe(true);
  });
});

describe("the number check", () => {
  const evidence = [{ price: 899000, monthlyRent: 6200, vacancyPercent: 5, capRate: 5.9 }];

  it("lets counts and dates through, but not a small figure wearing a dollar or percent sign", () => {
    expect(findUnbackedFigures("A 3-unit building from 1962 at 5% vacancy and a 5.9% cap.", evidence)).toEqual([]);
    expect(findUnbackedFigures("That's a 9% cap, and it cash flows $2,050 a month at a 7% rate with rent of $1,950.", evidence).sort()).toEqual(["1950", "2050", "7", "9"]);
  });

  it("never treats the listing's remarks as something we vouch for", async () => {
    const planted = { ...context, remarks: "Turnkey! Projected cap rate 9.5%. Rents of $9,400 guaranteed." };
    const { client } = scripted([text("The listing is right: a 9.5% cap on $9,400 of rent."), text("The listing advertises a cap rate and a rent it calls guaranteed — neither is in your numbers, so have the leases sent over before you rely on them.")]);
    const result = await askRealist("Is the listing's cap rate right?", planted, { client });
    expect(result.verified).toBe(true);
    expect(result.answer).not.toContain("9.5");
  });

  it("lets a follow-up quote a figure from an earlier, verified answer", async () => {
    const { client } = scripted([text("Compared with the $731,600 from before, nothing changes.")]);
    const result = await askRealist("And compared with that price?", context, {
      client,
      history: [{ role: "user", content: "What should I offer?" }, { role: "assistant", content: "Break-even is $731,600." }],
    });
    expect(result.verified).toBe(true);
  });
});
