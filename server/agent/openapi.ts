/**
 * OpenAPI 3.1 description of /api/v1, generated from the tool registry so it
 * can never drift from what the server actually runs.
 *
 * This is the on-ramp for harnesses that speak HTTP rather than MCP — custom
 * GPT actions, the OpenAI / xAI (Grok) / Gemini function-calling APIs,
 * LangChain-style OpenAPI toolkits, or plain curl. One POST operation per
 * tool; the operationId is the tool name.
 */
import { AGENT_VIEW_DISCLAIMER } from "@shared/agentViews";
import { AGENT_PLATFORM_VERSION, publicBaseUrl } from "./context";
import { AGENT_TOOLS, toolInputJsonSchema, type AgentTool } from "./tools";

export interface PublicToolDescriptor {
  name: string;
  title: string;
  description: string;
  scope: string;
  readOnly: boolean;
  inputSchema: Record<string, unknown>;
  endpoint: string;
}

export function describeTool(tool: AgentTool): PublicToolDescriptor {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    scope: tool.scope,
    readOnly: tool.annotations.readOnlyHint,
    inputSchema: toolInputJsonSchema(tool),
    endpoint: `${publicBaseUrl()}/api/v1/tools/${tool.name}`,
  };
}

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

export function buildOpenApiDocument(): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  for (const tool of AGENT_TOOLS) {
    paths[`/tools/${tool.name}`] = {
      post: {
        operationId: tool.name,
        summary: tool.title,
        description: `${tool.description}\n\nRequires the \`${tool.scope}\` API key scope.`,
        tags: [tool.annotations.readOnlyHint ? "Read" : "Act"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: toolInputJsonSchema(tool) } },
        },
        responses: {
          "200": {
            description: "Tool result.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ToolResponse" } } },
          },
          "400": errorResponse("invalid_input — the arguments failed validation; see details."),
          "401": errorResponse("Missing, malformed or revoked API key."),
          "403": errorResponse("scope_required — the key lacks the scope this tool needs."),
          "404": errorResponse("The listing, analysis, city or tool was not found."),
          "429": errorResponse("rate_limited — see retry_after_seconds."),
        },
      },
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Realist API",
      version: AGENT_PLATFORM_VERSION,
      summary: "Canadian real estate deal search, underwriting, rent estimates and market data for AI agents.",
      description: [
        "Call Realist.ca's investing tools from any agent harness. Every tool is a `POST /tools/{name}` with a JSON body.",
        "",
        "**Hosted results.** Tools that produce something worth seeing return a `result.view.url` — a page on realist.ca with an interactive version of the result (an editable pro forma spreadsheet with an Excel download, a development model, a chart report). Show that link to the user.",
        "",
        `**MCP.** The same tools are available over the Model Context Protocol at \`${publicBaseUrl()}/mcp\` (Streamable HTTP, same API key).`,
        "",
        `**Advisory only.** ${AGENT_VIEW_DISCLAIMER}`,
      ].join("\n"),
      contact: { name: "Realist.ca", url: `${publicBaseUrl()}/developers` },
    },
    servers: [{ url: `${publicBaseUrl()}/api/v1` }],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Read", description: "Tools that only read data." },
      { name: "Act", description: "Tools that save an analysis or act on the user's behalf." },
    ],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: `API key from ${publicBaseUrl()}/account/api-keys, sent as "Authorization: Bearer realist_live_…".`,
        },
      },
      schemas: {
        View: {
          type: "object",
          description: "A hosted, interactive version of the result. Give `url` to the user.",
          properties: {
            url: { type: "string", format: "uri" },
            kind: { type: "string", enum: ["underwriting", "report", "multiplex_model"] },
            title: { type: "string" },
            instructions: { type: "string" },
          },
          required: ["url", "kind", "title"],
        },
        ToolResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", const: true },
            tool: { type: "string" },
            result: {
              type: "object",
              description: "Tool-specific result. Includes `view` when a hosted page was created.",
              properties: { view: { oneOf: [{ $ref: "#/components/schemas/View" }, { type: "null" }] } },
              additionalProperties: true,
            },
          },
          required: ["ok", "tool", "result"],
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string", description: "Stable machine-readable code, e.g. invalid_input, scope_required, rate_limited." },
            message: { type: "string" },
          },
          required: ["error"],
          additionalProperties: true,
        },
      },
    },
  };
}
