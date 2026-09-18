import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class AgentJobError extends Error {
    constructor(
      public status: number,
      public code: string,
      message?: string,
    ) {
      super(message || code);
      this.name = "AgentJobError";
    }
  }
  return {
    selectMock: vi.fn(),
    updateMock: vi.fn(),
    insertMock: vi.fn(),
    getRentEstimate: vi.fn(),
    executeMultiplexUnderwriter: vi.fn(),
    submitDealDesk: vi.fn(),
    AgentJobError,
    createAgentJob: vi.fn(),
    listAgentJobs: vi.fn(),
    getAgentJob: vi.fn(),
    approveAgentJob: vi.fn(),
    cancelAgentJob: vi.fn(),
  };
});

vi.mock("./db", () => ({
  db: {
    select: mocks.selectMock,
    update: mocks.updateMock,
    insert: mocks.insertMock,
  },
}));

vi.mock("./rentIntelligence", () => ({
  getRentEstimate: mocks.getRentEstimate,
}));

vi.mock("./multiplexUnderwriter", async () => {
  const { z } = await import("zod");
  return {
    underwriteRequestSchema: z.object({
      address: z.string().min(5),
      lotFrontageFt: z.number().optional(),
      lotDepthFt: z.number().optional(),
    }),
    executeMultiplexUnderwriter: mocks.executeMultiplexUnderwriter,
  };
});

vi.mock("./routes/dealDesk", async () => {
  const { z } = await import("zod");
  return {
    dealDeskSubmitSchema: z.object({
      name: z.string(),
      email: z.string().email(),
      address: z.string(),
      financingHelpWanted: z.boolean().default(false),
      buyingHelpWanted: z.boolean().default(false),
      consentEmail: z.boolean().default(false),
      consentSms: z.boolean().default(false),
    }),
    submitDealDesk: mocks.submitDealDesk,
  };
});

vi.mock("./storage", () => ({
  storage: {},
}));

vi.mock("./agentJobs", () => ({
  AgentJobError: mocks.AgentJobError,
  createAgentJob: mocks.createAgentJob,
  listAgentJobs: mocks.listAgentJobs,
  getAgentJob: mocks.getAgentJob,
  approveAgentJob: mocks.approveAgentJob,
  cancelAgentJob: mocks.cancelAgentJob,
  registerSpecialistExecutor: vi.fn(),
  serializeAgentJob: (job: any) => job,
}));

vi.mock("@shared/investmentMetrics", () => ({
  calculateInvestmentMetrics: vi.fn(),
}));

import { registerAgentRoutes } from "./agentApi";

function app() {
  const app = express();
  app.use(express.json());
  registerAgentRoutes(app);
  return app;
}

function mockDbAuth(scopes: string[] = []) {
  mocks.selectMock.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => [{ id: "key-1", userId: "user-1", revokedAt: null, scopes }],
      }),
    }),
  });
  mocks.updateMock.mockReturnValue({
    set: () => ({ where: () => ({ catch: vi.fn() }) }),
  });
  mocks.insertMock.mockReturnValue({
    values: () => ({ catch: vi.fn() }),
  });
}

