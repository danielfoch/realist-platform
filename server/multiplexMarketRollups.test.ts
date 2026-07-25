/**
 * Tests for the FSA rollup rebuild (server/multiplexMarketRollups.ts).
 *
 * The aggregate SQL itself is exercised against a real database, not here. What
 * these pin down is the part that is a policy decision rather than arithmetic:
 * which buckets are allowed to be published, and that a NULL from the aggregate
 * stays NULL instead of being written as a confident zero.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  aggregateRows: [] as Array<Record<string, unknown>>,
  written: [] as Record<string, unknown>[],
  conflictSets: [] as Record<string, unknown>[],
};

vi.mock("./db", () => ({
  db: {
    execute: async () => ({ rows: state.aggregateRows }),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        state.written.push(v);
        return {
          onConflictDoUpdate: async (cfg: { set: Record<string, unknown> }) => {
            state.conflictSets.push(cfg.set);
            return undefined;
          },
        };
      },
    }),
    select: () => {
      const chain: Record<string, unknown> = {};
      chain.from = () => chain;
      chain.where = () => chain;
      chain.orderBy = () => chain;
      chain.limit = async () => [];
      return chain;
    },
  },
}));

const { rebuildMultiplexMarketRollups, MIN_UNDERWRITES_PER_BUCKET } = await import("./multiplexMarketRollups");

function bucket(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    postal_fsa: "M4E",
    period_month: "2026-07-01T00:00:00.000Z",
    underwrite_count: 5,
    distinct_user_count: 4,
    median_purchase_price: 1_350_000,
    median_max_units: 4,
    sixplex_eligible_rate: 0.6,
    hold_preference_rate: 0.8,
    median_yield_on_cost: 0.052,
    ...overrides,
  };
}

beforeEach(() => {
  state.aggregateRows = [];
  state.written = [];
  state.conflictSets = [];
});

describe("rebuildMultiplexMarketRollups", () => {
  it("publishes a bucket that clears the floor", async () => {
    state.aggregateRows = [bucket()];

    const result = await rebuildMultiplexMarketRollups();

    expect(result.bucketsWritten).toBe(1);
    expect(result.bucketsSuppressed).toBe(0);
    expect(state.written).toHaveLength(1);
    expect(state.written[0].postalFsa).toBe("M4E");
    expect(state.written[0].medianPurchasePrice).toBe(1_350_000);
  });

  it("suppresses a bucket below the floor instead of publishing it", async () => {
    state.aggregateRows = [bucket({ underwrite_count: MIN_UNDERWRITES_PER_BUCKET - 1 })];

    const result = await rebuildMultiplexMarketRollups();

    // One person's opinion is not a market median, and with a single row an
    // FSA-level median price is close to naming the deal they screened.
    expect(result.bucketsConsidered).toBe(1);
    expect(result.bucketsWritten).toBe(0);
    expect(result.bucketsSuppressed).toBe(1);
    expect(state.written).toHaveLength(0);
  });

  it("publishes exactly at the floor", async () => {
    state.aggregateRows = [bucket({ underwrite_count: MIN_UNDERWRITES_PER_BUCKET })];
    const result = await rebuildMultiplexMarketRollups();
    expect(result.bucketsWritten).toBe(1);
  });

  it("keeps a missing metric NULL rather than writing a confident zero", async () => {
    state.aggregateRows = [
      bucket({ median_purchase_price: null, hold_preference_rate: null, median_yield_on_cost: null }),
    ];

    await rebuildMultiplexMarketRollups();

    expect(state.written[0].medianPurchasePrice).toBeNull();
    expect(state.written[0].holdPreferenceRate).toBeNull();
    expect(state.written[0].medianYieldOnCost).toBeNull();
    // Counts are genuinely known, so they stay numeric.
    expect(state.written[0].underwriteCount).toBe(5);
  });

  it("coerces numeric strings from the driver and rejects junk", async () => {
    // node-postgres hands back numerics as strings.
    state.aggregateRows = [bucket({ median_purchase_price: "1350000.00", median_max_units: "NaN" })];

    await rebuildMultiplexMarketRollups();

    expect(state.written[0].medianPurchasePrice).toBe(1_350_000);
    expect(state.written[0].medianMaxUnits).toBeNull();
  });

  it("counts distinct months covered, not buckets", async () => {
    state.aggregateRows = [
      bucket({ postal_fsa: "M4E", period_month: "2026-07-01T00:00:00.000Z" }),
      bucket({ postal_fsa: "M6H", period_month: "2026-07-01T00:00:00.000Z" }),
      bucket({ postal_fsa: "M4E", period_month: "2026-06-01T00:00:00.000Z" }),
    ];

    const result = await rebuildMultiplexMarketRollups();

    expect(result.bucketsWritten).toBe(3);
    expect(result.monthsCovered).toBe(2);
  });

  it("upserts so a rebuild refreshes a bucket instead of duplicating it", async () => {
    state.aggregateRows = [bucket()];

    await rebuildMultiplexMarketRollups();

    expect(state.conflictSets).toHaveLength(1);
    expect(state.conflictSets[0].underwriteCount).toBe(5);
    expect(state.conflictSets[0].rebuiltAt).toBeInstanceOf(Date);
  });

  it("is a no-op on an empty window", async () => {
    const result = await rebuildMultiplexMarketRollups();
    expect(result).toEqual({
      bucketsConsidered: 0,
      bucketsWritten: 0,
      bucketsSuppressed: 0,
      monthsCovered: 0,
    });
  });
});
