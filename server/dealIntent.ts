/**
 * Deal-intent capture — the single entry point every underwriting surface uses
 * to turn work-in-the-product into lead flow.
 *
 * Before this module, the lead → opportunity → partner-routing chain existed in
 * exactly one place: the inline block in POST /api/leads (server/routes.ts).
 * The multiplex underwriter, the cap-rates map, the sale estimator and the land
 * claim screener all ran their models and returned JSON, so the highest-intent
 * act on the site (a real fourplex underwrite with confirmed lot dimensions)
 * produced no lead, no score, and no notification to a partner.
 *
 * Two entry points, deliberately split on whether we know who the person is:
 *
 *   recordDealIntent()  — always safe to call, anonymous or signed-in. Writes
 *                         the activity event so the intent engine and the
 *                         market-sentiment rollups see the work. No identity
 *                         required, nothing sent, nobody notified.
 *
 *   captureDealLead()   — called once an email is known. Does the full genesis:
 *                         lead upsert → opportunity with a SERVER-DERIVED
 *                         intent score → partner-claim routing → email triggers.
 *
 * The split is forced by the schema, not by taste: realtor_lead_notifications
 * .lead_id is NOT NULL, so a partner cannot be notified about an anonymous
 * session. Anonymous work is recorded and waits to be claimed — see
 * claimAnonymousIntent(), which the signup path calls to backfill a session's
 * work onto the new user.
 */

import type { Request } from "express";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { multiplexUnderwritings, opportunities, users, userActivityEvents } from "@shared/schema";
import { storage } from "./storage";
import { logUserActivity } from "./userActivity";
import { scoreLeadInput, selectEmailTriggers, type ScoringInput } from "@shared/leadScoring";
import { queueEmailTrigger } from "./emailTriggerProducer";
import {
  getLeadRoutingChannel,
  getPartnerTypesForIntent,
  shouldNotifyPartnerClaims,
  type LeadIntent,
} from "./referralRoutingPolicy";

/** Product surface the intent came from — drives leadSource and sourcePage. */
export type DealIntentSurface =
  | "multiplex_underwriter"
  | "deal_analyzer"
  | "cap_rates_map"
  | "sale_estimator"
  | "land_claim_screener"
  | "deal_desk";

const SURFACE_META: Record<DealIntentSurface, { leadSource: string; sourcePage: string }> = {
  multiplex_underwriter: { leadSource: "Multiplex Underwriter", sourcePage: "/tools/multiplex-underwriter" },
  deal_analyzer: { leadSource: "Deal Analyzer", sourcePage: "/tools/analyzer" },
  cap_rates_map: { leadSource: "Cap Rates Map", sourcePage: "/cap-rates" },
  sale_estimator: { leadSource: "Sale Estimator", sourcePage: "/tools/sale-estimator" },
  land_claim_screener: { leadSource: "Land Claim Screener", sourcePage: "/tools/land-claim-screener" },
  deal_desk: { leadSource: "Deal Desk", sourcePage: "/deal-desk" },
};

export interface DealIntentSignal {
  surface: DealIntentSurface;
  /** Activity event name — must be one the sentiment rollups recognise. */
  eventName: string;
  userId?: string | null;
  sessionId?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  propertyType?: string | null;
  strategyType?: string | null;
  purchasePrice?: number | null;
  estimatedRent?: number | null;
  /** multiplex_underwritings.id — raw-SQL managed, so it travels as metadata. */
  underwritingId?: string | null;
  analysisId?: string | null;
  metadata?: Record<string, unknown>;
}

function activityMetadata(signal: DealIntentSignal): Record<string, unknown> {
  return {
    ...(signal.metadata ?? {}),
    surface: signal.surface,
    // logUserActivity lifts these into the typed rollup columns.
    city: signal.city ?? undefined,
    province: signal.region ?? undefined,
    property_type: signal.propertyType ?? undefined,
    strategy_type: signal.strategyType ?? undefined,
    address: signal.address ?? undefined,
    underwritingId: signal.underwritingId ?? undefined,
    purchasePrice: signal.purchasePrice ?? undefined,
    estimatedRent: signal.estimatedRent ?? undefined,
  };
}

/**
 * Record product work as an intent signal. Anonymous-safe and non-throwing —
 * callers are model pipelines whose response must not fail because an analytics
 * write did.
 */
