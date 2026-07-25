/**
 * Tests for the deal-desk sweeps (server/routes/dealDesk.ts).
 *
 * These used to live inline in an admin-only POST handler, so they were
 * unreachable from a test and — more to the point — never ran unless someone
 * pressed a button. Now that they are scheduled (SLA every 5 minutes,
 * behavioural hourly, see server/index.ts), the filter that decides who counts
 * as a breach is worth pinning down.
 *
 * The db and the email producer are mocked; no database, no I/O.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  breachRows: [] as Record<string, unknown>[],
  /** Raw-SQL sweep results, drained in call order. */
  executeQueue: [] as Array<{ rows: Array<Record<string, unknown>> }>,
  executeCalls: 0,
  queued: [] as Array<{
    triggerType: string;
    userId?: string | null;
    opportunityId?: string | null;
    payload?: Record<string, unknown>;
  }>,
  selectWhereArgs: [] as unknown[],
};

vi.mock("../db", () => ({
  db: {
    select: () => {
      const chain: Record<string, unknown> = {};
      chain.from = () => chain;
      chain.where = (...args: unknown[]) => {
        state.selectWhereArgs.push(args);
        return chain;
      };
      (chain as any).then = (resolve: (v: unknown) => void) => resolve(state.breachRows);
      return chain;
    },
    execute: async () => {
      state.executeCalls++;
      return state.executeQueue.shift() ?? { rows: [] };
    },
  },
}));

vi.mock("../storage", () => ({ storage: {} }));
vi.mock("../auth", () => ({ isAdmin: () => undefined }));
vi.mock("../userActivity", () => ({ logUserActivity: async () => undefined }));

vi.mock("../emailTriggerProducer", () => ({
  queueEmailTrigger: async (input: {
    triggerType: string;
    userId?: string | null;
    opportunityId?: string | null;
    payload?: Record<string, unknown>;
  }) => {
    state.queued.push(input);
    return { queued: true };
  },
}));

const { runSlaBreachSweep, runBehaviouralTriggerSweep } = await import("./dealDesk");

beforeEach(() => {
  state.breachRows = [];
  state.executeQueue = [];
  state.executeCalls = 0;
  state.queued = [];
  state.selectWhereArgs = [];
});

describe("runSlaBreachSweep", () => {
  it("queues one nag per uncontacted hot lead", async () => {
    state.breachRows = [
      { id: "opp-1", userId: "user-1", assignedTo: "dan" },
      { id: "opp-2", userId: "user-2", assignedTo: null },
    ];

    const result = await runSlaBreachSweep();

    expect(result).toEqual({ breaches: 2, queued: 2 });
    expect(state.queued).toHaveLength(2);
    expect(state.queued.every(q => q.triggerType === "sla_breach_nag")).toBe(true);
    expect(state.queued[0].opportunityId).toBe("opp-1");
  });

  it("is a no-op when nothing is in breach", async () => {
    const result = await runSlaBreachSweep();
    expect(result).toEqual({ breaches: 0, queued: 0 });
    expect(state.queued).toHaveLength(0);
  });

  it("carries the assignee through so the nag says who is on the hook", async () => {
    state.breachRows = [{ id: "opp-1", userId: "user-1", assignedTo: "nick" }];
    await runSlaBreachSweep();
    expect(state.queued[0].payload).toEqual({ assigned_to: "nick", opportunity_id: "opp-1" });
  });

  it("marks an unassigned breach as such rather than dropping it", async () => {
    state.breachRows = [{ id: "opp-9", userId: null, assignedTo: null }];
    await runSlaBreachSweep();
    expect(state.queued).toHaveLength(1);
    expect(state.queued[0].payload).toEqual({ assigned_to: null, opportunity_id: "opp-9" });
  });
});

describe("runBehaviouralTriggerSweep", () => {
  it("queues one trigger per user per sweep category", async () => {
    state.executeQueue = [
      { rows: [{ user_id: "user-1" }, { user_id: "user-2" }] }, // saved, no submit
      { rows: [{ user_id: "user-3" }] }, // abandoned underwriting
      { rows: [{ user_id: "user-4" }] }, // financing interest
    ];

    const result = await runBehaviouralTriggerSweep();

    expect(result.queued).toBe(4);
    expect(state.executeCalls).toBe(3);
    const types = state.queued.map(q => q.triggerType);
    expect(types.filter(t => t === "saved_deal_no_submit")).toHaveLength(2);
    expect(types).toContain("abandoned_underwriting");
    expect(types).toContain("financing_interest");
  });

  it("queues nothing when every window comes back empty", async () => {
    const result = await runBehaviouralTriggerSweep();
    expect(result.queued).toBe(0);
    expect(state.queued).toHaveLength(0);
    // All three sweeps still ran.
    expect(state.executeCalls).toBe(3);
  });

  it("runs independently of the SLA sweep", async () => {
    // Scheduling split them onto different cadences, so neither may depend on
    // the other having run first.
    state.executeQueue = [{ rows: [{ user_id: "user-1" }] }, { rows: [] }, { rows: [] }];
    const result = await runBehaviouralTriggerSweep();
    expect(result.queued).toBe(1);
    expect(state.queued[0].triggerType).toBe("saved_deal_no_submit");
  });
});
