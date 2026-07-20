/**
 * Ask Realist — the on-site conversational agent over the same tool layer as
 * the MCP/agent API. Same doctrine as the multiplex report writer: the math
 * computes, the model narrates. Every number in an answer must come from a
 * tool result; the system prompt forbids invented figures and the response
 * carries the tool calls that produced it so the UI can show provenance.
 *
 * POST /api/ask { question, context?, history? } → { answer, toolCalls }
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { sql, gte, and, eq } from "drizzle-orm";
import { underwriteSimple } from "./agentApi";
import { logAskRealistInteraction, summarizeToolInput } from "./demandLedger";
import { db } from "./db";
import { askRealistInteractions } from "@shared/schema";
import { storage } from "./storage";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export function askRealistConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// ─── Freemium quota ────────────────────────────────────────────────────────

const FREE_ASKS_PER_PERIOD = 3;
const FREE_PERIOD_DAYS = 30;

async function countFreePeriodInteractions(userId: string): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - FREE_PERIOD_DAYS);
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(askRealistInteractions)
    .where(
      and(
        eq(askRealistInteractions.userId, userId),
        eq(askRealistInteractions.status, "ok"),
        gte(askRealistInteractions.createdAt, since)
      )
    );
  return result[0]?.count ?? 0;
}

async function hasAskRealistAccess(userId: string): Promise<boolean> {
  // Existing premium subscribers get Ask Realist included.
  const subscription = await storage.getProfessionalSubscription(userId);
  if (subscription && subscription.tier === "premium" && subscription.status !== "cancelled") {
    return true;
  }

  // Or they bought the Ask Realist-specific $100/mo add-on.
  const askRealistPriceId = process.env.STRIPE_ASK_REALIST_PRICE_ID;
  if (!askRealistPriceId || !subscription?.stripeCustomerId) return false;

  const rows = await db.execute(sql`
    SELECT 1
    FROM stripe.subscription_items si
    JOIN stripe.subscriptions s ON s.id = si.subscription
    WHERE si.price = ${askRealistPriceId}
      AND s.customer_id = ${subscription.stripeCustomerId}
      AND s.status IN ('active', 'trialing')
    LIMIT 1
  `);
  return (rows.rows.length ?? 0) > 0;
}

// ─── Rate limiting (in-memory, per session/IP per day) ─────────────────────

const DAILY_LIMIT_ANON = 10;
const DAILY_LIMIT_AUTHED = 50;
const usage = new Map<string, { day: string; count: number }>();

function checkRateLimit(key: string, limit: number): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const entry = usage.get(key);
  if (!entry || entry.day !== day) {
    usage.set(key, { day, count: 1 });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

// ─── Tools ───────────────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "underwrite_property",
    description:
      "Run a deterministic underwrite for a property: cap rate, cash flow, DSCR, cash-on-cash. Use this for ANY question involving returns, affordability, or 'does this pencil'. Never estimate these numbers yourself.",
    input_schema: {
      type: "object",
      properties: {
        price: { type: "number", description: "Purchase price in CAD" },
        monthlyRent: { type: "number", description: "Total monthly rent (omit to use a rough per-bed estimate)" },
        units: { type: "number" },
        beds: { type: "number" },
        city: { type: "string" },
        province: { type: "string" },
        downPaymentPercent: { type: "number", description: "Default 20" },
        interestRate: { type: "number", description: "Default 5.5" },
        vacancyRate: { type: "number", description: "Percent, default 5" },
        expenseRatio: { type: "number", description: "Operating expenses as % of rent, default 35" },
      },
      required: ["price"],
    },
  },
  {
    name: "find_deals",
    description: "Natural-language search over live Canadian MLS listings (CREA DDF). Returns listings with computed cap rates and deal scores.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Plain-English search, e.g. 'duplexes in Hamilton under 800k'" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_mortgage_rates",
    description: "Current Canadian mortgage rates (fixed and variable).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_market_report",
    description: "City-level Canadian market report: prices, yields, trends.",
    input_schema: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"],
    },
  },
];

async function runTool(name: string, input: any): Promise<unknown> {
  const baseUrl = process.env.AGENT_INTERNAL_BASE_URL
    || `http://127.0.0.1:${process.env.PORT || 5000}`;

  switch (name) {
    case "underwrite_property": {
      if (!Number.isFinite(Number(input?.price)) || Number(input.price) <= 0) {
        return { error: "price must be a positive number" };
      }
      return underwriteSimple(input);
    }
    case "find_deals": {
      const upstream = await fetch(`${baseUrl}/api/find-deals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: String(input?.query || "") }),
      });
      if (!upstream.ok) return { error: `search failed (${upstream.status})` };
      const data: any = await upstream.json();
      return {
        filters: data.filters_applied,
        total: data.total,
        listings: (data.listings || []).slice(0, 8).map((l: any) => ({
          mlsNumber: l.mlsNumber,
          address: l.address,
          listPrice: l.price,
          capRate: l.cap_rate,
          dealScore: l.deal_score,
          daysOnMarket: l.daysOnMarket,
        })),
      };
    }
    case "get_mortgage_rates": {
      const upstream = await fetch(`${baseUrl}/api/mortgage-rates`);
      if (!upstream.ok) return { error: `rates unavailable (${upstream.status})` };
      return upstream.json();
    }
    case "get_market_report": {
      const upstream = await fetch(`${baseUrl}/api/market-report/all`);
      if (!upstream.ok) return { error: `report unavailable (${upstream.status})` };
      const data: any = await upstream.json();
      const arr: any[] = Array.isArray(data) ? data : (data?.reports || data?.cities || []);
      const city = String(input?.city || "").toLowerCase();
      const match = arr.find((r: any) => (r.city || r.cityName || "").toLowerCase() === city);
      return match || { error: "city not found", city: input?.city };
    }
    default:
      return { error: `unknown tool: ${name}` };
  }
}

// ─── Route ───────────────────────────────────────────────────────────────────

const askSchema = z.object({
  question: z.string().min(1).max(2000),
  context: z
    .object({
      address: z.string().optional(),
      city: z.string().optional(),
      province: z.string().optional(),
      strategy: z.string().optional(),
      price: z.number().optional(),
      monthlyRent: z.number().optional(),
      capRate: z.number().optional(),
      cashOnCash: z.number().optional(),
      monthlyCashFlow: z.number().optional(),
      dscr: z.number().optional(),
    })
    .optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(12)
    .optional(),
});

const SYSTEM_PROMPT = `You are Ask Realist, the AI assistant on realist.ca — a Canadian real estate investing platform. You help investors understand deals and markets.

Hard rules:
- NEVER invent a financial figure. Every number you state must come from a tool result or from the deal context the user shared. If you need a number you don't have, call a tool.
- When the user asks "what if" questions (different down payment, rate, rent), call underwrite_property with the changed assumptions rather than approximating.
- Be direct and concise. Lead with the answer, then the key numbers, then caveats.
- You are not a licensed advisor: for legal/tax specifics, say so briefly and suggest verifying with a professional.
- When a deal looks worth pursuing, mention that the user can take it forward via the Deal Desk (the "Take it forward" button on their results) to get matched with a vetted local professional.
- Answers render as plain text with simple markdown (bold, lists). Keep them under ~250 words.`;

export function registerAskRealistRoutes(app: Express): void {
  app.get("/api/ask/status", async (req: Request, res: Response) => {
    const session: any = (req as any).session;
    const userId = session?.userId;
    const available = askRealistConfigured();
    if (!available || !userId) {
      res.json({ available, requiresAuth: !userId, remaining: 0, isPremium: false });
      return;
    }

    const isPremium = await hasAskRealistAccess(userId);
    const used = isPremium ? 0 : await countFreePeriodInteractions(userId);
    const remaining = Math.max(0, FREE_ASKS_PER_PERIOD - used);
    res.json({ available, requiresAuth: false, remaining, isPremium });
  });

  app.post("/api/ask/checkout", async (req: Request, res: Response) => {
    const session: any = (req as any).session;
    const userId = session?.userId;
    if (!userId) {
      res.status(401).json({ error: "auth_required", message: "Create a free account to upgrade." });
      return;
    }
    if (!process.env.STRIPE_ASK_REALIST_PRICE_ID) {
      res.status(503).json({ error: "checkout_not_configured", message: "Ask Realist premium is not configured." });
      return;
    }

    try {
      const { stripeService } = await import("./stripeService");
      const priceId = process.env.STRIPE_ASK_REALIST_PRICE_ID;
      let subscription = await storage.getProfessionalSubscription(userId);
      let customerId = subscription?.stripeCustomerId;

      if (!customerId) {
        const userClaims = (req as any).user?.claims || {};
        const customer = await stripeService.createCustomer(
          userClaims.email || `${userId}@realist.ca`,
          userId,
          userClaims.name
        );
        customerId = customer.id;
        await storage.upsertProfessionalSubscription({
          userId,
          tier: "free",
          stripeCustomerId: customerId,
        });
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0] || "realist.ca"}`;
      const checkoutSession = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${baseUrl}/premium?success=true`,
        `${baseUrl}/premium?canceled=true`,
        { userId, product: "ask_realist" }
      );
      res.json({ url: checkoutSession.url });
    } catch (error: any) {
      console.error("[ask-realist] checkout error:", error?.message || error);
      res.status(500).json({ error: "checkout_failed", message: "Could not start checkout. Please try again." });
    }
  });

  app.post("/api/ask", async (req: Request, res: Response) => {
    const startedAt = Date.now();
    if (!askRealistConfigured()) {
      res.status(503).json({ error: "ask_unavailable", message: "Ask Realist isn't configured on this server yet." });
      return;
    }

    const parsed = askSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_input", details: parsed.error.issues });
      return;
    }

    const session: any = (req as any).session;
    const userId = session?.userId;
    if (!userId) {
      res.status(401).json({ error: "auth_required", message: "Create a free account to ask Realist." });
      return;
    }

    const isPremium = await hasAskRealistAccess(userId);
    if (!isPremium) {
      const used = await countFreePeriodInteractions(userId);
      if (used >= FREE_ASKS_PER_PERIOD) {
        logAskRealistInteraction({
          sessionId: session?.id || (req as any).sessionID || null,
          userId,
          question: parsed.data.question,
          context: parsed.data.context as any ?? null,
          status: "quota_exceeded",
          latencyMs: Date.now() - startedAt,
        });
        res.status(403).json({
          error: "quota_exceeded",
          message: `You've used your ${FREE_ASKS_PER_PERIOD} free Ask Realist questions this month. Upgrade for unlimited access.`,
          upgradeUrl: "/premium",
        });
        return;
      }
    }

    const rateKey = userId;
    if (!checkRateLimit(String(rateKey), DAILY_LIMIT_AUTHED)) {
      logAskRealistInteraction({
        sessionId: session?.id || (req as any).sessionID || null,
        userId,
        question: parsed.data.question,
        context: parsed.data.context as any ?? null,
        status: "rate_limited",
        latencyMs: Date.now() - startedAt,
      });
      res.status(429).json({ error: "rate_limited", message: "You've hit today's Ask Realist limit. Try again tomorrow." });
      return;
    }

    const { question, context, history } = parsed.data;

    const messages: Anthropic.MessageParam[] = [
      ...(history || []).map((m) => ({ role: m.role, content: m.content } as Anthropic.MessageParam)),
      {
        role: "user",
        content: context
          ? `Current deal context (from the user's analyzer session — numbers are computed, safe to cite):\n${JSON.stringify(context, null, 2)}\n\nQuestion: ${question}`
          : question,
      },
    ];

    const toolCallLog: Array<{ name: string; input: unknown }> = [];

    try {
      const anthropic = getClient();
      let response = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      // Tool-use loop, bounded to keep latency and cost predictable.
      for (let turn = 0; turn < 5 && response.stop_reason === "tool_use"; turn++) {
        const toolUses = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
        );
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const toolUse of toolUses) {
          toolCallLog.push({ name: toolUse.name, input: toolUse.input });
          let result: unknown;
          try {
            result = await runTool(toolUse.name, toolUse.input);
          } catch (err: any) {
            result = { error: err?.message || "tool failed" };
          }
          results.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(result).slice(0, 12000),
          });
        }
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: results });
        response = await anthropic.messages.create({
          model: "claude-opus-4-8",
          max_tokens: 1200,
          system: SYSTEM_PROMPT,
          tools: TOOLS,
          messages,
        });
      }

      const answer = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      const finalAnswer = answer || "I couldn't produce an answer — try rephrasing the question.";

      logAskRealistInteraction({
        sessionId: session?.id || (req as any).sessionID || null,
        userId,
        question,
        answer: finalAnswer,
        toolCalls: toolCallLog.map((t) => ({
          name: t.name,
          argsSummary: summarizeToolInput(t.input),
        })) as any,
        context: context as any ?? null,
        status: "ok",
        latencyMs: Date.now() - startedAt,
      });

      res.json({
        answer: finalAnswer,
        toolCalls: toolCallLog.map((t) => ({ name: t.name })),
      });
    } catch (err: any) {
      console.error("[ask-realist] error:", err?.message || err);
      logAskRealistInteraction({
        sessionId: session?.id || (req as any).sessionID || null,
        userId,
        question,
        context: context as any ?? null,
        status: "error",
        errorMessage: String(err?.message || "ask_failed").slice(0, 500),
        latencyMs: Date.now() - startedAt,
      });
      res.status(500).json({ error: "ask_failed", message: "Something went wrong answering that — try again." });
    }
  });
}
