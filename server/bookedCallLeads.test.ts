/**
 * Route tests for the booked-call lead funnel (server/bookedCallLeads.ts).
 *
 * The db, auth, activity log, and BLD destination are mocked — these tests
 * exercise validation, session handling, admin gating, the pipeline PATCH,
 * and the forward-to-BLD hooks without a database or any external I/O.
 */
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock state ──────────────────────────────────────────────────────────────

const state = {
  insertReturning: [] as Record<string, unknown>[],
  insertedValues: [] as Record<string, unknown>[],
  selectRows: [] as Record<string, unknown>[],
  updateReturning: [] as Record<string, unknown>[],
  updateSets: [] as Record<string, unknown>[],
};

vi.mock("./db", () => {
  const makeSelectChain = () => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.orderBy = () => chain;
    chain.limit = async () => state.selectRows;
    return chain;
  };
  return {
    db: {
      insert: () => ({
        values: (v: Record<string, unknown>) => ({
          returning: async () => {
            state.insertedValues.push(v);
            return state.insertReturning;
          },
        }),
      }),
      select: () => makeSelectChain(),
      update: () => ({
        set: (s: Record<string, unknown>) => {
          state.updateSets.push(s);
          return {
            where: () => ({
              returning: async () => state.updateReturning,
            }),
          };
        },
      }),
    },
  };
});

vi.mock("./auth", () => ({
  isAdmin: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.headers["x-test-admin"] === "1") return next();
    return res.status(403).json({ message: "Forbidden - Admin access required" });
  },
  isAuthenticated: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("./userActivity", () => ({
  logUserActivity: vi.fn(async () => {}),
}));

vi.mock("./bldLeadDestination", () => ({
  bldDestinationStatus: vi.fn(() => ({ webhook: false, email: false, configured: false })),
  forwardLeadToBld: vi.fn(async () => ({ delivered: false as const, reason: "unconfigured" as const })),
}));

import { registerBookedCallLeadRoutes } from "./bookedCallLeads";
import { forwardLeadToBld } from "./bldLeadDestination";
import { logUserActivity } from "./userActivity";

const forwardMock = vi.mocked(forwardLeadToBld);
const activityMock = vi.mocked(logUserActivity);

function makeApp(session: Record<string, unknown> = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request & { session: Record<string, unknown> }).session = session;
    next();
  });
  registerBookedCallLeadRoutes(app);
  return app;
}

const validBody = {
  fullName: "Dana Investor",
  email: "dana@example.com",
  intent: "financing",
  sourcePage: "/tools/multiplex-underwriter",
};

beforeEach(() => {
  state.insertReturning = [{ id: "lead-1", ...validBody, status: "new", createdAt: new Date() }];
  state.insertedValues = [];
  state.selectRows = [];
  state.updateReturning = [];
  state.updateSets = [];
  forwardMock.mockClear();
  activityMock.mockClear();
});

// ─── POST /api/booked-call-leads ─────────────────────────────────────────────

