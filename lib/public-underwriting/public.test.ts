import { beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { calculateInvestmentMetrics } from "@/lib/underwriting/investmentMetrics";
import { underwrite, atPrice } from "@/lib/underwriting/underwriter";
import { rentalRoute } from "./http";
import { calculateRental, SAMPLE, PUBLIC_BASE } from "./service";
import { parseRental, parseQuery, readJson } from "./model";
import { rentalReport, rentalSvg } from "./visuals";
import { mcpPost, mcpGet } from "./mcp";
import { publicMultiplexSchema } from "./multiplex";
import { UNDERWRITING_OPENAPI } from "./openapi";
import { GET as chartPng } from "@/app/api/underwriting/chart.png/route";
import { writeFileSync } from "node:fs";
import robots from "@/app/robots";

const token = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/lib/auth/throttle", () => ({ takeToken: token, clientIp: () => "test-client" }));
beforeEach(() => token.mockReset().mockResolvedValue(true));
const sampleRequest = () => new Request(`${PUBLIC_BASE}/api/underwriting?${new URLSearchParams(Object.entries(SAMPLE).map(([key, value]) => [key, String(value)]))}`);

describe("public underwriting", () => {
  it("uses the established Canadian mortgage engine and all cash invested", () => {
    const result = calculateRental(parseRental(SAMPLE));
    const direct = calculateInvestmentMetrics(750000, { monthlyRent: 5400, unitCount: 3, downPaymentPercent: 25, interestRate: 5.5, amortizationYears: 25, vacancyPercent: 5, managementPercent: 8, maintenancePercent: 5, annualPropertyTax: 6500, annualInsurance: 2400, closingCosts: result.inputs.closingCosts });
    expect(result.metrics.monthlyDebtService).toBe(direct.monthlyDebtService);
    expect(result.metrics.cashOnCashReturn).toBe(direct.cashOnCashReturn);
    expect(result.metrics.cashInvested).toBe(750000 * .25 + result.inputs.closingCosts);
    expect(result.provenance.interestRate).toBe("caller_supplied");
    expect(result.provenance.vacancyPercent).toBe("model_default");
    expect(result.sensitivity[3].metrics.monthlyCashFlow).toBe(underwrite({ ...result.inputs, interestRate: 6.5 }).monthlyCashFlow);
  });
  it("honours zero-dollar overrides and provides a truthful all-cash result", () => {
    const result = calculateRental(parseRental({ price: 500000, monthlyRent: 3000, downPaymentPercent: 100, annualPropertyTax: 0, annualInsurance: 0 }));
    expect(result.inputs.annualPropertyTax).toBe(0);
    expect(result.metrics.monthlyDebtService).toBe(0);
    expect(result.metrics.dscr).toBeNull();
    expect(result.verdict.headline).toMatch(/all-cash/);
    expect(result.verdict.detail).not.toMatch(/undefined/);
  });
  it("replays exact normalized inputs and default provenance from visual links", () => {
    const first = calculateRental(parseRental(SAMPLE));
    const second = calculateRental(parseRental(parseQuery(new Request(first.visuals.json))));
    expect(second.inputs).toEqual(first.inputs);
    expect(second.metrics).toEqual(first.metrics);
    expect(second.provenance).toEqual(first.provenance);
  });
  it("returns a target-meeting offer within the advertised bounds", () => {
    const result = calculateRental(parseRental(SAMPLE));
    const price = result.offerPrices.dscr120!;
    expect(price).toBeGreaterThanOrEqual(SAMPLE.price * .05);
    expect(price).toBeLessThanOrEqual(SAMPLE.price * 3);
    expect(underwrite(atPrice(result.inputs, price)).dscr).toBeGreaterThanOrEqual(1.2);
    expect(underwrite(atPrice(result.inputs, price + 200)).dscr).toBeLessThan(1.2);
  });
  it("requires no credentials, supports GET/POST and returns CORS on errors", async () => {
    const get = await rentalRoute(sampleRequest());
    const post = await rentalRoute(new Request(`${PUBLIC_BASE}/api/underwriting`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(SAMPLE) }));
    expect(get.status).toBe(200);
    expect(await get.json()).toEqual(await post.json());
    expect(get.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(get.headers.get("Set-Cookie")).toBeNull();
    const invalid = await rentalRoute(new Request(`${PUBLIC_BASE}/api/underwriting?price=500000&monthlyRent=`));
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
  it("rejects duplicate/unknown parameters, booleans, NaN and fractional hold periods", async () => {
    for (const query of ["price=500000&price=600000&monthlyRent=3000", "price=500000&monthlyRent=3000&apiKey=x", "price=NaN&monthlyRent=3000", "price=500000&monthlyRent=3000&units=1.5"]) {
      expect((await rentalRoute(new Request(`${PUBLIC_BASE}/api/underwriting?${query}`))).status).toBe(400);
    }
    expect(() => parseRental({ ...SAMPLE, downPaymentPercent: true })).toThrow();
    expect(() => parseRental({ ...SAMPLE, holdPeriodYears: 2.5 })).toThrow();
    expect(() => parseRental({ ...SAMPLE, monthlyRent: Infinity })).toThrow();
  });
  it("fails closed when the shared rate allowance is unavailable", async () => {
    token.mockResolvedValue(false);
    const response = await rentalRoute(sampleRequest());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
  });
  it("bounds streamed JSON, not only the Content-Length header", async () => {
    await expect(readJson(new Request(`${PUBLIC_BASE}/api/underwriting`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ junk: "x".repeat(33000) }) }))).rejects.toMatchObject({ status: 413 });
  });
  it("escapes caller markup in reports and SVG and includes real scenario values", () => {
    const result = calculateRental(parseRental({ ...SAMPLE, address: '<script>alert("x")</script>' }));
    const html = rentalReport(result);
    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('action="/api/underwriting/report"');
    expect(rentalSvg(result)).not.toContain("<script>");
    expect(rentalSvg(result)).toContain("Scenario inputs, not verified listing facts");
  });
  it("renders a real 1200×800 PNG without credentials", async () => {
    const response = await chartPng(sampleRequest());
    expect(response.status).toBe(200);
    const png = Buffer.from(await response.arrayBuffer());
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(800);
    writeFileSync("/private/tmp/realist-underwriting-chart-test.png", png);
  });
  it("publishes an unauthenticated machine schema with all runtime input fields", () => {
    expect(UNDERWRITING_OPENAPI.security).toEqual([]);
    expect(UNDERWRITING_OPENAPI.paths["/api/underwriting"].post.requestBody.content["application/json"].schema.required).toContain("price");
    expect(UNDERWRITING_OPENAPI.paths["/api/underwriting"].post.requestBody.content["application/json"].schema.required).toContain("monthlyRent");
    expect(robots().rules).toMatchObject([{ allow: ["/", "/api/underwriting", "/api/property"], disallow: expect.arrayContaining(["/api/", "/account"]) }]);
  });
  it("bounds multiplex coverage and disallows arbitrary assumption objects", () => {
    expect(publicMultiplexSchema.safeParse({ address: "90 Ash Crescent, Toronto", lat: 51, lng: -114 }).success).toBe(false);
    expect(publicMultiplexSchema.safeParse({ address: "90 Ash Crescent, Toronto", lat: 43.5946 }).success).toBe(false);
    expect(publicMultiplexSchema.safeParse({ address: "90 Ash Crescent, Toronto", assumptionOverrides: { arbitrary: {} } }).success).toBe(false);
  });
});

