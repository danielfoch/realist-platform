/**
 * Ask Realist — the investor's realtor, at the desk.
 *
 * A member asks a question about the deal in front of them. Claude answers with
 * TOOLS that run this site's own engine: re-underwrite a scenario, solve for an
 * offer price, read how this market's members decide, read what this member
 * buys. It never does arithmetic of its own and never recalls a market figure:
 * every number in an answer must have come from the deal or from a tool result,
 * and an answer that contains one that didn't is rejected (one retry, then an
 * honest "I couldn't verify that").
 *
 * This is the desk half of the model where an investor reviews from home and a
 * licensed agent does the one showing and the paperwork. It explains and
 * pressure-tests; it does not give legal, tax or financial advice, and it never
 * tells someone to buy.
 */

import Anthropic from "@anthropic-ai/sdk";
import { findLeakedNumbers } from "@/lib/multiplex/reportWriter";
import { templateMemo, type MemoDeal } from "@/lib/underwriting/dealMemo";
import { INPUT_LIMITS, solveOfferPrice, underwrite, type OfferTarget, type UnderwriterField, type UnderwriterInputs } from "@/lib/underwriting/underwriter";

export interface AskContext {
  deal: MemoDeal & { mlsNumber?: string | null };
  inputs: UnderwriterInputs;
  /** Public listing remarks, fetched by us — never taken from the browser. */
  remarks?: string | null;
  /** "Hamilton members pursue at 6.1% and pass at 4.7%". */
  decisionLine?: { pursueAt: number; passAt: number | null; calls: number; scopeLabel: string } | null;
  /** What other members made of this exact deal, once enough have. */
  consensus?: { analysts: number; medianRent: number | null; medianCapRate: number | null } | null;
  /** What this member buys, learned from their calls. */
  buyBox?: string | null;
  /** Active listings in the same market, as aggregates only. */
  market?: { listings: number; medianPrice: number | null; medianNetYield: number | null; bestNetYield: number | null } | null;
}

export interface AskTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AskResult {
  answer: string;
  /** What it ran to get there — shown to the person, so the reasoning is inspectable. */
  steps: string[];
  verified: boolean;
}

