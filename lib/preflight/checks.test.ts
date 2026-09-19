import { describe, expect, it, vi } from "vitest";
import { EXPECTED_TABLES, checkDatabase, checkGhl, checkResend, checkSecrets, summarize, type DbFacts } from "./checks";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const facts = (over: Partial<DbFacts> = {}): DbFacts => ({ tables: [...EXPECTED_TABLES], hasNewestColumn: true, members: 4200, legacyMembers: 4100, freshListings: 90_000, waitingDeliveries: 0, ...over });

describe("go-live preflight", () => {
  it("says plainly that nothing persists without a database, and how to get one", () => {
    const [result] = checkDatabase("", new Error("not configured"));
    expect(result).toMatchObject({ status: "missing", required: true });
    expect(result.fix).toContain("npm run db:push");
  });

  it("catches a database the schema was never pushed to", () => {
    const [result] = checkDatabase("postgres://x", facts({ tables: ["users"] }));
    expect(result.status).toBe("broken");
    expect(result.detail).toContain("lead_deliveries");
  });

  it("is happy with a current schema, and nudges the member migration and the crawl", () => {
    const results = checkDatabase("postgres://x", facts({ legacyMembers: 0, freshListings: 0 }));
    expect(results[0].status).toBe("ok");
    expect(results.filter((result) => result.status === "warn").map((result) => result.name)).toEqual(["v1 members", "Listings crawl"]);
  });

  it("checks GoHighLevel with the same call delivery makes first, and names the pipeline's stages when the id is wrong", async () => {
    const fetcher = vi.fn(async (url: string) =>
      String(url).includes("/contacts/search/duplicate") ? json(200, { contact: null }) : json(200, { pipelines: [{ id: "pipe-1", name: "Investor deals", stages: [{ id: "st-1", name: "New request" }] }] }),
    ) as unknown as typeof fetch;
    const results = await checkGhl({ GHL_API_KEY: "pit-x", GHL_LOCATION_ID: "loc-1", GHL_PIPELINE_ID: "pipe-1", GHL_PIPELINE_STAGE_ID: "nope" }, fetcher);
    expect(results[0]).toMatchObject({ name: "GoHighLevel", status: "ok" });
    expect(results[1]).toMatchObject({ name: "GHL pipeline", status: "broken" });
    expect(results[1].fix).toContain("New request (st-1)");
  });

  it("tells a rejected GHL token apart from a missing one", async () => {
    const rejected = await checkGhl({ GHL_API_KEY: "pit-x", GHL_LOCATION_ID: "loc-1" }, (async () => json(401, {})) as unknown as typeof fetch);
    expect(rejected[0]).toMatchObject({ status: "broken", required: true });
    const missing = await checkGhl({});
    expect(missing[0]).toMatchObject({ status: "missing" });
    expect(missing[0].fix).toContain("wait and are delivered");
  });

  it("wants the sending domain verified, not just a key that exists", async () => {
    const unverified = await checkResend({ RESEND_API_KEY: "re_x" }, (async () => json(200, { data: [{ name: "realist.ca", status: "pending" }] })) as unknown as typeof fetch);
    expect(unverified).toMatchObject({ status: "broken" });
    const verified = await checkResend({ RESEND_API_KEY: "re_x" }, (async () => json(200, { data: [{ name: "realist.ca", status: "verified" }] })) as unknown as typeof fetch);
    expect(verified.status).toBe("ok");
    const sendOnly = await checkResend({ RESEND_API_KEY: "re_x" }, (async () => json(401, { name: "restricted_api_key" })) as unknown as typeof fetch);
    expect(sendOnly.status).toBe("warn");
    // A key Resend has never heard of comes back 400, not 401 — still a rejection, never "domain not found".
    const unknown = await checkResend({ RESEND_API_KEY: "re_fake" }, (async () => json(400, { name: "validation_error", message: "API key is invalid" })) as unknown as typeof fetch);
    expect(unknown).toMatchObject({ status: "broken", detail: expect.stringContaining("rejected the key") });
  });

  it("never prints a secret", async () => {
    const env = { GHL_API_KEY: "pit-zq9hidden", GHL_LOCATION_ID: "loc-zq9hidden", RESEND_API_KEY: "re_zq9hidden", CRON_SECRET: "cron-zq9hidden", ACQUISITION_LEAD_EMAILS: "a@example.com", FINANCING_LEAD_EMAILS: "b@example.com", KEYPR_REALIST_SECRET: "keypr-zq9hidden" };
    const fetcher = (async () => json(200, { contact: null, data: [] })) as unknown as typeof fetch;
    const printed = JSON.stringify([...(await checkGhl(env, fetcher)), await checkResend(env, fetcher), ...checkSecrets(env)]);
    expect(printed).not.toContain("zq9hidden");
  });

  it("knows 'set in Vercel but not downloadable' from 'missing' — a Sensitive value pulls down as an empty string", async () => {
    const pulled = { CRON_SECRET: "", GHL_API_KEY: "", GHL_LOCATION_ID: "loc-1", RESEND_API_KEY: "" };
    expect(checkSecrets(pulled)[0]).toMatchObject({ name: "Cron secret", status: "ok" });
    expect((await checkGhl(pulled))[0]).toMatchObject({ status: "warn" });
    expect(await checkResend(pulled)).toMatchObject({ status: "warn" });
    expect(checkSecrets({})[0]).toMatchObject({ name: "Cron secret", status: "missing" });
  });

  it("is ready only when everything launch depends on is in place", () => {
    expect(summarize([{ name: "Database", status: "ok", required: true, detail: "" }, { name: "AI", status: "warn", required: false, detail: "" }])).toMatchObject({ ready: true });
    expect(summarize([{ name: "Database", status: "missing", required: true, detail: "" }]).ready).toBe(false);
  });
});
