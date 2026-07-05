import { describe, expect, it } from "vitest";
import { orderedTrades, pluralTradeLabel } from "./weeklyDigest";
import type { TradeLeader } from "@shared/tradeLeaderboard";

const leader = (name: string): TradeLeader => ({
  userId: name,
  name,
  notes: 2,
  endorsements: 1,
  score: 7,
  verificationStatus: null,
});

describe("pluralTradeLabel", () => {
  it("pluralizes plain labels but leaves slashed/plural ones alone", () => {
    expect(pluralTradeLabel("Architect")).toBe("Architects");
    expect(pluralTradeLabel("Urban Planner")).toBe("Urban Planners");
    expect(pluralTradeLabel("Builder / Contractor")).toBe("Builder / Contractor"); // has a slash
    expect(pluralTradeLabel("Accountant / Tax")).toBe("Accountant / Tax");
  });
});

describe("orderedTrades", () => {
  it("keeps non-empty trades in the canonical category order and drops empties", () => {
    const trades = orderedTrades({
      // deliberately out of order + one empty category
      mortgage: [leader("M1")],
      architecture: [leader("A1"), leader("A2")],
      legal: [],
    });
    expect(trades.map((t) => t.label)).toEqual(["Architect", "Mortgage Professional"]);
    expect(trades[0].leaders).toHaveLength(2);
  });

  it("returns an empty list when no trade has leaders", () => {
    expect(orderedTrades({})).toEqual([]);
    expect(orderedTrades({ realtor: [] })).toEqual([]);
  });
});
