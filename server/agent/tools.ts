/**
 * The Realist agent tool registry — ONE catalog of tools, served over three
 * transports:
 *
 *   /api/agent/*            legacy REST routes        (server/agentApi.ts)
 *   /api/v1/tools/:name     versioned REST + OpenAPI  (server/agent/v1Routes.ts)
 *   /mcp                    hosted MCP endpoint       (server/agent/mcpServer.ts)
 *
 * A tool is a name, a description written for the calling model, a zod input
 * schema (JSON Schema is generated from it for MCP + OpenAPI), the API-key
 * scope it needs, and a handler that only sees AgentContext + parsed input.
 * Business logic stays in the engines the handlers call (shared/, storage,
 * rentIntelligence, multiplexUnderwriter, dealDesk) — never in a transport.
 *
 * Tools that produce something worth *seeing* attach a `view` block: a link to
 * a hosted page (/v/:token) the agent hands to the human.
 */
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { propertyAnalyses, users } from "@shared/schema";
import { buyHoldInputsSchema } from "@shared/schema";
import { getRentEstimate } from "../rentIntelligence";
import { executeMultiplexUnderwriter, underwriteRequestSchema } from "../multiplexUnderwriter";
import { dealDeskSubmitSchema, submitDealDesk } from "../routes/dealDesk";
import {
  REFERRAL_OUTCOME_ACTIONS,
  getSafeReferralOutcomeForAgent,
  updateReferralOutcomeForAgent,
} from "../referralOutcomes";
import type { AgentViewRef } from "@shared/agentViews";
import { AgentToolError, internalBaseUrl, publicBaseUrl, type AgentApiScope, type AgentContext } from "./context";
import {
  fallbackMonthlyRent,
  perUnitBedrooms,
  resolveBuyHoldInputs,
  runAgentUnderwriting,
  type AgentUnderwriteAssumptions,
  type ResolvedRent,
} from "./underwriting";
import {
  attachView,
  buildDealSearchViewDocument,
  buildMarketReportViewDocument,
  buildRentEstimateViewDocument,
  buildUnderwritingViewDocument,
  snapshotHasData,
  viewUrlForToken,
  type DealSearchListing,
  type MarketSnapshotRow,
} from "./viewDocuments";
import { getAgentViewStore } from "./viewStore";

// ---------- types ----------

export interface AgentToolAnnotations {
  /** True when the tool only reads — never creates or changes anything. */
  readOnlyHint: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  /** True when the tool reaches outside Realist's own data (e.g. the MLS feed). */
  openWorldHint?: boolean;
}

export interface AgentTool<Schema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  title: string;
  /** Written for the calling model: what it does, when to use it, what comes back. */
  description: string;
  scope: AgentApiScope;
  input: Schema;
  /** Descriptions for fields of schemas imported from other modules. */
  fieldDescriptions?: Record<string, string>;
  annotations: AgentToolAnnotations;
  /** Pre-registry tool names still accepted by tools/call. */
  aliases?: string[];
  handler: (ctx: AgentContext, input: z.infer<Schema>) => Promise<Record<string, unknown>>;
}

/** Type-checks the handler against its own schema, then erases the schema type for the registry. */
function defineTool<Schema extends z.ZodTypeAny>(tool: AgentTool<Schema>): AgentTool {
  return tool as unknown as AgentTool;
}

const ADVISORY = "Outputs are screening estimates, not appraisal, legal, tax, planning or investment advice — say so when presenting them.";
const VIEW_NOTE = "The result includes view.url: always give that link to the user — it opens an interactive version of the result in their browser.";

// ---------- shared input pieces ----------

const strategyType = z.enum(["buyHold", "brrr", "flip", "airbnb", "multiplex"]).default("buyHold")
  .describe("Investment strategy label saved with the analysis. The math is a buy & hold pro forma for every strategy.");

const assumptionFields = {
  monthlyRent: z.number().positive().optional().describe("Total monthly rent for all units. If omitted, Realist uses the listing's actual rent, then its rent-estimate engine."),
  downPaymentPercent: z.number().min(0).max(100).optional().describe("Down payment, % of price. Default 20."),
  interestRate: z.number().min(0).max(25).optional().describe("Mortgage interest rate, % per year. Default 5.5."),
  amortizationYears: z.number().int().min(1).max(40).optional().describe("Amortization in years. Default 25."),
  closingCosts: z.number().min(0).optional().describe("Closing costs in dollars. Default 3% of price."),
  vacancyRate: z.number().min(0).max(50).optional().describe("Vacancy allowance, % of gross rent. Default 5."),
  expenseRatio: z.number().min(0).max(80).optional().describe("ALL-IN operating expenses as % of gross rent (tax, insurance, maintenance, management, reserves — excludes vacancy and mortgage). Omit to use line-item estimates instead."),
  annualPropertyTax: z.number().min(0).optional().describe("Annual property tax in dollars. Default: listing value, else 1% of price."),
  annualInsurance: z.number().min(0).optional().describe("Annual insurance in dollars. Default $1,200 per unit."),
  monthlyUtilities: z.number().min(0).optional().describe("Owner-paid utilities per month. Default 0."),
  maintenancePercent: z.number().min(0).max(100).optional().describe("Maintenance, % of gross rent. Default 5."),
  managementPercent: z.number().min(0).max(100).optional().describe("Property management, % of gross rent. Default 5."),
  capexReservePercent: z.number().min(0).max(100).optional().describe("Capital reserve, % of gross rent. Default 5."),
  monthlyOtherExpenses: z.number().min(0).optional().describe("Any other monthly operating expense in dollars."),
  rentGrowthPercent: z.number().min(-10).max(20).optional().describe("Annual rent growth %. Default 0 (conservative)."),
  expenseInflationPercent: z.number().min(-10).max(20).optional().describe("Annual expense inflation %. Default 2."),
  appreciationPercent: z.number().min(-10).max(20).optional().describe("Annual appreciation %. Default 2."),
  holdingPeriodYears: z.number().int().min(1).max(30).optional().describe("Years until sale, for IRR. Default 10."),
  sellingCostsPercent: z.number().min(0).max(20).optional().describe("Selling costs, % of sale price. Default 5."),
};

