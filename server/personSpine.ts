/**
 * PERSON SPINE — phase 1 DB wiring (see docs/engineering/PERSON-SPINE.md).
 *
 * One human = one `users` row, referenced by `leads.user_id` and
 * `crm_contacts.linked_user_id` (both nullable, additive). This module is
 * the ONLY place that resolves email → user and stamps those links:
 *
 * - linkPersonByEmail(email): forward hook for every lead / crm_contact
 *   INSERT path — resolve the email to an existing user id (or null).
 * - backlinkUserRecords(userId, email): reverse hook for every user
 *   CREATION path — stamp any pre-existing unlinked leads/crm_contacts rows
 *   with that email (one UPDATE per table).
 * - getPersonByEmail(email): the read-only unified person view future
 *   personalization consumes.
 *
 * Every helper is best-effort and never throws: identity linkage must never
 * fail a signup, lead capture, or checkout. Match rules (normalize + never
 * overwrite) live in shared/personSpine.ts, which is pure and unit tested.
 */

import { desc, eq, isNull, or, sql, and } from "drizzle-orm";
import { db } from "./db";
import {
  crmContacts,
  leads,
  users,
  type CrmContact,
  type Lead,
  type User,
} from "@shared/schema";
import { normalizeEmail } from "@shared/authTokens";

/**
 * Resolve a raw email to an existing user id, or null when no user exists.
 * Matches on lower(trim(users.email)) so legacy rows created before email
 * normalization still resolve. Never throws.
 */
export async function linkPersonByEmail(
  email: string | null | undefined,
): Promise<string | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(trim(${users.email})) = ${normalized}`)
      .orderBy(users.createdAt)
      .limit(1);
    return user?.id ?? null;
  } catch (err) {
    console.error(
      "[person-spine] linkPersonByEmail failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Reverse hook: after a user is created, backlink every pre-existing
 * unlinked leads / crm_contacts row carrying the same normalized email.
 * One UPDATE per table; existing links are never overwritten (user_id /
 * linked_user_id IS NULL guard). Idempotent and never throws.
 */
export async function backlinkUserRecords(
  userId: string,
  email: string | null | undefined,
): Promise<{ leadsLinked: number; crmContactsLinked: number }> {
  const normalized = normalizeEmail(email);
  if (!userId || !normalized) return { leadsLinked: 0, crmContactsLinked: 0 };
  let leadsLinked = 0;
  let crmContactsLinked = 0;
  try {
    const linkedLeads = await db
      .update(leads)
      .set({ userId })
      .where(
        and(
          isNull(leads.userId),
          sql`lower(trim(${leads.email})) = ${normalized}`,
        ),
      )
      .returning({ id: leads.id });
    leadsLinked = linkedLeads.length;
  } catch (err) {
    console.error(
      "[person-spine] lead backlink failed:",
      err instanceof Error ? err.message : err,
    );
  }
  try {
    const linkedContacts = await db
      .update(crmContacts)
      .set({ linkedUserId: userId })
      .where(
        and(
          isNull(crmContacts.linkedUserId),
          sql`lower(trim(${crmContacts.email})) = ${normalized}`,
        ),
      )
      .returning({ id: crmContacts.id });
    crmContactsLinked = linkedContacts.length;
  } catch (err) {
    console.error(
      "[person-spine] crm contact backlink failed:",
      err instanceof Error ? err.message : err,
    );
  }
  if (leadsLinked || crmContactsLinked) {
    console.log(
      `[person-spine] backlinked user ${userId}: ${leadsLinked} lead(s), ${crmContactsLinked} crm contact(s)`,
    );
  }
  return { leadsLinked, crmContactsLinked };
}

/** The unified person view — the single accessor for personalization. */
export interface PersonView {
  user: User | null;
  /** Every leads row for this person (append-only history), newest first. */
  leadRows: Lead[];
  /** Most recently touched crm_contacts row, or null. */
  crmContact: CrmContact | null;
  counts: { leads: number; crmContacts: number };
}

/**
 * Read-only unified view of one person by email: the users row (if any),
 * every leads row (matched by normalized email OR an existing user_id link),
 * and their most recent crm_contacts row. No writes, no merging — phase 1
 * consumers read through this instead of querying the three tables ad hoc.
 * Best-effort like the hooks: a DB error returns the empty view, so a
 * personalization read can never take down its caller.
 */
export async function getPersonByEmail(
  email: string | null | undefined,
): Promise<PersonView> {
  const empty: PersonView = {
    user: null,
    leadRows: [],
    crmContact: null,
    counts: { leads: 0, crmContacts: 0 },
  };
  const normalized = normalizeEmail(email);
  if (!normalized) return empty;

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(trim(${users.email})) = ${normalized}`)
      .orderBy(users.createdAt)
      .limit(1);

    const leadEmailMatch = sql`lower(trim(${leads.email})) = ${normalized}`;
    const leadRows = await db
      .select()
      .from(leads)
      .where(user ? or(eq(leads.userId, user.id), leadEmailMatch) : leadEmailMatch)
      .orderBy(desc(leads.createdAt));

    const contactEmailMatch = sql`lower(trim(${crmContacts.email})) = ${normalized}`;
    const contactRows = await db
      .select()
      .from(crmContacts)
      .where(
        user
          ? or(eq(crmContacts.linkedUserId, user.id), contactEmailMatch)
          : contactEmailMatch,
      )
      .orderBy(desc(crmContacts.updatedAt));

    return {
      user: user ?? null,
      leadRows,
      crmContact: contactRows[0] ?? null,
      counts: { leads: leadRows.length, crmContacts: contactRows.length },
    };
  } catch (err) {
    console.error(
      "[person-spine] getPersonByEmail failed:",
      err instanceof Error ? err.message : err,
    );
    return empty;
  }
}
