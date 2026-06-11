/**
 * Realist CRM API — native CRM for realist.ca.
 *
 * Design rule (Elon-simple): manage contacts, know the stage, always show one
 * next step, execute it in one click, then run the transaction file.
 *
 * Auth model: any logged-in user owns their own CRM (ownerUserId scoping).
 * Admins can additionally import Deal Desk opportunities into their book.
 */

import type { Express, Request, Response } from "express";
import "express-session";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { logUserActivity } from "./userActivity";
import { isAuthenticated } from "./auth";
import {
  crmActivities,
  crmContacts,
  crmDeals,
  insertCrmContactSchema,
  insertCrmDealSchema,
  opportunities,
  propertyAnalyses,
  users,
  CRM_ACTIVITY_KINDS,
  CRM_CONTACT_STAGES,
  CRM_DEAL_STAGES,
  type CrmChecklistItem,
  type CrmContact,
  type CrmDeal,
} from "@shared/schema";
import {
  defaultChecklist,
  suggestNextStep,
  type DealSnapshot,
  type NextStep,
} from "@shared/crmNextStep";
import { getResendClient } from "./resend";

function sessionUserId(req: Request): string | null {
  return req.session?.userId ?? null;
}

function toDealSnapshot(deal: CrmDeal): DealSnapshot {
  return {
    id: deal.id,
    title: deal.title,
    stage: deal.stage,
    keyDates: (deal.keyDates ?? {}) as DealSnapshot["keyDates"],
    checklist: (deal.checklist ?? []) as CrmChecklistItem[],
  };
}

function withNextStep(contact: CrmContact, deals: CrmDeal[]): CrmContact & { nextStep: NextStep } {
  const step = suggestNextStep(
    {
      name: contact.name,
      stage: contact.stage,
      contactType: contact.contactType,
      email: contact.email,
      consentEmail: contact.consentEmail,
      targetMarket: contact.targetMarket,
      lastTouchAt: contact.lastTouchAt,
      createdAt: contact.createdAt,
    },
    deals.map(toDealSnapshot),
  );
  return { ...contact, nextStep: step };
}

async function ownedContact(contactId: string, ownerUserId: string): Promise<CrmContact | null> {
  const [contact] = await db
    .select()
    .from(crmContacts)
    .where(and(eq(crmContacts.id, contactId), eq(crmContacts.ownerUserId, ownerUserId)))
    .limit(1);
  return contact ?? null;
}

