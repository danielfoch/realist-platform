/**
 * /api/v1 — the versioned public REST surface of the agent platform, plus the
 * public read endpoints behind the hosted /v/:token pages.
 *
 *   GET    /api/v1                     index (where everything lives)
 *   GET    /api/v1/openapi.json        OpenAPI 3.1, generated from the registry
 *   GET    /api/v1/tools               tool catalog with JSON Schemas
 *   POST   /api/v1/tools/:name         run a tool                 (bearer)
 *   GET    /api/v1/views               the caller's hosted views  (bearer)
 *   DELETE /api/v1/views/:token        delete one of them         (bearer)
 *
 *   GET    /api/views/:token                 view document (the token is the credential)
 *   GET    /api/views/:token/model.xlsx      Excel model, original assumptions
 *   POST   /api/views/:token/model.xlsx      Excel model, the visitor's edited assumptions
 *   GET    /api/views/:token/proforma.csv    year-by-year pro forma
 */
import type { Express, Request, Response } from "express";
import cors from "cors";
import { buyHoldInputsSchema, type BuyHoldInputs } from "@shared/schema";
import type { AgentViewDocument } from "@shared/agentViews";
import { bearerAuth, agentContextFromRequest, sendAgentToolError } from "../agentApi";
import { agentRateLimit, usageMeter } from "../services/usage";
import { AGENT_API_SCOPES, AGENT_PLATFORM_VERSION, publicBaseUrl } from "./context";
import { AGENT_TOOLS, getAgentTool, invokeAgentTool } from "./tools";
import { buildOpenApiDocument, describeTool } from "./openapi";
import { buildProFormaCsv, buildProFormaWorkbook } from "./proFormaWorkbook";
import { XLSX_MIME } from "./xlsx";
import { viewUrlForToken } from "./viewDocuments";
import { getAgentViewStore, VIEW_TOKEN_PATTERN, type StoredAgentView } from "./viewStore";

function downloadName(title: string, extension: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "realist-model";
  return `realist-${slug}.${extension}`;
}

/** What a link-holder may see: the document, never who made it or the analysis id behind it. */
function publicView(view: StoredAgentView) {
  const { analysisId: _analysisId, ...document } = view.document as AgentViewDocument & { analysisId?: string | null };
  return {
    token: view.token,
    kind: view.kind,
    title: view.title,
    createdAt: view.createdAt,
    document,
  };
}

async function loadView(req: Request, res: Response): Promise<StoredAgentView | null> {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "private, no-store");
  const token = req.params.token;
  if (!VIEW_TOKEN_PATTERN.test(token)) {
    res.status(404).json({ error: "view_not_found" });
    return null;
  }
  const view = await getAgentViewStore().getByToken(token);
  if (!view) {
    res.status(404).json({ error: "view_not_found" });
    return null;
  }
  return view;
}

function underwritingInputs(view: StoredAgentView, res: Response): BuyHoldInputs | null {
  if (view.document.kind !== "underwriting") {
    res.status(409).json({ error: "not_an_underwriting_view", message: "Only underwriting views have a spreadsheet model." });
    return null;
  }
  return view.document.inputs;
}

function sendWorkbook(res: Response, view: StoredAgentView, inputs: BuyHoldInputs): void {
  const workbook = buildProFormaWorkbook(inputs, {
    title: view.title,
    subtitle: view.document.subtitle,
    viewUrl: viewUrlForToken(view.token),
  });
  res.setHeader("Content-Type", XLSX_MIME);
  res.setHeader("Content-Disposition", `attachment; filename="${downloadName(view.title, "xlsx")}"`);
  res.send(workbook);
}

