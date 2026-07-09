import { describe, expect, it } from "vitest";
import {
  coerceMetric,
  extractTypedMetrics,
  CAP_RATE_MIN,
  CAP_RATE_MAX,
  DSCR_MIN,
  DSCR_MAX,
  PURCHASE_PRICE_MIN,
  PURCHASE_PRICE_MAX,
  type AnalysisMetricSource,
} from "./analysisMetrics";
import { strategyTypes } from "./schema";

// ---------- fixtures ----------

/** Realistic WEB row (write sites A/B): full buy&hold results object; price +
 * rent live in inputs_json, results has grossMonthlyIncome (no top-level price). */
function webRow(strategyType: string, overrides: Partial<{ results: any; inputs: any }> = {}): AnalysisMetricSource {
  return {
    strategyType,
    resultsJson: {
      capRate: 5.2,
      cashOnCash: 8.1,
      dscr: 1.35,
      irr: 11.4,
      monthlyNoi: 1450,
      monthlyCashFlow: 320,
      annualNoi: 17400,
      annualCashFlow: 3840,
      grossMonthlyIncome: 2400,
      effectiveMonthlyIncome: 2280,
      ...(overrides.results ?? {}),
    },
    inputsJson: {
      purchasePrice: 650000,
      monthlyRent: 2400,
      downPaymentPercent: 20,
      interestRate: 5,
      listingPrice: 675000,
      ...(overrides.inputs ?? {}),
    },
  };
}

/** Realistic AGENT row (write sites C/D): underwriteSimple result mirrors
 * price + monthlyRent into results_json; annual NOI is flat `noi`. */
function agentRow(strategyType: string, overrides: Partial<{ results: any; inputs: any }> = {}): AnalysisMetricSource {
  return {
    strategyType,
    resultsJson: {
      price: 540000,
      monthlyRent: 2100,
      rentSource: "provided",
      units: 1,
      annualRent: 25200,
      noi: 15000,
      capRate: 4.4,
      monthlyCashFlow: 180,
      annualCashFlow: 2160,
      cashOnCash: 6.2,
      dscr: 1.18,
      ...(overrides.results ?? {}),
    },
    inputsJson: {
      mlsNumber: "X1234567",
      strategyType,
      monthlyRent: 2100,
      purchasePrice: 540000,
      source: "agent_api",
      ...(overrides.inputs ?? {}),
    },
  };
}

describe("coerceMetric", () => {
  it("accepts a plain finite number", () => {
    expect(coerceMetric(5.2)).toBe(5.2);
  });
  it("accepts a whole numeric string", () => {
    expect(coerceMetric("5.2")).toBe(5.2);
    expect(coerceMetric("-320")).toBe(-320);
    expect(coerceMetric("650000")).toBe(650000);
  });
  it("rejects a partially-numeric string (no parseFloat semantics)", () => {
    expect(coerceMetric("12abc")).toBeNull();
    expect(coerceMetric("5.2%")).toBeNull();
    expect(coerceMetric("$650000")).toBeNull();
    expect(coerceMetric("")).toBeNull();
  });
  it("rejects null / undefined / non-scalar", () => {
    expect(coerceMetric(null)).toBeNull();
    expect(coerceMetric(undefined)).toBeNull();
    expect(coerceMetric({})).toBeNull();
    expect(coerceMetric([])).toBeNull();
  });
  it("rejects non-finite numbers (Infinity / NaN)", () => {
    expect(coerceMetric(Infinity)).toBeNull();
    expect(coerceMetric(-Infinity)).toBeNull();
    expect(coerceMetric(NaN)).toBeNull();
  });
  it("applies range clamps → out-of-range becomes null", () => {
    expect(coerceMetric(30, CAP_RATE_MIN, CAP_RATE_MAX)).toBeNull();
    expect(coerceMetric(-11, CAP_RATE_MIN, CAP_RATE_MAX)).toBeNull();
    expect(coerceMetric(5, CAP_RATE_MIN, CAP_RATE_MAX)).toBe(5);
  });
  it("treats range bounds as inclusive", () => {
    expect(coerceMetric(CAP_RATE_MIN, CAP_RATE_MIN, CAP_RATE_MAX)).toBe(CAP_RATE_MIN);
    expect(coerceMetric(CAP_RATE_MAX, CAP_RATE_MIN, CAP_RATE_MAX)).toBe(CAP_RATE_MAX);
    expect(coerceMetric(DSCR_MIN, DSCR_MIN, DSCR_MAX)).toBe(DSCR_MIN);
    expect(coerceMetric(DSCR_MAX, DSCR_MIN, DSCR_MAX)).toBe(DSCR_MAX);
  });
  it("clamps garbage-string same as number path (both → null)", () => {
    expect(coerceMetric("999", CAP_RATE_MIN, CAP_RATE_MAX)).toBeNull();
    expect(coerceMetric(999, CAP_RATE_MIN, CAP_RATE_MAX)).toBeNull();
  });
});

describe("extractTypedMetrics — happy path per strategy", () => {
  for (const strategy of strategyTypes) {
    it(`extracts all five for a WEB ${strategy} row`, () => {
      const m = extractTypedMetrics(webRow(strategy));
      expect(m).toEqual({
        capRateNum: 5.2,
        cashFlowMonthlyNum: 320,
        dscrNum: 1.35,
        purchasePriceNum: 650000,
        monthlyRentNum: 2400,
      });
    });
  }

  // Agent path only emits a subset of strategy spellings, but the mapping is
  // strategy-agnostic — assert the shape holds for each.
  for (const strategy of ["buyHold", "brrr", "flip", "airbnb", "multiplex"]) {
    it(`extracts all five for an AGENT ${strategy} row`, () => {
      const m = extractTypedMetrics(agentRow(strategy));
      expect(m).toEqual({
        capRateNum: 4.4,
        cashFlowMonthlyNum: 180,
        dscrNum: 1.18,
        purchasePriceNum: 540000,
        monthlyRentNum: 2100,
      });
    });
  }
});

