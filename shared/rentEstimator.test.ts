import { describe, expect, it } from "vitest";
import {
  estimateRent,
  haversineKm,
  normalizeBedroomBand,
  MIN_COMPS,
  RENT_ESTIMATOR_MODEL_KEY,
  RENT_ESTIMATOR_VERSION,
  type RentComp,
  type CityRentAggregate,
} from "./rentEstimator";

const NOW = new Date("2026-06-11T12:00:00Z");

// Hamilton, ON — downtown-ish anchor for geo tests
const SUBJECT = {
  bedrooms: 2,
  city: "Hamilton",
  province: "ON",
  lat: 43.2557,
  lng: -79.8711,
};

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

/** A comp `km` kilometres due north of the subject. */
function compAt(rent: number, km: number, opts: Partial<RentComp> = {}): RentComp {
  return {
    rent,
    bedrooms: "2",
    city: "Hamilton",
    lat: SUBJECT.lat + km / 111, // ~111 km per degree latitude
    lng: SUBJECT.lng,
    scrapedAt: daysAgo(7),
    ...opts,
  };
}

describe("normalizeBedroomBand", () => {
  it("bands numeric and string inputs", () => {
    expect(normalizeBedroomBand(0)).toBe("0");
    expect(normalizeBedroomBand(1)).toBe("1");
    expect(normalizeBedroomBand("2")).toBe("2");
    expect(normalizeBedroomBand(2.5)).toBe("2");
    expect(normalizeBedroomBand("3+1")).toBe("3");
    expect(normalizeBedroomBand(4)).toBe("4+");
    expect(normalizeBedroomBand("5")).toBe("4+");
    expect(normalizeBedroomBand("4+")).toBe("4+");
  });

  it("handles bachelor/studio aliases", () => {
    expect(normalizeBedroomBand("Bachelor")).toBe("0");
    expect(normalizeBedroomBand("studio")).toBe("0");
  });

  it("returns null on garbage", () => {
    expect(normalizeBedroomBand(null)).toBeNull();
    expect(normalizeBedroomBand(undefined)).toBeNull();
    expect(normalizeBedroomBand("")).toBeNull();
    expect(normalizeBedroomBand("loft")).toBeNull();
    expect(normalizeBedroomBand(-1)).toBeNull();
  });
});

describe("haversineKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineKm(43.25, -79.87, 43.25, -79.87)).toBe(0);
  });

  it("measures Toronto→Hamilton at roughly 60 km", () => {
    const km = haversineKm(43.6532, -79.3832, 43.2557, -79.8711);
    expect(km).toBeGreaterThan(55);
    expect(km).toBeLessThan(65);
  });
});

describe("estimateRent — comps_radius", () => {
  it("uses nearby same-band comps and reports the radius tier", () => {
    const comps = [2100, 2150, 2200, 2250, 2300, 2350].map((rent, i) =>
      compAt(rent, 0.2 * (i + 1)),
    );
    const result = estimateRent(SUBJECT, { comps, now: NOW })!;
    expect(result.method).toBe("comps_radius");
    expect(result.radiusKm).toBe(2);
    expect(result.compCount).toBe(6);
    expect(result.monthlyRent).toBeGreaterThanOrEqual(2100);
    expect(result.monthlyRent).toBeLessThanOrEqual(2350);
    expect(result.rangeLow).toBeLessThanOrEqual(result.monthlyRent);
    expect(result.rangeHigh).toBeGreaterThanOrEqual(result.monthlyRent);
    expect(result.modelKey).toBe(RENT_ESTIMATOR_MODEL_KEY);
    expect(result.modelVersion).toBe(RENT_ESTIMATOR_VERSION);
  });

  it("expands to a wider tier when the inner radius is thin", () => {
    const comps = [2000, 2050, 2100, 2150, 2200].map((rent, i) =>
      compAt(rent, 3 + 0.3 * i), // all between 3–5 km out
    );
    const result = estimateRent(SUBJECT, { comps, now: NOW })!;
    expect(result.method).toBe("comps_radius");
    expect(result.radiusKm).toBe(5);
  });

  it("weights closer comps more than distant ones", () => {
    // Five cheap comps right at the subject, five expensive ones ~9 km out.
    // No 2/5 km tier has enough alone... ensure 10km tier mixes them but
    // proximity pulls the estimate toward the cheap cluster.
    const near = [1800, 1820, 1840].map((r, i) => compAt(r, 0.1 * (i + 1)));
    const far = [2800, 2820, 2840].map((r, i) => compAt(r, 8.5 + 0.1 * i));
    const result = estimateRent(SUBJECT, { comps: [...near, ...far], now: NOW })!;
    expect(result.method).toBe("comps_radius");
    expect(result.radiusKm).toBe(10);
    expect(result.monthlyRent).toBeLessThan(2300); // pulled toward near cluster
  });

  it("ignores wrong-band, stale, and insane comps", () => {
    const comps: RentComp[] = [
      ...[2100, 2150, 2200, 2250, 2300].map((r, i) => compAt(r, 0.3 * (i + 1))),
      compAt(9000, 0.1, { bedrooms: "4" }), // wrong band
      compAt(2500, 0.1, { scrapedAt: daysAgo(400) }), // too old
      compAt(150, 0.1), // below sanity floor
      compAt(50000, 0.1), // above sanity ceiling
    ];
    const result = estimateRent(SUBJECT, { comps, now: NOW })!;
    expect(result.compCount).toBe(5);
    expect(result.monthlyRent).toBeGreaterThanOrEqual(2100);
    expect(result.monthlyRent).toBeLessThanOrEqual(2300);
  });

  it("grades confidence by comp count and spread", () => {
    const tight = Array.from({ length: 20 }, (_, i) => compAt(2200 + i * 5, 0.1 * (i + 1)));
    expect(estimateRent(SUBJECT, { comps: tight, now: NOW })!.confidence).toBe("high");

    const thin = Array.from({ length: 5 }, (_, i) => compAt(2200 + i * 10, 0.2 * (i + 1)));
    expect(estimateRent(SUBJECT, { comps: thin, now: NOW })!.confidence).toBe("low");
  });
});

