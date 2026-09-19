import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { ddfListingSnapshots, leadDeliveries } from "@/lib/db/schema";
import { useTestDb } from "@/lib/test/db";
import { trustedProperty } from "./brief";
import { captureLead } from "./capture";
import { MAX_ATTEMPTS, deliverDue, expeditePending, requeueFailed } from "./outbox";

let ctx: Awaited<ReturnType<typeof useTestDb>>;

beforeAll(async () => {
  ctx = await useTestDb();
}, 60_000);
afterAll(async () => ctx.close());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const deliveriesOf = (leadId: string) => ctx.db.select().from(leadDeliveries).where(eq(leadDeliveries.leadId, leadId));
const dueNow = () => ctx.db.execute(sql`UPDATE lead_deliveries SET next_attempt_at = (now() AT TIME ZONE 'utc') - interval '1 second' WHERE status = 'pending'`);

function stubGhl(handler: (path: string) => number) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = String(url).replace("https://services.leadconnectorhq.com", "").split("?")[0];
      calls.push(path);
      const status = handler(path);
      const json = path === "/contacts/upsert" ? { contact: { id: "c-1" } } : path === "/contacts/search/duplicate" ? { contact: null } : {};
      return new Response(JSON.stringify(json), { status });
    }),
  );
  return calls;
}

describe("capturing a lead", () => {
  it("normalises, routes, and treats a double-submit as one lead", async () => {
    const first = await captureLead({
      kind: "offer", email: " Dana@Example.com ", name: "Dana Tester", phone: "(416) 555-0101", city: "Hamilton", province: "Ontario",
      property: { mlsNumber: "C1", address: "12 Main St" }, consentPartner: true,
    });
    expect(first.lead).toMatchObject({ email: "dana@example.com", phone: "+14165550101", province: "ON", routing: "in_house", intent: "acquisition" });
    const again = await captureLead({ kind: "offer", email: "dana@example.com", property: { mlsNumber: "C1" } });
    expect(again).toMatchObject({ duplicate: true });
    expect(again.lead.id).toBe(first.lead.id);
    // A different property is a different lead.
    expect((await captureLead({ kind: "offer", email: "dana@example.com", property: { mlsNumber: "C2" } })).duplicate).toBe(false);
    // Ontario + partner consent + full name + clean phone → Keypr is in the outbox too.
    expect((await deliveriesOf(first.lead.id)).map((row) => row.destination).sort()).toEqual(["ghl", "keypr", "receipt", "team_email"]);
  });

  it("never queues Keypr for another province, or without consent", async () => {
    const alberta = await captureLead({ kind: "offer", email: "ab@example.com", name: "A B", phone: "403-555-0100", province: "AB", consentPartner: true });
    const noConsent = await captureLead({ kind: "offer", email: "nc@example.com", name: "N C", phone: "416-555-0100", province: "ON" });
    for (const { lead } of [alberta, noConsent]) {
      expect((await deliveriesOf(lead.id)).map((row) => row.destination)).not.toContain("keypr");
    }
  });
});