describe("extractTypedMetrics — source fallbacks", () => {
  it("falls back to results_json.price when inputs_json.purchasePrice is absent (agent-custom)", () => {
    const row = agentRow("buyHold", { inputs: { purchasePrice: undefined } });
    // spread-undefined leaves the key present-but-undefined; coerce → null → fallback to results.price
    const m = extractTypedMetrics(row);
    expect(m.purchasePriceNum).toBe(540000);
  });
  it("falls back to results_json.monthlyRent when inputs_json.monthlyRent is absent (agent-custom)", () => {
    const row: AnalysisMetricSource = {
      strategyType: "buyHold",
      resultsJson: { monthlyRent: 1950, capRate: 4, dscr: 1.1, monthlyCashFlow: 50, price: 500000 },
      inputsJson: { purchasePrice: 500000, source: "agent_api" }, // no monthlyRent
    };
    const m = extractTypedMetrics(row);
    expect(m.monthlyRentNum).toBe(1950);
    expect(m.purchasePriceNum).toBe(500000);
  });
  it("prefers inputs_json over results_json when both present", () => {
    const row = agentRow("buyHold", { inputs: { purchasePrice: 500000, monthlyRent: 1800 }, results: { price: 999999, monthlyRent: 9999 } });
    const m = extractTypedMetrics(row);
    expect(m.purchasePriceNum).toBe(500000);
    expect(m.monthlyRentNum).toBe(1800);
  });
});

describe("extractTypedMetrics — out-of-range clamped to null", () => {
  it("cap rate above 25 → null", () => {
    expect(extractTypedMetrics(webRow("buy_hold", { results: { capRate: 40 } })).capRateNum).toBeNull();
  });
  it("cap rate below -10 → null", () => {
    expect(extractTypedMetrics(webRow("buy_hold", { results: { capRate: -50 } })).capRateNum).toBeNull();
  });
  it("dscr above 4 → null; dscr Infinity → null (no-debt case)", () => {
    expect(extractTypedMetrics(webRow("buy_hold", { results: { dscr: 9 } })).dscrNum).toBeNull();
    expect(extractTypedMetrics(webRow("buy_hold", { results: { dscr: Infinity } })).dscrNum).toBeNull();
  });
  it("purchase price below 50000 or above 20000000 → null (both blob sources)", () => {
    expect(extractTypedMetrics(webRow("buy_hold", { inputs: { purchasePrice: 1000 } })).purchasePriceNum).toBeNull();
    expect(extractTypedMetrics(webRow("buy_hold", { inputs: { purchasePrice: 25_000_000 } })).purchasePriceNum).toBeNull();
  });
  it("monthly cash flow keeps large/negative values (no hard range) and stays a number", () => {
    expect(extractTypedMetrics(webRow("buy_hold", { results: { monthlyCashFlow: -5000 } })).cashFlowMonthlyNum).toBe(-5000);
    expect(extractTypedMetrics(webRow("buy_hold", { results: { monthlyCashFlow: 100000 } })).cashFlowMonthlyNum).toBe(100000);
  });
});

describe("extractTypedMetrics — non-numeric / missing → null", () => {
  it("non-numeric strings → null per metric", () => {
    const m = extractTypedMetrics({
      strategyType: "buy_hold",
      resultsJson: { capRate: "5.2%", dscr: "N/A", monthlyCashFlow: "n/a" },
      inputsJson: { purchasePrice: "$650k", monthlyRent: "2,400" },
    });
    expect(m).toEqual({
      capRateNum: null,
      cashFlowMonthlyNum: null,
      dscrNum: null,
      purchasePriceNum: null,
      monthlyRentNum: null,
    });
  });
  it("null resultsJson (write-site-B anonymous save) → results-derived metrics null, inputs still extracted", () => {
    const m = extractTypedMetrics({
      strategyType: "buy_hold",
      resultsJson: null,
      inputsJson: { purchasePrice: 650000, monthlyRent: 2400 },
    });
    expect(m.capRateNum).toBeNull();
    expect(m.cashFlowMonthlyNum).toBeNull();
    expect(m.dscrNum).toBeNull();
    expect(m.purchasePriceNum).toBe(650000);
    expect(m.monthlyRentNum).toBe(2400);
  });
  it("missing both blobs entirely → all null, no throw", () => {
    expect(extractTypedMetrics({})).toEqual({
      capRateNum: null,
      cashFlowMonthlyNum: null,
      dscrNum: null,
      purchasePriceNum: null,
      monthlyRentNum: null,
    });
    expect(extractTypedMetrics({ resultsJson: undefined, inputsJson: undefined })).toEqual({
      capRateNum: null,
      cashFlowMonthlyNum: null,
      dscrNum: null,
      purchasePriceNum: null,
      monthlyRentNum: null,
    });
  });
  it("numeric-string blobs (SQL ->> text path) coerce identically to number blobs", () => {
    const m = extractTypedMetrics({
      strategyType: "buy_hold",
      resultsJson: { capRate: "5.2", dscr: "1.35", monthlyCashFlow: "320" },
      inputsJson: { purchasePrice: "650000", monthlyRent: "2400" },
    });
    expect(m).toEqual({
      capRateNum: 5.2,
      cashFlowMonthlyNum: 320,
      dscrNum: 1.35,
      purchasePriceNum: 650000,
      monthlyRentNum: 2400,
    });
  });
});
