import { after } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { resolveActor } from "@/lib/analyses/actor";
import { getActorStats } from "@/lib/analyses/community";
import { dealKeyFor } from "@/lib/analyses/dealKey";
import { AnalysisCapError, getAnalysis, listAnalyses, saveAnalysis } from "@/lib/analyses/store";
import { crossOriginResponse, isSameOrigin } from "@/lib/auth/origin";
import { clientIp, isThrottled, recordFailure } from "@/lib/auth/throttle";
import { getDb } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { captureLead } from "@/lib/leads/capture";
import { deliverDue } from "@/lib/leads/outbox";
import { clampInputs } from "@/lib/underwriting/underwriter";

export const dynamic = "force-dynamic";

const numbers = z.record(z.string().max(40), z.number());

const schema = z.object({
  source: z.enum(["listing", "manual"]),
  mlsNumber: z.string().trim().max(40).nullish(),
  address: z.string().trim().max(300).nullish(),
  city: z.string().trim().max(120).nullish(),
  province: z.string().trim().max(60).nullish(),
  postalCode: z.string().trim().max(12).nullish(),
  propertyType: z.string().trim().max(80).nullish(),
  inputs: numbers,
  defaults: numbers,
  offerPrice: z.number().positive().max(5e8).nullish(),
  verdict: z.enum(["pursue", "watch", "pass"]).nullish(),
  isPublic: z.boolean().optional(),
});

/** GET /api/analyses?mls=… | ?address=… — this person's saved numbers for one deal, if any. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  // ?mine=1 — just the keys of the deals this person has underwritten (for the "done" marks on cards).
  if (params.get("mine")) {
    try {
      const actor = await resolveActor({ create: false });
      const keys = actor ? (await listAnalyses(actor.key, 500)).map((row) => row.dealKey) : [];
      return Response.json({ keys }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return Response.json({ keys: [] }, { headers: { "Cache-Control": "no-store" } });
    }
  }
  const dealKey = dealKeyFor({ mlsNumber: params.get("mls"), address: params.get("address") });
  const none = Response.json({ analysis: null }, { headers: { "Cache-Control": "no-store" } });
  if (!dealKey) return none;
  try {
    const actor = await resolveActor({ create: false });
    if (!actor) return none;
    const analysis = await getAnalysis(actor.key, dealKey);
    if (!analysis) return none;
    const inputs = clampInputs(analysis.inputs);
    if (!inputs) return none;
    const stats = await getActorStats(actor.key);
    return Response.json(
      { analysis: { inputs, verdict: analysis.verdict }, signedIn: Boolean(actor.user), stats },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return none;
  }
}

/** Has this behavioural signal already been raised for this person (optionally: recently)? */
async function everRaised(email: string, kind: "first_underwrite" | "active_underwriter", withinMs?: number): Promise<boolean> {
  const conditions = [eq(leads.email, email), eq(leads.kind, kind)];
  if (withinMs) conditions.push(gt(leads.createdAt, new Date(Date.now() - withinMs)));
  const rows = await getDb().select({ id: leads.id }).from(leads).where(and(...conditions)).limit(1);
  return rows.length > 0;
}

/** A member who underwrites this many deals in a week is telling us they're buying. */
const ACTIVE_UNDERWRITER_AT = 5;
const ACTIVE_UNDERWRITER_EVERY_MS = 30 * 86_400_000;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "That analysis couldn't be read." }, { status: 400 });

  const inputs = clampInputs(parsed.data.inputs);
  const defaults = clampInputs(parsed.data.defaults);
  const dealKey = dealKeyFor(parsed.data);
  if (!inputs || !defaults || !dealKey) {
    return Response.json({ ok: false, error: "Add an address and numbers in a realistic range." }, { status: 400 });
  }

  try {
    const actor = await resolveActor({ create: true });
    if (!actor) return Response.json({ ok: false, error: "Couldn't start a session." }, { status: 400 });
    // Anonymous sessions are free to mint, so they're rate-limited by address. Members have a daily cap instead.
    const ipKey = `analysis-ip:${clientIp(request)}`;
    if (!actor.user) {
      if (await isThrottled(ipKey, new Date(), 60)) {
        return Response.json({ ok: false, error: "That's a lot of deals at once — create a free account to keep going." }, { status: 429 });
      }
      await recordFailure(ipKey);
    }
    const { analysis, created } = await saveAnalysis(actor, { ...parsed.data, dealKey, inputs, defaults });
    const stats = await getActorStats(actor.key);

    // A member's first underwrite tags them in the CRM with their market — which is
    // how "everyone underwriting Hamilton" becomes an invitation list for the Hamilton meetup.
    if (created && actor.user && stats.deals >= 1 && !(await everRaised(actor.user.email, "first_underwrite"))) {
      const user = actor.user;
      const { lead, duplicate } = await captureLead({
        kind: "first_underwrite",
        email: user.email,
        name: user.name,
        phone: user.phone,
        city: analysis.city ?? user.city,
        province: analysis.province ?? user.province,
        userId: user.id,
        consentMarketing: user.consentMarketing,
      });
      if (!duplicate) after(() => deliverDue({ leadId: lead.id }).catch(() => {}));
    }

    // Behaviour is the best lead signal there is: tell the team once, not on every deal.
    if (created && actor.user && stats.thisWeek === ACTIVE_UNDERWRITER_AT) {
      const user = actor.user;
      if (!(await everRaised(user.email, "active_underwriter", ACTIVE_UNDERWRITER_EVERY_MS))) {
        const { lead } = await captureLead({
          kind: "active_underwriter",
          email: user.email,
          name: user.name,
          phone: user.phone,
          city: analysis.city ?? user.city,
          province: analysis.province ?? user.province,
          userId: user.id,
          consentMarketing: user.consentMarketing,
          property: { address: analysis.address, mlsNumber: analysis.mlsNumber, price: analysis.price, url: analysis.mlsNumber ? `/listings/${encodeURIComponent(analysis.mlsNumber)}` : null },
          context: { dealsAnalyzed: stats.deals, dealsThisWeek: stats.thisWeek, numbers: { capRate: analysis.capRate, monthlyCashFlow: analysis.monthlyCashFlow, dscr: analysis.dscr } },
        });
        after(() => deliverDue({ leadId: lead.id }).catch(() => {}));
      }
    }

    return Response.json({
      ok: true,
      id: analysis.id,
      created,
      eligible: analysis.eligible,
      signedIn: Boolean(actor.user),
      stats,
    });
  } catch (error) {
    if (error instanceof AnalysisCapError) {
      return Response.json({ ok: false, error: "That's a lot of deals for one day — pick it up again tomorrow." }, { status: 429 });
    }
    console.error("[analyses]", (error as Error).message);
    return Response.json({ ok: false, error: "We couldn't log that analysis. Your numbers are still on screen." }, { status: 503 });
  }
}