describe("POST /api/booked-call-leads", () => {
  it("creates a lead anonymously and returns its id", async () => {
    const res = await request(makeApp()).post("/api/booked-call-leads").send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, id: "lead-1" });
    expect(state.insertedValues).toHaveLength(1);
    expect(state.insertedValues[0]).toMatchObject({
      userId: null,
      email: "dana@example.com",
      intent: "financing",
      sourcePage: "/tools/multiplex-underwriter",
    });
    // Status is left to the db default ("new").
    expect("status" in state.insertedValues[0]).toBe(false);
    // Anonymous submissions do not write user activity events.
    expect(activityMock).not.toHaveBeenCalled();
  });

  it("attaches the session user and logs activity when signed in", async () => {
    const res = await request(makeApp({ userId: "user-42" }))
      .post("/api/booked-call-leads")
      .send({ ...validBody, underwritingId: "uw-9" });
    expect(res.status).toBe(201);
    expect(state.insertedValues[0]).toMatchObject({ userId: "user-42", underwritingId: "uw-9" });
    expect(activityMock).toHaveBeenCalledTimes(1);
    expect(activityMock.mock.calls[0][1]).toMatchObject({
      userId: "user-42",
      eventName: "booked_call_requested",
    });
  });

  it("defaults intent to financing", async () => {
    const { intent: _omit, ...noIntent } = validBody;
    const res = await request(makeApp()).post("/api/booked-call-leads").send(noIntent);
    expect(res.status).toBe(201);
    expect(state.insertedValues[0]).toMatchObject({ intent: "financing" });
  });

  it("rejects an invalid email with 400 and does not insert", async () => {
    const res = await request(makeApp())
      .post("/api/booked-call-leads")
      .send({ ...validBody, email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(state.insertedValues).toHaveLength(0);
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown intent", async () => {
    const res = await request(makeApp())
      .post("/api/booked-call-leads")
      .send({ ...validBody, intent: "sales" });
    expect(res.status).toBe(400);
  });

  it("rejects a dealSnapshot with unknown keys (no arbitrary blobs)", async () => {
    const res = await request(makeApp())
      .post("/api/booked-call-leads")
      .send({ ...validBody, dealSnapshot: { address: "123 Logan Ave", resultJson: { huge: true } } });
    expect(res.status).toBe(400);
  });

  it("attempts the BLD forward with the created lead", async () => {
    await request(makeApp()).post("/api/booked-call-leads").send(validBody);
    expect(forwardMock).toHaveBeenCalledTimes(1);
    expect(forwardMock.mock.calls[0][0]).toMatchObject({ id: "lead-1" });
    expect(forwardMock.mock.calls[0][1]).toBe("created");
    // Unconfigured destination → no forwardedAt bookkeeping write.
    expect(state.updateSets).toHaveLength(0);
  });

  it("records forwardedAt/forwardedVia when a destination delivers", async () => {
    forwardMock.mockResolvedValueOnce({ delivered: true, via: "webhook" });
    const res = await request(makeApp()).post("/api/booked-call-leads").send(validBody);
    expect(res.status).toBe(201);
    expect(state.updateSets).toHaveLength(1);
    expect(state.updateSets[0]).toMatchObject({ forwardedVia: "webhook" });
    expect(state.updateSets[0].forwardedAt).toBeInstanceOf(Date);
  });

  it("still returns 201 when the forward throws — the lead is already stored", async () => {
    forwardMock.mockRejectedValueOnce(new Error("destination exploded"));
    const res = await request(makeApp()).post("/api/booked-call-leads").send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

// ─── GET /api/booked-call-leads ──────────────────────────────────────────────

describe("GET /api/booked-call-leads", () => {
  it("requires admin", async () => {
    const res = await request(makeApp()).get("/api/booked-call-leads");
    expect(res.status).toBe(403);
  });

  it("returns leads for an admin, newest first", async () => {
    state.selectRows = [
      { id: "lead-2", email: "b@example.com", status: "new" },
      { id: "lead-1", email: "a@example.com", status: "contacted" },
    ];
    const res = await request(makeApp()).get("/api/booked-call-leads").set("x-test-admin", "1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe("lead-2");
  });

  it("accepts a known ?status= filter and rejects unknown ones", async () => {
    state.selectRows = [];
    const ok = await request(makeApp()).get("/api/booked-call-leads?status=new").set("x-test-admin", "1");
    expect(ok.status).toBe(200);
    const bad = await request(makeApp()).get("/api/booked-call-leads?status=bogus").set("x-test-admin", "1");
    expect(bad.status).toBe(400);
  });
});

// ─── PATCH /api/booked-call-leads/:id ────────────────────────────────────────

describe("PATCH /api/booked-call-leads/:id", () => {
  it("requires admin", async () => {
    const res = await request(makeApp()).patch("/api/booked-call-leads/lead-1").send({ status: "contacted" });
    expect(res.status).toBe(403);
  });

  it("advances the pipeline status", async () => {
    state.updateReturning = [{ id: "lead-1", status: "contacted", email: "dana@example.com" }];
    const res = await request(makeApp())
      .patch("/api/booked-call-leads/lead-1")
      .set("x-test-admin", "1")
      .send({ status: "contacted" });
    expect(res.status).toBe(200);
    expect(res.body.lead.status).toBe("contacted");
    expect(state.updateSets[0]).toMatchObject({ status: "contacted" });
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("updates internal notes without touching status", async () => {
    state.updateReturning = [{ id: "lead-1", status: "new", notes: "left voicemail" }];
    const res = await request(makeApp())
      .patch("/api/booked-call-leads/lead-1")
      .set("x-test-admin", "1")
      .send({ notes: "left voicemail" });
    expect(res.status).toBe(200);
    expect(state.updateSets[0]).toMatchObject({ notes: "left voicemail" });
    expect(state.updateSets[0].status).toBeUndefined();
  });

  it("rejects unknown statuses", async () => {
    const res = await request(makeApp())
      .patch("/api/booked-call-leads/lead-1")
      .set("x-test-admin", "1")
      .send({ status: "qualified" });
    expect(res.status).toBe(400);
    expect(state.updateSets).toHaveLength(0);
  });

  it("rejects an empty update", async () => {
    const res = await request(makeApp())
      .patch("/api/booked-call-leads/lead-1")
      .set("x-test-admin", "1")
      .send({});
    expect(res.status).toBe(400);
  });

  it("404s on a missing lead", async () => {
    state.updateReturning = [];
    const res = await request(makeApp())
      .patch("/api/booked-call-leads/nope")
      .set("x-test-admin", "1")
      .send({ status: "contacted" });
    expect(res.status).toBe(404);
  });

  it("forwards to BLD when a lead is flipped", async () => {
    state.updateReturning = [{ id: "lead-1", status: "flipped", email: "dana@example.com", intent: "financing" }];
    const res = await request(makeApp())
      .patch("/api/booked-call-leads/lead-1")
      .set("x-test-admin", "1")
      .send({ status: "flipped" });
    expect(res.status).toBe(200);
    expect(forwardMock).toHaveBeenCalledTimes(1);
    expect(forwardMock.mock.calls[0][0]).toMatchObject({ id: "lead-1", status: "flipped" });
    expect(forwardMock.mock.calls[0][1]).toBe("flipped");
  });
});