describe("estimateRent — city_comps", () => {
  it("matches by city when the subject has no coordinates", () => {
    const comps = [2100, 2150, 2200, 2250, 2300].map((r) =>
      compAt(r, 1, { lat: null, lng: null }),
    );
    const result = estimateRent(
      { bedrooms: 2, city: "Hamilton", province: "ON" },
      { comps, now: NOW },
    )!;
    expect(result.method).toBe("city_comps");
    expect(result.radiusKm).toBeNull();
    expect(result.compCount).toBe(5);
  });

  it("city matching is case-insensitive and excludes other cities", () => {
    const comps = [
      ...[2100, 2150, 2200, 2250, 2300].map((r) => compAt(r, 1, { city: "hamilton", lat: null, lng: null })),
      compAt(3500, 1, { city: "Toronto", lat: null, lng: null }),
    ];
    const result = estimateRent(
      { bedrooms: 2, city: "Hamilton" },
      { comps, now: NOW },
    )!;
    expect(result.compCount).toBe(5);
    expect(result.monthlyRent).toBeLessThanOrEqual(2300);
  });
});

describe("estimateRent — city_aggregate fallback", () => {
  const aggregates: CityRentAggregate[] = [
    { bedrooms: "2", medianRent: 2240, sampleSize: 85, scrapedAt: daysAgo(10) },
    { bedrooms: "2", medianRent: 2000, sampleSize: 90, scrapedAt: daysAgo(200) }, // older, ignored
    { bedrooms: "1", medianRent: 1750, sampleSize: 120, scrapedAt: daysAgo(10) }, // wrong band
  ];

  it("uses the freshest same-band aggregate when comps are insufficient", () => {
    const result = estimateRent(SUBJECT, {
      comps: [compAt(2200, 0.5)], // below MIN_COMPS
      cityAggregates: aggregates,
      now: NOW,
    })!;
    expect(result.method).toBe("city_aggregate");
    expect(result.monthlyRent).toBe(2240);
    expect(result.confidence).toBe("medium");
    expect(result.rangeLow).toBe(Math.round(2240 * 0.85));
    expect(result.rangeHigh).toBe(Math.round(2240 * 1.15));
  });

  it("downgrades confidence for small or stale samples", () => {
    const result = estimateRent(SUBJECT, {
      cityAggregates: [{ bedrooms: "2", medianRent: 2240, sampleSize: 8, scrapedAt: daysAgo(10) }],
      now: NOW,
    })!;
    expect(result.confidence).toBe("low");
  });
});

describe("estimateRent — cmhc_baseline fallback", () => {
  it("falls through to CMHC with a wide low-confidence range", () => {
    const result = estimateRent(SUBJECT, {
      cmhcBaseline: { rent: 1700, source: "cmhc_city" },
      now: NOW,
    })!;
    expect(result.method).toBe("cmhc_baseline");
    expect(result.confidence).toBe("low");
    expect(result.monthlyRent).toBe(1700);
    expect(result.rangeLow).toBe(1360);
    expect(result.rangeHigh).toBe(2040);
    expect(result.compCount).toBe(0);
  });
});

describe("estimateRent — multi-unit and edge cases", () => {
  it("multiplies estimate and range by unit count", () => {
    const comps = [2100, 2150, 2200, 2250, 2300, 2350].map((r, i) => compAt(r, 0.2 * (i + 1)));
    const single = estimateRent(SUBJECT, { comps, now: NOW })!;
    const triplex = estimateRent({ ...SUBJECT, units: 3 }, { comps, now: NOW })!;
    expect(triplex.units).toBe(3);
    expect(triplex.monthlyRent).toBe(single.monthlyRent * 3);
    expect(triplex.rangeLow).toBe(single.rangeLow * 3);
  });

  it("returns null when bedrooms are unparseable", () => {
    expect(estimateRent({ bedrooms: "penthouse" }, { now: NOW })).toBeNull();
  });

  it("returns null when no data source is available", () => {
    expect(estimateRent(SUBJECT, { comps: [], cityAggregates: [], now: NOW })).toBeNull();
  });

  it("requires MIN_COMPS to use a comps method", () => {
    const comps = Array.from({ length: MIN_COMPS - 1 }, (_, i) => compAt(2200, 0.2 * (i + 1)));
    const result = estimateRent(SUBJECT, {
      comps,
      cmhcBaseline: { rent: 1700, source: "cmhc_province" },
      now: NOW,
    })!;
    expect(result.method).toBe("cmhc_baseline");
  });
});
