import { afterEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "@/lib/db/schema";
import { crmContact, crmTags, leadSummaryLines, webhookPayload } from "./crmPayload";
import { deliverToGhl } from "./ghl";
import { deliverToKeypr, qualifiesForKeypr } from "./keypr";
import { MAX_ATTEMPTS, retryDelayMs } from "./outbox";
import { isE164, splitName, toE164 } from "./phone";
import { leadIntent, leadRouting, provinceCode, teamRecipients } from "./routing";
import { teamEmailSubject } from "./teamEmail";

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "offer",
    intent: "acquisition",
    routing: "in_house",
    email: "dana@example.com",
    name: "Dana Tester",
    phone: "+14165550101",
    city: "Toronto",
    province: "ON",
    message: "Circling this one.",
    property: { address: "12 Main St, Toronto", mlsNumber: "C1234567", price: 899000, url: "/listings/C1234567" },
    context: { interest: "Multiplex / small apartment", numbers: { capRate: 5.13, monthlyCashFlow: -306, dscr: 0.92 } },
    userId: null,
    consentMarketing: true,
    consentPartner: true,
    consentVersion: "realist-keypr-cashback-v1",
    pagePath: "/work-with-us",
    utm: null,
    createdAt: new Date("2026-09-19T12:00:00Z"),
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("phone + name", () => {
  it("normalises North American numbers and keeps anything else as typed", () => {
    expect(toE164("(416) 555-0101")).toBe("+14165550101");
    expect(toE164("1-416-555-0101")).toBe("+14165550101");
    expect(toE164("+44 20 7946 0958")).toBe("+442079460958");
    expect(toE164("ext 12")).toBe("ext 12");
    expect(toE164("  ")).toBeNull();
    expect(isE164("+14165550101")).toBe(true);
    expect(isE164("ext 12")).toBe(false);
  });

  it("splits a name, and guesses one from the email when none was given", () => {
    expect(splitName("Dana Marie Tester", "x@y.ca")).toEqual({ first: "Dana", last: "Marie Tester" });
    expect(splitName(null, "dana.tester@example.com")).toEqual({ first: "Dana", last: "Tester" });
    expect(splitName("", "d123@example.com")).toEqual({ first: "", last: "" });
  });
});

describe("routing", () => {
  it("works leads in-house within about two hours of Toronto, refers the rest", () => {
    expect(leadRouting({ city: "Hamilton", province: "Ontario" })).toBe("in_house");
    expect(leadRouting({ city: "woodbridge", province: "ON" })).toBe("in_house");
    expect(leadRouting({ city: "Ottawa", province: "ON" })).toBe("partner_referral");
    expect(leadRouting({ city: "Calgary", province: "AB" })).toBe("partner_referral");
    expect(leadRouting({ city: "Smalltown", province: "ON" })).toBe("manual_review");
    expect(leadRouting({})).toBe("manual_review");
  });

  it("lets a listing's coordinates overrule its city label", () => {
    expect(leadRouting({ city: "Ottawa", province: "ON", lat: 43.26, lng: -79.87 })).toBe("in_house");
    expect(leadRouting({ city: "Toronto", province: "ON", lat: 45.42, lng: -75.7 })).toBe("partner_referral");
  });

  it("reads provinces by code or name", () => {
    expect(provinceCode("ontario")).toBe("ON");
    expect(provinceCode("bc")).toBe("BC");
    expect(provinceCode("Atlantis")).toBeNull();
  });

  it("decides who the lead is for", () => {
    expect(leadIntent("financing")).toBe("financing");
    expect(leadIntent("offer")).toBe("acquisition");
    expect(leadIntent("power_team", { roles: ["mortgage_broker"] })).toBe("financing");
    expect(leadIntent("power_team", { roles: ["mortgage_broker", "realtor"] })).toBe("acquisition");
    expect(leadIntent("power_team", { roles: ["lawyer"] })).toBe("general");
    expect(leadIntent("meetup_rsvp")).toBe("general");
  });

  it("emails financing leads to the broker with acquisition copied", () => {
    vi.stubEnv("ACQUISITION_LEAD_EMAILS", "deals@example.com");
    vi.stubEnv("FINANCING_LEAD_EMAILS", "broker@example.com, not-an-email");
    expect(teamRecipients("financing")).toEqual({ to: ["broker@example.com"], cc: ["deals@example.com"] });
    expect(teamRecipients("acquisition")).toEqual({ to: ["deals@example.com"], cc: [] });
    expect(teamRecipients("general")).toEqual({ to: ["deals@example.com"], cc: ["broker@example.com"] });
  });
});

describe("what the CRM receives", () => {
  it("tags by kind, market, intent and routing — in the previous app's dialect", () => {
    const tags = crmTags(lead());
    expect(tags).toEqual(
      expect.arrayContaining(["realist.ca", "offer_request", "cashback_request", "city-toronto", "LEAD_ON", "intent-acquisition", "route-in-house"]),
    );
    expect(crmTags(lead({ kind: "signup" }))).toEqual(expect.arrayContaining(["realist-user", "new-signup", "signup-2026-09"]));
    expect(crmTags(lead({ kind: "meetup_rsvp", city: "St. John's" }))).toContain("MEETUP_ST_JOHN_S");
    expect(crmTags(lead({ kind: "power_team", context: { roles: ["mortgage_broker", "lawyer"] } }))).toEqual(
      expect.arrayContaining(["needs-mortgage-broker", "needs-lawyer"]),
    );
  });

  it("never sends a malformed phone — the CRM rejects the whole contact over one", () => {
    expect(crmContact(lead()).phone).toBe("+14165550101");
    expect(crmContact(lead({ phone: "ext 12" }))).not.toHaveProperty("phone");
    expect(leadSummaryLines(lead({ phone: "ext 12" })).join("\n")).toContain("Phone (as typed): ext 12");
  });

  it("writes a note a person can act on", () => {
    const note = leadSummaryLines(lead()).join("\n");
    expect(note).toContain("Property: 12 Main St, Toronto · MLS® C1234567 · $899,000");
    expect(note).toContain("cap 5.1% · cash flow -$306/mo · DSCR 0.92");
    expect(note).toContain("partner handoff consent: yes");
  });

  it("keeps the inbound-webhook field names existing workflows read", () => {
    const body = webhookPayload(lead());
    expect(body).toMatchObject({
      email: "dana@example.com",
      firstName: "Dana",
      lastName: "Tester",
      fullName: "Dana Tester",
      phone: "+14165550101",
      consent: true,
      leadSource: "realist_offer",
      formTag: "offer_request",
      source: "realist.ca",
      propertyMls: "C1234567",
    });
  });

  it("labels the team email so it can be triaged from the subject line", () => {
    expect(teamEmailSubject(lead())).toBe("[Realist] Offer request — Dana Tester · 12 Main St, Toronto");
  });
});

describe("Keypr handoff", () => {
  it("only ever takes a consented Ontario offer with a full name and a clean phone", () => {
    expect(qualifiesForKeypr(lead())).toBe(true);
    expect(qualifiesForKeypr(lead({ consentPartner: false }))).toBe(false);
    expect(qualifiesForKeypr(lead({ province: "AB" }))).toBe(false);
    expect(qualifiesForKeypr(lead({ kind: "financing" }))).toBe(false);
    expect(qualifiesForKeypr(lead({ phone: "ext 12" }))).toBe(false);
    expect(qualifiesForKeypr(lead({ name: "Dana" }))).toBe(false);
  });

  it("waits, without burning attempts, until the secret exists", async () => {
    expect(await deliverToKeypr(lead())).toEqual({ outcome: "not_configured" });
    expect(await deliverToKeypr(lead({ consentPartner: false }))).toEqual({ outcome: "skipped" });
  });
});

describe("retry schedule", () => {
  it("backs off 1m → 5m → 30m → 2h → 12h, then gives up", () => {
    expect([1, 2, 3, 4, 5].map(retryDelayMs)).toEqual([60_000, 300_000, 1_800_000, 7_200_000, 43_200_000]);
    expect(retryDelayMs(MAX_ATTEMPTS)).toBeNull();
  });
});

describe("GoHighLevel delivery", () => {
  /** `existing` = the contact id the duplicate lookup should report, if any. */
  function stubApi(handler: (url: string, body: Record<string, unknown>) => { status: number; json?: unknown }, existing: string | null = null) {
    const calls: Array<{ url: string; method: string; body: Record<string, unknown>; headers: Record<string, string> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        const body = (init.body ? JSON.parse(String(init.body)) : {}) as Record<string, unknown>;
        calls.push({ url, method: String(init.method), body, headers: init.headers as Record<string, string> });
        if (url.includes("/contacts/search/duplicate")) {
          const found = handler(url, body);
          return new Response(JSON.stringify({ contact: existing ? { id: existing } : null }), { status: found.status >= 400 ? found.status : 200 });
        }
        const { status, json } = handler(url, body);
        return new Response(JSON.stringify(json ?? {}), { status });
      }),
    );
    return calls;
  }

  it("does nothing, and says so, when no credentials exist", async () => {
    expect(await deliverToGhl(lead(), {})).toEqual({ outcome: "not_configured" });
  });

  it("upserts WITHOUT tags, then adds tags and a note", async () => {
    vi.stubEnv("GHL_API_KEY", "pit-test");
    vi.stubEnv("GHL_LOCATION_ID", "loc-1");
    const calls = stubApi((url) => (url.endsWith("/contacts/upsert") ? { status: 200, json: { contact: { id: "c-9" }, new: true } } : { status: 201 }));

    const result = await deliverToGhl(lead(), {});
    expect(result).toMatchObject({ outcome: "sent", externalId: "c-9", progress: { contactId: "c-9", tagged: true, noted: true } });
    expect(calls.map((call) => `${call.method} ${call.url.replace("https://services.leadconnectorhq.com", "").split("?")[0]}`)).toEqual([
      "GET /contacts/search/duplicate",
      "POST /contacts/upsert",
      "POST /contacts/c-9/tags",
      "POST /contacts/c-9/notes",
    ]);
    const upsert = calls[1];
    // Upsert replaces tags — sending any here would wipe what the team tagged by hand.
    expect(upsert.body).not.toHaveProperty("tags");
    expect(upsert.body).toMatchObject({ locationId: "loc-1", email: "dana@example.com", source: "realist.ca" });
    expect(upsert.headers).toMatchObject({ Authorization: "Bearer pit-test", Version: "2021-07-28" });
  });

  it("never overwrites a contact that already exists — a web form proves nothing about who typed it", async () => {
    vi.stubEnv("GHL_API_KEY", "pit-test");
    vi.stubEnv("GHL_LOCATION_ID", "loc-1");
    const calls = stubApi(() => ({ status: 201 }), "c-existing");
    const result = await deliverToGhl(lead({ name: "Mallory Imposter", phone: "+19995550000" }), {});
    expect(result).toMatchObject({ outcome: "sent", externalId: "c-existing", progress: { existing: true } });
    expect(calls.some((call) => call.url.endsWith("/contacts/upsert"))).toBe(false);
    // What was typed still reaches a human — in the note, where it can't silently replace the real details.
    const note = calls.find((call) => call.url.endsWith("/notes"))!;
    expect(String(note.body.body)).toContain("Submitted as: Mallory Imposter · +19995550000");
  });

  it("passes an unsubscribe on: tagged, and email do-not-disturb set", async () => {
    vi.stubEnv("GHL_API_KEY", "pit-test");
    vi.stubEnv("GHL_LOCATION_ID", "loc-1");
    const calls = stubApi(() => ({ status: 200 }), "c-7");
    await deliverToGhl(lead({ kind: "unsubscribe", intent: "general" }), {});
    expect(calls.find((call) => call.url.endsWith("/tags"))!.body.tags).toContain("unsubscribed");
    const dnd = calls.find((call) => call.method === "PUT")!;
    expect(dnd.url).toMatch(/\/contacts\/c-7$/);
    expect(dnd.body).toMatchObject({ dndSettings: { Email: { status: "active" } } });
  });

  it("resumes after a partial failure without repeating finished steps", async () => {
    vi.stubEnv("GHL_API_KEY", "pit-test");
    vi.stubEnv("GHL_LOCATION_ID", "loc-1");
    let notesAttempts = 0;
    const calls = stubApi((url) => {
      if (url.endsWith("/contacts/upsert")) return { status: 200, json: { contact: { id: "c-9" } } };
      if (url.endsWith("/notes")) return { status: ++notesAttempts === 1 ? 503 : 201 };
      return { status: 201 };
    });

    const first = await deliverToGhl(lead(), {});
    expect(first).toMatchObject({ outcome: "retry", progress: { contactId: "c-9", tagged: true } });
    const second = await deliverToGhl(lead(), (first as { progress: Record<string, unknown> }).progress);
    expect(second.outcome).toBe("sent");
    expect(calls.filter((call) => call.url.endsWith("/contacts/upsert"))).toHaveLength(1);
    expect(calls.filter((call) => call.url.endsWith("/tags"))).toHaveLength(1);
  });

  it("gives up at once on a bad token, retries a rate limit", async () => {
    vi.stubEnv("GHL_API_KEY", "pit-test");
    vi.stubEnv("GHL_LOCATION_ID", "loc-1");
    stubApi(() => ({ status: 401, json: { message: "Invalid token" } }));
    expect((await deliverToGhl(lead(), {})).outcome).toBe("failed");
    stubApi(() => ({ status: 429 }));
    expect((await deliverToGhl(lead(), {})).outcome).toBe("retry");
  });

  it("posts the legacy-shaped body to an inbound webhook when that is what's configured", async () => {
    vi.stubEnv("GHL_WEBHOOK_URL", "https://services.leadconnectorhq.com/hooks/abc/webhook-trigger/xyz");
    const calls = stubApi(() => ({ status: 200 }));
    const result = await deliverToGhl(lead({ kind: "signup" }), {});
    expect(result).toMatchObject({ outcome: "sent", progress: { webhooked: true } });
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({ formTag: "realist-user", leadSource: "realist_signup" });
  });
});