export async function recordDealIntent(
  req: Request | null,
  signal: DealIntentSignal,
): Promise<void> {
  try {
    await logUserActivity(req, {
      userId: signal.userId ?? null,
      sessionId: signal.sessionId ?? null,
      analysisId: signal.analysisId ?? null,
      eventName: signal.eventName,
      source: signal.surface,
      sourcePage: SURFACE_META[signal.surface].sourcePage,
      metadata: activityMetadata(signal),
    });
  } catch (err) {
    console.error(`[deal-intent] failed to record ${signal.eventName} from ${signal.surface}:`, err);
  }
}

// ─── Server-derived intent scoring ───────────────────────────────────────────

/** Behavioural lookback. Long enough to catch a weekend of deal-hunting. */
const INTENT_WINDOW_DAYS = 30;

/**
 * Derive the scoring inputs from what the person ACTUALLY did, rather than the
 * booleans the client volunteers in the request body.
 *
 * shared/leadScoring.ts is unchanged and still the single source of weights —
 * this only replaces where its inputs come from. The old call site
 * (submitDealDesk) trusts `reportExported`/`dealSaved`/`returnThresholdHit`
 * straight off the wire, which means a lead can only be scored if they filled
 * the form, and the score is self-reported either way.
 */
export async function deriveScoringInput(opts: {
  userId?: string | null;
  sessionId?: string | null;
  phoneProvided: boolean;
  financingHelpWanted: boolean;
  buyingHelpWanted: boolean;
  /** Set when this capture is itself a deal submission. */
  dealSubmitted?: boolean;
}): Promise<ScoringInput> {
  const base: ScoringInput = {
    dealSubmitted: opts.dealSubmitted ?? false,
    phoneProvided: opts.phoneProvided,
    financingHelpWanted: opts.financingHelpWanted,
    buyingHelpWanted: opts.buyingHelpWanted,
  };

  // No identity anchor means no behavioural history to read.
  if (!opts.userId && !opts.sessionId) return base;

  const since = new Date(Date.now() - INTENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const identity = opts.userId
    ? eq(userActivityEvents.userId, opts.userId)
    : eq(userActivityEvents.sessionId, opts.sessionId!);

  try {
    const [counts] = await db
      .select({
        exports: sql<number>`COUNT(*) FILTER (WHERE ${userActivityEvents.eventName} IN ('deal_exported', 'underwriting_exported_or_saved', 'report_exported'))::int`,
        saves: sql<number>`COUNT(*) FILTER (WHERE ${userActivityEvents.eventName} IN ('deal_saved', 'listing_saved', 'saved_listing', 'listing_watchlisted'))::int`,
        financingChanges: sql<number>`COUNT(*) FILTER (WHERE ${userActivityEvents.eventName} = 'financing_assumption_changed')::int`,
        ctaClicks: sql<number>`COUNT(*) FILTER (WHERE ${userActivityEvents.eventName} IN ('deal_desk_cta_clicked', 'booked_call_cta_clicked'))::int`,
        offerCandidates: sql<number>`COUNT(*) FILTER (WHERE ${userActivityEvents.eventName} = 'deal_marked_offer_candidate')::int`,
        goodDeals: sql<number>`COUNT(*) FILTER (WHERE ${userActivityEvents.eventName} = 'deal_marked_good')::int`,
        searches: sql<number>`COUNT(*) FILTER (WHERE ${userActivityEvents.eventName} IN ('market_filter_used', 'region_filter_used', 'yield_filter_used', 'cap_rate_filter_used', 'cashflow_filter_used', 'price_band_filter_used'))::int`,
        underwrites: sql<number>`COUNT(*) FILTER (WHERE ${userActivityEvents.eventName} IN ('underwriting_completed', 'analysis_completed'))::int`,
      })
      .from(userActivityEvents)
      .where(and(identity, gte(userActivityEvents.eventTimestamp, since)));

    return {
      ...base,
      reportExported: Number(counts?.exports || 0) > 0,
      dealSaved: Number(counts?.saves || 0) > 0,
      financingChanged: Number(counts?.financingChanges || 0) > 0,
      dealDeskCtaClicked: Number(counts?.ctaClicks || 0) > 0,
      // "Hit a return threshold" in behavioural terms: the person explicitly
      // marked a deal as good or as an offer candidate.
      returnThresholdHit:
        Number(counts?.offerCandidates || 0) > 0 || Number(counts?.goodDeals || 0) > 0,
      // Repeat intent — several filtered searches, or more than one completed
      // underwrite in the window. One underwrite is a trial; three is a hunt.
      repeatMarketSearches:
        Number(counts?.searches || 0) >= 3 || Number(counts?.underwrites || 0) >= 2,
    };
  } catch (err) {
    console.error("[deal-intent] scoring derivation failed, falling back to declared inputs:", err);
    return base;
  }
}

// ─── Partner routing ─────────────────────────────────────────────────────────

export interface PartnerRoutingResult {
  channel: ReturnType<typeof getLeadRoutingChannel>;
  notified: number;
}

/**
 * Fan a lead out to active partner claims for its market.
 *
 * Extracted verbatim in behaviour from the inline block in POST /api/leads so
 * every surface routes identically: Toronto-drive-zone Ontario leads stay with
 * Valery, non-Ontario goes to the partner network, the rest is held for manual
 * review. Financing intent routes to mortgage brokers + lenders instead of
 * realtors (getPartnerTypesForIntent).
 */
export async function routeLeadToPartnerClaims(opts: {
  leadId: string;
  leadName: string;
  city?: string | null;
  region?: string | null;
  intent: LeadIntent;
  dealAddress?: string | null;
  dealStrategy?: string | null;
  propertyId?: string | null;
  analysisId?: string | null;
  baseUrl: string;
}): Promise<PartnerRoutingResult> {
  const channel = getLeadRoutingChannel({ city: opts.city, region: opts.region });

  if (!opts.city || !opts.region || !shouldNotifyPartnerClaims({ city: opts.city, region: opts.region })) {
    await logUserActivity(null, {
      userId: null,
      eventName: "lead_routing_policy_applied",
      source: "partner_network",
      metadata: {
        routingChannel: channel,
        leadIntent: opts.intent,
        leadId: opts.leadId,
        analysisId: opts.analysisId ?? undefined,
        dealCity: opts.city ?? undefined,
        dealRegion: opts.region ?? undefined,
      },
    }).catch(err => console.error("[deal-intent] routing policy event error:", err));
    return { channel, notified: 0 };
  }

  const partnerTypes = getPartnerTypesForIntent(opts.intent);
  const activeClaims = await storage.getActiveClaimsForMarket(opts.city, opts.region, partnerTypes);

  for (const claim of activeClaims) {
    await storage.createRealtorLeadNotification({
      realtorClaimId: claim.id,
      realtorUserId: claim.userId,
      leadId: opts.leadId,
      propertyId: opts.propertyId ?? null,
      analysisId: opts.analysisId ?? null,
      partnerType: claim.partnerType ?? "realtor",
      dealAddress: opts.dealAddress ?? null,
      dealCity: opts.city,
      dealRegion: opts.region,
      dealStrategy: opts.dealStrategy ?? null,
      status: "new",
      notifiedAt: new Date(),
    });

    logUserActivity(null, {
      userId: claim.userId,
      eventName: "partner_lead_notified",
      source: "partner_network",
      metadata: {
        partnerType: claim.partnerType ?? "realtor",
        leadIntent: opts.intent,
        leadId: opts.leadId,
        analysisId: opts.analysisId ?? undefined,
        dealCity: opts.city,
        dealRegion: opts.region,
        dealStrategy: opts.dealStrategy ?? undefined,
      },
    }).catch(err => console.error("[deal-intent] partner_lead_notified event error:", err));

    try {
      const [partnerUser] = await db.select().from(users).where(eq(users.id, claim.userId));
      if (partnerUser) {
        const partnerName =
          `${partnerUser.firstName || ""} ${partnerUser.lastName || ""}`.trim() || partnerUser.email;
        const { sendRealtorLeadAlert } = await import("./resend");
        sendRealtorLeadAlert({
          realtorEmail: partnerUser.email,
          realtorName: partnerName,
          leadName: opts.leadName,
          dealAddress: opts.dealAddress ?? undefined,
          dealCity: opts.city ?? undefined,
          dealStrategy: opts.dealStrategy ?? undefined,
          claimUrl: `${opts.baseUrl}/partner`,
        }).catch(err => console.error("[deal-intent] partner lead alert email error:", err));
      }
    } catch (emailErr) {
      console.error("[deal-intent] partner alert lookup error:", emailErr);
    }
  }

  if (activeClaims.length > 0) {
    console.log(
      `[deal-intent] notified ${activeClaims.length} partner(s) [${partnerTypes.join(", ")}] for ${opts.city}, ${opts.region}`,
    );
  }
  return { channel, notified: activeClaims.length };
}

/** Same precedence POST /api/leads used for partner claim links. */
export function partnerBaseUrl(): string {
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  if (process.env.REPL_SLUG) return `https://${process.env.REPL_SLUG}.replit.app`;
  return "https://realist.ca";
}

// ─── Team alerting ───────────────────────────────────────────────────────────

/** Repeat captures inside this window are throttled unless they escalate. */
const TEAM_ALERT_THROTTLE_HOURS = 24;

/**
 * Whether an in-house lead should page a human right now.
 *
 * Status alone is a useless gate — captureDealLead always scores at least 55
 * (deal_submitted 40 + one of buying/financing help 15), so everything is warm
 * or better by construction. The real noise source is volume from ONE person: a
 * signed-in investor running twenty underwrites in an afternoon should not send
 * twenty emails.
 *
 * So: first capture in the window always alerts; repeats only alert if they came
 * back HOT, which is exactly the escalation worth interrupting someone for. The
 * legacy analyzer path instead used "first lead from this email, ever", which
 * goes permanently quiet on a known investor at the moment they get serious.
 */
async function shouldAlertTeam(
  leadId: string,
  status: "hot" | "warm" | "nurture" | "audience",
): Promise<boolean> {
  if (status === "nurture" || status === "audience") return false;
  try {
    const since = new Date(Date.now() - TEAM_ALERT_THROTTLE_HOURS * 60 * 60 * 1000);
    const [row] = await db
      .select({ recent: sql<number>`COUNT(*)::int` })
      .from(opportunities)
      .where(and(eq(opportunities.leadId, leadId), gte(opportunities.createdAt, since)));
    // The opportunity for THIS capture is already written, so a prior one means
    // a count above 1.
    const isRepeat = Number(row?.recent || 0) > 1;
    return !isRepeat || status === "hot";
  } catch (err) {
    // Never swallow a lead alert because a throttle query failed.
    console.error("[deal-intent] alert throttle check failed, alerting anyway:", err);
    return true;
  }
}

// ─── Full capture ────────────────────────────────────────────────────────────

export interface DealLeadIdentity {
  name: string;
  email: string;
  phone?: string | null;
  consentEmail?: boolean;
  consentSms?: boolean;
}

export interface CaptureDealLeadResult {
  leadId: string;
  opportunityId: string;
  intentScore: number;
  status: "hot" | "warm" | "nurture" | "audience";
  suggestedNextAction: string;
  routing: PartnerRoutingResult;
  triggersQueued: string[];
}

/**
 * Lead genesis for a known person: upsert the lead, score them from real
 * behaviour, open an opportunity, route to partner claims, queue the lifecycle
 * emails. Non-fatal at every step past the lead/opportunity write — a partner
 * email failing must not lose the lead.
 */
export async function captureDealLead(
  req: Request | null,
  signal: DealIntentSignal,
  identity: DealLeadIdentity,
  opts: {
    intent?: LeadIntent;
    dealSubmitted?: boolean;
    /** Set when the caller already created a properties row. */
    propertyId?: string | null;
  } = {},
): Promise<CaptureDealLeadResult> {
  const intent = opts.intent ?? "purchase";
  const meta = SURFACE_META[signal.surface];

  const lead = await storage.upsertLeadByEmail({
    name: identity.name,
    email: identity.email,
    phone: identity.phone || null,
    consent: identity.consentEmail ?? false,
    consentSms: identity.consentSms ?? false,
    leadSource: meta.leadSource,
  });

  const scoringInput = await deriveScoringInput({
    userId: signal.userId,
    sessionId: signal.sessionId,
    phoneProvided: !!(identity.phone && identity.phone.trim().length > 0),
    financingHelpWanted: intent === "financing",
    buyingHelpWanted: intent === "purchase",
    dealSubmitted: opts.dealSubmitted ?? true,
  });
  const score = scoreLeadInput(scoringInput);

  const opportunity = await storage.createOpportunity({
    leadId: lead.id,
    userId: signal.userId ?? null,
    dealId: null,
    intentScore: score.intentScore,
    status: score.status,
    suggestedNextAction: score.suggestedNextAction,
    source: signal.surface,
    financingHelp: intent === "financing",
    buyingHelp: intent === "purchase",
    propertyAddress: signal.address ?? null,
    market: signal.city ?? null,
    propertyType: signal.propertyType ?? null,
    purchasePrice: signal.purchasePrice ?? null,
    estimatedRent: signal.estimatedRent ?? null,
  });

  await recordDealIntent(req, {
    ...signal,
    eventName: "deal_submitted",
    metadata: {
      ...(signal.metadata ?? {}),
      leadId: lead.id,
      opportunityId: opportunity.id,
      intentScore: score.intentScore,
      status: score.status,
      scoreBreakdown: score.breakdown,
    },
  });

  let routing: PartnerRoutingResult = { channel: "manual_review", notified: 0 };
  try {
    routing = await routeLeadToPartnerClaims({
      leadId: lead.id,
      leadName: lead.name,
      city: signal.city,
      region: signal.region,
      intent,
      dealAddress: signal.address,
      dealStrategy: signal.strategyType,
      propertyId: opts.propertyId ?? null,
      analysisId: signal.analysisId ?? null,
      baseUrl: partnerBaseUrl(),
    });
  } catch (err) {
    console.error("[deal-intent] partner routing failed:", err);
  }

  // Partner routing deliberately stays silent on the in-house lanes ("valery"
  // for the Toronto drive zone, "manual_review" for the rest of Ontario) — but
  // silent must not mean invisible. Those are OUR leads, so the team gets the
  // alert the partner network would otherwise have sent. Without this, every
  // Toronto multiplex underwrite lands in the database and notifies nobody.
  if (routing.notified === 0 && (await shouldAlertTeam(lead.id, score.status))) {
    try {
      const { sendLeadNotification } = await import("./resend");
      await sendLeadNotification({
        name: lead.name,
        email: lead.email,
        phone: lead.phone ?? undefined,
        address: signal.address ?? undefined,
        strategy: signal.strategyType ?? undefined,
        purchasePrice: signal.purchasePrice ?? undefined,
        source: `${meta.leadSource} — ${score.status.toUpperCase()} (${score.intentScore}) · ${score.suggestedNextAction}`,
      });
    } catch (err) {
      console.error("[deal-intent] in-house lead notification failed:", err);
    }
  }

  const triggerTypes = selectEmailTriggers(score.status, intent === "financing");
  await Promise.all(
    triggerTypes.map(triggerType =>
      queueEmailTrigger({
        leadId: lead.id,
        userId: signal.userId ?? null,
        opportunityId: opportunity.id,
        triggerType,
        payload: {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          address: signal.address,
          market: signal.city,
          propertyType: signal.propertyType,
          intentScore: score.intentScore,
          status: score.status,
          suggestedNextAction: score.suggestedNextAction,
          surface: signal.surface,
          underwritingId: signal.underwritingId,
        },
      }).catch(err => console.error(`[deal-intent] failed to queue ${triggerType}:`, err)),
    ),
  );

  console.log(
    `[deal-intent] ${signal.surface} → lead ${lead.id} scored ${score.intentScore} (${score.status}), ` +
      `routing=${routing.channel}, partners=${routing.notified}`,
  );

  return {
    leadId: lead.id,
    opportunityId: opportunity.id,
    intentScore: score.intentScore,
    status: score.status,
    suggestedNextAction: score.suggestedNextAction,
    routing,
    triggersQueued: triggerTypes,
  };
}

/**
 * Attach a session's anonymous work to a user who just signed in or signed up.
 *
 * The analyzer already backfills its own table (POST /api/analyses); this does
 * the same for activity events and the raw-SQL multiplex_underwritings table,
 * so an anonymous multiplex underwrite is not orphaned the moment its author
 * creates an account.
 */
export async function claimAnonymousIntent(
  userId: string,
  sessionId: string | null | undefined,
): Promise<{ events: number; underwritings: number }> {
  if (!sessionId) return { events: 0, underwritings: 0 };

  let events = 0;
  let underwritings = 0;

  try {
    const result = await db
      .update(userActivityEvents)
      .set({ userId })
      .where(and(eq(userActivityEvents.sessionId, sessionId), isNull(userActivityEvents.userId)));
    events = result.rowCount ?? 0;
  } catch (err) {
    console.error("[deal-intent] activity backfill failed:", err);
  }

  try {
    const result = await db
      .update(multiplexUnderwritings)
      .set({ userId })
      .where(
        and(
          eq(multiplexUnderwritings.sessionId, sessionId),
          isNull(multiplexUnderwritings.userId),
        ),
      );
    underwritings = result.rowCount ?? 0;
  } catch (err) {
    console.error("[deal-intent] multiplex underwriting backfill failed:", err);
  }

  if (events || underwritings) {
    console.log(
      `[deal-intent] claimed session ${sessionId} for user ${userId}: ${events} events, ${underwritings} underwritings`,
    );
  }
  return { events, underwritings };
}
