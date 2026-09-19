/**
 * End-to-end over HTTP (supertest): one tool registry served as legacy REST,
 * /api/v1 + OpenAPI, and the hosted MCP endpoint — plus the hosted views those
 * tools hand back.
 */
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectMock: vi.fn(),
  updateMock: vi.fn(),
  insertMock: vi.fn(),
  usageRows: [] as any[],
  getRentEstimate: vi.fn(),
  executeMultiplexUnderwriter: vi.fn(),
  submitDealDesk: vi.fn(),
  createAnalysis: vi.fn(),
  getAnalysis: vi.fn(),
  getAnalysesByUser: vi.fn(),
  getMarketSnapshots: vi.fn(),
}));

vi.mock("../db", () => ({
  db: { select: mocks.selectMock, update: mocks.updateMock, insert: mocks.insertMock },
}));
vi.mock("../rentIntelligence", () => ({ getRentEstimate: mocks.getRentEstimate }));
vi.mock("../multiplexUnderwriter", async () => {
  const { z } = await import("zod");
  return {
    underwriteRequestSchema: z.object({ address: z.string().min(5).optional(), lotFrontageFt: z.number().optional(), lotDepthFt: z.number().optional() }),
    executeMultiplexUnderwriter: mocks.executeMultiplexUnderwriter,
  };
});
vi.mock("../routes/dealDesk", async () => {
  const { z } = await import("zod");
  return {
    dealDeskSubmitSchema: z.object({ name: z.string(), email: z.string().email(), address: z.string() }),
    submitDealDesk: mocks.submitDealDesk,
  };
});
vi.mock("../storage", () => ({
  storage: {
    createAnalysis: mocks.createAnalysis,
    getAnalysis: mocks.getAnalysis,
    getAnalysesByUser: mocks.getAnalysesByUser,
    getMarketSnapshots: mocks.getMarketSnapshots,
  },
}));

import { registerAgentRoutes } from "../agentApi";
import { registerAgentV1Routes } from "./v1Routes";
import { registerMcpRoutes } from "./mcpServer";
import { AGENT_TOOLS, getAgentTool, toolInputJsonSchema, toolsForScopes } from "./tools";
import { buildOpenApiDocument } from "./openapi";
import { createMemoryAgentViewStore, setAgentViewStore } from "./viewStore";

const KEY = "realist_live_testtoken";
const AUTH = { Authorization: `Bearer ${KEY}` };
const MCP_HEADERS = { ...AUTH, Accept: "application/json, text/event-stream", "Content-Type": "application/json" };

function app() {
  const app = express();
  app.use(express.json());
  registerAgentRoutes(app);
  registerAgentV1Routes(app);
  registerMcpRoutes(app);
  return app;
}

function mockKey(scopes: string[] = ["read", "underwrite", "deal:submit"]) {
  mocks.selectMock.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => [{ id: "key-1", userId: "user-1", revokedAt: null, scopes, usagePayloadConsentAt: new Date(), email: "dan@example.com" }],
      }),
    }),
  });
  mocks.updateMock.mockReturnValue({ set: () => ({ where: () => ({ catch: vi.fn() }) }) });
  mocks.insertMock.mockReturnValue({
    values: (row: any) => {
      mocks.usageRows.push(row);
      return { catch: vi.fn() };
    },
  });
}

const rpc = (method: string, params: unknown = {}, id = 1) => ({ jsonrpc: "2.0", id, method, params });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.usageRows.length = 0;
  mockKey();
  setAgentViewStore(createMemoryAgentViewStore());
  mocks.createAnalysis.mockImplementation(async (row: any) => ({ id: "analysis-1", ...row }));
});

