import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  details: null as Record<string, unknown> | null,
  sent: [] as Array<Record<string, any>>,
};

vi.mock("./db", () => ({
  db: {
    select: () => {
      const chain: Record<string, any> = {};
      chain.from = () => chain;
      chain.leftJoin = () => chain;
      chain.where = () => chain;
      chain.limit = async () => state.details ? [state.details] : [];
      return chain;
    },
  },
}));

vi.mock("./storage", () => ({
  storage: {
    getAppSetting: async () => "admin@example.com",
    getLead: async () => undefined,
  },
}));

vi.mock("./resend", () => ({
  getResendClient: async () => ({
    fromEmail: "daniel@realist.ca",
    client: {
      emails: {
        send: async (message: Record<string, any>) => {
          state.sent.push(message);
          return { data: { id: "email-1" }, error: null };
        },
      },
    },
  }),
}));

vi.mock("./emailGovernor", () => ({
  governMarketingSend: async () => ({ ok: true }),
}));

const { sendEmailTrigger } = await import("./emailTriggerSender");

beforeEach(() => {
  state.details = null;
  state.sent = [];
});

describe("sendEmailTrigger sla_breach_nag", () => {
  it("enriches an anonymous opportunity from its linked lead and deal", async () => {
    state.details = {
      firstContactedAt: null,
      intentScore: 100,
      assignedTo: null,
      propertyAddress: null,
      opportunityMarket: null,
      dealAddress: "456 King St W, Toronto, ON",
      dealMarket: "Toronto",
      leadName: "Jane Test",
      leadEmail: "jane.test@example.com",
      leadPhone: "+14165550123",
      userEmail: null,
      userFirstName: null,
      userLastName: null,
      userPhone: null,
    };

    const outcome = await sendEmailTrigger({
      id: "trigger-1",
      triggerType: "sla_breach_nag",
      payload: { opportunity_id: "opp-1", assigned_to: null },
      userId: null,
      leadId: "lead-1",
      opportunityId: "opp-1",
      createdAt: new Date(),
    });

    expect(outcome.status).toBe("sent");
    expect(state.sent).toHaveLength(1);
    expect(state.sent[0].subject).toBe("Hot lead waiting: Jane Test — uncontacted past SLA");
    expect(state.sent[0].html).toContain("jane.test@example.com");
    expect(state.sent[0].html).toContain("456 King St W, Toronto, ON");
    expect(state.sent[0].html).toContain("Toronto");
  });

  it("cancels a queued nag when contact happened before delivery", async () => {
    state.details = {
      firstContactedAt: new Date(),
      intentScore: 100,
      assignedTo: "dan",
      propertyAddress: "123 Main St",
      opportunityMarket: "Toronto",
      dealAddress: null,
      dealMarket: null,
      leadName: "Contacted Lead",
      leadEmail: "contacted@example.com",
      leadPhone: null,
      userEmail: null,
      userFirstName: null,
      userLastName: null,
      userPhone: null,
    };

    const outcome = await sendEmailTrigger({
      id: "trigger-2",
      triggerType: "sla_breach_nag",
      payload: { opportunity_id: "opp-2" },
      userId: null,
      leadId: "lead-2",
      opportunityId: "opp-2",
      createdAt: new Date(),
    });

    expect(outcome).toEqual({ status: "cancelled", reason: "Lead was contacted before the nag fired" });
    expect(state.sent).toHaveLength(0);
  });
});
