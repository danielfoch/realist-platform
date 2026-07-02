import { describe, expect, it } from "vitest";
import { runRentBacktest, type BacktestObservation } from "./rentBacktest";

const BASE_TIME = new Date("2026-06-01T12:00:00Z").getTime();

function daysAfterBase(days: number): Date {
  return new Date(BASE_TIME + days * 24 * 60 * 60 * 1000);
}

let seq = 0;
function obs(rent: number, day: number, overrides: Partial<BacktestObservation> = {}): BacktestObservation {
  seq++;
  return {
    externalId: `obs-${seq}`,
    rent,
    bedrooms: "2",
    city: "Hamilton",
    province: "Ontario",
    lat: 43.2557 + (seq % 10) * 0.001,
    lng: -79.8711,
    scrapedAt: daysAfterBase(day),
    ...overrides,
  };
}

describe("runRentBacktest", () => {
  it("scores held-out observations against history and reports error stats", () => {
    // 30 days of stable ~$2200 2BR observations
    const observations = Array.from({ length: 30 }, (_, i) => obs(2150 + (i % 5) * 25, i));
    const report = runRentBacktest(observations);

    expect(report.samples).toBeGreaterThan(10);
    expect(report.overall.mape).toBeLessThan(10); // stable market → low error
    expect(report.overall.samples).toBe(report.samples);
    expect(report.byCity[0].city).toBe("Hamilton");
    expect(report.byCity[0].samples).toBe(report.samples);
    // Early observations have thin history → some skipped or fallback methods
    expect(report.samples + report.skipped).toBeLessThanOrEqual(30);
  });

  it("never leaks future data into a prediction", () => {
    // Stable $2,200 history, one held-out target at day 8 with a unique
    // rent, then a massive $9,500 spike strictly AFTER the target. If future
    // data leaked into the target's comps, its prediction would be dragged
    // toward 9,500 (30 fresher spike rows would dominate the weighted
    // median). It must instead be predicted from the stable past only.
    const history = Array.from({ length: 8 }, (_, i) => obs(2200, i));
    const target = obs(2222, 8);
    const futureSpike = Array.from({ length: 30 }, (_, i) => obs(9500, 9 + i));
    const report = runRentBacktest([...history, target, ...futureSpike], {
      maxSamplesPerCity: 100,
      includeDetails: true,
    });

    const targetSample = report.details!.find((d) => d.actual === 2222);
    expect(targetSample).toBeDefined();
    expect(targetSample!.predicted).toBeGreaterThan(2000);
    expect(targetSample!.predicted).toBeLessThan(2600); // untouched by the future spike
    expect(targetSample!.compCount).toBe(8); // exactly the 8 earlier rows
  });

  it("excludes the held-out listing's own other rows (same externalId)", () => {
    // One listing re-scraped many times at a unique rent + a real market
    const relisted = Array.from({ length: 8 }, (_, i) =>
      obs(3333, i * 2, { externalId: "same-listing" }),
    );
    const market = Array.from({ length: 10 }, (_, i) => obs(2000, i * 2 + 1));
    const report = runRentBacktest([...relisted, ...market], { maxSamplesPerCity: 100 });
    // If self-comps leaked, the 3333 rows would predict themselves at ~0 error.
    const selfSamples = report.samples;
    expect(selfSamples).toBeGreaterThan(0);
    // The relisted rows must be predicted from the 2000-market, giving them
    // substantial error — so overall MAPE cannot be near zero.
    expect(report.overall.mape).toBeGreaterThan(10);
  });

  it("keeps cities separate", () => {
    const hamilton = Array.from({ length: 15 }, (_, i) => obs(2200, i));
    const timmins = Array.from({ length: 15 }, (_, i) =>
      obs(1100, i, { city: "Timmins", lat: 48.4758 + (i % 10) * 0.001, lng: -81.3305 }),
    );
    const report = runRentBacktest([...hamilton, ...timmins]);
    expect(report.byCity).toHaveLength(2);
    // Cross-city leakage would blow up both cities' error; separate comps
    // keep each city's median error tight.
    for (const city of report.byCity) {
      expect(city.mape).toBeLessThan(10);
    }
  });

  it("scores the CMHC baseline comparator on the same samples", () => {
    const observations = Array.from({ length: 20 }, (_, i) => obs(2400, i + 1));
    const report = runRentBacktest(observations, {
      cmhcBaselineResolver: () => ({ rent: 1700, source: "cmhc_city" }),
    });
    expect(report.baseline).not.toBeNull();
    expect(report.baseline!.samples).toBe(report.samples);
    // Static 1700 vs actual 2400 → ~29% APE; comps must beat it
    expect(report.baseline!.mape).toBeGreaterThan(25);
    expect(report.overall.mape).toBeLessThan(report.baseline!.mape);
  });

  it("caps held-out samples per city deterministically", () => {
    const observations = Array.from({ length: 120 }, (_, i) => obs(2200, i * 0.25));
    const a = runRentBacktest(observations, { maxSamplesPerCity: 20 });
    const b = runRentBacktest(observations, { maxSamplesPerCity: 20 });
    expect(a.samples + a.skipped).toBeLessThanOrEqual(20);
    expect(a).toEqual(b); // deterministic
  });

  it("skips unusable observations and empty inputs", () => {
    const report = runRentBacktest([
      obs(2200, 1, { bedrooms: "loft" }), // unparseable band
      obs(50, 2), // below sanity floor
      obs(2200, 3, { city: null as unknown as string }),
    ]);
    expect(report.samples).toBe(0);
    expect(report.overall.mape).toBe(0);
    expect(report.baseline).toBeNull();
  });

  it("reports method mix (early thin history falls to baseline when provided)", () => {
    const observations = Array.from({ length: 25 }, (_, i) => obs(2300, i));
    const report = runRentBacktest(observations, {
      cmhcBaselineResolver: () => ({ rent: 1700, source: "cmhc_province" }),
    });
    const methods = Object.keys(report.byMethod);
    expect(methods.length).toBeGreaterThan(0);
    // Later observations have ≥5 prior comps → comps method present
    expect(methods.some((m) => m === "comps_radius" || m === "city_comps")).toBe(true);
  });
});