describe("tool registry", () => {
  it("has unique, prefixed names with model-facing descriptions and object input schemas", () => {
    const names = AGENT_TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const tool of AGENT_TOOLS) {
      expect(tool.name).toMatch(/^realist_[a-z_]+$/);
      expect(tool.description.length).toBeGreaterThan(60);
      const schema = toolInputJsonSchema(tool) as any;
      expect(schema.type).toBe("object");
      expect(schema.$schema).toBeUndefined();
    }
  });

  it("publishes per-field descriptions, including for schemas owned by other modules", () => {
    const custom = toolInputJsonSchema(getAgentTool("realist_underwrite_custom")!) as any;
    expect(custom.required).toEqual(["address", "price"]);
    expect(custom.properties.expenseRatio.description).toMatch(/ALL-IN/);
    const multiplex = toolInputJsonSchema(getAgentTool("realist_underwrite_multiplex")!) as any;
    expect(multiplex.properties.lotFrontageFt.description).toMatch(/feet/);
  });

  it("still answers to the tool names the stdio package shipped with", () => {
    expect(getAgentTool("estimate_rent")?.name).toBe("realist_estimate_rent");
    expect(getAgentTool("underwrite_multiplex")?.name).toBe("realist_underwrite_multiplex");
    expect(getAgentTool("submit_to_deal_desk")?.name).toBe("realist_submit_to_deal_desk");
  });

  it("only offers a key the tools its scopes allow", () => {
    const names = toolsForScopes(["read"]).map((tool) => tool.name);
    expect(names).toContain("realist_find_deals");
    expect(names).not.toContain("realist_underwrite_custom");
    expect(names).not.toContain("realist_update_referral");
  });

  it("generates an OpenAPI document with one operation per tool", () => {
    const doc = buildOpenApiDocument() as any;
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths)).toHaveLength(AGENT_TOOLS.length);
    expect(doc.paths["/tools/realist_underwrite_custom"].post.operationId).toBe("realist_underwrite_custom");
    expect(doc.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
  });
});

