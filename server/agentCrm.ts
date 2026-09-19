/**
 * Agent CRM writes — Realist-owned crm_contacts only.
 * Preview builds a proposed diff; apply writes after human approval.
 * Person-spine email linkage is reused. No external CRM.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { linkPersonByEmail } from "./personSpine";
import { crmActivities, crmContacts, type CrmContact } from "@shared/schema";
import { normalizeEmail } from "@shared/authTokens";
import { AgentJobError } from "./agentJobs";
import { crmUpdateInputSchema } from "@shared/agentSpine";
import {
  buildCrmDiff,
  composeContactName,
  crmSnapshotsConflict,
  emptyCrmSnapshot,
  type CrmProposedDiff,
  type CrmSnapshot,
} from "@shared/crmJob";
import type { z } from "zod";

export type CrmUpdateInput = z.infer<typeof crmUpdateInputSchema>;

export type AgentCrmRow = {
  id: string;
  ownerUserId: string;
  name: string;
  email: string | null;
  phone: string | null;
  stage: string;
  contactType: string;
  source: string | null;
  targetMarket: string | null;
  lastTouchAt: Date | string | null;
  data: Record<string, unknown>;
  archived: boolean;
};

export interface AgentCrmStore {
  findOwnedById(ownerUserId: string, id: string): Promise<AgentCrmRow | null>;
  findOwnedByEmail(ownerUserId: string, email: string): Promise<AgentCrmRow | null>;
  listOwned(ownerUserId: string, query?: string): Promise<AgentCrmRow[]>;
  insertContact(row: Omit<AgentCrmRow, "id"> & { id?: string; linkedUserId?: string | null }): Promise<AgentCrmRow>;
  updateContact(id: string, ownerUserId: string, patch: Partial<AgentCrmRow>): Promise<AgentCrmRow>;
  insertActivity(row: { contactId: string; userId: string; kind: string; body?: string | null; metadata?: Record<string, unknown> }): Promise<void>;
  linkPersonByEmail(email: string | null | undefined): Promise<string | null>;
}

function fromDb(contact: CrmContact): AgentCrmRow {
  return {
    id: contact.id,
    ownerUserId: contact.ownerUserId,
    name: contact.name,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    stage: contact.stage,
    contactType: contact.contactType,
    source: contact.source ?? null,
    targetMarket: contact.targetMarket ?? null,
    lastTouchAt: contact.lastTouchAt ?? null,
    data: (contact.data && typeof contact.data === "object" ? contact.data : {}) as Record<string, unknown>,
    archived: contact.archived,
  };
}

const drizzleStore: AgentCrmStore = {
  async findOwnedById(ownerUserId, id) {
    const [row] = await db
      .select()
      .from(crmContacts)
      .where(and(eq(crmContacts.id, id), eq(crmContacts.ownerUserId, ownerUserId), eq(crmContacts.archived, false)))
      .limit(1);
    return row ? fromDb(row) : null;
  },
  async findOwnedByEmail(ownerUserId, email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    const [row] = await db
      .select()
      .from(crmContacts)
      .where(and(
        eq(crmContacts.ownerUserId, ownerUserId),
        eq(crmContacts.archived, false),
        sql`lower(trim(${crmContacts.email})) = ${normalized}`,
      ))
      .limit(1);
    return row ? fromDb(row) : null;
  },
  async listOwned(ownerUserId, query) {
    const rows = await db
      .select()
      .from(crmContacts)
      .where(and(eq(crmContacts.ownerUserId, ownerUserId), eq(crmContacts.archived, false)))
      .orderBy(desc(crmContacts.updatedAt))
      .limit(50);
    const q = query?.trim().toLowerCase();
    const mapped = rows.map(fromDb);
    if (!q) return mapped;
    return mapped.filter((row) =>
      row.name.toLowerCase().includes(q)
      || (row.email && row.email.toLowerCase().includes(q))
      || (row.phone && row.phone.includes(q)),
    );
  },
  async insertContact(row) {
    const [created] = await db.insert(crmContacts).values({
      ownerUserId: row.ownerUserId,
      linkedUserId: row.linkedUserId ?? null,
      name: row.name,
      email: row.email,
      phone: row.phone,
      stage: row.stage,
      contactType: row.contactType,
      source: row.source,
      targetMarket: row.targetMarket,
      data: row.data ?? {},
    }).returning();
    return fromDb(created);
  },
  async updateContact(id, ownerUserId, patch) {
    const [updated] = await db.update(crmContacts).set({
      ...(patch.name != null ? { name: patch.name } : {}),
      ...(patch.email !== undefined ? { email: patch.email } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.stage != null ? { stage: patch.stage } : {}),
      ...(patch.contactType != null ? { contactType: patch.contactType } : {}),
      ...(patch.source !== undefined ? { source: patch.source } : {}),
      ...(patch.targetMarket !== undefined ? { targetMarket: patch.targetMarket } : {}),
      ...(patch.data ? { data: patch.data } : {}),
      ...(patch.lastTouchAt !== undefined ? { lastTouchAt: patch.lastTouchAt instanceof Date ? patch.lastTouchAt : patch.lastTouchAt ? new Date(patch.lastTouchAt) : null } : {}),
      updatedAt: new Date(),
    }).where(and(eq(crmContacts.id, id), eq(crmContacts.ownerUserId, ownerUserId))).returning();
    if (!updated) throw new AgentJobError(404, "contact_not_found", "Contact disappeared during apply.");
    return fromDb(updated);
  },
  async insertActivity(row) {
    await db.insert(crmActivities).values({
      contactId: row.contactId,
      userId: row.userId,
      kind: row.kind,
      body: row.body ?? null,
      metadata: row.metadata ?? {},
    });
  },
  linkPersonByEmail,
};

let store: AgentCrmStore = drizzleStore;

export function setAgentCrmStore(next: AgentCrmStore | null) {
  store = next ?? drizzleStore;
}

export function resetAgentCrmStore() {
  store = drizzleStore;
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function snapshotFromRow(row: AgentCrmRow | null): CrmSnapshot | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    stage: row.stage,
    contactType: row.contactType,
    source: row.source,
    targetMarket: row.targetMarket,
    nextAction: typeof row.data.nextAction === "string" ? row.data.nextAction : null,
    nextActionAt: typeof row.data.nextActionAt === "string" ? row.data.nextActionAt : null,
    lastTouchAt: iso(row.lastTouchAt),
  };
}

async function resolveOwned(ownerUserId: string, input: CrmUpdateInput): Promise<AgentCrmRow | null> {
  if (input.contactId) {
    const byId = await store.findOwnedById(ownerUserId, input.contactId);
    if (!byId) {
      throw new AgentJobError(404, "contact_not_found", "No Realist CRM contact with that id in this key's book.");
    }
    return byId;
  }
  const email = input.contact?.email;
  if (!email) return null;
  return store.findOwnedByEmail(ownerUserId, email);
}

function proposedAfter(existing: AgentCrmRow | null, input: CrmUpdateInput): CrmSnapshot {
  const before = snapshotFromRow(existing) ?? emptyCrmSnapshot();
  const name = composeContactName(input.contact);
  const email = input.contact?.email ?? before.email;
  const phone = input.contact?.phone ?? before.phone;
  const after: CrmSnapshot = {
    ...before,
    name: name ?? before.name,
    email: email ?? null,
    phone: phone ?? null,
    stage: input.stage ?? before.stage ?? (input.action === "upsert_contact" ? "new" : before.stage),
    contactType: input.contact?.contactType ?? before.contactType ?? (existing ? before.contactType : "investor"),
    source: input.contact?.source ?? before.source ?? (existing ? before.source : "agent_api"),
    targetMarket: input.contact?.targetMarket ?? before.targetMarket,
    nextAction: input.nextAction ?? before.nextAction,
    nextActionAt: input.nextActionAt ?? before.nextActionAt,
  };
  if (!existing && input.action === "upsert_contact") {
    after.id = null;
  }
  return after;
}

export async function previewCrmUpdate(input: unknown, ownerUserId: string): Promise<{
  proposedDiff: CrmProposedDiff;
  dryRun: true;
  action: string;
}> {
  const parsed = crmUpdateInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new AgentJobError(400, "invalid_input", parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  const existing = await resolveOwned(ownerUserId, parsed.data);
  if (!existing && parsed.data.action !== "upsert_contact") {
    throw new AgentJobError(404, "contact_not_found", "Update-only CRM actions need an existing owned contact.");
  }
  if (!existing && parsed.data.action === "upsert_contact") {
    const name = composeContactName(parsed.data.contact);
    if (!name) {
      throw new AgentJobError(400, "name_required", "Cannot create a Realist CRM contact without a name. Names are never invented.");
    }
    if (!parsed.data.contact?.email) {
      throw new AgentJobError(400, "email_required", "Cannot create a Realist CRM contact without an email. Emails are never invented.");
    }
  }
  const after = proposedAfter(existing, parsed.data);
  if (parsed.data.note) {
    // Notes are append-only; surface the pending body without inventing contact facts.
    (after as CrmSnapshot & { pendingNote?: string }).pendingNote = parsed.data.note;
  }
  return {
    action: parsed.data.action,
    dryRun: true,
    proposedDiff: buildCrmDiff(snapshotFromRow(existing), after),
  };
}

export async function applyCrmUpdate(
  input: unknown,
  ownerUserId: string,
  previousResult?: Record<string, unknown> | null,
): Promise<{
  before: CrmSnapshot | null;
  after: CrmSnapshot;
  applied: true;
  action: string;
  contactId: string;
}> {
  const preview = await previewCrmUpdate(input, ownerUserId);
  const parsed = crmUpdateInputSchema.parse(input);
  const existing = parsed.contactId
    ? await store.findOwnedById(ownerUserId, parsed.contactId)
    : parsed.contact?.email
      ? await store.findOwnedByEmail(ownerUserId, parsed.contact.email)
      : null;

  const proposed = previousResult?.proposedDiff as CrmProposedDiff | undefined;
  const liveBefore = snapshotFromRow(existing);
  if (proposed && crmSnapshotsConflict(proposed.before, liveBefore)) {
    throw new AgentJobError(409, "conflict", "Contact changed since the proposed diff. Re-create the crm.update job.");
  }

  let row = existing;
  const after = preview.proposedDiff.after;
  if (!row) {
    const name = composeContactName(parsed.contact)!;
    const linkedUserId = await store.linkPersonByEmail(parsed.contact?.email);
    row = await store.insertContact({
      ownerUserId,
      linkedUserId,
      name,
      email: parsed.contact?.email ?? null,
      phone: parsed.contact?.phone ?? null,
      stage: parsed.stage ?? "new",
      contactType: parsed.contact?.contactType ?? "investor",
      source: parsed.contact?.source ?? "agent_api",
      targetMarket: parsed.contact?.targetMarket ?? null,
      lastTouchAt: null,
      data: {
        ...(parsed.nextAction ? { nextAction: parsed.nextAction } : {}),
        ...(parsed.nextActionAt ? { nextActionAt: parsed.nextActionAt } : {}),
      },
      archived: false,
    });
    await store.insertActivity({
      contactId: row.id,
      userId: ownerUserId,
      kind: "system",
      body: "Contact created via Agent API crm.update",
      metadata: { source: "agent_api" },
    });
  } else {
    const current = row;
    const data = { ...current.data };
    if (parsed.nextAction) data.nextAction = parsed.nextAction;
    if (parsed.nextActionAt) data.nextActionAt = parsed.nextActionAt;
    const name = composeContactName(parsed.contact);
    row = await store.updateContact(current.id, ownerUserId, {
      ...(name ? { name } : {}),
      ...(parsed.contact?.email ? { email: parsed.contact.email } : {}),
      ...(parsed.contact?.phone ? { phone: parsed.contact.phone } : {}),
      ...(parsed.stage ? { stage: parsed.stage } : {}),
      ...(parsed.contact?.contactType ? { contactType: parsed.contact.contactType } : {}),
      ...(parsed.contact?.source ? { source: parsed.contact.source } : {}),
      ...(parsed.contact?.targetMarket ? { targetMarket: parsed.contact.targetMarket } : {}),
      data,
      ...(parsed.note || parsed.nextAction ? { lastTouchAt: new Date() } : {}),
    });
    if (parsed.stage && parsed.stage !== current.stage) {
      await store.insertActivity({
        contactId: row.id,
        userId: ownerUserId,
        kind: "stage_change",
        body: `Stage: ${current.stage} → ${parsed.stage}`,
        metadata: { from: current.stage, to: parsed.stage },
      });
    }
  }

  if (parsed.note) {
    await store.insertActivity({
      contactId: row.id,
      userId: ownerUserId,
      kind: "note",
      body: parsed.note,
      metadata: { source: "agent_api" },
    });
  }
  if (parsed.nextAction && existing) {
    await store.insertActivity({
      contactId: row.id,
      userId: ownerUserId,
      kind: "task",
      body: parsed.nextAction,
      metadata: { nextActionAt: parsed.nextActionAt ?? null, source: "agent_api" },
    });
  }

  const applied = snapshotFromRow(row)!;
  return {
    action: parsed.action,
    before: liveBefore,
    after: { ...applied, id: row.id },
    applied: true,
    contactId: row.id,
  };
}

export async function listAgentCrmContacts(ownerUserId: string, query?: string) {
  return store.listOwned(ownerUserId, query);
}

export async function getAgentCrmContact(ownerUserId: string, id: string) {
  return store.findOwnedById(ownerUserId, id);
}

export function createMemoryCrmStore(seed: AgentCrmRow[] = []): AgentCrmStore & { rows: AgentCrmRow[]; activities: Array<Record<string, unknown>> } {
  const rows = seed.map((row) => ({ ...row, data: { ...row.data } }));
  const activities: Array<Record<string, unknown>> = [];
  let seq = 1;
  return {
    rows,
    activities,
    async findOwnedById(ownerUserId, id) {
      return rows.find((row) => row.ownerUserId === ownerUserId && row.id === id && !row.archived) ?? null;
    },
    async findOwnedByEmail(ownerUserId, email) {
      const normalized = normalizeEmail(email);
      return rows.find((row) =>
        row.ownerUserId === ownerUserId
        && !row.archived
        && normalizeEmail(row.email) === normalized,
      ) ?? null;
    },
    async listOwned(ownerUserId, query) {
      const q = query?.trim().toLowerCase();
      return rows.filter((row) =>
        row.ownerUserId === ownerUserId
        && !row.archived
        && (!q || row.name.toLowerCase().includes(q) || row.email?.toLowerCase().includes(q)),
      );
    },
    async insertContact(row) {
      const created: AgentCrmRow = {
        id: row.id ?? `crm_${seq++}`,
        ownerUserId: row.ownerUserId,
        name: row.name,
        email: row.email,
        phone: row.phone,
        stage: row.stage,
        contactType: row.contactType,
        source: row.source,
        targetMarket: row.targetMarket,
        lastTouchAt: row.lastTouchAt,
        data: { ...(row.data ?? {}) },
        archived: false,
      };
      rows.push(created);
      return created;
    },
    async updateContact(id, ownerUserId, patch) {
      const row = rows.find((item) => item.id === id && item.ownerUserId === ownerUserId);
      if (!row) throw new AgentJobError(404, "contact_not_found", "Contact not found");
      Object.assign(row, patch);
      if (patch.data) row.data = { ...patch.data };
      return row;
    },
    async insertActivity(row) {
      activities.push(row);
    },
    async linkPersonByEmail() {
      return null;
    },
  };
}