export function registerAgentV1Routes(app: Express): void {
  // Bearer-only, cookie-less: safe to open to every origin so browser-based
  // harnesses and API explorers work. (The global CORS layer allowlists only
  // our own origins because it is credentialed.)
  app.use("/api/v1", cors({ origin: true, credentials: false, maxAge: 86400 }));

  // ---------- discovery (public) ----------
  app.get("/api/v1", (_req, res) => {
    const base = publicBaseUrl();
    res.json({
      name: "Realist API",
      version: AGENT_PLATFORM_VERSION,
      docs: `${base}/developers`,
      openapi: `${base}/api/v1/openapi.json`,
      tools: `${base}/api/v1/tools`,
      mcp: { url: `${base}/mcp`, transport: "streamable-http", auth: "Authorization: Bearer <api key>" },
      apiKeys: `${base}/account/api-keys`,
      scopes: AGENT_API_SCOPES,
    });
  });

  app.get("/api/v1/openapi.json", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(buildOpenApiDocument());
  });

  app.get("/api/v1/tools", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({ count: AGENT_TOOLS.length, tools: AGENT_TOOLS.map(describeTool) });
  });

  // ---------- authenticated ----------
  const authenticated = [bearerAuth, agentRateLimit, usageMeter];

  app.post("/api/v1/tools/:name", ...authenticated, async (req, res) => {
    const tool = getAgentTool(req.params.name);
    if (!tool) {
      return res.status(404).json({ error: "unknown_tool", tool: req.params.name, available: AGENT_TOOLS.map((t) => t.name) });
    }
    try {
      const result = await invokeAgentTool(agentContextFromRequest(req, "v1"), tool, req.body ?? {});
      res.json({ ok: true, tool: tool.name, result });
    } catch (err) {
      sendAgentToolError(res, err, tool.name);
    }
  });

  app.get("/api/v1/views", ...authenticated, async (req, res) => {
    try {
      const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 25, 1), 100);
      const views = await getAgentViewStore().listForUser(req.agentUserId!, limit);
      res.json({ count: views.length, views: views.map((view) => ({ ...view, url: viewUrlForToken(view.token) })) });
    } catch (err) {
      sendAgentToolError(res, err, "views.list");
    }
  });

  app.delete("/api/v1/views/:token", ...authenticated, async (req, res) => {
    try {
      const deleted = await getAgentViewStore().deleteForUser(req.agentUserId!, req.params.token);
      if (!deleted) return res.status(404).json({ error: "view_not_found" });
      res.json({ deleted: true });
    } catch (err) {
      sendAgentToolError(res, err, "views.delete");
    }
  });

  // ---------- hosted view pages (public: the unguessable token is the credential) ----------
  app.get("/api/views/:token", async (req, res) => {
    try {
      const view = await loadView(req, res);
      if (!view) return;
      void getAgentViewStore().recordOpen(view.token);
      res.json(publicView(view));
    } catch (err: any) {
      console.error("[agent-views] load failed:", err?.message || err);
      res.status(500).json({ error: "view_load_failed" });
    }
  });

  app.get("/api/views/:token/model.xlsx", async (req, res) => {
    try {
      const view = await loadView(req, res);
      if (!view) return;
      const inputs = underwritingInputs(view, res);
      if (inputs) sendWorkbook(res, view, inputs);
    } catch (err: any) {
      console.error("[agent-views] xlsx failed:", err?.message || err);
      res.status(500).json({ error: "export_failed" });
    }
  });

  // The visitor has edited assumptions in the browser: export THEIR scenario.
  app.post("/api/views/:token/model.xlsx", async (req, res) => {
    try {
      const view = await loadView(req, res);
      if (!view) return;
      if (!underwritingInputs(view, res)) return;
      const parsed = buyHoldInputsSchema.safeParse(req.body?.inputs);
      if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.issues });
      sendWorkbook(res, view, parsed.data);
    } catch (err: any) {
      console.error("[agent-views] xlsx failed:", err?.message || err);
      res.status(500).json({ error: "export_failed" });
    }
  });

  app.get("/api/views/:token/proforma.csv", async (req, res) => {
    try {
      const view = await loadView(req, res);
      if (!view) return;
      const inputs = underwritingInputs(view, res);
      if (!inputs) return;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${downloadName(view.title, "csv")}"`);
      res.send(buildProFormaCsv(inputs));
    } catch (err: any) {
      console.error("[agent-views] csv failed:", err?.message || err);
      res.status(500).json({ error: "export_failed" });
    }
  });
}