function pickAssumptions(input: Record<string, unknown>): AgentUnderwriteAssumptions {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(assumptionFields)) {
    if (key !== "monthlyRent" && input[key] != null) out[key] = input[key];
  }
  return out as AgentUnderwriteAssumptions;
}

// ---------- underwriting helpers ----------

async function resolveRent(
  ctx: AgentContext,
  subject: {
    providedMonthlyRent?: number;
    actualMonthlyRent?: number | null;
    beds?: number | null;
    units: number;
    city?: string | null;
    province?: string | null;
    lat?: number | null;
    lng?: number | null;
    subjectType: "listing" | "adhoc";
    subjectId?: string | null;
  },
): Promise<ResolvedRent> {
  if (subject.providedMonthlyRent && subject.providedMonthlyRent > 0) {
    return { monthlyRent: subject.providedMonthlyRent, source: "provided" };
  }
  if (subject.actualMonthlyRent && subject.actualMonthlyRent > 0) {
    return { monthlyRent: Math.round(subject.actualMonthlyRent), source: "actual" };
  }
  if (subject.city || (subject.lat != null && subject.lng != null)) {
    try {
      const estimate = await getRentEstimate({
        bedrooms: perUnitBedrooms(subject.beds, subject.units),
        city: subject.city ?? null,
        province: subject.province ?? null,
        lat: subject.lat ?? null,
        lng: subject.lng ?? null,
        units: subject.units,
        subjectType: subject.subjectType,
        subjectId: subject.subjectId ?? null,
        userId: ctx.userId,
      });
      if (estimate && estimate.monthlyRent > 0) {
        return {
          monthlyRent: Math.round(estimate.monthlyRent),
          source: "realist_estimate",
          detail: `${estimate.method.replace(/_/g, " ")}, ${estimate.compCount} comps, ${estimate.confidence} confidence`,
        };
      }
    } catch (error: any) {
      console.error("[agent] rent estimate for underwriting failed:", error?.message || error);
    }
  }
  return { monthlyRent: fallbackMonthlyRent(subject.beds, subject.units), source: "fallback_table" };
}

function headline(u: ReturnType<typeof runAgentUnderwriting>["underwriting"]): string {
  const cashFlow = `${u.monthlyCashFlow < 0 ? "-" : ""}$${Math.abs(u.monthlyCashFlow).toLocaleString("en-CA")}/mo`;
  return `Cap rate ${u.capRate}% · cash flow ${cashFlow} · cash-on-cash ${u.cashOnCash}% · DSCR ${u.dscr ?? "n/a"}${u.irr != null ? ` · ${u.exit?.holdingPeriodYears ?? ""}-yr IRR ${u.irr}%` : ""}`;
}

function ddfAddressLine(address: any): string {
  if (!address) return "";
  const street = [address.streetNumber, address.streetDirectionPrefix, address.streetName, address.streetSuffix, address.streetDirection]
    .map((part: unknown) => String(part || "").trim()).filter(Boolean).join(" ");
  return address.unitNumber ? `${address.unitNumber}-${street}` : street;
}

const num = (value: unknown): number | null => {
  const n = typeof value === "string" ? parseFloat(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) ? n : null;
};

// ---------- tools ----------

const whoami = defineTool({
  name: "realist_whoami",
  title: "Check connection",
  description: "Verify the Realist API key works. Returns the account it belongs to and the scopes it carries. Call this first if another tool reports an authentication or scope problem.",
  scope: "read",
  input: z.object({}),
  annotations: { readOnlyHint: true, idempotentHint: true },
  async handler(ctx) {
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    }).from(users).where(eq(users.id, ctx.userId)).limit(1);
    return { ok: true, user: user || { id: ctx.userId }, keyId: ctx.keyId, scopes: ctx.scopes };
  },
});

