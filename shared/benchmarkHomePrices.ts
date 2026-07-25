/**
 * Benchmark / average home prices for the livestream market overlay
 * (server/streamOverlay.ts). These have no free live API, so they are pinned
 * here and refreshed by hand after each release:
 *
 *  - Board figures (TRREB, GVR, CREB, QPAREB) land in the first week of the
 *    month for the prior month.
 *  - CREA's national composite lands mid-month and lags the boards by a month.
 *
 * The overlay prints `asOf` next to every number, so a stale month is visible
 * on stream rather than silently wrong.
 */
export interface BenchmarkHomePrice {
  /** Display label used on the overlay. */
  market: string;
  /** Price in CAD dollars. */
  price: number;
  /** Year-over-year change, in percent (negative = down). */
  yoyPct: number;
  /** Human-readable vintage, e.g. "Jun 2026". */
  asOf: string;
  /** MLS HPI composite benchmark vs plain average sale price. */
  measure: "benchmark" | "average";
  source: string;
}

export const BENCHMARK_HOME_PRICES: BenchmarkHomePrice[] = [
  {
    market: "Canada",
    price: 667700,
    yoyPct: -4.1,
    asOf: "May 2026",
    measure: "benchmark",
    source: "CREA National Composite MLS HPI",
  },
  {
    market: "Toronto",
    price: 940800,
    yoyPct: -5.4,
    asOf: "Jun 2026",
    measure: "benchmark",
    source: "TRREB MLS HPI composite (GTA)",
  },
  {
    market: "Vancouver",
    price: 1099100,
    yoyPct: -6.0,
    asOf: "Jun 2026",
    measure: "benchmark",
    source: "Greater Vancouver REALTORS MLS HPI composite",
  },
  {
    market: "Calgary",
    price: 572500,
    yoyPct: -2.0,
    asOf: "Jun 2026",
    measure: "benchmark",
    source: "CREB benchmark, total residential",
  },
  {
    market: "Montréal",
    price: 689908,
    yoyPct: 5.0,
    asOf: "Jun 2026",
    measure: "average",
    source: "QPAREB average sale price (CMA)",
  },
];