describe("public MCP client interoperability", () => {
  it("initializes, lists tools/resources and invokes them through the official client", async () => {
    const client = new Client({ name: "public-api-test", version: "1.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${PUBLIC_BASE}/api/underwriting/mcp`), {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        return request.method === "GET" ? mcpGet(request) : mcpPost(request);
      },
    });
    await client.connect(transport);
    try {
      const listed = await client.listTools();
      expect(listed.tools.map(tool => tool.name)).toEqual(["realist_underwrite_rental", "realist_solve_offer", "realist_compare_scenarios", "realist_underwrite_multiplex"]);
      const result = await client.callTool({ name: "realist_underwrite_rental", arguments: SAMPLE });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toEqual(calculateRental(parseRental(SAMPLE)));
      const comparison = await client.callTool({ name: "realist_compare_scenarios", arguments: { base: SAMPLE, scenarios: [{ label: "Higher mortgage rate", changes: { interestRate: 6.5 } }] } });
      expect(comparison.isError).not.toBe(true);
      const offer = await client.callTool({ name: "realist_solve_offer", arguments: { deal: SAMPLE, target: { metric: "dscr", value: 1.2 } } });
      expect(offer.isError).not.toBe(true);
      const resources = await client.listResources();
      expect(resources.resources).toHaveLength(1);
      expect((await client.readResource({ uri: resources.resources[0].uri })).contents[0]).toMatchObject({ mimeType: "text/markdown" });
      const invalid = await client.callTool({ name: "realist_underwrite_rental", arguments: { price: -1, monthlyRent: 3000 } });
      expect(invalid.isError).toBe(true);
    } finally { await client.close(); }
  });
  it("rejects invalid/private origins and honours the no-SSE transport response", async () => {
    expect((await mcpPost(new Request(`${PUBLIC_BASE}/api/underwriting/mcp`, { method: "POST", headers: { Origin: "null" } }))).status).toBe(403);
    expect(mcpGet(new Request(`${PUBLIC_BASE}/api/underwriting/mcp`, { headers: { Origin: "https://127.0.0.1" } })).status).toBe(403);
    expect(mcpGet(new Request(`${PUBLIC_BASE}/api/underwriting/mcp`, { headers: { Accept: "text/event-stream" } })).status).toBe(405);
  });
});
