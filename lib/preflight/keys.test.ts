import { describe, expect, it } from "vitest";
import { KEY_GROUPS, checkDdfCredentials, parseEnvNames, shapeWarning } from "./keys";

const spec = (name: string) => KEY_GROUPS.flatMap((group) => group.keys).find((key) => key.name === name)!;

describe("connecting the keys", () => {
  it("reads which variables Vercel already has from `vercel env ls` — names only", () => {
    const names = parseEnvNames(`> Variables found for team/realist-lean\n\n name                 value       environments   created\n CRON_SECRET          Encrypted   Production     23d ago\n DATABASE_URL         Encrypted   Production     1h ago\n\nCommon commands:\n`);
    expect([...names].sort()).toEqual(["CRON_SECRET", "DATABASE_URL"]);
  });

  it("notices the wrong thing pasted into a prompt, without refusing it", () => {
    expect(shapeWarning(spec("GHL_API_KEY"), "pit-0123456789abcdef")).toBeNull();
    expect(shapeWarning(spec("GHL_API_KEY"), "eyJhbGciOi.old-v1-agency-key")).toContain("doesn't look like");
    expect(shapeWarning(spec("RESEND_API_KEY"), "re_abc 123")).toContain("space");
    expect(shapeWarning(spec("ACQUISITION_LEAD_EMAILS"), "deals@example.com, second@example.com")).toBeNull();
    expect(shapeWarning(spec("ACQUISITION_LEAD_EMAILS"), "deals at example")).toContain("email addresses");
  });

  it("asks for everything the preflight requires, secrets marked as secrets", () => {
    const all = KEY_GROUPS.flatMap((group) => group.keys);
    for (const name of ["GHL_API_KEY", "GHL_LOCATION_ID", "ACQUISITION_LEAD_EMAILS", "FINANCING_LEAD_EMAILS", "RESEND_API_KEY"]) expect(all.some((key) => key.name === name && !key.optional)).toBe(true);
    for (const name of ["GHL_API_KEY", "RESEND_API_KEY", "CREA_DDF_PASSWORD", "ANTHROPIC_API_KEY", "GOOGLE_CLIENT_SECRET", "KEYPR_REALIST_SECRET"]) expect(spec(name).secret).toBe(true);
  });

  it("proves CREA credentials with a token request — read-only", async () => {
    const good = await checkDdfCredentials("user", "pass", (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch);
    const bad = await checkDdfCredentials("user", "nope", (async () => new Response("{}", { status: 400 })) as unknown as typeof fetch);
    expect([good.ok, bad.ok]).toEqual([true, false]);
  });

  it("tells the national pool from an office's own feed, which authenticates just as well", async () => {
    const feed = (count: number) =>
      (async (url: string) => (String(url).includes("/connect/token") ? new Response(JSON.stringify({ access_token: "t" }), { status: 200 }) : new Response(JSON.stringify({ "@odata.count": count, value: [] }), { status: 200 }))) as unknown as typeof fetch;
    const national = await checkDdfCredentials("user", "pass", feed(163_412));
    expect(national).toMatchObject({ ok: true, listings: 163_412 });
    expect(national.detail).toContain("national pool");
    const office = await checkDdfCredentials("user", "pass", feed(37));
    expect(office.ok).toBe(true);
    expect(office.detail).toContain("Member Website Feed");
  });
});
