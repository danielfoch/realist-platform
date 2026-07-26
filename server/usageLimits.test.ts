/**
 * Tests for the durable daily usage caps (server/usageLimits.ts).
 *
 * The db is mocked. What matters here is the identity choice (a signed-in user
 * counts across devices; an anonymous one falls back to session then hashed IP),
 * that the cap boundary is exact, and that a broken counter fails OPEN — the
 * cap is a conversion nudge, and a database blip must not break the tool.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  /** Count the UPSERT returns, i.e. the value AFTER this increment. */
  nextCount: 1,
  insertThrows: false,
  selectCount: null as number | null,
  selectThrows: false,
  deleteRowCount: 0,
  deleteThrows: false,
  insertedValues: [] as Record<string, unknown>[],
  deleteWhereCalled: 0,
};

vi.mock("./db", () => ({
  db: {
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        state.insertedValues.push(v);
        return {
          onConflictDoUpdate: () => ({
            returning: async () => {
              if (state.insertThrows) throw new Error("counter boom");
              return [{ count: state.nextCount }];
            },
          }),
        };
      },
    }),
    select: () => {
      const chain: Record<string, unknown> = {};
      chain.from = () => chain;
      chain.where = () => chain;
      chain.limit = async () => {
        if (state.selectThrows) throw new Error("peek boom");
        return state.selectCount === null ? [] : [{ count: state.selectCount }];
      };
      return chain;
    },
    delete: () => ({
      where: async () => {
        state.deleteWhereCalled++;
        if (state.deleteThrows) throw new Error("prune boom");
        return { rowCount: state.deleteRowCount };
      },
    }),
  },
}));

const {
  consumeDailyUsage,
  grantDailyUnlock,
  hasDailyUnlock,
  peekDailyUsage,
  pruneUsageCounters,
  usageKey,
} = await import("./usageLimits");

const LIMITS = { anonymous: 3, identified: 20 };

function makeReq(opts: { userId?: string; sessionID?: string; ip?: string } = {}): any {
  return {
    session: opts.userId ? { userId: opts.userId } : {},
    sessionID: opts.sessionID,
    headers: opts.ip ? { "x-forwarded-for": opts.ip } : {},
    socket: { remoteAddress: opts.ip },
  };
}

beforeEach(() => {
  state.nextCount = 1;
  state.insertThrows = false;
  state.selectCount = null;
  state.selectThrows = false;
  state.deleteRowCount = 0;
  state.deleteThrows = false;
  state.insertedValues = [];
  state.deleteWhereCalled = 0;
});

