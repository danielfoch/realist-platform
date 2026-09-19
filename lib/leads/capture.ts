import { and, desc, eq, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { leadDeliveries, leads, type Lead, type LeadDestination, type LeadKind, type LeadProperty } from "@/lib/db/schema";
import { recordConsent } from "@/lib/auth/consent";
import { KEYPR_CONSENT_VERSION } from "./consentText";
import { qualifiesForKeypr } from "./keypr";
import { toE164 } from "./phone";
import { leadIntent, leadRouting, provinceCode } from "./routing";

/**
 * The one way a lead enters the system. Commit first, deliver second: the row
 * and its outbox entries are written before anything is sent anywhere, so a
 * CRM outage can delay a lead but never lose one.
 */

export interface LeadInput {
  kind: LeadKind;
  email: string;
  name?: string | null;
  phone?: string | null;
  city?: string | null;
  province?: string | null;
  message?: string | null;
  property?: LeadProperty | null;
  /** Kind-specific detail. Small, flat values only — this is shown to people. */
  context?: Record<string, unknown> | null;
  userId?: string | null;
  consentMarketing?: boolean;
  consentPartner?: boolean;
  pagePath?: string | null;
  utm?: Record<string, string> | null;
  /** Where the property is, when known — decides in-house vs referral. */
  lat?: number | null;
  lng?: number | null;
}

/** A double-click or a refresh-and-resubmit is the same lead, not two. */
const DUPLICATE_WINDOW_MS = 10 * 60_000;

function sameSubject(a: Lead, input: LeadInput): boolean {
  const mls = (value: LeadProperty | null | undefined) => value?.mlsNumber ?? value?.address ?? null;
  const event = (value: Record<string, unknown> | null | undefined) => value?.eventUid ?? null;
  return mls(a.property) === mls(input.property) && event(a.context) === event(input.context);
}

export async function captureLead(input: LeadInput): Promise<{ lead: Lead; duplicate: boolean }> {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  const context = input.context ?? null;

  const recent = await db
    .select()
    .from(leads)
    .where(and(eq(leads.email, email), eq(leads.kind, input.kind), gt(leads.createdAt, new Date(Date.now() - DUPLICATE_WINDOW_MS))))
    .orderBy(desc(leads.createdAt))
    .limit(5);
  const twin = recent.find((row) => sameSubject(row, input));
  if (twin) return { lead: twin, duplicate: true };

  const province = provinceCode(input.province) ?? input.province?.trim() ?? null;
  const consentPartner = Boolean(input.consentPartner);
  const [lead] = await db
    .insert(leads)
    .values({
      kind: input.kind,
      intent: leadIntent(input.kind, context),
      routing: leadRouting({ city: input.city, province, lat: input.lat, lng: input.lng }),
      email,
      name: input.name?.trim() || null,
      phone: toE164(input.phone),
      city: input.city?.trim() || null,
      province,
      message: input.message?.trim() || null,
      property: input.property ?? null,
      context,
      userId: input.userId ?? null,
      consentMarketing: Boolean(input.consentMarketing),
      consentPartner,
      consentVersion: consentPartner ? KEYPR_CONSENT_VERSION : null,
      pagePath: input.pagePath?.slice(0, 300) ?? null,
      utm: input.utm ?? null,
    })
    .returning();

  const destinations: LeadDestination[] = ["ghl", "team_email"];
  if (qualifiesForKeypr(lead)) destinations.push("keypr");
  await db.insert(leadDeliveries).values(destinations.map((destination) => ({ leadId: lead.id, destination })));

  if (lead.consentMarketing && lead.userId) {
    await recordConsent(lead.userId, true, `lead:${lead.kind}`).catch(() => {});
  }
  return { lead, duplicate: false };
}
