/**
 * Hosted MCP endpoint — https://realist.ca/mcp (Streamable HTTP).
 *
 * Lets any MCP-capable harness (Claude Code / Desktop / claude.ai, Codex,
 * Cursor, Grok via the xAI API, ChatGPT connectors, …) use Realist with
 * nothing to install: a URL plus an API key.
 *
 *   POST /mcp            Authorization: Bearer realist_live_…
 *   POST /mcp/u/:key     same server, key in the path — for connector UIs that
 *                        cannot send custom headers. The URL is then a secret.
 *
 * Stateless by design: every request builds a fresh Server bound to the
 * caller's key, answers with plain JSON (no long-lived SSE stream to babysit
 * behind the autoscale proxy), and is torn down. Tools come from the shared
 * registry; this file only translates MCP <-> registry and meters each call.
 */
import type { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { AgentViewRef } from "@shared/agentViews";
import { bearerAuth, agentContextFromRequest } from "../agentApi";
import { checkAgentRateLimit, recordAgentUsage } from "../services/usage";
import { AGENT_PLATFORM_VERSION, AgentToolError, publicBaseUrl, type AgentContext } from "./context";
import { getAgentTool, invokeAgentTool, toolInputJsonSchema, toolsForScopes, type AgentTool } from "./tools";

const MCP_INSTRUCTIONS = `Realist.ca is a Canadian real estate investing platform. These tools search live MLS® listings for deals, underwrite properties (cap rate, cash flow, DSCR, IRR, 10-year pro forma, stress test), estimate rents, model Toronto multiplex developments, and report city-level market data.

Working with results:
- Many results include "view.url" — a hosted, interactive version of the result on realist.ca (an editable pro forma spreadsheet with an Excel download, a development model, a chart report). ALWAYS show that link to the user as a clickable URL; it is the best way for them to inspect and adjust the numbers.
- Never invent or adjust financial figures yourself. Call a tool, and re-run it with different assumptions when the user asks "what if".
- Results carry "warnings" / notes describing which assumptions were estimated. Mention the material ones (especially estimated rent).
- These are screening estimates, not an appraisal or legal, tax, planning or investment advice. Say so briefly when presenting numbers.
- realist_submit_to_deal_desk and realist_submit_for_review act on the user's behalf with real people. Only call them after the user explicitly asks.`;

function toMcpTool(tool: AgentTool) {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: toolInputJsonSchema(tool),
    annotations: { title: tool.title, ...tool.annotations },
  };
}

/** Lead with what a human needs (headline + link); the full JSON follows for the model. */
export function formatMcpToolResult(result: Record<string, unknown>): CallToolResult {
  const view = result.view as AgentViewRef | null | undefined;
  const lead: string[] = [];
  if (typeof result.summary === "string" && result.summary) lead.push(result.summary);
  if (view?.url) lead.push(`Interactive view: ${view.url}`, view.instructions);
  const json = JSON.stringify(result);
  return { content: [{ type: "text", text: lead.length ? `${lead.join("\n")}\n\n${json}` : json }] };
}

export function formatMcpToolError(error: AgentToolError): CallToolResult {
  const hints: Record<string, string> = {
    scope_required: `Ask the user to create an API key with the "${String(error.extra.requiredScope)}" scope at ${publicBaseUrl()}/account/api-keys.`,
    invalid_input: "Fix the arguments listed in details and call the tool again.",
    rate_limited: "Wait for retry_after_seconds before calling again.",
  };
  const body = { ...error.toBody(), ...(hints[error.code] ? { hint: hints[error.code] } : {}) };
  return { isError: true, content: [{ type: "text", text: JSON.stringify(body) }] };
}

