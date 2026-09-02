/**
 * Tests for site-wide lead routing (server/leadRouter.ts).
 *
 * Pins the one thing that matters: which human hears about which inquiry.
 * Resend and the CRM are mocked — delivery is exercised only far enough to
 * prove the router never throws into a capture endpoint.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  sent: [] as Record<string, unknown>[],
  crm: [] as Record<string, unknown>[],
  resendThrows: false,
};

vi.mock("./resend", () => ({
  getResendClient: async () => {
    if (state.resendThrows) throw new Error("Resend not connected");
    return {
      fromEmail: "Realist <hello@realist.ca>",
      client: {
        emails: {
          send: async (payload: Record<string, unknown>) => {
            state.sent.push(payload);
            return { data: { id: "email-1" }, error: null };
          },
        },
      },
    };
  },
}));

vi.mock("./crmIngest", () => ({
  upsertPlatformCrmContact: async (input: Record<string, unknown>) => {
    state.crm.push(input);
    return "contact-1";
  },
}));

const {
  buildLeadEmail,
  getAcquisitionNotifyEmails,
  getFinancingNotifyEmails,
  getLeadNotifyEmails,
  intentFromFormTag,
  leadAlertThrottle,
  notifyTeamOfLead,
  recipientsForIntent,
} = await import("./leadRouter");

const ENV_KEYS = ["ACQUISITION_LEAD_EMAILS", "FINANCING_LEAD_EMAILS", "LEAD_NOTIFY_EMAILS"] as const;
const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
  state.sent = [];
  state.crm = [];
  state.resendThrows = false;
  leadAlertThrottle.reset();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe("recipient lists", () => {
  it("defaults to Daniel for acquisition and Nick for financing", () => {
    expect(getAcquisitionNotifyEmails()).toEqual(["danielfoch@gmail.com"]);
    expect(getFinancingNotifyEmails()).toEqual(["nick@bldfinancial.ca"]);
    expect(getLeadNotifyEmails()).toEqual(["danielfoch@gmail.com", "nick@bldfinancial.ca"]);
  });

  it("honours the env overrides and ignores junk entries", () => {
    process.env.ACQUISITION_LEAD_EMAILS = "a@example.com, not-an-email ,b@example.com";
    process.env.FINANCING_LEAD_EMAILS = "";
    expect(getAcquisitionNotifyEmails()).toEqual(["a@example.com", "b@example.com"]);
    expect(getFinancingNotifyEmails()).toEqual(["nick@bldfinancial.ca"]);
    // Union follows the overrides, deduped.
    process.env.FINANCING_LEAD_EMAILS = "b@example.com";
    expect(getLeadNotifyEmails()).toEqual(["a@example.com", "b@example.com"]);
  });

  it("lets LEAD_NOTIFY_EMAILS replace the union outright", () => {
    process.env.LEAD_NOTIFY_EMAILS = "ops@example.com";
    expect(getLeadNotifyEmails()).toEqual(["ops@example.com"]);
  });
});

describe("recipientsForIntent", () => {
  it("sends acquisition to Daniel only", () => {
    expect(recipientsForIntent("acquisition")).toEqual({ to: ["danielfoch@gmail.com"], cc: [] });
  });

  it("sends financing to Nick with Daniel copied", () => {
    expect(recipientsForIntent("financing")).toEqual({
      to: ["nick@bldfinancial.ca"],
      cc: ["danielfoch@gmail.com"],
    });
  });

  it("sends general to both", () => {
    expect(recipientsForIntent("general")).toEqual({
      to: ["danielfoch@gmail.com", "nick@bldfinancial.ca"],
      cc: [],
    });
  });

  it("does not cc someone who is already on the To line", () => {
    process.env.FINANCING_LEAD_EMAILS = "danielfoch@gmail.com";
    expect(recipientsForIntent("financing")).toEqual({ to: ["danielfoch@gmail.com"], cc: [] });
  });
});

describe("intentFromFormTag", () => {
  it.each([
    ["financing_consultation", "financing"],
    ["mortgage_rate_request", "financing"],
    ["mli_select_quote", "financing"],
    ["financing_readiness", "financing"],
    ["representation_interest", "acquisition"],
    ["offer_request", "acquisition"],
    ["buybox_alert", "acquisition"],
    ["acquisition_call", "acquisition"],
    ["engagement", "general"],
    ["", "general"],
    [null, "general"],
    [undefined, "general"],
  ])("maps %s → %s", (tag, expected) => {
    expect(intentFromFormTag(tag as string | null | undefined)).toBe(expected);
  });

  it("is case-insensitive", () => {
    expect(intentFromFormTag("Financing_Consultation")).toBe("financing");
  });
});

describe("leadAlertThrottle", () => {
  it("suppresses the same email+surface inside ten minutes", () => {
    const t0 = 1_000_000;
    expect(leadAlertThrottle.shouldSuppress("Jane@Example.com", "Contact page", t0)).toBe(false);
    expect(leadAlertThrottle.shouldSuppress("jane@example.com", "contact page", t0 + 60_000)).toBe(true);
    expect(leadAlertThrottle.shouldSuppress("jane@example.com", "Contact page", t0 + 10 * 60_000)).toBe(false);
  });

  it("keys on the surface, so the same person on two forms alerts twice", () => {
    const t0 = 1_000_000;
    expect(leadAlertThrottle.shouldSuppress("jane@example.com", "Contact page", t0)).toBe(false);
    expect(leadAlertThrottle.shouldSuppress("jane@example.com", "Offer form", t0)).toBe(false);
  });
});

describe("notifyTeamOfLead", () => {
  const base = {
    intent: "financing" as const,
    surface: "Financing readiness",
    sourcePage: "/tools/financing-readiness",
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "416-555-0100",
    context: { address: "24 Barton St E", purchasePrice: 1_250_000, units: 4 },
  };

  it("emails the routed recipients with reply-to set to the lead", async () => {
    const result = await notifyTeamOfLead(base);

    expect(result).toEqual({ emailed: true, recipients: ["nick@bldfinancial.ca", "danielfoch@gmail.com"] });
    expect(state.sent).toHaveLength(1);
    expect(state.sent[0]).toMatchObject({
      to: ["nick@bldfinancial.ca"],
      cc: ["danielfoch@gmail.com"],
      replyTo: "jane@example.com",
      subject: "[Realist lead · Financing] Jane Doe — 24 Barton St E",
    });
    expect(String(state.sent[0].html)).toContain("1,250,000");
    expect(String(state.sent[0].text)).toContain("Units: 4");
  });

  it("records the contact in the CRM under the surface", async () => {
    await notifyTeamOfLead(base);
    expect(state.crm).toHaveLength(1);
    expect(state.crm[0]).toMatchObject({
      email: "jane@example.com",
      source: "financing_readiness",
      sourceDetail: "/tools/financing-readiness",
    });
  });

  it("skips the CRM write when the caller already made one", async () => {
    await notifyTeamOfLead({ ...base, skipCrm: true });
    expect(state.crm).toHaveLength(0);
    expect(state.sent).toHaveLength(1);
  });

  it("throttles a double submit but still returns cleanly", async () => {
    await notifyTeamOfLead(base);
    const second = await notifyTeamOfLead(base);
    expect(second.emailed).toBe(false);
    expect(state.sent).toHaveLength(1);
  });

  it("never throws when Resend is unavailable", async () => {
    state.resendThrows = true;
    const result = await notifyTeamOfLead(base);
    expect(result.emailed).toBe(false);
    expect(result.recipients).toEqual(["nick@bldfinancial.ca", "danielfoch@gmail.com"]);
  });

  it("skips silently without a usable email", async () => {
    const result = await notifyTeamOfLead({ ...base, email: "" });
    expect(result).toEqual({ emailed: false, recipients: [] });
    expect(state.sent).toHaveLength(0);
  });
});

describe("buildLeadEmail", () => {
  it("falls back to the page when there is no address and escapes html", () => {
    const { subject, html } = buildLeadEmail({
      intent: "general",
      surface: "Contact page",
      sourcePage: "/contact",
      name: "<script>",
      email: "x@example.com",
      message: "Hi <b>there</b>",
    });
    expect(subject).toBe("[Realist lead · General] <script> — /contact");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Hi &lt;b&gt;there&lt;/b&gt;");
  });
});