describe("usageKey", () => {
  it("prefers the user id so a cap follows the account across devices", () => {
    const { key, identified } = usageKey(makeReq({ userId: "user-1", sessionID: "sess-1", ip: "1.2.3.4" }));
    expect(key).toBe("u:user-1");
    expect(identified).toBe(true);
  });

  it("falls back to the session for anonymous callers", () => {
    const { key, identified } = usageKey(makeReq({ sessionID: "sess-1", ip: "1.2.3.4" }));
    expect(key).toBe("s:sess-1");
    expect(identified).toBe(false);
  });

  it("falls back to a hashed ip, never a raw one", () => {
    const { key, identified } = usageKey(makeReq({ ip: "203.0.113.9" }));
    expect(identified).toBe(false);
    expect(key.startsWith("i:")).toBe(true);
    expect(key).not.toContain("203.0.113.9");
    expect(key).toHaveLength(2 + 32);
  });

  it("is stable for the same ip and different for another", () => {
    const a = usageKey(makeReq({ ip: "203.0.113.9" })).key;
    const b = usageKey(makeReq({ ip: "203.0.113.9" })).key;
    const c = usageKey(makeReq({ ip: "198.51.100.4" })).key;
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("consumeDailyUsage", () => {
  it("allows the call that lands exactly on the cap", async () => {
    state.nextCount = 3;
    const decision = await consumeDailyUsage("multiplex_underwrite", makeReq({ sessionID: "s" }), LIMITS);
    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBe(0);
  });

  it("rejects the call after the cap", async () => {
    state.nextCount = 4;
    const decision = await consumeDailyUsage("multiplex_underwrite", makeReq({ sessionID: "s" }), LIMITS);
    expect(decision.allowed).toBe(false);
    expect(decision.limit).toBe(3);
    expect(decision.remaining).toBe(0);
  });

  it("gives signed-in callers the higher cap", async () => {
    state.nextCount = 4;
    const decision = await consumeDailyUsage("multiplex_underwrite", makeReq({ userId: "user-1" }), LIMITS);
    expect(decision.allowed).toBe(true);
    expect(decision.limit).toBe(20);
    expect(decision.remaining).toBe(16);
  });

  it("writes a UTC day bucket alongside the scope and key", async () => {
    await consumeDailyUsage("multiplex_underwrite", makeReq({ sessionID: "s" }), LIMITS);
    const written = state.insertedValues[0];
    expect(written.scope).toBe("multiplex_underwrite");
    expect(written.key).toBe("s:s");
    expect(written.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(written.day).toBe(new Date().toISOString().slice(0, 10));
  });

  it("fails open when the counter is unreachable", async () => {
    state.insertThrows = true;
    const decision = await consumeDailyUsage("multiplex_underwrite", makeReq({ sessionID: "s" }), LIMITS);
    expect(decision.allowed).toBe(true);
    expect(decision.degraded).toBe(true);
  });
});

describe("peekDailyUsage", () => {
  it("reports a full allowance when no bucket exists yet", async () => {
    state.selectCount = null;
    const decision = await peekDailyUsage("multiplex_underwrite", makeReq({ sessionID: "s" }), LIMITS);
    expect(decision.remaining).toBe(3);
    expect(decision.allowed).toBe(true);
  });

  it("reports exhaustion at the cap without consuming", async () => {
    state.selectCount = 3;
    const decision = await peekDailyUsage("multiplex_underwrite", makeReq({ sessionID: "s" }), LIMITS);
    expect(decision.allowed).toBe(false);
    expect(decision.remaining).toBe(0);
    expect(state.insertedValues).toHaveLength(0);
  });

  it("fails open on error", async () => {
    state.selectThrows = true;
    const decision = await peekDailyUsage("multiplex_underwrite", makeReq({ sessionID: "s" }), LIMITS);
    expect(decision.allowed).toBe(true);
    expect(decision.degraded).toBe(true);
  });
});

describe("daily unlock", () => {
  it("records an unlock under its own scope so it expires with the day", async () => {
    await grantDailyUnlock("multiplex_underwrite", makeReq({ sessionID: "s" }));
    const written = state.insertedValues[0];
    expect(written.scope).toBe("multiplex_underwrite:unlock");
    expect(written.key).toBe("s:s");
    expect(written.day).toBe(new Date().toISOString().slice(0, 10));
  });

  it("reports an unlock once one exists", async () => {
    state.selectCount = 1;
    await expect(hasDailyUnlock("multiplex_underwrite", makeReq({ sessionID: "s" }))).resolves.toBe(true);
  });

  it("reports no unlock when the bucket is empty", async () => {
    state.selectCount = null;
    await expect(hasDailyUnlock("multiplex_underwrite", makeReq({ sessionID: "s" }))).resolves.toBe(false);
  });

  it("fails CLOSED when the lookup errors", async () => {
    // Opposite of consumeDailyUsage on purpose. Failing open here would hand
    // every anonymous caller the raised limit on a transient database error;
    // the cheaper mistake is re-showing a prompt someone already completed.
    state.selectThrows = true;
    await expect(hasDailyUnlock("multiplex_underwrite", makeReq({ sessionID: "s" }))).resolves.toBe(false);
  });

  it("does not throw when recording an unlock fails", async () => {
    // The lead is already captured by this point — losing the allowance bump is
    // recoverable, losing the request is not.
    state.insertThrows = true;
    await expect(grantDailyUnlock("multiplex_underwrite", makeReq({ sessionID: "s" }))).resolves.toBeUndefined();
  });
});

describe("pruneUsageCounters", () => {
  it("returns how many stale buckets it dropped", async () => {
    state.deleteRowCount = 42;
    await expect(pruneUsageCounters()).resolves.toBe(42);
    expect(state.deleteWhereCalled).toBe(1);
  });

  it("swallows failures so the lifecycle tick keeps going", async () => {
    state.deleteThrows = true;
    await expect(pruneUsageCounters()).resolves.toBe(0);
  });
});