export function buildMcpServer(ctx: AgentContext, opts: { structuredUsageAllowed: boolean }): Server {
  const server = new Server(
    { name: "realist", title: "Realist.ca", version: AGENT_PLATFORM_VERSION },
    { capabilities: { tools: {} }, instructions: MCP_INSTRUCTIONS },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolsForScopes(ctx.scopes).map(toMcpTool),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const { name, arguments: args = {} } = request.params;
    const tool = getAgentTool(name);
    if (!tool) throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${name}`);

    const started = Date.now();
    const meter = (status: number) => recordAgentUsage({
      keyId: ctx.keyId,
      userId: ctx.userId,
      method: "MCP",
      endpoint: `mcp:${tool.name}`,
      status,
      latencyMs: Date.now() - started,
      input: args,
      structuredUsageAllowed: opts.structuredUsageAllowed,
    });

    // Same per-key counters as REST: a key's quota is shared across transports.
    const limit = checkAgentRateLimit(ctx.keyId);
    if (!limit.allowed) {
      meter(429);
      return formatMcpToolError(new AgentToolError(429, "rate_limited", `Rate limit exceeded (${limit.limitExceeded} window).`, {
        limit_exceeded: limit.limitExceeded,
        retry_after_seconds: limit.retryAfterSeconds,
      }));
    }

    try {
      const result = await invokeAgentTool(ctx, tool, args);
      meter(200);
      return formatMcpToolResult(result);
    } catch (error) {
      if (error instanceof AgentToolError) {
        meter(error.status);
        return formatMcpToolError(error);
      }
      meter(500);
      console.error(`[mcp] ${tool.name} failed:`, error);
      return formatMcpToolError(new AgentToolError(500, "tool_failed", error instanceof Error ? error.message : String(error), { tool: tool.name }));
    }
  });

  return server;
}

function jsonRpcError(res: Response, status: number, message: string): void {
  res.status(status).json({ jsonrpc: "2.0", error: { code: -32000, message }, id: null });
}

async function handleMcpPost(req: Request, res: Response): Promise<void> {
  const ctx = agentContextFromRequest(req, "mcp");
  const server = buildMcpServer(ctx, { structuredUsageAllowed: Boolean(req.agentStructuredUsageAllowed) });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("[mcp] request failed:", error);
    if (!res.headersSent) jsonRpcError(res, 500, "Internal server error");
  }
}

/** Lift the key out of /mcp/u/:key so the normal bearer check runs on it. */
function keyFromPath(req: Request, _res: Response, next: NextFunction): void {
  req.headers.authorization = `Bearer ${req.params.key}`;
  next();
}

/** A 401 must say how to authenticate, or harnesses show an opaque failure. */
function advertiseBearer(_req: Request, res: Response, next: NextFunction): void {
  const status = res.status.bind(res);
  res.status = (code: number) => {
    if (code === 401) {
      res.setHeader("WWW-Authenticate", `Bearer realm="realist", error="invalid_token", error_description="Create an API key at ${publicBaseUrl()}/account/api-keys"`);
    }
    return status(code);
  };
  next();
}

export function registerMcpRoutes(app: Express): void {
  // Bearer-only and cookie-less, so any origin may call it (browser-based MCP
  // clients included). The global CORS layer only allowlists our own origins.
  const mcpCors = cors({
    origin: true,
    credentials: false,
    methods: ["POST", "GET", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Accept", "Mcp-Session-Id", "Mcp-Protocol-Version", "Last-Event-ID"],
    exposedHeaders: ["Mcp-Session-Id", "WWW-Authenticate"],
    maxAge: 86400,
  });
  app.use("/mcp", mcpCors);

  app.post("/mcp", advertiseBearer, bearerAuth, handleMcpPost);
  app.post("/mcp/u/:key", keyFromPath, advertiseBearer, bearerAuth, handleMcpPost);

  // Stateless server: there is no session to resume or end, and no
  // server-initiated stream to open.
  const methodNotAllowed = (_req: Request, res: Response) => {
    res.setHeader("Allow", "POST");
    jsonRpcError(res, 405, "Method not allowed. This MCP server is stateless: send JSON-RPC over POST.");
  };
  app.get(["/mcp", "/mcp/u/:key"], methodNotAllowed);
  app.delete(["/mcp", "/mcp/u/:key"], methodNotAllowed);
}