describe("/api/v1", () => {
  it("serves discovery without a key", async () => {
    const index = await request(app()).get("/api/v1");
    expect(index.status).toBe(200);
    expect(index.body.mcp.url).toBe("https://realist.ca/mcp");

    const tools = await request(app()).get("/api/v1/tools");
    expect(tools.body.count).toBe(AGENT_TOOLS.length);
    expect(tools.body.tools[0]).toHaveProperty("inputSchema");

    const openapi = await request(app()).get("/api/v1/openapi.json");
    expect(openapi.body.servers[0].url).toBe("https://realist.ca/api/v1");
  });

  it("refuses to run a tool without a key", async () => {
    const response = await request(app()).post("/api/v1/tools/realist_underwrite_custom").send({ address: "x", price: 1 });
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("missing_bearer_token");
  });

  it("underwrites, saves the analysis, and hands back a hosted view", async () => {
    const response = await request(app())
      .post("/api/v1/tools/realist_underwrite_custom")
      .set(AUTH)
      .send({ address: "123 Main St", city: "Hamilton", province: "ON", price: 750000, monthlyRent: 4200, units: 3 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, tool: "realist_underwrite_custom" });
    const { result } = response.body;
    expect(result.analysisId).toBe("analysis-1");
    expect(result.underwriting.capRate).toBeGreaterThan(3);
    expect(result.summary).toMatch(/^Cap rate /);
    expect(result.view.url).toMatch(/^https:\/\/realist\.ca\/v\/[A-Za-z0-9_-]{22}$/);
    expect(result.view.instructions).toMatch(/Give this link to the user/);
    // Provided rent → the rent engine is never consulted.
    expect(mocks.getRentEstimate).not.toHaveBeenCalled();

    // The saved row is shaped like a web-analyzer analysis (typed metric columns derive from it).
    const saved = mocks.createAnalysis.mock.calls[0][0];
    expect(saved.userId).toBe("user-1");
    expect(saved.inputsJson).toMatchObject({ purchasePrice: 750000, monthlyRent: 4200, source: "agent_api" });
    expect(saved.resultsJson.yearlyProjections).toHaveLength(10);
    expect(saved.resultsJson.capRate).toBe(result.underwriting.capRate);

    // Metered under the v1 path, with the consented structured summary.
    expect(mocks.usageRows.at(-1)).toMatchObject({ endpoint: "/api/v1/tools/realist_underwrite_custom", status: 200, inputSummary: { city: "Hamilton", price: 750000 } });
  });

  it("estimates rent per unit from TOTAL bedrooms when the caller gives none", async () => {
    mocks.getRentEstimate.mockResolvedValue({ monthlyRent: 5400, rangeLow: 4800, rangeHigh: 6000, method: "city_comps", confidence: "medium", compCount: 14, radiusKm: null, bedroomBand: "2", units: 3, modelKey: "rent", modelVersion: "v1" });

    const response = await request(app())
      .post("/api/v1/tools/realist_underwrite_custom")
      .set(AUTH)
      .send({ address: "123 Main St", city: "Hamilton", price: 750000, units: 3, beds: 6 });

    expect(mocks.getRentEstimate).toHaveBeenCalledWith(expect.objectContaining({ bedrooms: 2, units: 3, city: "Hamilton", userId: "user-1" }));
    expect(response.body.result.underwriting).toMatchObject({ monthlyRent: 5400, rentSource: "realist_estimate" });
    expect(response.body.result.underwriting.warnings[0]).toMatch(/Realist estimate \(city comps, 14 comps, medium confidence\)/);
  });

  it("rejects bad input and unknown tools with actionable errors", async () => {
    const invalid = await request(app()).post("/api/v1/tools/realist_underwrite_custom").set(AUTH).send({ address: "x" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toBe("invalid_input");
    expect(invalid.body.details[0].path).toEqual(["price"]);

    const unknown = await request(app()).post("/api/v1/tools/nope").set(AUTH).send({});
    expect(unknown.status).toBe(404);
    expect(unknown.body.available).toContain("realist_find_deals");
  });

  it("reports a city's market history (the old route 404'd on every city)", async () => {
    mocks.getMarketSnapshots.mockResolvedValue([
      { city: "Hamilton", province: "ON", month: "2026-07", dealCount: 12, medianCapRate: 4.9, avgCapRate: 5.1, medianPurchasePrice: 720000 },
      { city: "Hamilton", province: "ON", month: "2026-08", dealCount: 15, medianCapRate: 5.2, avgCapRate: 5.3, medianPurchasePrice: 735000 },
      { city: "Toronto", province: "ON", month: "2026-08", dealCount: 40, medianCapRate: 3.9, avgCapRate: 4.0, medianPurchasePrice: 1150000 },
    ]);

    const city = await request(app()).get("/api/agent/market-report?city=hamilton").set(AUTH);
    expect(city.status).toBe(200);
    expect(city.body.latest.month).toBe("2026-08");
    expect(city.body.history).toHaveLength(2);
    expect(city.body.view.kind).toBe("report");

    const all = await request(app()).get("/api/agent/market-report").set(AUTH);
    expect(all.body.cities.map((row: any) => row.city)).toEqual(["Hamilton", "Toronto"]);

    // A month nobody underwrote a deal in is an empty row: never the headline, never plotted as 0.
    mocks.getMarketSnapshots.mockResolvedValue([
      { city: "Hamilton", province: "ON", month: "2026-07", dealCount: 12, medianCapRate: 4.9, avgCapRate: 5.1, medianPurchasePrice: 720000 },
      { city: "Hamilton", province: "ON", month: "2026-08", dealCount: 15, medianCapRate: 5.2, avgCapRate: 5.3, medianPurchasePrice: 735000 },
      { city: "Hamilton", province: "ON", month: "2026-09", dealCount: 0, medianCapRate: null, avgCapRate: null, medianPurchasePrice: null },
    ]);
    const sparse = await request(app()).get("/api/agent/market-report?city=Hamilton").set(AUTH);
    expect(sparse.body.latest.month).toBe("2026-08");
    expect(sparse.body.latestMonthWithData).toBe("2026-08");
    expect(sparse.body.history).toHaveLength(3);
    const sparseView = await request(app()).get(`/api/views/${String(sparse.body.view.url).split("/v/")[1]}`);
    const charts = sparseView.body.document.sections.filter((section: any) => section.type === "chart");
    expect(charts[0].data.map((row: any) => row.month)).toEqual(["2026-07", "2026-08"]);
    expect(JSON.stringify(charts)).not.toMatch(/"medianCapRate":0|"medianPurchasePrice":0/);
    expect(sparseView.body.document.sections.find((section: any) => section.type === "callout" && section.tone === "warning").body).toMatch(/since 2026-08/);

    mocks.getMarketSnapshots.mockResolvedValue([
      { city: "Hamilton", province: "ON", month: "2026-08", dealCount: 15, medianCapRate: 5.2, avgCapRate: 5.3, medianPurchasePrice: 735000 },
      { city: "Toronto", province: "ON", month: "2026-08", dealCount: 40, medianCapRate: 3.9, avgCapRate: 4.0, medianPurchasePrice: 1150000 },
    ]);
    const missing = await request(app()).get("/api/agent/market-report?city=Atlantis").set(AUTH);
    expect(missing.status).toBe(404);
    expect(missing.body.availableCities).toEqual(["Hamilton", "Toronto"]);
  });
});

describe("tools that hand back a visual", () => {
  it("turns a deal search into a ranked, linkable shortlist", async () => {
    const listing = (mls: string, street: string, price: number, cap: number) => ({
      mlsNumber: mls,
      address: { streetNumber: "12", streetName: street, streetSuffix: "St", city: "Hamilton" },
      price,
      cap_rate: cap,
      cash_on_cash: 2.1,
      deal_score: 71,
      explanation: "Strong rent-to-price ratio",
      daysOnMarket: 9,
      numberOfUnitsTotal: 4,
      monthlyRent: 6100,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ listings: [listing("X1", "King", 880000, 6.2), listing("X2", "Queen", 910000, 5.4)], total: 37, filters_applied: { city: "Hamilton" } }),
    }));

    const response = await request(app()).post("/api/v1/tools/realist_find_deals").set(AUTH).send({ query: "4-plex in Hamilton under 900k", limit: 500 });
    vi.unstubAllGlobals();

    expect(response.status).toBe(200); // an oversized limit is capped, not rejected
    const { result } = response.body;
    expect(result.listings[0]).toMatchObject({ mlsNumber: "X1", capRate: 6.2, url: "https://realist.ca/listings/X1" });
    const view = await request(app()).get(`/api/views/${String(result.view.url).split("/v/")[1]}`);
    const sections = view.body.document.sections;
    expect(sections.map((section: any) => section.type)).toEqual(["statGrid", "chart", "table", "narrative"]);
    expect(sections[0].stats[0]).toMatchObject({ label: "Matches", value: "37" });
    expect(sections[2].rows[0]).toMatchObject({ address: "12 King St, Hamilton", href: "/listings/X1", capRate: 6.2 });
  });

  it("shows a rent estimate with its range and confidence, and warns when data is thin", async () => {
    mocks.getRentEstimate.mockResolvedValue({ monthlyRent: 2150, rangeLow: 1900, rangeHigh: 2400, method: "cmhc_baseline", confidence: "low", compCount: 0, radiusKm: null, bedroomBand: "2", units: 1, modelKey: "rent", modelVersion: "v3" });

    const response = await request(app()).post("/api/v1/tools/realist_estimate_rent").set(AUTH).send({ bedrooms: 2, city: "Sudbury" });
    const view = await request(app()).get(`/api/views/${String(response.body.result.view.url).split("/v/")[1]}`);

    expect(view.body.document.title).toBe("Rent estimate — 2-bedroom in Sudbury");
    expect(view.body.document.sections.find((section: any) => section.type === "callout")).toMatchObject({ tone: "warning" });

    mocks.getRentEstimate.mockResolvedValue(null);
    const none = await request(app()).post("/api/v1/tools/realist_estimate_rent").set(AUTH).send({ bedrooms: 2, city: "Nowhere" });
    expect(none.body.result).toMatchObject({ estimate: null, reason: "no_data_for_market", view: null });
  });

  it("links a multiplex underwrite to the existing interactive model page", async () => {
    mocks.executeMultiplexUnderwriter.mockResolvedValue({ status: "complete", id: "mu-1", shareToken: "abc123abc123abc123abc123", site: { address: "10 Elm Ave, Toronto" }, underwrite: { maxUnitsAsOfRight: 4, winner: { hold: "Fourplex + garden suite", flip: null } } });

    const response = await request(app()).post("/api/v1/tools/realist_underwrite_multiplex").set(AUTH).send({ address: "10 Elm Ave, Toronto", lotFrontageFt: 25, lotDepthFt: 120 });

    expect(response.body.result.view).toMatchObject({
      kind: "multiplex_model",
      url: "https://realist.ca/tools/multiplex-underwriter?share=abc123abc123abc123abc123",
    });
    expect(response.body.result.summary).toMatch(/up to 4 units as-of-right · best hold configuration: Fourplex \+ garden suite/);

    const typed = Object.assign(new Error("We could not find that Toronto address."), { name: "SiteResolutionError" });
    mocks.executeMultiplexUnderwriter.mockRejectedValue(typed);
    const failed = await request(app()).post("/api/v1/tools/realist_underwrite_multiplex").set(AUTH).send({ address: "nowhere at all" });
    expect(failed.status).toBe(422);
    expect(failed.body).toMatchObject({ error: "underwrite_multiplex_failed", code: "SiteResolutionError" });
  });
});

