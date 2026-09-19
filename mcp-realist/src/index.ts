#!/usr/bin/env node
/**
 * @realist/mcp — stdio bridge to the Realist agent platform.
 *
 * Most harnesses should skip this package and connect straight to the hosted
 * MCP endpoint (https://realist.ca/mcp — a URL plus an API key, nothing to
 * install). This bridge exists for MCP clients that can only launch local
 * stdio servers.
 *
 * It carries no tool definitions of its own: the catalog is fetched from
 * GET /api/v1/tools and calls are forwarded to POST /api/v1/tools/:name, so a
 * tool added or changed on the server shows up here without a new release.
 *
 * Auth: set REALIST_API_KEY (mint at https://realist.ca/account/api-keys).
 * Optional: REALIST_BASE_URL (defaults to https://realist.ca).
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { RealistClient, RealistApiError, type RealistToolDescriptor } from "./client.js";

const apiKey = process.env.REALIST_API_KEY;
const baseUrl = process.env.REALIST_BASE_URL;

if (!apiKey) {
  console.error("[realist-mcp] REALIST_API_KEY is not set. Mint one at https://realist.ca/account/api-keys");
  process.exit(1);
}

const client = new RealistClient({ apiKey, baseUrl });

const server = new Server(
  { name: "realist-mcp", version: "0.2.0" },
  {
    capabilities: { tools: {} },
    instructions:
      "Realist.ca tools for Canadian real estate investing. When a result includes view.url, always show that link to the user — it opens an interactive spreadsheet, model or report of the result in their browser. Never adjust financial figures yourself; re-run the tool with different assumptions. Results are screening estimates, not advice.",
  },
);

/** Catalog cache: one fetch per process is plenty. */
let catalog: Promise<RealistToolDescriptor[]> | null = null;

async function loadCatalog(): Promise<RealistToolDescriptor[]> {
  if (!catalog) {
    catalog = (async () => {
      const [{ tools }, me] = await Promise.all([client.listTools(), client.me()]);
      // Only offer what this key can actually run.
      const scopes = new Set(me.scopes ?? []);
      return scopes.size ? tools.filter((tool) => scopes.has(tool.scope)) : tools;
    })().catch((error) => {
      catalog = null;
      throw error;
    });
  }
  return catalog;
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: (await loadCatalog()).map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: { title: tool.title, readOnlyHint: tool.readOnly },
  })),
}));

type TextResult = { content: Array<{ type: "text"; text: string }>; isError?: true };

/** Lead with the headline and the link a human should open; the JSON follows for the model. */
function formatResult(result: Record<string, any>): TextResult {
  const lead: string[] = [];
  if (typeof result?.summary === "string" && result.summary) lead.push(result.summary);
  if (result?.view?.url) lead.push(`Interactive view: ${result.view.url}`, String(result.view.instructions ?? ""));
  const json = JSON.stringify(result);
  return { content: [{ type: "text", text: lead.length ? `${lead.filter(Boolean).join("\n")}\n\n${json}` : json }] };
}

function formatError(err: unknown): TextResult {
  const text = err instanceof RealistApiError
    ? JSON.stringify({ status: err.status, ...(typeof err.body === "object" && err.body ? err.body : { error: err.message }) })
    : err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text", text }], isError: true };
}

server.setRequestHandler(CallToolRequestSchema, async (req: any) => {
  const { name, arguments: args = {} } = req.params;
  try {
    const { result } = await client.callTool(name, args);
    return formatResult(result);
  } catch (err) {
    return formatError(err);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[realist-mcp] ready (stdio bridge → hosted Realist API)");