const underwriteListing = defineTool({
  name: "realist_underwrite_listing",
  title: "Underwrite an MLS listing",
  description: `Underwrite a Canadian MLS®-listed property by MLS number. Pulls price, taxes, units and actual rent from the CREA DDF® feed, fills gaps with Realist's rent-estimate engine, and runs the same buy & hold pro forma as realist.ca: cap rate, NOI, cash flow, cash-on-cash, DSCR, IRR, a 10-year projection and a bear/base/bull stress test. Every assumption can be overridden. Saves the analysis to the user's account. ${VIEW_NOTE} ${ADVISORY}`,
  scope: "underwrite",
  input: z.object({
    mlsNumber: z.string().min(1).describe("Canadian MLS® listing number, e.g. X12345678."),
    strategyType,
    ...assumptionFields,
  }),
  annotations: { readOnlyHint: false, openWorldHint: true },
  async handler(ctx, input) {
    const { isDdfConfigured, searchDdfByMlsNumber, normalizeDdfListing } = await import("../creaDdf");
    if (!isDdfConfigured()) throw new AgentToolError(503, "ddf_not_configured", "CREA DDF feed is unavailable");
    const ddfListing = await searchDdfByMlsNumber(input.mlsNumber.replace(/[^a-zA-Z0-9]/g, ""));
    if (!ddfListing) throw new AgentToolError(404, "listing_not_found", undefined, { mlsNumber: input.mlsNumber });
    const listing: any = normalizeDdfListing(ddfListing);
    const price = num(listing.listPrice);
    if (price == null || price <= 1) throw new AgentToolError(422, "listing_has_no_price", undefined, { mlsNumber: input.mlsNumber });

    const beds = num(listing.details?.numBedrooms);
    const units = Math.max(1, Math.round(num(listing.numberOfUnitsTotal) ?? 1));
    const annualActualRent = num(listing.totalActualRent);
    const city = listing.address?.city || null;
    const province = listing.address?.state || null;
    const addressLine = ddfAddressLine(listing.address) || null;

    const rent = await resolveRent(ctx, {
      providedMonthlyRent: input.monthlyRent,
      actualMonthlyRent: annualActualRent && annualActualRent > 0 ? annualActualRent / 12 : null,
      beds,
      units,
      city,
      province,
      lat: num(listing.map?.latitude),
      lng: num(listing.map?.longitude),
      subjectType: "listing",
      subjectId: input.mlsNumber,
    });
    const { inputs, notes } = resolveBuyHoldInputs(
      { price, units, rent, knownAnnualPropertyTax: num(listing.taxes?.annualAmount) },
      pickAssumptions(input),
    );
    const { underwriting, results } = runAgentUnderwriting(inputs, { units, rent, notes });

    const analysis = await storage.createAnalysis({
      countryMode: "CA",
      strategyType: input.strategyType,
      inputsJson: { ...inputs, mlsNumber: input.mlsNumber, numberOfUnits: units, rentSource: rent.source, source: "agent_api" },
      resultsJson: { ...results, ...underwriting } as any,
      userId: ctx.userId,
      sessionId: null,
      address: addressLine,
      city,
      province,
      rentInputs: { monthlyRent: underwriting.monthlyRent, numberOfUnits: units },
      vacancyRate: inputs.vacancyPercent,
      expenseAssumptions: { expenseRatio: underwriting.assumptions.expenseRatio },
    });

    const view = await attachView(ctx, buildUnderwritingViewDocument({
      tool: "realist_underwrite_listing",
      property: { address: addressLine, city, province, mlsNumber: input.mlsNumber, listPrice: price, units, beds, propertyType: listing.details?.propertyType ?? null },
      strategyType: input.strategyType,
      countryMode: "CA",
      inputs,
      rent,
      notes,
      analysisId: analysis.id,
    }), { analysisId: analysis.id });

    return {
      summary: headline(underwriting),
      analysisId: analysis.id,
      analysisUrl: view?.url ?? null,
      view,
      listing: {
        mlsNumber: input.mlsNumber,
        address: listing.address,
        listPrice: price,
        beds,
        units,
        daysOnMarket: listing.daysOnMarket,
        propertyType: listing.details?.propertyType,
      },
      underwriting,
      strategyType: input.strategyType,
    };
  },
});

const underwriteCustom = defineTool({
  name: "realist_underwrite_custom",
  title: "Underwrite any property",
  description: `Underwrite a deal at any address with a caller-supplied price — for off-market, US, pre-construction or hypothetical deals, or when the user wants full control. Runs the same buy & hold pro forma as realist.ca (cap rate, NOI, cash flow, cash-on-cash, DSCR, IRR, 10-year projection, stress test). Pass monthlyRent when the user knows it; otherwise pass city (+ beds/units) so Realist can estimate it. Saves the analysis to the user's account. ${VIEW_NOTE} ${ADVISORY}`,
  scope: "underwrite",
  input: z.object({
    address: z.string().min(1).describe("Street address or a short label for the deal."),
    price: z.number().positive().describe("Purchase price in dollars."),
    city: z.string().optional().describe("City — used for the rent estimate when monthlyRent is omitted."),
    province: z.string().optional().describe("Province or state, e.g. ON."),
    countryMode: z.enum(["CA", "US"]).default("CA"),
    strategyType,
    units: z.number().int().positive().optional().describe("Number of rental units. Default 1."),
    beds: z.number().int().nonnegative().optional().describe("TOTAL bedrooms across all units."),
    ...assumptionFields,
  }),
  annotations: { readOnlyHint: false },
  async handler(ctx, input) {
    const units = input.units && input.units > 0 ? input.units : 1;
    const rent = await resolveRent(ctx, {
      providedMonthlyRent: input.monthlyRent,
      beds: input.beds ?? null,
      units,
      city: input.countryMode === "CA" ? input.city ?? null : null,
      province: input.province ?? null,
      subjectType: "adhoc",
    });
    const { inputs, notes } = resolveBuyHoldInputs({ price: input.price, units, rent }, pickAssumptions(input));
    const { underwriting, results } = runAgentUnderwriting(inputs, { units, rent, notes });

    const analysis = await storage.createAnalysis({
      countryMode: input.countryMode,
      strategyType: input.strategyType,
      inputsJson: { ...inputs, address: input.address, numberOfUnits: units, rentSource: rent.source, source: "agent_api" },
      resultsJson: { ...results, ...underwriting } as any,
      userId: ctx.userId,
      sessionId: null,
      address: input.address,
      city: input.city || null,
      province: input.province || null,
      rentInputs: { monthlyRent: underwriting.monthlyRent, numberOfUnits: units },
      vacancyRate: inputs.vacancyPercent,
      expenseAssumptions: { expenseRatio: underwriting.assumptions.expenseRatio },
    });

    const view = await attachView(ctx, buildUnderwritingViewDocument({
      tool: "realist_underwrite_custom",
      property: { address: input.address, city: input.city ?? null, province: input.province ?? null, mlsNumber: null, listPrice: null, units, beds: input.beds ?? null, propertyType: null },
      strategyType: input.strategyType,
      countryMode: input.countryMode,
      inputs,
      rent,
      notes,
      analysisId: analysis.id,
    }), { analysisId: analysis.id });

    return {
      summary: headline(underwriting),
      analysisId: analysis.id,
      analysisUrl: view?.url ?? null,
      view,
      underwriting,
      strategyType: input.strategyType,
    };
  },
});

