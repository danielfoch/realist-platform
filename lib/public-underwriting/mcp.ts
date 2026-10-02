import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { solveOfferPrice } from "@/lib/underwriting/underwriter";
import { rentalSchema, parseRental, offerTargetSchema, readJson } from "./model";
import { calculateRental, PUBLIC_BASE } from "./service";
import { publicMultiplexSchema, calculateMultiplex, parseMultiplex } from "./multiplex";
import { UNDERWRITING_SKILL } from "./skill";
import { PUBLIC_HEADERS, DISCOVERY, apiError, enforceLimit, reply } from "./http";

const changesSchema = z.object(rentalSchema.shape).partial().omit({ address: true, city: true, province: true, assumedFields: true }).strict();
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
function toolResult(value: Record<string, unknown>): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value };
}
function validOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (url.origin !== origin) return false;
    if (new URL(request.url).hostname === "localhost" && process.env.NODE_ENV !== "production") return url.protocol === "http:" && url.hostname === "localhost";
    return url.protocol === "https:" && !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(url.hostname) && !url.hostname.endsWith(".local");
  } catch { return false; }
}

export function createPublicMcp(request: Request) {
  const server = new McpServer({ name: "realist-public-underwriting", version: "1.0.0" }, { instructions: "Use Realist's deterministic engines for all underwriting arithmetic. No credentials required. Read the instructions resource; ask for missing price and total rent. Return visual/report links and label default assumptions." });
  server.registerResource("instructions", `${PUBLIC_BASE}/api/underwriting/skill`, { mimeType: "text/markdown", description: "Realist underwriting instructions and a complete demo" }, async uri => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: UNDERWRITING_SKILL }] }));
  server.registerTool("realist_underwrite_rental", { description: "Underwrite a Canadian rental from purchase price and total monthly rent. Returns exact inputs, provenance, financials, memo, offer thresholds, sensitivity data and public PNG/SVG/report links. Percentages use points, not fractions.", inputSchema: rentalSchema, annotations }, async args => {
    const value = calculateRental(parseRental(args));
    const output = toolResult(value);
    output.content.push({ type: "resource_link", uri: value.visuals.png, name: "Realist underwriting chart", mimeType: "image/png", description: "Cap rate, cash flow, cash-on-cash and financing/rent sensitivity" });
    output.content.push({ type: "resource_link", uri: value.visuals.report, name: "Realist underwriting report", mimeType: "text/html" });
    return output;
  });
  server.registerTool("realist_solve_offer", { description: "Find the highest scenario price meeting a cash_flow (CAD/month), cash_on_cash (%), cap_rate (%) or dscr target. Search range is 5% to 300% of the input price; insurance/closing costs scale, other inputs stay fixed. Not an appraisal or lender approval.", inputSchema: z.object({ deal: rentalSchema, target: offerTargetSchema }).strict(), annotations }, async args => {
    const result = calculateRental(parseRental(args.deal));
    return toolResult({ target: args.target, offerPrice: solveOfferPrice(result.inputs, args.target), inputs: result.inputs, notes: result.notes });
  });
  server.registerTool("realist_compare_scenarios", { description: "Compare up to five named financing/rent/expense scenarios through the same Realist engine. Returns base and scenario calculations plus chart/report links.", inputSchema: z.object({ base: rentalSchema, scenarios: z.array(z.object({ label: z.string().min(1).max(80), changes: changesSchema }).strict()).min(1).max(5) }).strict(), annotations }, async args => {
    const base = parseRental(args.base);
    return toolResult({ base: calculateRental(base), scenarios: args.scenarios.map(row => ({ label: row.label, result: calculateRental(parseRental({ ...base, ...row.changes, assumedFields: base.assumedFields?.split(",").filter(field => !(field in row.changes)).join(",") })) })) });
  });
  server.registerTool("realist_underwrite_multiplex", { description: "Screen a Toronto multiplex lot with the existing zoning, envelope, development proforma and CMHC/condo takeout engines. Returns source evidence and schematic site-plan visuals. Supply surveyed dimensions; no paid AI narrative or member analysis is saved.", inputSchema: publicMultiplexSchema, annotations: { ...annotations, openWorldHint: true, idempotentHint: false } }, async args => {
    await enforceLimit(request, "multiplex");
    return toolResult(await calculateMultiplex(parseMultiplex(args)));
  });
  return server;
}

export async function mcpPost(request: Request) {
  if (!validOrigin(request)) return reply({ error: "Invalid Origin" }, 403);
  let server: McpServer | undefined;
  try {
    const parsedBody = await readJson(request);
    await enforceLimit(request, "mcp");
    server = createPublicMcp(request);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 32768 });
    await server.connect(transport);
    const response = await transport.handleRequest(request, { parsedBody });
    for (const [key, value] of Object.entries(PUBLIC_HEADERS)) response.headers.set(key, value);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) { return apiError(error); }
  finally { await server?.close(); }
}
export function mcpGet(request: Request) {
  if (!validOrigin(request)) return reply({ error: "Invalid Origin" }, 403);
  if (request.headers.get("accept")?.includes("text/event-stream")) return reply({ error: "This stateless MCP endpoint has no standalone SSE stream. Use Streamable HTTP POST." }, 405, { Allow: "POST, OPTIONS" });
  return reply({ ...DISCOVERY, transport: "MCP Streamable HTTP, stateless JSON responses" });
}