describe("agent API new endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAuth();
  });

  it("requires bearer auth for estimate-rent", async () => {
    const response = await request(app()).post("/api/agent/estimate-rent").send({ bedrooms: 2, city: "Hamilton" });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("missing_bearer_token");
  });

  it("delegates estimate-rent to the rent estimator", async () => {
    mocks.getRentEstimate.mockResolvedValue({ monthlyRent: 2200, confidence: "medium" });

    const response = await request(app())
      .post("/api/agent/estimate-rent")
      .set("Authorization", "Bearer realist_live_testtoken")
      .send({ bedrooms: 2, city: "Hamilton", province: "Ontario" });

    expect(response.status).toBe(200);
    expect(response.body.estimate.monthlyRent).toBe(2200);
    expect(mocks.getRentEstimate).toHaveBeenCalledWith(expect.objectContaining({
      bedrooms: 2,
      city: "Hamilton",
      userId: "user-1",
    }));
  });

  it("delegates underwrite-multiplex to the multiplex engine", async () => {
    mocks.executeMultiplexUnderwriter.mockResolvedValue({ status: "needs_lot_dimensions" });

    const response = await request(app())
      .post("/api/agent/underwrite-multiplex")
      .set("Authorization", "Bearer realist_live_testtoken")
      .send({ address: "123 Main St Toronto" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("needs_lot_dimensions");
    expect(mocks.executeMultiplexUnderwriter).toHaveBeenCalledWith(expect.objectContaining({
      address: "123 Main St Toronto",
    }), expect.objectContaining({ userId: "user-1" }));
  });

  it("delegates deal-desk-submit with agent_api attribution", async () => {
    mocks.submitDealDesk.mockResolvedValue({ ok: true, opportunityId: "opp-1" });

    const response = await request(app())
      .post("/api/agent/deal-desk-submit")
      .set("Authorization", "Bearer realist_live_testtoken")
      .send({ name: "Dan", email: "dan@example.com", address: "123 Main St" });

    expect(response.status).toBe(200);
    expect(response.body.opportunityId).toBe("opp-1");
    expect(mocks.submitDealDesk).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      userId: "user-1",
      source: "agent_api",
      sourcePage: "/api/agent/deal-desk-submit",
    }));
  });

  it("passes agent_api demand source through find-deals exactly once", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ listings: [], total: 0, filters_applied: {} }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app())
      .post("/api/agent/find-deals")
      .set("Authorization", "Bearer realist_live_testtoken")
      .send({ query: "duplexes in Hamilton under 900k" });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      query: "duplexes in Hamilton under 900k",
      demandSource: "agent_api",
      demandChannel: "api",
      demandApiKeyId: "key-1",
      demandUserId: "user-1",
    });
    vi.unstubAllGlobals();
  });

  it("blocks community publishing without community:write", async () => {
    const response = await request(app())
      .post("/api/agent/community/submit")
      .set("Authorization", "Bearer realist_live_testtoken")
      .send({ mlsNumber: "X123", visibility: "public" });

    expect(response.status).toBe(403);
    expect(response.body.requiredScope).toBe("community:write");
  });
});

function sampleJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    type: "underwrite.custom",
    status: "succeeded",
    input: { address: "10 Queen St", price: 500000 },
    result: { underwriting: { capRate: 5.1 } },
    error: null,
    specialistId: "realist.underwrite",
    createdByUserId: "user-1",
    createdByApiKeyId: "key-1",
    approvalRequired: false,
    approvedAt: null,
    approvedByUserId: null,
    idempotencyKey: "idem-1",
    auditTrail: [],
    createdAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
    ...overrides,
  };
}

