/**
 * Platform CRM ingest — every lead-capture surface (Deal Room registration,
 * booked-call requests, replay unlocks) upserts a crm_contacts row so the
 * native CRM is the single spine, not a side channel.
 *
 * Contacts land under one owner: CRM_OWNER_USER_ID if set, otherwise the
 * oldest admin account. All writes are best-effort — capture endpoints must
 * never fail because CRM wiring is missing.
 */

import { and, asc, eq } from "drizzle-orm";
import { db } from "./db";
import { crmActivities, crmContacts, users } from "@shared/schema";

let cachedOwnerUserId: string | null | undefined;

export async function resolvePlatformCrmOwner(): Promise<string | null> {
  if (cachedOwnerUserId !== undefined) return cachedOwnerUserId;
  const configured = process.env.CRM_OWNER_USER_ID;
  if (configured) {
    cachedOwnerUserId = configured;
    return cachedOwnerUserId;
  }
  try {
    const [admin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .orderBy(asc(users.createdAt))
      .limit(1);
    cachedOwnerUserId = admin?.id ?? null;
  } catch (err) {
    console.error("[crm-ingest] owner resolution failed:", err instanceof Error ? err.message : err);
    cachedOwnerUserId = null;
  }
  return cachedOwnerUserId;
}

export interface PlatformContactInput {
  name: string;
  email: string;
  phone?: string | null;
  linkedUserId?: string | null;
  source: string; // deal_room | booked_call | deal_room_replay | ...
  sourceDetail?: string | null;
  consentEmail?: boolean;
  consentSms?: boolean;
  activityBody: string;
  activityMetadata?: Record<string, unknown>;
}

/**
 * Idempotent per (owner, email): existing contacts get a timeline activity
 * and a lastTouchAt bump instead of a duplicate row. Returns the contact id,
 * or null when no owner is resolvable / on any error.
 */
export async function upsertPlatformCrmContact(
  input: PlatformContactInput,
): Promise<string | null> {
  try {
    const ownerUserId = await resolvePlatformCrmOwner();
    if (!ownerUserId) {
      console.warn("[crm-ingest] no CRM owner (set CRM_OWNER_USER_ID or create an admin) — skipping contact for", input.email);
      return null;
    }

    const email = input.email.trim().toLowerCase();
    let [contact] = await db
      .select()
      .from(crmContacts)
      .where(and(eq(crmContacts.ownerUserId, ownerUserId), eq(crmContacts.email, email)))
      .limit(1);

    if (!contact) {
      [contact] = await db
        .insert(crmContacts)
        .values({
          ownerUserId,
          linkedUserId: input.linkedUserId ?? null,
          name: input.name,
          email,
          phone: input.phone ?? null,
          contactType: "investor",
          stage: "new",
          source: input.source,
          sourceDetail: input.sourceDetail ?? null,
          consentEmail: input.consentEmail ?? false,
          consentSms: input.consentSms ?? false,
        })
        .returning();
    } else {
      await db
        .update(crmContacts)
        .set({
          lastTouchAt: new Date(),
          updatedAt: new Date(),
          // Never downgrade consent; phone fills in if we just learned it.
          ...(input.consentEmail ? { consentEmail: true } : {}),
          ...(input.consentSms ? { consentSms: true } : {}),
          ...(!contact.phone && input.phone ? { phone: input.phone } : {}),
        })
        .where(eq(crmContacts.id, contact.id));
    }

    await db.insert(crmActivities).values({
      contactId: contact.id,
      kind: "system",
      body: input.activityBody,
      metadata: input.activityMetadata ?? {},
    });

    return contact.id;
  } catch (err) {
    console.error("[crm-ingest] upsert failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
