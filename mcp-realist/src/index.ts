#!/usr/bin/env node
/**
 * @realist/mcp — Model Context Protocol server for Realist.ca
 *
 * Exposes 8 tools for AI agents (Claude Desktop, Codex CLI, Cursor, etc.):
 *   realist_underwrite_listing       — underwrite by Canadian MLS#
 *   realist_underwrite_custom        — underwrite a custom address + price
 *   realist_find_deals               — natural-language deal search
 *   realist_list_my_analyses         — list saved underwritings
 *   realist_get_analysis             — fetch a specific underwriting
 *   realist_submit_for_review        — post to community feed
 *   realist_get_market_report        — city-level market report
 *   realist_get_mortgage_rates       — current Canadian mortgage rates
 *   estimate_rent                    — Realist rent estimate + accuracy loop
 *   underwrite_multiplex             — Toronto multiplex underwriter
 *   submit_to_deal_desk              — submit a lead/deal into Deal Desk
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
import { RealistClient, RealistApiError } from "./client.js";

const apiKey = process.env.REALIST_API_KEY;
const baseUrl = process.env.REALIST_BASE_URL;

if (!apiKey) {
  console.error("[realist-mcp] REALIST_API_KEY is not set. Mint one at https://realist.ca/account/api-keys");
  process.exit(1);
}

const client = new RealistClient({ apiKey, baseUrl });

const server = new Server(
  { name: "realist-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

const TOOLS = [
  {
    name: "realist_underwrite_listing",
    description: "Underwrite a Canadian MLS-listed property. Fetches the listing from the CREA DDF feed, computes cap rate, monthly cash flow, cash-on-cash return, and DSCR using sensible defaults that the caller can override (down payment %, interest rate, vacancy, expense ratio, custom monthly rent). Saves the analysis to the user's Realist account and returns an analysisId + URL.",
    inputSchema: {
      type: "object",
      required: ["mlsNumber"],
      properties: {
        mlsNumber: { type: "string", description: "Canadian MLS listing number, e.g. 'X12345678'" },
        strategyType: { type: "string", enum: ["buyHold", "brrr", "flip", "airbnb", "multiplex"], default: "buyHold" },
        monthlyRent: { type: "number", description: "Override monthly rent (uses CMHC / actual rent otherwise)" },
        downPaymentPercent: { type: "number", description: "Down payment % (default 20)" },
        interestRate: { type: "number", description: "Interest rate %, default 5.5" },
        vacancyRate: { type: "number", description: "Vacancy rate %, default 5" },
        expenseRatio: { type: "number", description: "Operating expenses as % of gross rent, default 35" },
      },
    },
  },
  {
    name: "realist_underwrite_custom",
    description: "Underwrite a deal at a custom address with caller-provided price. Use when the property is not in CREA DDF (e.g. off-market, US, pre-construction) or when the caller wants full control over inputs. Saves the analysis to the user's Realist account.",
    inputSchema: {
      type: "object",
      required: ["address", "price"],
      properties: {
        address: { type: "string" },
        price: { type: "number", description: "Purchase price" },
        city: { type: "string" },
        province: { type: "string" },
        countryMode: { type: "string", enum: ["CA", "US"], default: "CA" },
        strategyType: { type: "string", enum: ["buyHold", "brrr", "flip", "airbnb", "multiplex"], default: "buyHold" },
        monthlyRent: { type: "number" },
        units: { type: "integer", description: "Number of rental units" },
        beds: { type: "integer", description: "Bedroom count (used to estimate rent if monthlyRent absent)" },
        downPaymentPercent: { type: "number" },
        interestRate: { type: "number" },
        vacancyRate: { type: "number" },
        expenseRatio: { type: "number" },
      },
    },
  },
  {
    name: "realist_find_deals",
    description: "Natural-language search for Canadian real estate deals using CREA DDF. Returns ranked listings with cap rate, cash-on-cash, deal score, and a one-line explanation. Examples: '4-plex in Hamilton under $900k', 'positive cash flow houses in Calgary', 'high cap rate triplexes in Quebec'.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
        limit: { type: "integer", default: 10, minimum: 1, maximum: 25 },
      },
    },
  },
  {
    name: "realist_list_my_analyses",
    description: "List the calling user's saved underwritings (most recent first). Returns id, address, key metrics, and a URL to open the deal on realist.ca.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", default: 25, minimum: 1, maximum: 100 },
      },
    },
  },
  {
    name: "estimate_rent",
    description: "Estimate monthly market rent using Realist's prediction-ledger-backed rent estimator. Provide bedrooms plus either city/province or lat/lng. Returns rent, confidence, method, comps, and range where available.",
    inputSchema: {
      type: "object",
      required: ["bedrooms"],
      properties: {
        bedrooms: { type: ["number", "string"], description: "Bedroom count or band, e.g. 2, '2', '3+1'" },
        city: { type: "string", description: "Canadian city, e.g. Hamilton" },
        province: { type: "string", description: "Province, e.g. Ontario or ON" },
        lat: { type: "number" },
        lng: { type: "number" },
        units: { type: "integer", default: 1, minimum: 1, maximum: 100 },
        listingKey: { type: "string", description: "Optional listing key for prediction ledger lineage" },
        analysisId: { type: "string", description: "Optional analysis id for prediction ledger lineage" },
      },
    },
  },
  {
    name: "underwrite_multiplex",
    description: "Run Realist's Toronto multiplex underwriter: zoning/site screen, build configurations, condo exit vs rental hold math, MLI Select assumptions, and report narrative. Address is required; lot dimensions unlock the full underwrite.",
    inputSchema: {
      type: "object",
      required: ["address"],
      properties: {
        address: { type: "string", description: "Toronto property address" },
        postalCode: { type: "string" },
        lotFrontageFt: { type: "number" },
        lotDepthFt: { type: "number" },
        lotAreaSqft: { type: "number" },
        purchasePrice: { type: "number" },
        laneAccess: { type: "boolean" },
        goal: { type: "string", enum: ["flip", "hold"] },
        mliCommitments: {
          type: "object",
          properties: {
            affordabilityLevel: { type: "integer", minimum: 0, maximum: 3 },
            energyLevel: { type: "integer", minimum: 0, maximum: 3 },
            accessibilityLevel: { type: "integer", minimum: 0, maximum: 2 },
          },
        },
        assumptionOverrides: { type: "object" },
      },
    },
  },
  {
    name: "submit_to_deal_desk",
    description: "Submit a property and contact into Realist Deal Desk for human follow-up. Use when an investor wants financing help, buyer-agent help, or a sanity check on a deal. Creates a lead, deal, opportunity, and email-trigger queue rows.",
    inputSchema: {
      type: "object",
      required: ["name", "email", "address"],
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        address: { type: "string" },
        listingUrl: { type: "string" },
        market: { type: "string" },
        propertyType: { type: "string" },
        purchasePrice: { type: "number" },
        estimatedRent: { type: "number" },
        financingHelpWanted: { type: "boolean", default: false },
        buyingHelpWanted: { type: "boolean", default: false },
        userNotes: { type: "string" },
        consentEmail: { type: "boolean", default: false },
        consentSms: { type: "boolean", default: false },
        reportExported: { type: "boolean" },
        dealSaved: { type: "boolean" },
        financingChanged: { type: "boolean" },
        returnThresholdHit: { type: "boolean" },
        repeatMarketSearches: { type: "boolean" },
        dealDeskCtaClicked: { type: "boolean" },
        analysisId: { type: "string" },
      },
    },
  },
  {
    name: "realist_get_analysis",
    description: "Fetch a single underwriting by ID, including full inputs and computed results. The caller must own the analysis.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" } },
    },
  },
  {
    name: "realist_submit_for_review",
    description: "Post an underwriting to the Realist community feed where other investors can upvote, comment, and challenge the assumptions. Pass an existing analysisId to attach previously computed metrics, or pass metrics/assumptions inline.",
    inputSchema: {
      type: "object",
      required: ["mlsNumber"],
      properties: {
        mlsNumber: { type: "string" },
        analysisId: { type: "string", description: "Optional: a previously created analysis to attach" },
        title: { type: "string", maxLength: 180 },
        summary: { type: "string", maxLength: 2000 },
        notes: { type: "string", maxLength: 20000 },
        visibility: { type: "string", enum: ["public", "private"], default: "public" },
        metrics: { type: "object", description: "Computed metrics (capRate, cashOnCash, etc.)" },
        assumptions: { type: "object", description: "Inputs used to compute the metrics" },
        city: { type: "string" },
        province: { type: "string" },
        propertyType: { type: "string" },
        market: { type: "string", description: "Market label (e.g. 'GTA', 'Greater Vancouver')" },
      },
    },
  },
  {
    name: "realist_get_market_report",
    description: "Get the latest Realist market report. Pass a city for that city's snapshot, or omit to receive all available cities. Includes price trends, cap rates, distress signals, and inventory metrics.",
    inputSchema: {
      type: "object",
      properties: { city: { type: "string", description: "Canadian city name, e.g. 'Toronto'" } },
    },
  },
  {
    name: "realist_get_mortgage_rates",
    description: "Get current Canadian mortgage rates (fixed and variable, by term).",
    inputSchema: { type: "object", properties: {} },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

function formatResult(payload: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

function formatError(err: unknown): { content: Array<{ type: "text"; text: string }>; isError: true } {
  const msg = err instanceof RealistApiError
    ? `Realist API error (${err.status}): ${err.message}\n${JSON.stringify(err.body, null, 2)}`
    : err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text", text: msg }],
    isError: true,
  };
}

server.setRequestHandler(CallToolRequestSchema, async (req: any) => {
  const { name, arguments: args = {} } = req.params;
  try {
    switch (name) {
      case "realist_underwrite_listing":
        return formatResult(await client.underwriteListing(args as any));
      case "realist_underwrite_custom":
        return formatResult(await client.underwriteCustom(args as any));
      case "realist_find_deals":
        return formatResult(await client.findDeals(args as any));
      case "estimate_rent":
        return formatResult(await client.estimateRent(args as any));
      case "underwrite_multiplex":
        return formatResult(await client.underwriteMultiplex(args as any));
      case "submit_to_deal_desk":
        return formatResult(await client.submitToDealDesk(args as any));
      case "realist_list_my_analyses":
        return formatResult(await client.listAnalyses((args as any).limit));
      case "realist_get_analysis":
        return formatResult(await client.getAnalysis((args as any).id));
      case "realist_submit_for_review":
        return formatResult(await client.submitForReview(args as any));
      case "realist_get_market_report":
        return formatResult(await client.marketReport((args as any).city));
      case "realist_get_mortgage_rates":
        return formatResult(await client.mortgageRates());
      default:
        return formatError(new Error(`Unknown tool: ${name}`));
    }
  } catch (err) {
    return formatError(err);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[realist-mcp] ready (stdio transport)");