const findDeals = defineTool({
  name: "realist_find_deals",
  title: "Find deals",
  description: `Natural-language search of active Canadian MLS® listings, ranked for investors. Returns listings with estimated cap rate, cash-on-cash, a 0–100 deal score and a one-line reason. Examples: "4-plex in Hamilton under $900k", "positive cash flow houses in Calgary", "high cap rate triplexes in Quebec". Follow up with realist_underwrite_listing on anything promising. ${VIEW_NOTE} ${ADVISORY}`,
  scope: "read",
  input: z.object({
    query: z.string().trim().min(1).max(400).describe("What the user is looking for, in plain language — include city, property type and budget when known."),
    limit: z.coerce.number().int().min(1).default(10).describe("How many listings to return. Capped at 25."),
  }),
  annotations: { readOnlyHint: true, openWorldHint: true },
  async handler(ctx, input) {
    const upstream = await fetch(`${internalBaseUrl()}/api/find-deals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: input.query,
        demandSource: "agent_api",
        demandChannel: "api",
        demandApiKeyId: ctx.keyId,
        demandUserId: ctx.userId,
      }),
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      throw new AgentToolError(upstream.status, "find_deals_failed", undefined, { upstream: text.slice(0, 200) });
    }
    const data: any = await upstream.json();
    const top: any[] = (data.listings || []).slice(0, Math.min(input.limit, 25));
    const listings = top.map((l) => ({
      mlsNumber: l.mlsNumber,
      address: l.address,
      listPrice: l.price,
      capRate: l.cap_rate,
      cashOnCash: l.cash_on_cash,
      dealScore: l.deal_score,
      explanation: l.explanation,
      daysOnMarket: l.daysOnMarket,
      units: l.numberOfUnitsTotal,
      url: `${publicBaseUrl()}/listings/${encodeURIComponent(l.mlsNumber)}`,
    }));

    let view: AgentViewRef | null = null;
    if (top.length) {
      const rows: DealSearchListing[] = top.map((l) => ({
        mlsNumber: String(l.mlsNumber),
        addressLine: ddfAddressLine(l.address) || `MLS ${l.mlsNumber}`,
        city: l.address?.city || null,
        listPrice: num(l.price),
        capRate: num(l.cap_rate),
        cashOnCash: num(l.cash_on_cash),
        dealScore: num(l.deal_score),
        monthlyRent: num(l.monthlyRent),
        units: num(l.numberOfUnitsTotal),
        daysOnMarket: num(l.daysOnMarket),
        explanation: l.explanation || null,
      }));
      view = await attachView(ctx, buildDealSearchViewDocument("realist_find_deals", input.query, num(data.total) ?? rows.length, rows));
    }
    return { query: input.query, filters: data.filters_applied, total: data.total, listings, view };
  },
});

const estimateRent = defineTool({
  name: "realist_estimate_rent",
  title: "Estimate rent",
  description: `Estimate monthly market rent for a Canadian rental from Realist's rent engine (nearby comps → city comps → city aggregates → CMHC baseline). Provide bedrooms plus either city or lat/lng. Returns the estimate, a likely range, the method used, comp count and a confidence level — quote the confidence. ${VIEW_NOTE} ${ADVISORY}`,
  scope: "underwrite",
  aliases: ["estimate_rent"],
  input: z.object({
    bedrooms: z.union([z.number().int().nonnegative(), z.string().min(1)]).describe("Bedrooms PER UNIT, e.g. 2, or a band like \"3+1\"."),
    city: z.string().optional().nullable().describe("Canadian city, e.g. Hamilton."),
    province: z.string().optional().nullable().describe("Province, e.g. Ontario or ON."),
    lat: z.number().min(-90).max(90).optional().nullable(),
    lng: z.number().min(-180).max(180).optional().nullable(),
    units: z.number().int().min(1).max(100).optional().describe("Identical units to total up. Default 1."),
    listingKey: z.string().optional().nullable().describe("Optional listing key, links the estimate to a listing for accuracy tracking."),
    analysisId: z.string().optional().nullable().describe("Optional analysis id, links the estimate to a saved analysis."),
  }).refine((value) => Boolean(value.city) || (value.lat != null && value.lng != null), {
    message: "Provide city or lat/lng",
  }),
  annotations: { readOnlyHint: true },
  async handler(ctx, input) {
    const estimate = await getRentEstimate({
      bedrooms: input.bedrooms,
      city: input.city ?? null,
      province: input.province ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      units: input.units,
      subjectType: input.listingKey ? "listing" : input.analysisId ? "analysis" : "adhoc",
      subjectId: input.listingKey ?? input.analysisId ?? null,
      userId: ctx.userId,
    });
    const view = estimate && estimate.rangeLow != null && estimate.rangeHigh != null
      ? await attachView(ctx, buildRentEstimateViewDocument("realist_estimate_rent", input, estimate))
      : null;
    return { success: true, estimate, reason: estimate ? null : "no_data_for_market", view };
  },
});

function multiplexSummary(result: any): string | null {
  const u = result?.underwrite;
  if (!u) return typeof result?.message === "string" ? result.message : null;
  const bits = [
    u.maxUnitsAsOfRight != null ? `up to ${u.maxUnitsAsOfRight} units as-of-right` : null,
    u.zoningTier?.label ? `zoning tier: ${u.zoningTier.label}` : null,
    u.winner?.hold ? `best hold configuration: ${u.winner.hold}` : null,
    u.winner?.flip ? `best condo-exit configuration: ${u.winner.flip}` : null,
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : null;
}

const underwriteMultiplex = defineTool({
  name: "realist_underwrite_multiplex",
  title: "Underwrite a Toronto multiplex",
  description: `Realist's Toronto multiplex underwriter: screens zoning and the site (ward, sixplex eligibility, heritage, trees), sizes the buildable envelope, generates build configurations, and compares a condo exit against a CMHC MLI Select rental hold for each — with a written report. Toronto only. Identify the property by address, MLS number or realtor.ca URL; lot frontage + depth (or area) are needed for the full model — if status is "needs_lot_dimensions", ask the user for them and call again. ${VIEW_NOTE} Preliminary screening only: zoning, envelope, costs and financing must be verified with the City, a planner or architect, and a lender.`,
  scope: "underwrite",
  aliases: ["underwrite_multiplex"],
  input: underwriteRequestSchema,
  fieldDescriptions: {
    address: "Toronto street address. Optional when mlsNumber or listingUrl is given.",
    mlsNumber: "MLS® number, e.g. C1234567 — resolved through the CREA DDF® feed.",
    listingUrl: "A realtor.ca listing URL.",
    postalCode: "Postal code, helps resolve the ward.",
    lotFrontageFt: "Lot frontage in feet.",
    lotDepthFt: "Lot depth in feet.",
    lotAreaSqft: "Lot area in square feet — used when frontage/depth are unknown.",
    purchasePrice: "Purchase price in dollars. Defaults to the list price for an MLS listing.",
    laneAccess: "True if the lot backs onto a public lane (enables a laneway suite).",
    goal: "\"flip\" to optimise a condo exit, \"hold\" to optimise a rental hold.",
    mliCommitments: "CMHC MLI Select commitment levels: affordabilityLevel 0-3, energyLevel 0-3, accessibilityLevel 0-2.",
    assumptionOverrides: "Advanced: override named model assumptions (costs, rents, cap rates).",
  },
  annotations: { readOnlyHint: false, openWorldHint: true },
  async handler(ctx, input) {
    let result: any;
    try {
      result = await executeMultiplexUnderwriter(input, { userId: ctx.userId, sessionId: null });
    } catch (error: any) {
      const status = ({ SiteResolutionError: 422, ListingRefInvalid: 400, ListingNotFound: 404, ListingSourceUnavailable: 503 } as Record<string, number>)[error?.name];
      if (status) throw new AgentToolError(status, "underwrite_multiplex_failed", error.message, { code: error.name });
      throw error;
    }
    const view: AgentViewRef | null = result?.shareToken
      ? {
          url: `${publicBaseUrl()}/tools/multiplex-underwriter?share=${result.shareToken}`,
          kind: "multiplex_model",
          title: `Multiplex model — ${result.site?.address || input.address || "Toronto"}`,
          instructions: "Give this link to the user. It opens the full interactive multiplex model on realist.ca: zoning screen, build configurations, condo-exit vs rental-hold economics, MLI Select financing and the written report.",
        }
      : null;
    const summary = multiplexSummary(result);
    return { ...(summary ? { summary } : {}), ...result, view };
  },
});

const submitToDealDesk = defineTool({
  name: "realist_submit_to_deal_desk",
  title: "Send a deal to the Realist Deal Desk",
  description: "Hand a property and the user's contact details to Realist's human Deal Desk for follow-up — financing help, buyer-agent help, or a sanity check. This contacts real people on the user's behalf: only call it after the user has explicitly agreed and confirmed their name, email and what help they want. Set consentEmail/consentSms only if the user said yes to being contacted that way.",
  scope: "deal:submit",
  aliases: ["submit_to_deal_desk"],
  input: dealDeskSubmitSchema,
  fieldDescriptions: {
    name: "The user's full name.",
    email: "The user's email address.",
    phone: "The user's phone number (optional).",
    address: "Property address.",
    listingUrl: "Link to the listing, if any.",
    market: "Market label, e.g. Hamilton or GTA.",
    purchasePrice: "Purchase or asking price in dollars.",
    estimatedRent: "Expected total monthly rent in dollars.",
    financingHelpWanted: "True if the user wants mortgage/financing help.",
    buyingHelpWanted: "True if the user wants help buying (an investor-focused realtor).",
    userNotes: "Anything the user wants the Deal Desk to know.",
    consentEmail: "True only if the user explicitly agreed to be emailed.",
    consentSms: "True only if the user explicitly agreed to be texted.",
    analysisId: "A Realist analysisId to attach, from an underwriting tool.",
  },
  annotations: { readOnlyHint: false, openWorldHint: true },
  async handler(ctx, input) {
    const sourcePage = ctx.channel === "mcp" ? "/mcp" : ctx.req?.originalUrl?.split("?")[0] || "/api/agent/deal-desk-submit";
    return await submitDealDesk(input, {
      req: ctx.req ?? undefined,
      userId: ctx.userId,
      sessionId: null,
      source: "agent_api",
      sourcePage,
    }) as Record<string, unknown>;
  },
});

const listAnalyses = defineTool({
  name: "realist_list_my_analyses",
  title: "List saved analyses",
  description: "List the user's saved underwritings, newest first: id, address, headline metrics, and — where one exists — the link to its interactive view. Use realist_get_analysis for full detail.",
  scope: "read",
  input: z.object({
    limit: z.coerce.number().int().min(1).default(25).describe("How many to return. Capped at 100."),
  }),
  annotations: { readOnlyHint: true, idempotentHint: true },
  async handler(ctx, input) {
    const rows = await storage.getAnalysesByUser(ctx.userId);
    const views = await getAgentViewStore().listForUser(ctx.userId, 200).catch(() => []);
    const viewByAnalysis = new Map<string, string>();
    for (const view of views) {
      if (view.analysisId && !viewByAnalysis.has(view.analysisId)) viewByAnalysis.set(view.analysisId, viewUrlForToken(view.token));
    }
    const analyses = rows.slice(0, Math.min(input.limit, 100)).map((a: any) => ({
      id: a.id,
      createdAt: a.createdAt,
      strategyType: a.strategyType,
      countryMode: a.countryMode,
      address: a.address,
      city: a.city,
      province: a.province,
      mlsNumber: a.inputsJson?.mlsNumber || null,
      purchasePrice: a.inputsJson?.purchasePrice || null,
      capRate: a.resultsJson?.capRate ?? null,
      monthlyCashFlow: a.resultsJson?.monthlyCashFlow ?? null,
      cashOnCash: a.resultsJson?.cashOnCash ?? null,
      url: viewByAnalysis.get(a.id) ?? null,
    }));
    return { count: analyses.length, totalAvailable: rows.length, analyses };
  },
});

const getAnalysis = defineTool({
  name: "realist_get_analysis",
  title: "Get a saved analysis",
  description: `Fetch one of the user's saved underwritings by id, with full inputs and results. Creates an interactive view for it if one does not exist yet. ${VIEW_NOTE}`,
  scope: "read",
  input: z.object({ id: z.string().min(1).describe("The analysisId returned by an underwriting tool or realist_list_my_analyses.") }),
  annotations: { readOnlyHint: true, idempotentHint: true },
  async handler(ctx, input) {
    const analysis = await storage.getAnalysis(input.id);
    if (!analysis) throw new AgentToolError(404, "not_found");
    if (analysis.userId !== ctx.userId) throw new AgentToolError(403, "forbidden");

    let view: AgentViewRef | null = null;
    const existing = await getAgentViewStore().getLatestForAnalysis(ctx.userId, analysis.id).catch(() => null);
    if (existing) {
      view = { url: viewUrlForToken(existing.token), kind: existing.kind, title: existing.title, instructions: "Give this link to the user — it opens the interactive version of this analysis." };
    } else {
      // Analyses saved from the website carry the same BuyHoldInputs blob.
      const parsed = buyHoldInputsSchema.safeParse(analysis.inputsJson);
      if (parsed.success && parsed.data.purchasePrice > 0) {
        const inputsJson = (analysis.inputsJson || {}) as Record<string, any>;
        const units = Math.max(1, Math.round(num(inputsJson.numberOfUnits) ?? 1));
        view = await attachView(ctx, buildUnderwritingViewDocument({
          tool: "realist_get_analysis",
          property: { address: analysis.address, city: analysis.city, province: analysis.province, mlsNumber: inputsJson.mlsNumber ?? null, listPrice: null, units, beds: null, propertyType: null },
          strategyType: analysis.strategyType,
          countryMode: analysis.countryMode === "US" ? "US" : "CA",
          inputs: parsed.data,
          rent: { monthlyRent: parsed.data.monthlyRent, source: "provided" },
          notes: [],
          analysisId: analysis.id,
        }), { analysisId: analysis.id });
      }
    }
    return {
      id: analysis.id,
      createdAt: analysis.createdAt,
      strategyType: analysis.strategyType,
      countryMode: analysis.countryMode,
      address: analysis.address,
      city: analysis.city,
      province: analysis.province,
      inputs: analysis.inputsJson,
      results: analysis.resultsJson,
      url: view?.url ?? null,
      view,
    };
  },
});

const submitForReview = defineTool({
  name: "realist_submit_for_review",
  title: "Post an underwriting to the community",
  description: "Publish an underwriting to the Realist community feed, where other investors can upvote, comment and challenge the assumptions. This posts publicly under the user's name — only call it when the user has clearly asked to share. Pass analysisId to attach a saved analysis, or pass metrics/assumptions inline.",
  scope: "community:write",
  input: z.object({
    mlsNumber: z.string().min(1).describe("MLS® number of the listing the underwriting is about."),
    analysisId: z.string().min(1).optional().describe("A saved analysis to attach (must belong to the user)."),
    title: z.string().max(180).optional(),
    summary: z.string().max(2000).optional(),
    notes: z.string().max(20000).optional(),
    visibility: z.enum(["public", "private"]).default("public"),
    metrics: z.record(z.any()).optional().describe("Computed metrics (capRate, cashOnCash, …) when not using analysisId."),
    assumptions: z.record(z.any()).optional().describe("Inputs used to compute the metrics."),
    city: z.string().optional(),
    province: z.string().optional(),
    propertyType: z.string().optional(),
    market: z.string().optional().describe("Market label, e.g. GTA or Greater Vancouver."),
  }),
  annotations: { readOnlyHint: false, openWorldHint: true },
  async handler(ctx, input) {
    let metrics: Record<string, any> = input.metrics || {};
    let assumptions: Record<string, any> = input.assumptions || {};
    let city = input.city || null;
    let province = input.province || null;
    if (input.analysisId) {
      const existing = await storage.getAnalysis(input.analysisId);
      if (!existing || existing.userId !== ctx.userId) throw new AgentToolError(404, "analysis_not_found_or_forbidden");
      metrics = { ...(existing.resultsJson as any || {}), ...metrics };
      assumptions = { ...(existing.inputsJson as any || {}), ...assumptions };
      city = city || existing.city;
      province = province || existing.province;
    }
    const [created] = await db.insert(propertyAnalyses).values({
      userId: ctx.userId,
      listingMlsNumber: input.mlsNumber,
      title: input.title || null,
      summary: input.summary || null,
      userNotes: input.notes || null,
      visibility: input.visibility,
      assumptions: assumptions as any,
      calculatedMetrics: metrics as any,
      city,
      province,
      propertyType: input.propertyType || null,
      market: input.market || null,
      sourceContext: { source: "agent_api", apiKeyId: ctx.keyId },
    } as any).returning();
    return {
      id: created.id,
      listingMlsNumber: created.listingMlsNumber,
      visibility: created.visibility,
      url: `${publicBaseUrl()}/tools/listing-intelligence?mls=${encodeURIComponent(input.mlsNumber)}`,
    };
  },
});

const mortgageRates = defineTool({
  name: "realist_get_mortgage_rates",
  title: "Get mortgage rates",
  description: "Current Canadian mortgage rates tracked by Realist — fixed and variable, by term and lender category. Use them as the interestRate when underwriting instead of guessing.",
  scope: "read",
  input: z.object({}),
  annotations: { readOnlyHint: true, idempotentHint: true },
  async handler() {
    const { getAllCurrentRates } = await import("../rateScraper");
    const rates = await getAllCurrentRates();
    return { count: rates.length, rates };
  },
});

const marketReport = defineTool({
  name: "realist_get_market_report",
  title: "Get a market report",
  description: `City-level investor market data from realist.ca: median and average cap rates, cash-on-cash, DSCR, purchase prices, rent per unit and CMHC rent benchmarks, by month. Pass a city for its latest snapshot plus history; omit it to list every city's latest month. ${VIEW_NOTE}`,
  scope: "read",
  input: z.object({
    city: z.string().trim().max(80).optional().describe("Canadian city name, e.g. Toronto. Omit to list all cities."),
  }),
  annotations: { readOnlyHint: true, idempotentHint: true },
  async handler(ctx, input) {
    const snapshots = (await storage.getMarketSnapshots()) as unknown as MarketSnapshotRow[];
    if (!input.city) {
      const latestByCity = new Map<string, MarketSnapshotRow>();
      for (const row of snapshots.filter(snapshotHasData)) {
        const current = latestByCity.get(row.city);
        if (!current || row.month > current.month) latestByCity.set(row.city, row);
      }
      const cities = [...latestByCity.values()].sort((x, y) => x.city.localeCompare(y.city));
      return { count: cities.length, cities };
    }
    const wanted = input.city.toLowerCase();
    const history = snapshots.filter((row) => (row.city || "").toLowerCase() === wanted);
    if (!history.length) {
      const available = [...new Set(snapshots.map((row) => row.city))].sort();
      throw new AgentToolError(404, "city_not_found", `No market data for "${input.city}".`, { city: input.city, availableCities: available.slice(0, 60) });
    }
    const ordered = [...history].sort((x, y) => x.month.localeCompare(y.month));
    // Months nobody underwrote a deal in exist as empty rows; never headline one.
    const measured = ordered.filter(snapshotHasData);
    const latest = measured[measured.length - 1] ?? ordered[ordered.length - 1];
    const view = await attachView(ctx, buildMarketReportViewDocument("realist_get_market_report", latest.city, ordered));
    return {
      city: latest.city,
      province: latest.province,
      latest,
      latestMonthWithData: measured.length ? latest.month : null,
      history: ordered,
      view,
    };
  },
});

const getReferral = defineTool({
  name: "realist_get_referral",
  title: "Get a referral outcome",
  description: "Partner tool: read the status of a referral Realist routed to the partner that owns this API key. Requires the partner:referrals scope.",
  scope: "partner:referrals",
  input: z.object({ outcomeId: z.string().min(1).describe("The referral outcome id from the referral notification.") }),
  annotations: { readOnlyHint: true, idempotentHint: true },
  async handler(ctx, input) {
    const result = await getSafeReferralOutcomeForAgent(input.outcomeId, ctx.userId);
    if (!result) throw new AgentToolError(404, "referral_not_found");
    return result as Record<string, unknown>;
  },
});

const updateReferral = defineTool({
  name: "realist_update_referral",
  title: "Update a referral outcome",
  description: "Partner tool: write back progress on a referral Realist routed to the partner that owns this API key — accepted, lost, closed (with close price / GCI). Requires the partner:referrals scope.",
  scope: "partner:referrals",
  input: z.object({
    outcomeId: z.string().min(1).describe("The referral outcome id."),
    action: z.enum(REFERRAL_OUTCOME_ACTIONS).optional(),
    closePrice: z.coerce.number().finite().nonnegative().optional(),
    gci: z.coerce.number().finite().positive().optional().describe("Gross commission income in dollars."),
    financingIntent: z.boolean().optional(),
    buyingIntent: z.boolean().optional(),
    lostReason: z.string().trim().min(1).max(500).optional(),
    notes: z.string().trim().max(2000).optional(),
    reportedBy: z.string().trim().max(160).optional(),
    partnerWritebackAt: z.coerce.date().optional(),
  }).strict(),
  annotations: { readOnlyHint: false },
  async handler(ctx, input) {
    const { outcomeId, ...update } = input;
    try {
      const result = await updateReferralOutcomeForAgent(outcomeId, ctx.userId, update);
      if (!result) throw new AgentToolError(404, "referral_not_found");
      return result as Record<string, unknown>;
    } catch (error: any) {
      if (error?.name === "ReferralOutcomeValidationError") throw new AgentToolError(400, "invalid_referral_update", error.message);
      throw error;
    }
  },
});

// ---------- registry ----------

export const AGENT_TOOLS: AgentTool[] = [
  whoami,
  findDeals,
  underwriteListing,
  underwriteCustom,
  underwriteMultiplex,
  estimateRent,
  marketReport,
  mortgageRates,
  listAnalyses,
  getAnalysis,
  submitToDealDesk,
  submitForReview,
  getReferral,
  updateReferral,
];

const TOOLS_BY_NAME = new Map<string, AgentTool>();
for (const tool of AGENT_TOOLS) {
  TOOLS_BY_NAME.set(tool.name, tool);
  for (const alias of tool.aliases ?? []) TOOLS_BY_NAME.set(alias, tool);
}

export function getAgentTool(name: string): AgentTool | undefined {
  return TOOLS_BY_NAME.get(name);
}

/** Tools a key may call. Catalog listings are scope-filtered so agents never see tools they cannot use. */
export function toolsForScopes(scopes: readonly AgentApiScope[]): AgentTool[] {
  return AGENT_TOOLS.filter((tool) => scopes.includes(tool.scope));
}

const jsonSchemaCache = new Map<string, Record<string, unknown>>();

/** JSON Schema (draft-07) for a tool's input — what MCP tools/list and OpenAPI publish. */
export function toolInputJsonSchema(tool: AgentTool): Record<string, unknown> {
  const cached = jsonSchemaCache.get(tool.name);
  if (cached) return cached;
  const generated = zodToJsonSchema(tool.input, { target: "jsonSchema7", $refStrategy: "none" }) as Record<string, any>;
  delete generated.$schema;
  // MCP requires an object schema at the top level.
  const schema: Record<string, any> = generated.type === "object" ? generated : { type: "object", properties: {}, ...generated };
  if (tool.fieldDescriptions && schema.properties) {
    for (const [field, description] of Object.entries(tool.fieldDescriptions)) {
      if (schema.properties[field] && !schema.properties[field].description) schema.properties[field].description = description;
    }
  }
  jsonSchemaCache.set(tool.name, schema);
  return schema;
}

/**
 * The one way a transport runs a tool: scope check → input validation →
 * handler. Throws AgentToolError for anything the caller can act on.
 */
export async function invokeAgentTool(ctx: AgentContext, tool: AgentTool, rawInput: unknown): Promise<Record<string, unknown>> {
  if (!ctx.scopes.includes(tool.scope)) {
    throw new AgentToolError(403, "scope_required", `This API key needs the ${tool.scope} scope.`, { requiredScope: tool.scope });
  }
  const parsed = tool.input.safeParse(rawInput ?? {});
  if (!parsed.success) {
    throw new AgentToolError(400, "invalid_input", undefined, { details: parsed.error.issues });
  }
  return tool.handler(ctx, parsed.data);
}