/** The slice of the SDK this needs — so tests can stand in for it. */
export interface MessagesClient {
  messages: { create(body: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> };
}

const MODEL = "claude-sonnet-5";
const MAX_TOOL_ROUNDS = 5;

export function askRealistConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const EDITABLE = Object.keys(INPUT_LIMITS) as UnderwriterField[];

const TOOLS: Anthropic.Tool[] = [
  {
    name: "underwrite_scenario",
    description:
      "Re-run the underwriting engine on this deal with some inputs changed. Use it for ANY what-if (a different price, rent, down payment, rate, vacancy…) and whenever you need a figure you don't already have. Returns cash flow, cap rate, cash-on-cash, debt coverage, IRR and cash needed to close.",
    input_schema: {
      type: "object",
      properties: {
        changes: {
          type: "object",
          description: `Inputs to override, by field name. Allowed fields: ${EDITABLE.join(", ")}. Percent fields are in percent (5 means 5%).`,
          additionalProperties: { type: "number" },
        },
        label: { type: "string", description: "A few words naming the scenario, e.g. '30% down'." },
      },
      required: ["changes"],
    },
  },
  {
    name: "solve_offer_price",
    description: "The highest price at which this deal still meets a target, holding the rent and operating assumptions fixed. Use it for any 'what should I offer' question.",
    input_schema: {
      type: "object",
      properties: {
        metric: { type: "string", enum: ["cash_flow", "cash_on_cash", "cap_rate", "dscr"], description: "cash_flow in dollars a month; cash_on_cash and cap_rate in percent; dscr as a ratio." },
        value: { type: "number" },
      },
      required: ["metric", "value"],
    },
  },
  {
    name: "market_context",
    description: "How members in this market decide (the cap rate they pursue at and pass at), what other members made of this exact deal, aggregate figures for active listings in the same market, and what THIS member buys (their buy box, learned from their calls).",
    input_schema: { type: "object", properties: {} },
  },
];

const SYSTEM_PROMPT = `You are Realist's investor-realtor: the experienced agent a Canadian real estate investor wishes they had on speed dial. The member is reviewing one deal from their desk. They will see at most one showing, so your job is to help them decide whether this deal has earned it, what to verify when they go, and what to offer.

Rules, in order of importance:
1. Every number you state must come from the deal data you were given or from a tool result. Never do arithmetic yourself, never estimate, never recall a market statistic. If you need a number, call a tool. If a tool can't give it to you, say you don't have it.
2. Be direct and specific to THIS deal. Lead with the answer. No preamble, no "great question", no generic real-estate education. Under 170 words unless they ask for detail.
3. Use the listing remarks when they matter — what they reveal (tenancy, condition, motivation, legal status of units, who pays utilities) and what they conspicuously leave out. A remark is a claim by the seller's agent, never a verified fact.
4. Lending: 1–4 units is a residential mortgage, qualified on the borrower's income plus part of the rent; 5+ units is commercial, sized to the property's debt coverage (1.10 for CMHC MLI Select, about 1.20 conventionally). Don't apply one to the other. Mortgage payments here already use Canadian semi-annual compounding.
5. You are not a lawyer, accountant or mortgage broker, and this is not advice. Never tell them to buy. Say what the numbers show, what would change your mind, and what must be verified in person or on paper. When it's time for a showing or an offer, tell them to use the buttons on the page: a licensed agent on the team gets their numbers and what they want verified.
6. If their buy box is known, say plainly whether this deal is inside it or outside it, and why. Canadian spelling. Plain text only — no markdown, no headings, no bullet symbols.`;

function describeResult(inputs: UnderwriterInputs) {
  const result = underwrite(inputs);
  return {
    monthlyCashFlow: result.monthlyCashFlow,
    capRatePercent: result.capRate,
    cashOnCashPercent: result.cashOnCashReturn,
    debtCoverage: result.dscr,
    irrPercent: result.irr,
    noiAnnual: result.noi,
    monthlyMortgagePayment: result.monthlyDebtService,
    loanAmount: result.loanAmount,
    cashNeededToClose: result.cashInvested,
  };
}

/** Run one tool call. Pure: every figure it returns is the engine's. */
export function runTool(name: string, input: unknown, context: AskContext): { result: unknown; step: string } {
  const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  if (name === "underwrite_scenario") {
    const changes = (args.changes && typeof args.changes === "object" ? args.changes : {}) as Record<string, unknown>;
    const next = { ...context.inputs };
    const applied: string[] = [];
    const refused: string[] = [];
    for (const [field, raw] of Object.entries(changes)) {
      const limits = INPUT_LIMITS[field as UnderwriterField];
      const value = Number(raw);
      if (!limits || !isFinite(value) || value < limits[0] || value > limits[1]) {
        refused.push(field);
        continue;
      }
      next[field as UnderwriterField] = value;
      applied.push(`${field} ${value}`);
    }
    // A different price moves the price-linked costs with it, exactly as the solver does.
    if (typeof changes.price === "number" && context.inputs.price > 0 && changes.closingCosts === undefined) {
      const ratio = next.price / context.inputs.price;
      next.closingCosts = Math.round(context.inputs.closingCosts * ratio);
      if (changes.annualInsurance === undefined) next.annualInsurance = Math.round(context.inputs.annualInsurance * ratio);
    }
    const label = typeof args.label === "string" && args.label.trim() ? args.label.trim().slice(0, 60) : applied.join(", ") || "as entered";
    return {
      result: { scenario: label, applied, ...(refused.length ? { ignoredOutOfRange: refused } : {}), assumptions: next, results: describeResult(next) },
      step: `Re-underwrote it: ${label}`,
    };
  }

  if (name === "solve_offer_price") {
    const metric = String(args.metric) as OfferTarget["metric"];
    const value = Number(args.value);
    if (!["cash_flow", "cash_on_cash", "cap_rate", "dscr"].includes(metric) || !isFinite(value)) {
      return { result: { error: "metric must be cash_flow, cash_on_cash, cap_rate or dscr, with a numeric value" }, step: "Tried to solve for an offer price" };
    }
    const price = solveOfferPrice(context.inputs, { metric, value } as OfferTarget);
    return {
      result:
        price == null
          ? { reachable: false, note: "No price in range reaches that target at this rent — the rent or the financing has to change, not the price." }
          : { reachable: true, highestPriceMeetingTarget: price, askingOrEnteredPrice: context.inputs.price, atThatPrice: describeResult({ ...context.inputs, price: Math.min(price, context.inputs.price * 3) }) },
      step: `Solved for the price that gets ${metric.replace(/_/g, " ")} to ${value}`,
    };
  }

  if (name === "market_context") {
    return {
      result: {
        howThisMarketDecides: context.decisionLine ?? "Not enough members have made calls in this market yet.",
        otherMembersOnThisDeal: context.consensus ?? "Nobody else has worked this deal yet.",
        activeListingsInThisMarket: context.market ?? "No snapshot of this market's active listings is available.",
        thisMembersBuyBox: context.buyBox ?? "Not known yet — they haven't made enough calls for a pattern.",
      },
      step: "Checked how this market decides, and what you buy",
    };
  }

  return { result: { error: `unknown tool ${name}` }, step: `Tried an unknown tool (${name})` };
}

const UNVERIFIED =
  "I couldn't put together an answer I could fully verify against the numbers, so I'd rather not guess. Try asking it a different way — or change the inputs above and read the memo, which is computed directly from them.";

export async function askRealist(
  question: string,
  context: AskContext,
  options: { history?: AskTurn[]; client?: MessagesClient } = {},
): Promise<AskResult> {
  const client: MessagesClient = options.client ?? new Anthropic();
  const base = {
    deal: context.deal,
    assumptions: context.inputs,
    results: describeResult(context.inputs),
    rulesBasedMemo: templateMemo(context.deal, context.inputs),
    listingRemarks: context.remarks?.slice(0, 3000) ?? null,
  };

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `The deal I'm reviewing, with my own assumptions:\n\n${JSON.stringify(base)}` },
    { role: "assistant", content: "Understood. I have the deal and your numbers. What do you want to know?" },
    ...(options.history ?? []).slice(-6).map((turn) => ({ role: turn.role, content: turn.content.slice(0, 1500) })),
    { role: "user", content: question.slice(0, 600) },
  ];

  const steps: string[] = [];
  // Everything the model is allowed to quote a number from.
  const evidence: unknown[] = [base, context.decisionLine, context.consensus, context.market, context.buyBox, question];
  let corrected = false;

  for (let round = 0; round <= MAX_TOOL_ROUNDS + 1; round += 1) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages,
    });

    const calls = response.content.filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
    if (response.stop_reason === "tool_use" && calls.length > 0 && round < MAX_TOOL_ROUNDS) {
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: calls.map((call) => {
          const { result, step } = runTool(call.name, call.input, context);
          steps.push(step);
          evidence.push(result);
          return { type: "tool_result" as const, tool_use_id: call.id, content: JSON.stringify(result) };
        }),
      });
      continue;
    }

    const answer = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!answer) return { answer: UNVERIFIED, steps, verified: false };

    const leaks = findLeakedNumbers(answer, evidence);
    if (leaks.length === 0) return { answer, steps, verified: true };
    if (corrected) return { answer: UNVERIFIED, steps, verified: false };

    corrected = true;
    messages.push({ role: "assistant", content: answer });
    messages.push({
      role: "user",
      content: `That answer used figures that are not in the deal data or any tool result: ${leaks.slice(0, 8).join(", ")}. Rewrite it using ONLY numbers you were given or that a tool returned — call a tool if you need one — and copy them exactly.`,
    });
  }
  return { answer: UNVERIFIED, steps, verified: false };
}