describe("the outbox", () => {
  it("waits, without spending attempts, while a destination has no credentials", async () => {
    const { lead } = await captureLead({ kind: "power_team", email: "wait@example.com", context: { roles: ["lawyer"] } });
    const summary = await deliverDue({ leadId: lead.id });
    // CRM, team inbox, and the person's own receipt — all waiting on credentials.
    expect(summary).toMatchObject({ claimed: 3, waiting: 3, sent: 0, failed: 0 });
    for (const row of await deliveriesOf(lead.id)) {
      expect(row).toMatchObject({ status: "pending", attempts: 0, lastError: "destination not configured" });
      expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    }
    // …and nothing is due again until its timer, so a second pass claims nothing.
    expect((await deliverDue({ leadId: lead.id })).claimed).toBe(0);
  });

  it("delivers a parked lead the moment the key exists, resuming after a partial failure without repeating a step", async () => {
    const { lead } = await captureLead({ kind: "financing", email: "fin@example.com", name: "Fin Ance", message: "Refi" });
    await deliverDue({ leadId: lead.id });

    vi.stubEnv("GHL_API_KEY", "pit-test");
    vi.stubEnv("GHL_LOCATION_ID", "loc-1");
    let noteTries = 0;
    const calls = stubGhl((path) => (path.endsWith("/notes") && ++noteTries === 1 ? 503 : 200));

    await expeditePending();
    const first = await deliverDue({ leadId: lead.id });
    expect(first.retrying).toBe(1);
    let ghl = (await deliveriesOf(lead.id)).find((row) => row.destination === "ghl")!;
    expect(ghl).toMatchObject({ status: "pending", attempts: 1, progress: { contactId: "c-1", tagged: true } });

    await dueNow();
    await deliverDue({ leadId: lead.id });
    ghl = (await deliveriesOf(lead.id)).find((row) => row.destination === "ghl")!;
    expect(ghl).toMatchObject({ status: "sent", externalId: "c-1" });
    expect(calls.filter((path) => path === "/contacts/upsert")).toHaveLength(1);
    expect(calls.filter((path) => path.endsWith("/tags"))).toHaveLength(1);
    expect(calls.filter((path) => path.endsWith("/notes"))).toHaveLength(2);
  });

  it("gives up on a rejected token at once, and can be put back in line after the fix", async () => {
    const { lead } = await captureLead({ kind: "showing", email: "show@example.com" });
    vi.stubEnv("GHL_API_KEY", "pit-bad");
    vi.stubEnv("GHL_LOCATION_ID", "loc-1");
    stubGhl(() => 401);
    await deliverDue({ leadId: lead.id });
    expect((await deliveriesOf(lead.id)).find((row) => row.destination === "ghl")).toMatchObject({ status: "failed" });

    stubGhl(() => 200);
    expect(await requeueFailed("ghl")).toBeGreaterThanOrEqual(1);
    await deliverDue({ leadId: lead.id });
    expect((await deliveriesOf(lead.id)).find((row) => row.destination === "ghl")).toMatchObject({ status: "sent" });
  });

  it("stops retrying a flaky destination after the last backoff step", async () => {
    const { lead } = await captureLead({ kind: "event_invites", email: "flaky@example.com" });
    vi.stubEnv("GHL_API_KEY", "pit-test");
    vi.stubEnv("GHL_LOCATION_ID", "loc-1");
    stubGhl(() => 503);
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      await dueNow();
      await deliverDue({ leadId: lead.id });
    }
    expect((await deliveriesOf(lead.id)).find((row) => row.destination === "ghl")).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS });
  });

  it("skips the team email for a plain signup", async () => {
    const { lead } = await captureLead({ kind: "signup", email: "new@example.com" });
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("ACQUISITION_LEAD_EMAILS", "team@example.com");
    const send = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", send);
    await deliverDue({ leadId: lead.id });
    expect((await deliveriesOf(lead.id)).find((row) => row.destination === "team_email")).toMatchObject({ status: "skipped" });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("the price on a lead", () => {
  it("is our list price for a listing, whatever the form said — it sizes the opportunity in the CRM", async () => {
    await ctx.db.insert(ddfListingSnapshots).values({ listingKey: "LK-PRICE", mlsNumber: "W9000001", city: "Toronto", province: "Ontario", listPrice: 899_000, snapshotMonth: "2026-09" });
    expect(await trustedProperty({ mlsNumber: "w9000001", price: 950_000_000 })).toMatchObject({ price: 899_000 });
  });

  it("is the person's own figure for an off-market deal, kept only when it's a plausible purchase price", async () => {
    expect(await trustedProperty({ address: "12 Main St", price: 640_000 })).toMatchObject({ price: 640_000 });
    expect(await trustedProperty({ address: "12 Main St", price: 950_000_000 })).toMatchObject({ price: null });
    expect(await trustedProperty({ mlsNumber: "UNKNOWN1", price: 5 })).toMatchObject({ price: null });
  });
});
