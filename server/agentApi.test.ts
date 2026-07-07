import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectMock: vi.fn(),
  updateMock: vi.fn(),
  insertMock: vi.fn(),
  getRentEstimate: vi.fn(),
  executeMultiplexUnderwriter: vi.fn(),
  submitDealDesk: vi.fn(),
}));

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