describe("hosted views", () => {
  async function createView() {
    const response = await request(app())
      .post("/api/v1/tools/realist_underwrite_custom")
      .set(AUTH)
      .send({ address: "123 Main St", city: "Hamilton", price: 750000, monthlyRent: 4200, units: 3 });
    return String(response.body.result.view.url).split("/v/")[1];
  }

  it("serves the document to anyone holding the link — without leaking who made it", async () => {
    const token = await createView();
    const response = await request(app()).get(`/api/views/${token}`);

    expect(response.status).toBe(200);
    expect(response.headers["x-robots-tag"]).toMatch(/noindex/);
    expect(response.body.kind).toBe("underwriting");
    expect(response.body.document.title).toBe("123 Main St, Hamilton");
    expect(response.body.document.inputs).toMatchObject({ purchasePrice: 750000, monthlyRent: 4200, closingCosts: 22500 });
    expect(response.body.document.assumptionNotes.join(" ")).toMatch(/Property tax estimated/);
    expect(JSON.stringify(response.body)).not.toMatch(/user-1|key-1|analysis-1/);
  });

  it("404s on unknown or malformed tokens", async () => {
    expect((await request(app()).get("/api/views/AAAAAAAAAAAAAAAAAAAAAA")).status).toBe(404);
    expect((await request(app()).get("/api/views/not%20a%20token")).status).toBe(404);
  });

  it("downloads the Excel model — original, or re-built from the visitor's edited assumptions", async () => {
    const token = await createView();
    const original = await request(app()).get(`/api/views/${token}/model.xlsx`).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(original.status).toBe(200);
    expect(original.headers["content-type"]).toMatch(/spreadsheetml/);
    expect(original.headers["content-disposition"]).toBe('attachment; filename="realist-123-main-st-hamilton.xlsx"');
    expect((original.body as Buffer).subarray(0, 2).toString()).toBe("PK");

    const { body: view } = await request(app()).get(`/api/views/${token}`);
    const edited = await request(app()).post(`/api/views/${token}/model.xlsx`).send({ inputs: { ...view.document.inputs, interestRate: 4.25 } });
    expect(edited.status).toBe(200);
    const bad = await request(app()).post(`/api/views/${token}/model.xlsx`).send({ inputs: { purchasePrice: -5 } });
    expect(bad.status).toBe(400);

    const csv = await request(app()).get(`/api/views/${token}/proforma.csv`);
    expect(csv.text.split("\n")[0]).toMatch(/^Line item,Year 1,/);
  });

  it("lets the owner list and delete their views, and nobody else", async () => {
    const token = await createView();
    const list = await request(app()).get("/api/v1/views").set(AUTH);
    expect(list.body.views[0]).toMatchObject({ token, kind: "underwriting", url: `https://realist.ca/v/${token}` });

    expect((await request(app()).delete(`/api/v1/views/${token}`)).status).toBe(401);
    expect((await request(app()).delete(`/api/v1/views/${token}`).set(AUTH)).body).toEqual({ deleted: true });
    expect((await request(app()).get(`/api/views/${token}`)).status).toBe(404);
  });
});

