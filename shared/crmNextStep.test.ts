import { describe, expect, it } from "vitest";
import {
  defaultChecklist,
  firstContactEmail,
  suggestNextStep,
  type ContactSnapshot,
  type DealSnapshot,
} from "./crmNextStep";

const NOW = new Date("2026-06-10T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function contact(overrides: Partial<ContactSnapshot> = {}): ContactSnapshot {
  return {
    name: "Jane Investor",
    stage: "new",
    contactType: "investor",
    email: "jane@example.com",
    consentEmail: true,
    targetMarket: "Ottawa",
    lastTouchAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

function deal(overrides: Partial<DealSnapshot> = {}): DealSnapshot {
  return {
    id: "deal-1",
    title: "123 Main St",
    stage: "conditional",
    keyDates: {},
    checklist: [],
    ...overrides,
  };
}

describe("suggestNextStep — stage rules", () => {
  it("new lead: first contact within the hour, email kind when consented", () => {
    const step = suggestNextStep(contact(), [], NOW);
    expect(step.action).toContain("first contact");
    expect(step.kind).toBe("email");
    expect(step.dueAt.getTime()).toBe(NOW.getTime() + HOUR);
    expect(step.emailDraft?.subject).toBeTruthy();
  });

  it("new lead without email consent falls back to a call with no draft", () => {
    const step = suggestNextStep(contact({ consentEmail: false }), [], NOW);
    expect(step.kind).toBe("call");
    expect(step.emailDraft).toBeUndefined();
  });

  it("new lead older than an hour is priority now", () => {
    const created = new Date(NOW.getTime() - 3 * HOUR);
    const step = suggestNextStep(contact({ createdAt: created }), [], NOW);
    expect(step.priority).toBe("now");
  });

  it("contacted with a 5-day-old touch is overdue now", () => {
    const step = suggestNextStep(
      contact({ stage: "contacted", lastTouchAt: new Date(NOW.getTime() - 5 * DAY) }),
      [],
      NOW,
    );
    expect(step.priority).toBe("now");
    expect(step.reason).toContain("5 days");
  });

  it("contacted touched yesterday is scheduled, not due", () => {
    const step = suggestNextStep(
      contact({ stage: "contacted", lastTouchAt: new Date(NOW.getTime() - 1 * DAY) }),
      [],
      NOW,
    );
    expect(step.priority).toBe("soon");
  });

  it("nurturing runs a 14-day cadence", () => {
    const step = suggestNextStep(
      contact({ stage: "nurturing", lastTouchAt: new Date(NOW.getTime() - 15 * DAY) }),
      [],
      NOW,
    );
    expect(step.priority).toBe("now");
    expect(step.kind).toBe("email");
  });

  it("client with no deal is told to open a deal file", () => {
    const step = suggestNextStep(contact({ stage: "client" }), [], NOW);
    expect(step.action).toContain("deal file");
    expect(step.kind).toBe("task");
  });

  it("past_client gets a quarterly check-in", () => {
    const step = suggestNextStep(
      contact({ stage: "past_client", lastTouchAt: new Date(NOW.getTime() - 100 * DAY) }),
      [],
      NOW,
    );
    expect(step.action).toContain("Quarterly");
    expect(step.priority).toBe("now");
  });

  it("lost is low priority", () => {
    const step = suggestNextStep(contact({ stage: "lost" }), [], NOW);
    expect(step.kind).toBe("none");
    expect(step.priority).toBe("soon");
  });
});

describe("suggestNextStep — deals take precedence", () => {
  it("an active deal beats relationship-stage suggestions", () => {
    const step = suggestNextStep(
      contact({ stage: "nurturing", lastTouchAt: new Date(NOW.getTime() - 30 * DAY) }),
      [deal({ checklist: [{ label: "Deposit delivered", done: false }] })],
      NOW,
    );
    expect(step.dealId).toBe("deal-1");
    expect(step.action).toContain("Deposit delivered");
  });

  it("key dates beat checklist items and surface the nearest one", () => {
    const step = suggestNextStep(
      contact({ stage: "client" }),
      [
        deal({
          keyDates: {
            financingConditionDate: new Date(NOW.getTime() + 1 * DAY).toISOString(),
            closingDate: new Date(NOW.getTime() + 30 * DAY).toISOString(),
          },
          checklist: [{ label: "Lawyer has file", done: false }],
        }),
      ],
      NOW,
    );
    expect(step.action).toContain("Financing condition");
    expect(step.priority).toBe("now"); // inside the 2-day warning window
  });

  it("closed or dead deals do not generate steps", () => {
    const step = suggestNextStep(
      contact({ stage: "past_client", lastTouchAt: NOW }),
      [deal({ stage: "closed" }), deal({ id: "d2", stage: "fell_through" })],
      NOW,
    );
    expect(step.dealId).toBeUndefined();
  });

  it("skips completed checklist items", () => {
    const step = suggestNextStep(
      contact({ stage: "client" }),
      [
        deal({
          checklist: [
            { label: "Offer drafted and reviewed", done: true },
            { label: "Deposit delivered", done: false },
          ],
        }),
      ],
      NOW,
    );
    expect(step.action).toContain("Deposit delivered");
  });
});

describe("templates and checklists", () => {
  it("first-contact email personalizes name and market", () => {
    const draft = firstContactEmail(contact());
    expect(draft.body).toContain("Hi Jane");
    expect(draft.body).toContain("Ottawa");
  });

  it("default checklists differ by side and start undone", () => {
    const buy = defaultChecklist("buy");
    const sell = defaultChecklist("sell");
    expect(buy.length).toBeGreaterThan(5);
    expect(sell[0].label).toContain("listing agreement");
    expect(buy.every((item) => !item.done)).toBe(true);
  });
});