async function logActivity(params: {
  contactId: string;
  userId: string;
  kind: string;
  body?: string | null;
  dealId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(crmActivities).values({
    contactId: params.contactId,
    userId: params.userId,
    kind: params.kind,
    body: params.body ?? null,
    dealId: params.dealId ?? null,
    metadata: params.metadata ?? {},
  });
}

async function touchContact(contactId: string): Promise<void> {
  await db
    .update(crmContacts)
    .set({ lastTouchAt: new Date(), updatedAt: new Date() })
    .where(eq(crmContacts.id, contactId));
}

export function registerCrmRoutes(app: Express): void {
  // ——— Contacts ———————————————————————————————————————————————

  app.get("/api/crm/contacts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = sessionUserId(req)!;
      const stage = typeof req.query.stage === "string" ? req.query.stage : null;

      const where = stage
        ? and(
            eq(crmContacts.ownerUserId, userId),
            eq(crmContacts.stage, stage),
            eq(crmContacts.archived, false),
          )
        : and(eq(crmContacts.ownerUserId, userId), eq(crmContacts.archived, false));

      const contacts = await db
        .select()
        .from(crmContacts)
        .where(where)
        .orderBy(desc(crmContacts.updatedAt))
        .limit(500);

      const contactIds = contacts.map((c) => c.id);
      const deals = contactIds.length
        ? await db.select().from(crmDeals).where(inArray(crmDeals.contactId, contactIds))
        : [];
      const dealsByContact = new Map<string, CrmDeal[]>();
      for (const deal of deals) {
        const list = dealsByContact.get(deal.contactId) ?? [];
        list.push(deal);
        dealsByContact.set(deal.contactId, list);
      }

      const enriched = contacts.map((c) => withNextStep(c, dealsByContact.get(c.id) ?? []));
      // Today-view ordering: overdue first, then by due date.
      const rank = { now: 0, today: 1, soon: 2 } as const;
      enriched.sort((a, b) => {
        const pr =
          rank[a.nextStep.priority as keyof typeof rank] -
          rank[b.nextStep.priority as keyof typeof rank];
        if (pr !== 0) return pr;
        return new Date(a.nextStep.dueAt).getTime() - new Date(b.nextStep.dueAt).getTime();
      });

      res.json({ success: true, contacts: enriched });
    } catch (error) {
      console.error("[crm] list contacts failed:", error);
      res.status(500).json({ success: false, error: "Failed to load contacts" });
    }
  });

  app.post("/api/crm/contacts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = sessionUserId(req)!;
      const parsed = insertCrmContactSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid contact" });
        return;
      }
      const [contact] = await db
        .insert(crmContacts)
        .values({ ...parsed.data, ownerUserId: userId })
        .returning();
      await logActivity({
        contactId: contact.id,
        userId,
        kind: "system",
        body: `Contact created${contact.source ? ` (source: ${contact.source})` : ""}`,
      });
      await logUserActivity(req, {
        userId,
        eventName: "crm.contact_created",
        sourcePage: "/crm",
        metadata: { contactId: contact.id, source: contact.source },
      });
      res.json({ success: true, contact: withNextStep(contact, []) });
    } catch (error) {
      console.error("[crm] create contact failed:", error);
      res.status(500).json({ success: false, error: "Failed to create contact" });
    }
  });

  app.get("/api/crm/contacts/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = sessionUserId(req)!;
      const contact = await ownedContact(req.params.id, userId);
      if (!contact) {
        res.status(404).json({ success: false, error: "Contact not found" });
        return;
      }
      const [activities, deals] = await Promise.all([
        db
          .select()
          .from(crmActivities)
          .where(eq(crmActivities.contactId, contact.id))
          .orderBy(desc(crmActivities.createdAt))
          .limit(100),
        db.select().from(crmDeals).where(eq(crmDeals.contactId, contact.id)),
      ]);

      // The platform advantage: surface the linked user's recent analyses.
      let analyses: Array<{
        id: string;
        title: string | null;
        city: string | null;
        listingPrice: number | null;
        createdAt: Date;
      }> = [];
      if (contact.linkedUserId) {
        analyses = await db
          .select({
            id: propertyAnalyses.id,
            title: propertyAnalyses.title,
            city: propertyAnalyses.city,
            listingPrice: propertyAnalyses.listingPrice,
            createdAt: propertyAnalyses.createdAt,
          })
          .from(propertyAnalyses)
          .where(
            and(
              eq(propertyAnalyses.userId, contact.linkedUserId),
              eq(propertyAnalyses.isDeleted, false),
            ),
          )
          .orderBy(desc(propertyAnalyses.createdAt))
          .limit(10);
      }

      res.json({
        success: true,
        contact: withNextStep(contact, deals),
        activities,
        deals,
        analyses,
      });
    } catch (error) {
      console.error("[crm] get contact failed:", error);
      res.status(500).json({ success: false, error: "Failed to load contact" });
    }
  });

  app.patch("/api/crm/contacts/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = sessionUserId(req)!;
      const contact = await ownedContact(req.params.id, userId);
      if (!contact) {
        res.status(404).json({ success: false, error: "Contact not found" });
        return;
      }
      const parsed = insertCrmContactSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid update" });
        return;
      }
      const updates = parsed.data;
      const [updated] = await db
        .update(crmContacts)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(crmContacts.id, contact.id))
        .returning();

      if (updates.stage && updates.stage !== contact.stage) {
        await logActivity({
          contactId: contact.id,
          userId,
          kind: "stage_change",
          body: `Stage: ${contact.stage} → ${updates.stage}`,
          metadata: { from: contact.stage, to: updates.stage },
        });
      }
      const deals = await db.select().from(crmDeals).where(eq(crmDeals.contactId, contact.id));
      res.json({ success: true, contact: withNextStep(updated, deals) });
    } catch (error) {
      console.error("[crm] update contact failed:", error);
      res.status(500).json({ success: false, error: "Failed to update contact" });
    }
  });

  // ——— Activities ————————————————————————————————————————————

  app.post(
    "/api/crm/contacts/:id/activities",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = sessionUserId(req)!;
        const contact = await ownedContact(req.params.id, userId);
        if (!contact) {
          res.status(404).json({ success: false, error: "Contact not found" });
          return;
        }
        const kind = String(req.body?.kind ?? "note");
        const body = typeof req.body?.body === "string" ? req.body.body.slice(0, 5000) : null;
        if (!(CRM_ACTIVITY_KINDS as readonly string[]).includes(kind)) {
          res.status(400).json({ success: false, error: "Invalid activity kind" });
          return;
        }
        await logActivity({ contactId: contact.id, userId, kind, body });
        if (kind !== "note" && kind !== "system") {
          await touchContact(contact.id);
        }
        res.json({ success: true });
      } catch (error) {
        console.error("[crm] log activity failed:", error);
        res.status(500).json({ success: false, error: "Failed to log activity" });
      }
    },
  );

  // ——— One-click next-step execution ————————————————————————————

  app.post(
    "/api/crm/contacts/:id/next-step/execute",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = sessionUserId(req)!;
        const contact = await ownedContact(req.params.id, userId);
        if (!contact) {
          res.status(404).json({ success: false, error: "Contact not found" });
          return;
        }
        const deals = await db.select().from(crmDeals).where(eq(crmDeals.contactId, contact.id));
        const { nextStep } = withNextStep(contact, deals);

        const mode = String(req.body?.mode ?? "log"); // "log" | "email"

        if (mode === "email") {
          if (!contact.email || !contact.consentEmail) {
            res.status(400).json({ success: false, error: "Contact has no email consent on file" });
            return;
          }
          const subject = String(req.body?.subject ?? nextStep.emailDraft?.subject ?? "Following up");
          const bodyText = String(req.body?.body ?? nextStep.emailDraft?.body ?? "");
          if (!bodyText.trim()) {
            res.status(400).json({ success: false, error: "Email body is empty" });
            return;
          }
          const [owner] = await db
            .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
          const { client, fromEmail } = await getResendClient();
          await client.emails.send({
            from: fromEmail,
            to: contact.email,
            replyTo: owner?.email,
            subject,
            text: bodyText,
          });
          await logActivity({
            contactId: contact.id,
            userId,
            kind: "email",
            body: `Sent: "${subject}"\n\n${bodyText}`,
            metadata: { nextStepAction: nextStep.action },
          });
        } else {
          await logActivity({
            contactId: contact.id,
            userId,
            kind: nextStep.kind === "email" ? "task" : nextStep.kind === "none" ? "note" : nextStep.kind,
            body: `Done: ${nextStep.action}`,
            dealId: nextStep.dealId ?? null,
            metadata: { nextStepAction: nextStep.action, completed: true },
          });
        }

        await touchContact(contact.id);
        // Auto-advance: completing first contact on a "new" lead moves it forward.
        if (contact.stage === "new") {
          await db
            .update(crmContacts)
            .set({ stage: "contacted", updatedAt: new Date() })
            .where(eq(crmContacts.id, contact.id));
          await logActivity({
            contactId: contact.id,
            userId,
            kind: "stage_change",
            body: "Stage: new → contacted (first contact made)",
            metadata: { from: "new", to: "contacted", auto: true },
          });
        }

        const [refreshed] = await db
          .select()
          .from(crmContacts)
          .where(eq(crmContacts.id, contact.id))
          .limit(1);
        await logUserActivity(req, {
          userId,
          eventName: "crm.next_step_executed",
          sourcePage: "/crm",
          metadata: { contactId: contact.id, mode, action: nextStep.action },
        });
        res.json({ success: true, contact: withNextStep(refreshed, deals) });
      } catch (error) {
        console.error("[crm] execute next step failed:", error);
        res.status(500).json({ success: false, error: "Failed to execute next step" });
      }
    },
  );

  // ——— Deals ————————————————————————————————————————————————

  app.post("/api/crm/deals", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = sessionUserId(req)!;
      const parsed = insertCrmDealSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid deal" });
        return;
      }
      const contact = await ownedContact(parsed.data.contactId, userId);
      if (!contact) {
        res.status(404).json({ success: false, error: "Contact not found" });
        return;
      }
      const checklist =
        Array.isArray(parsed.data.checklist) && (parsed.data.checklist as unknown[]).length > 0
          ? parsed.data.checklist
          : defaultChecklist(parsed.data.side ?? "buy");
      const [deal] = await db
        .insert(crmDeals)
        .values({ ...parsed.data, checklist, ownerUserId: userId })
        .returning();

      if (contact.stage !== "client") {
        await db
          .update(crmContacts)
          .set({ stage: "client", updatedAt: new Date() })
          .where(eq(crmContacts.id, contact.id));
      }
      await logActivity({
        contactId: contact.id,
        userId,
        kind: "system",
        dealId: deal.id,
        body: `Deal file opened: ${deal.title}`,
      });
      res.json({ success: true, deal });
    } catch (error) {
      console.error("[crm] create deal failed:", error);
      res.status(500).json({ success: false, error: "Failed to create deal" });
    }
  });

  app.patch("/api/crm/deals/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = sessionUserId(req)!;
      const [deal] = await db
        .select()
        .from(crmDeals)
        .where(and(eq(crmDeals.id, req.params.id), eq(crmDeals.ownerUserId, userId)))
        .limit(1);
      if (!deal) {
        res.status(404).json({ success: false, error: "Deal not found" });
        return;
      }
      const parsed = insertCrmDealSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid update" });
        return;
      }
      const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
      const closingNow =
        parsed.data.stage && parsed.data.stage !== deal.stage &&
        (parsed.data.stage === "closed" || parsed.data.stage === "fell_through");
      if (closingNow) updates.closedAt = new Date();

      const [updated] = await db
        .update(crmDeals)
        .set(updates)
        .where(eq(crmDeals.id, deal.id))
        .returning();

      if (parsed.data.stage && parsed.data.stage !== deal.stage) {
        await logActivity({
          contactId: deal.contactId,
          userId,
          kind: "stage_change",
          dealId: deal.id,
          body: `Deal stage: ${deal.stage} → ${parsed.data.stage}`,
          metadata: { from: deal.stage, to: parsed.data.stage },
        });
        if (parsed.data.stage === "closed") {
          await db
            .update(crmContacts)
            .set({ stage: "past_client", updatedAt: new Date() })
            .where(eq(crmContacts.id, deal.contactId));
        }
      }
      res.json({ success: true, deal: updated });
    } catch (error) {
      console.error("[crm] update deal failed:", error);
      res.status(500).json({ success: false, error: "Failed to update deal" });
    }
  });

  // ——— Deal Desk bridge: import an opportunity into my book ————————

  app.post(
    "/api/crm/import/deal-desk/:opportunityId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = sessionUserId(req)!;
        const [me] = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        if (!me || (me.role !== "admin" && me.role !== "realtor")) {
          res.status(403).json({ success: false, error: "Admin or realtor access required" });
          return;
        }
        const [opp] = await db
          .select()
          .from(opportunities)
          .where(eq(opportunities.id, req.params.opportunityId))
          .limit(1);
        if (!opp) {
          res.status(404).json({ success: false, error: "Opportunity not found" });
          return;
        }
        if (!opp.userId) {
          res.status(404).json({ success: false, error: "Opportunity has no linked user" });
          return;
        }
        const [investor] = await db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            phone: users.phone,
          })
          .from(users)
          .where(eq(users.id, opp.userId))
          .limit(1);
        if (!investor) {
          res.status(404).json({ success: false, error: "Opportunity user not found" });
          return;
        }

        // Idempotent: one contact per linked user per owner.
        const [existing] = await db
          .select()
          .from(crmContacts)
          .where(
            and(eq(crmContacts.ownerUserId, userId), eq(crmContacts.linkedUserId, investor.id)),
          )
          .limit(1);
        if (existing) {
          res.json({ success: true, contact: existing, created: false });
          return;
        }

        const name =
          [investor.firstName, investor.lastName].filter(Boolean).join(" ") || investor.email;
        const [contact] = await db
          .insert(crmContacts)
          .values({
            ownerUserId: userId,
            linkedUserId: investor.id,
            name,
            email: investor.email,
            phone: investor.phone,
            contactType: "investor",
            stage: "new",
            source: "deal_desk",
            sourceDetail: opp.market ?? opp.propertyAddress ?? null,
            targetMarket: opp.market ?? null,
            consentEmail: true, // Deal Desk submission = express request for contact
          })
          .returning();
        await logActivity({
          contactId: contact.id,
          userId,
          kind: "system",
          body: `Imported from Deal Desk (intent score ${opp.intentScore}, status ${opp.status})${opp.propertyAddress ? ` — ${opp.propertyAddress}` : ""}`,
          metadata: { opportunityId: opp.id },
        });
        res.json({ success: true, contact: withNextStep(contact, []), created: true });
      } catch (error) {
        console.error("[crm] deal desk import failed:", error);
        res.status(500).json({ success: false, error: "Failed to import opportunity" });
      }
    },
  );

  // ——— Constants for the client ————————————————————————————————

  app.get("/api/crm/meta", isAuthenticated, async (_req: Request, res: Response) => {
    res.json({
      success: true,
      contactStages: CRM_CONTACT_STAGES,
      dealStages: CRM_DEAL_STAGES,
    });
  });
}