describe("agent API jobs spine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAuth();
  });

  it("requires bearer auth for job create", async () => {
    const response = await request(app())
      .post("/api/agent/jobs")
      .send({ type: "underwrite.custom", input: { address: "10 Queen", price: 1 } });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("missing_bearer_token");
  });

  it("creates an underwrite.custom job with the existing underwrite scope", async () => {
    mocks.createAgentJob.mockResolvedValue({ job: sampleJob(), replayed: false });

    const response = await request(app())
      .post("/api/agent/jobs")
      .set("Authorization", "Bearer realist_live_testtoken")
      .send({
        type: "underwrite.custom",
        input: { address: "10 Queen St", price: 500000 },
        idempotencyKey: "idem-1",
      });

    expect(response.status).toBe(201);
    expect(response.body.job.id).toBe("job-1");
    expect(response.body.replayed).toBe(false);
    expect(mocks.createAgentJob).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      apiKeyId: "key-1",
      request: expect.objectContaining({ type: "underwrite.custom", idempotencyKey: "idem-1" }),
    }));
  });

  it("replays an idempotent create as 200", async () => {
    mocks.createAgentJob.mockResolvedValue({ job: sampleJob(), replayed: true });

    const response = await request(app())
      .post("/api/agent/jobs")
      .set("Authorization", "Bearer realist_live_testtoken")
      .send({ type: "underwrite.custom", input: { address: "10 Queen St", price: 500000 }, idempotencyKey: "idem-1" });

    expect(response.status).toBe(200);
    expect(response.body.replayed).toBe(true);
  });

  it("blocks forms.fill without forms:write or jobs:write", async () => {
    const response = await request(app())
      .post("/api/agent/jobs")
      .set("Authorization", "Bearer realist_live_testtoken")
      .send({ type: "forms.fill", input: { formId: "orea-123" } });

    expect(response.status).toBe(403);
    expect(response.body.requiredScope).toBe("forms:write");
    expect(mocks.createAgentJob).not.toHaveBeenCalled();
  });

  it("lists the caller's jobs", async () => {
    mocks.listAgentJobs.mockResolvedValue([sampleJob()]);

    const response = await request(app())
      .get("/api/agent/jobs")
      .set("Authorization", "Bearer realist_live_testtoken");

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.jobs[0].id).toBe("job-1");
    expect(mocks.listAgentJobs).toHaveBeenCalledWith("user-1", 25);
  });

  it("gets a job by id", async () => {
    mocks.getAgentJob.mockResolvedValue(sampleJob());

    const response = await request(app())
      .get("/api/agent/jobs/job-1")
      .set("Authorization", "Bearer realist_live_testtoken");

    expect(response.status).toBe(200);
    expect(response.body.job.type).toBe("underwrite.custom");
    expect(mocks.getAgentJob).toHaveBeenCalledWith("job-1", "user-1");
  });

  it("approves a needs_approval job", async () => {
    mocks.getAgentJob.mockResolvedValue(sampleJob({ type: "forms.fill", status: "needs_approval" }));
    mocks.approveAgentJob.mockResolvedValue(sampleJob({ type: "forms.fill", status: "succeeded" }));
    mockDbAuth(["forms:write"]);

    const response = await request(app())
      .post("/api/agent/jobs/job-1/approve")
      .set("Authorization", "Bearer realist_live_testtoken");

    expect(response.status).toBe(200);
    expect(response.body.job.status).toBe("succeeded");
    expect(mocks.approveAgentJob).toHaveBeenCalledWith("job-1", "user-1");
  });

  it("returns 409 when approve is not allowed", async () => {
    mocks.getAgentJob.mockResolvedValue(sampleJob({ status: "succeeded" }));
    mocks.approveAgentJob.mockRejectedValue(new mocks.AgentJobError(409, "invalid_transition", "Cannot approve a job in status succeeded."));

    const response = await request(app())
      .post("/api/agent/jobs/job-1/approve")
      .set("Authorization", "Bearer realist_live_testtoken");

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("invalid_transition");
  });

  it("cancels a cancellable job", async () => {
    mocks.getAgentJob.mockResolvedValue(sampleJob({ status: "queued" }));
    mocks.cancelAgentJob.mockResolvedValue(sampleJob({ status: "cancelled" }));

    const response = await request(app())
      .post("/api/agent/jobs/job-1/cancel")
      .set("Authorization", "Bearer realist_live_testtoken");

    expect(response.status).toBe(200);
    expect(response.body.job.status).toBe("cancelled");
  });

  it("serves OpenAPI behind the read scope", async () => {
    const response = await request(app())
      .get("/api/agent/openapi.json")
      .set("Authorization", "Bearer realist_live_testtoken");

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe("3.0.3");
    expect(response.body.paths["/api/agent/jobs"]).toBeTruthy();
    expect(response.body.paths["/api/agent/underwrite/listing"]).toBeTruthy();
  });
});
