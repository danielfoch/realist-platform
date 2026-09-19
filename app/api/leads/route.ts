import { after } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current";
import { crossOriginResponse, isSameOrigin, safeNextPath } from "@/lib/auth/origin";
import { clientIp, isThrottled, recordFailure } from "@/lib/auth/throttle";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { emailConfigured } from "@/lib/email";
import { briefFor } from "@/lib/leads/brief";
import { captureLead } from "@/lib/leads/capture";
import { deliverDue } from "@/lib/leads/outbox";

/**
 * POST /api/leads — the single door for every form on the site. `kind` says
 * what the person asked for; everything downstream (CRM tags, who gets the
 * email, partner handoff) follows from it. See lib/leads.
 */

// "signup" and "active_underwriter" are raised by the server, never by a form.
const FORM_KINDS = ["event_invites", "meetup_rsvp", "offer", "showing", "financing", "power_team", "underwriting_help", "pro_application"] as const;

const DAILY_LEADS_PER_EMAIL = 8;

const flatValue = z.union([z.string().max(500), z.number(), z.boolean(), z.null(), z.array(z.string().max(80)).max(12)]);

const schema = z.object({
  kind: z.enum(FORM_KINDS),
  email: z.email().max(254),
  name: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  city: z.string().trim().max(120).optional(),
  province: z.string().trim().max(60).optional(),
  message: z.string().trim().max(2000).optional(),
  property: z
    .object({
      address: z.string().trim().max(300).nullish(),
      mlsNumber: z.string().trim().max(40).nullish(),
      price: z.number().positive().max(1e9).nullish(),
      url: z.string().trim().max(300).nullish(),
    })
    .optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  context: z
    .record(z.string().max(40), z.union([flatValue, z.record(z.string().max(40), z.union([z.number(), z.string().max(200), z.null()]))]))
    .refine((value) => Object.keys(value).length <= 16, "too much context")
    .optional(),
  consentMarketing: z.boolean().default(false),
  consentPartner: z.boolean().default(false),
  pagePath: z.string().max(300).optional(),
  utm: z.record(z.string().max(40), z.string().max(200)).optional(),
  // Honeypot: people never see this field, scripts fill it in.
  website: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Expected a JSON body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Please check the form — a valid email is required." }, { status: 400 });
  }
  const { website, ...input } = parsed.data;
  if (website) return Response.json({ ok: true });

  // Generous on purpose: at a live event a whole room submits from one Wi-Fi address.
  const ipKey = `lead-ip:${clientIp(request)}`;
  if (await isThrottled(ipKey, new Date(), 80)) {
    return Response.json({ ok: false, error: "That's a lot of requests — give it a few minutes and try again." }, { status: 429 });
  }
  await recordFailure(ipKey);

  // A listing URL is only ever a path on this site ("//evil.example" and "/\\evil.example" start with a slash too).
  if (input.property?.url) input.property.url = safeNextPath(input.property.url, "") || null;

  try {
    // One inbox can't be used to flood the team or the CRM, whatever address the requests come from.
    const [{ count }] = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(eq(leads.email, input.email.trim().toLowerCase()), gt(leads.createdAt, new Date(Date.now() - 86_400_000))));
    if (count >= DAILY_LEADS_PER_EMAIL) {
      return Response.json({ ok: false, error: "We have your requests from today — someone will be in touch. For anything urgent, reply to our email." }, { status: 429 });
    }
    const user = await getCurrentUser();
    // For a request about a deal, attach what this person underwrote and wants checked — from OUR records.
    const dealRequest = input.kind === "showing" || input.kind === "offer" || input.kind === "financing" || input.kind === "underwriting_help";
    const context = dealRequest ? { ...input.context, ...(await briefFor(input.property)) } : input.context;
    const { lead, duplicate } = await captureLead({ ...input, context, userId: user?.id ?? null });
    // Deliver once the response is on its way: the person never waits on the CRM.
    if (!duplicate) after(() => deliverDue({ leadId: lead.id }).catch((error) => console.error("[leads] inline delivery:", error)));
    // Tells the form whether to say "check your inbox".
    return Response.json({ ok: true, receipt: emailConfigured() });
  } catch (error) {
    console.error("[leads]", (error as Error).message);
    return Response.json(
      { ok: false, error: "We couldn't save your details right now. Please try again in a minute — or just email us." },
      { status: 503 },
    );
  }
}
