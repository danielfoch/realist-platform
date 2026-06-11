/**
 * CRM next-step engine — the one rule of the Realist CRM:
 * every contact has exactly one suggested next action, computable from state.
 *
 * Pure functions, no I/O, mirroring dealDeskScoring.ts so the rules are
 * unit-testable and the API/UI just render what this returns.
 */

import type { CrmChecklistItem, CrmKeyDates } from "./models/crm";

export interface ContactSnapshot {
  name: string;
  stage: string;
  contactType: string;
  email: string | null;
  consentEmail: boolean;
  phone?: string | null;
  consentSms?: boolean;
  targetMarket: string | null;
  lastTouchAt: Date | string | null;
  createdAt: Date | string;
}

export interface DealSnapshot {
  id: string;
  title: string;
  stage: string;
  keyDates: CrmKeyDates;
  checklist: CrmChecklistItem[];
}

export type NextStepKind = "call" | "email" | "sms" | "meeting" | "task" | "none";
export type NextStepPriority = "now" | "today" | "soon";

export interface NextStep {
  action: string;
  kind: NextStepKind;
  reason: string;
  dueAt: Date;
  priority: NextStepPriority;
  dealId?: string;
  /** Prefilled draft for one-click email execution, when applicable. */
  emailDraft?: { subject: string; body: string };
  /** Prefilled draft for one-click SMS execution, when applicable. */
  smsDraft?: string;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const ACTIVE_DEAL_STAGES = new Set(["preparing", "offer", "conditional", "firm"]);

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysSince(value: Date | string | null | undefined, now: Date): number {
  const d = toDate(value);
  if (!d) return Number.POSITIVE_INFINITY;
  return (now.getTime() - d.getTime()) / DAY;
}

function priorityFor(dueAt: Date, now: Date): NextStepPriority {
  if (dueAt.getTime() <= now.getTime()) return "now";
  if (dueAt.getTime() <= now.getTime() + DAY) return "today";
  return "soon";
}

function firstName(name: string): string {
  return (name || "").trim().split(/\s+/)[0] || "there";
}

export function firstContactEmail(contact: ContactSnapshot): { subject: string; body: string } {
  const market = contact.targetMarket ? ` in ${contact.targetMarket}` : "";
  return {
    subject: "Quick intro from Realist",
    body:
      `Hi ${firstName(contact.name)},\n\n` +
      `Thanks for connecting through Realist. I work with investors${market} and ` +
      `wanted to introduce myself while your search is fresh.\n\n` +
      `Two quick questions so I can actually be useful:\n` +
      `1. What kind of property are you hunting for right now?\n` +
      `2. Have you run the numbers on anything yet?\n\n` +
      `If it's easier, just reply with a listing link and I'll send back a full ` +
      `analysis.\n`,
  };
}

export function firstContactSms(contact: ContactSnapshot): string {
  const market = contact.targetMarket ? ` in ${contact.targetMarket}` : "";
  return (
    `Hi ${firstName(contact.name)}, it's Dan from Realist. Thanks for connecting — ` +
    `I work with investors${market}. What kind of property are you hunting for? ` +
    `Send me a listing link anytime and I'll run the numbers for you.`
  );
}

export function nurtureSms(contact: ContactSnapshot): string {
  const market = contact.targetMarket || "your market";
  return (
    `Hi ${firstName(contact.name)}, Dan from Realist — been watching ${market} and a few ` +
    `things shifted. Want me to send a deal worth running the numbers on?`
  );
}

export function nurtureEmail(contact: ContactSnapshot): { subject: string; body: string } {
  const market = contact.targetMarket || "your target market";
  return {
    subject: `Worth a look: what's moving in ${market}`,
    body:
      `Hi ${firstName(contact.name)},\n\n` +
      `Checking in — I've been watching ${market} and a few things have shifted ` +
      `since we last spoke.\n\n` +
      `Want me to send over a deal worth running the numbers on? Reply with a ` +
      `yes (or a listing you're curious about) and I'll get you an analysis.\n`,
  };
}

interface DealDateItem {
  label: string;
  date: Date;
}

const KEY_DATE_LABELS: Array<{ key: keyof CrmKeyDates; label: string }> = [
  { key: "depositDueDate", label: "Deposit due" },
  { key: "financingConditionDate", label: "Financing condition deadline" },
  { key: "inspectionConditionDate", label: "Inspection condition deadline" },
  { key: "closingDate", label: "Closing day" },
];

function upcomingDealDates(deal: DealSnapshot, now: Date): DealDateItem[] {
  const items: DealDateItem[] = [];
  for (const { key, label } of KEY_DATE_LABELS) {
    const d = toDate(deal.keyDates?.[key] ?? null);
    // Include recently passed dates too (overdue is the loudest signal).
    if (d && d.getTime() > now.getTime() - 7 * DAY) {
      items.push({ label, date: d });
    }
  }
  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function nextStepForDeal(deal: DealSnapshot, now: Date): NextStep | null {
  if (!ACTIVE_DEAL_STAGES.has(deal.stage)) return null;

  const dates = upcomingDealDates(deal, now);
  if (dates.length > 0) {
    const next = dates[0];
    return {
      action: `${next.label} — ${deal.title}`,
      kind: "task",
      reason: `Active deal in "${deal.stage}" stage with a hard date approaching.`,
      dueAt: next.date,
      priority: priorityFor(new Date(next.date.getTime() - 2 * DAY), now),
      dealId: deal.id,
    };
  }

  const open = (deal.checklist || []).find((item) => !item.done);
  if (open) {
    const due = toDate(open.dueAt ?? null) ?? new Date(now.getTime() + 2 * DAY);
    return {
      action: `${open.label} — ${deal.title}`,
      kind: "task",
      reason: "Next open item on the transaction checklist.",
      dueAt: due,
      priority: priorityFor(due, now),
      dealId: deal.id,
    };
  }

  return {
    action: `Review deal file — ${deal.title}`,
    kind: "task",
    reason: "Active deal with no dates or open checklist items — file needs attention.",
    dueAt: new Date(now.getTime() + DAY),
    priority: "today",
    dealId: deal.id,
  };
}

/**
 * The engine. Deterministic and ordered:
 * 1. an active deal always wins (transactions over prospecting),
 * 2. then relationship-stage rules with speed-to-lead first.
 */
export function suggestNextStep(
  contact: ContactSnapshot,
  deals: DealSnapshot[] = [],
  now: Date = new Date(),
): NextStep {
  for (const deal of deals) {
    const step = nextStepForDeal(deal, now);
    if (step) return step;
  }

  const created = toDate(contact.createdAt) ?? now;
  const sinceTouch = daysSince(contact.lastTouchAt ?? contact.createdAt, now);
  const canEmail = Boolean(contact.email && contact.consentEmail);
  const canSms = Boolean(contact.phone && contact.consentSms);
  const contactKind: NextStepKind = canEmail ? "email" : canSms ? "sms" : "call";

  switch (contact.stage) {
    case "new": {
      const dueAt = new Date(created.getTime() + HOUR);
      return {
        action: `Make first contact with ${firstName(contact.name)}`,
        kind: contactKind,
        reason: "New lead — speed to lead is the whole game. Target: under an hour.",
        dueAt,
        priority: priorityFor(dueAt, now),
        emailDraft: canEmail ? firstContactEmail(contact) : undefined,
        smsDraft: canSms ? firstContactSms(contact) : undefined,
      };
    }
    case "contacted": {
      const dueAt = new Date(now.getTime() + Math.max(0, (3 - sinceTouch) * DAY));
      return {
        action: "Second touch — follow up on first contact",
        kind: contactKind,
        reason:
          sinceTouch >= 3
            ? `No touch in ${Math.floor(sinceTouch)} days — leads go cold after 3.`
            : "Keep the 3-day follow-up cadence after first contact.",
        dueAt,
        priority: priorityFor(dueAt, now),
        emailDraft: canEmail ? nurtureEmail(contact) : undefined,
        smsDraft: canSms ? nurtureSms(contact) : undefined,
      };
    }
    case "nurturing": {
      const dueAt = new Date(now.getTime() + Math.max(0, (14 - sinceTouch) * DAY));
      return {
        action: "Nurture touch — send a deal worth analyzing",
        kind: contactKind,
        reason: "Bi-weekly cadence: stay useful, not noisy. Lead with a property, not a check-in.",
        dueAt,
        priority: priorityFor(dueAt, now),
        emailDraft: canEmail ? nurtureEmail(contact) : undefined,
        smsDraft: canSms ? nurtureSms(contact) : undefined,
      };
    }
    case "appointment": {
      const dueAt = new Date(now.getTime() + DAY);
      return {
        action: "Confirm the appointment and prep",
        kind: "call",
        reason: "Booked appointment — confirm 24h ahead and review their analyses before the meeting.",
        dueAt,
        priority: priorityFor(dueAt, now),
      };
    }
    case "client": {
      const dueAt = new Date(now.getTime() + DAY);
      return {
        action: "Open a deal file",
        kind: "task",
        reason: "Active client with no open transaction — pick a target property and start the file.",
        dueAt,
        priority: "today",
      };
    }
    case "past_client": {
      const dueAt = new Date(now.getTime() + Math.max(0, (90 - sinceTouch) * DAY));
      return {
        action: "Quarterly check-in",
        kind: contactKind,
        reason: "Past clients are the referral engine — 90-day cadence.",
        dueAt,
        priority: priorityFor(dueAt, now),
        emailDraft: canEmail ? nurtureEmail(contact) : undefined,
        smsDraft: canSms ? nurtureSms(contact) : undefined,
      };
    }
    case "lost": {
      const dueAt = new Date(now.getTime() + Math.max(0, (180 - sinceTouch) * DAY));
      return {
        action: "Re-engagement check",
        kind: "none",
        reason: "Lost — circumstances change every ~6 months. Low priority.",
        dueAt,
        priority: "soon",
      };
    }
    default: {
      const dueAt = new Date(now.getTime() + 7 * DAY);
      return {
        action: "Review contact",
        kind: "task",
        reason: "Unknown stage — review and re-stage.",
        dueAt,
        priority: "soon",
      };
    }
  }
}

/** Standard Ontario-flavoured transaction checklists. */
export function defaultChecklist(side: string): CrmChecklistItem[] {
  if (side === "sell") {
    return [
      { label: "Signed listing agreement", done: false },
      { label: "Photos, staging, and listing prep", done: false },
      { label: "Listing live on MLS", done: false },
      { label: "Review offers", done: false },
      { label: "Conditions waived / firm", done: false },
      { label: "Lawyer has file", done: false },
      { label: "Closing day confirmed", done: false },
    ];
  }
  return [
    { label: "Buyer representation agreement signed", done: false },
    { label: "Financing pre-approval confirmed", done: false },
    { label: "Offer drafted and reviewed", done: false },
    { label: "Deposit delivered", done: false },
    { label: "Financing condition satisfied", done: false },
    { label: "Inspection condition satisfied", done: false },
    { label: "Lawyer has file", done: false },
    { label: "Final walkthrough booked", done: false },
    { label: "Closing day confirmed", done: false },
  ];
}