describe("the receipt a person gets", () => {
  it("says what we received and what happens next, by name", async () => {
    const { receiptContent, wantsReceipt } = await import("./receipt");
    const content = receiptContent(lead({ kind: "showing" }));
    expect(content.subject).toBe("We've got your request about 12 Main St, Toronto");
    expect(content.lines).toEqual(["Dana,", "We've got your showing request about 12 Main St, Toronto.", "Someone on our team will reply within a business day to line up the showing."]);
    expect(receiptContent(lead({ kind: "power_team", property: null, name: null })).subject).toBe("We've got your request — power team intro");
    // Behavioural signals and plain sign-ups are not requests; nobody gets a receipt for them.
    for (const kind of ["signup", "first_underwrite", "active_underwriter", "team_gap", "unsubscribe"] as const) expect(wantsReceipt(kind)).toBe(false);
    expect(wantsReceipt("offer")).toBe(true);
  });
});

describe("GoHighLevel opportunities", () => {
  function stub(existing: string | null = null) {
    const calls: Array<{ url: string; method: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        const path = String(url).replace("https://services.leadconnectorhq.com", "").split("?")[0];
        const body = (init.body ? JSON.parse(String(init.body)) : {}) as Record<string, unknown>;
        calls.push({ url: path, method: String(init.method), body });
        const json = path === "/contacts/search/duplicate" ? { contact: existing ? { id: existing } : null } : path === "/contacts/upsert" ? { contact: { id: "c-1" } } : path === "/opportunities/" ? { opportunity: { id: "opp-1" } } : {};
        return new Response(JSON.stringify(json), { status: 200 });
      }),
    );
    return calls;
  }

  it("opens one on the pipeline for a showing — named for the deal and the person, valued at the price", async () => {
    vi.stubEnv("GHL_API_KEY", "pit-test");
    vi.stubEnv("GHL_LOCATION_ID", "loc-1");
    vi.stubEnv("GHL_PIPELINE_ID", "pipe-1");
    vi.stubEnv("GHL_PIPELINE_STAGE_ID", "stage-new");
    const calls = stub();
    const result = await deliverToGhl(lead({ kind: "showing" }), {});
    const created = calls.find((call) => call.url === "/opportunities/")!;
    expect(created.body).toMatchObject({
      locationId: "loc-1", pipelineId: "pipe-1", pipelineStageId: "stage-new", status: "open", contactId: "c-1",
      name: "Showing — 12 Main St, Toronto (Dana Tester)", monetaryValue: 899000,
    });
    expect(result).toMatchObject({ outcome: "sent", progress: { opportunityId: "opp-1" } });
    // A retry carrying that progress never opens a second one.
    const again = stub("c-1");
    await deliverToGhl(lead({ kind: "showing" }), { contactId: "c-1", tagged: true, noted: true, opportunityId: "opp-1" });
    expect(again.some((call) => call.url === "/opportunities/")).toBe(false);
  });

  it("stays out of the pipeline for anything that isn't a deal in the making, or when no pipeline is set", async () => {
    vi.stubEnv("GHL_API_KEY", "pit-test");
    vi.stubEnv("GHL_LOCATION_ID", "loc-1");
    const withoutPipeline = stub();
    await deliverToGhl(lead({ kind: "offer" }), {});
    expect(withoutPipeline.some((call) => call.url === "/opportunities/")).toBe(false);

    vi.stubEnv("GHL_PIPELINE_ID", "pipe-1");
    const rsvp = stub();
    await deliverToGhl(lead({ kind: "meetup_rsvp", intent: "general" }), {});
    expect(rsvp.some((call) => call.url === "/opportunities/")).toBe(false);
  });
});