describe("hosted MCP endpoint", () => {
  it("demands a key and says how to get one", async () => {
    const response = await request(app()).post("/mcp").set({ Accept: MCP_HEADERS.Accept }).send(rpc("initialize"));
    expect(response.status).toBe(401);
    expect(response.headers["www-authenticate"]).toMatch(/Bearer realm="realist".*account\/api-keys/);
  });

  it("initializes statelessly with usage instructions for the model", async () => {
    const response = await request(app()).post("/mcp").set(MCP_HEADERS).send(rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0.0" },
    }));

    expect(response.status).toBe(200);
    expect(response.headers["mcp-session-id"]).toBeUndefined();
    expect(response.body.result.serverInfo.name).toBe("realist");
    expect(response.body.result.capabilities.tools).toBeDefined();
    expect(response.body.result.instructions).toMatch(/ALWAYS show that link to the user/);
  });

  it("lists only the tools the key's scopes allow", async () => {
    mockKey(["read"]);
    const response = await request(app()).post("/mcp").set(MCP_HEADERS).send(rpc("tools/list"));
    const names = response.body.result.tools.map((tool: any) => tool.name);

    expect(names).toContain("realist_find_deals");
    expect(names).not.toContain("realist_underwrite_custom");
    const findDeals = response.body.result.tools.find((tool: any) => tool.name === "realist_find_deals");
    expect(findDeals.inputSchema.required).toEqual(["query"]);
    expect(findDeals.annotations.readOnlyHint).toBe(true);
  });

  it("runs a tool, leading the result with the headline and the link to show the user", async () => {
    const response = await request(app()).post("/mcp").set(MCP_HEADERS).send(rpc("tools/call", {
      name: "realist_underwrite_custom",
      arguments: { address: "123 Main St", city: "Hamilton", price: 750000, monthlyRent: 4200, units: 3 },
    }));

    expect(response.status).toBe(200);
    const { result } = response.body;
    expect(result.isError).toBeUndefined();
    const [headline, link] = result.content[0].text.split("\n");
    expect(headline).toMatch(/^Cap rate .* cash flow /);
    expect(link).toMatch(/^Interactive view: https:\/\/realist\.ca\/v\//);
    const payload = JSON.parse(result.content[0].text.slice(result.content[0].text.indexOf("\n\n") + 2));
    expect(payload.underwriting.units).toBe(3);

    expect(mocks.usageRows.at(-1)).toMatchObject({ method: "MCP", endpoint: "mcp:realist_underwrite_custom", status: 200 });
  });

  it("returns tool failures as results the model can act on, and meters them", async () => {
    mockKey(["read"]);
    const scope = await request(app()).post("/mcp").set(MCP_HEADERS).send(rpc("tools/call", { name: "realist_underwrite_custom", arguments: { address: "x", price: 5 } }));
    expect(scope.body.result.isError).toBe(true);
    expect(JSON.parse(scope.body.result.content[0].text)).toMatchObject({ error: "scope_required", requiredScope: "underwrite" });
    expect(mocks.usageRows.at(-1)).toMatchObject({ endpoint: "mcp:realist_underwrite_custom", status: 403 });

    mockKey();
    const invalid = await request(app()).post("/mcp").set(MCP_HEADERS).send(rpc("tools/call", { name: "realist_underwrite_custom", arguments: { address: "x" } }));
    expect(JSON.parse(invalid.body.result.content[0].text).error).toBe("invalid_input");

    const unknown = await request(app()).post("/mcp").set(MCP_HEADERS).send(rpc("tools/call", { name: "nope", arguments: {} }));
    expect(unknown.body.error.message).toMatch(/Unknown tool/);
  });

  it("accepts the key in the URL for connector UIs that cannot send headers", async () => {
    const response = await request(app())
      .post(`/mcp/u/${KEY}`)
      .set({ Accept: MCP_HEADERS.Accept })
      .send(rpc("tools/call", { name: "realist_whoami", arguments: {} }));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toMatchObject({ ok: true, keyId: "key-1" });
  });

  it("is POST-only (stateless: no stream to open, no session to end)", async () => {
    const response = await request(app()).get("/mcp").set(MCP_HEADERS);
    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe("POST");
  });
});
