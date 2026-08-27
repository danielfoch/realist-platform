import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./meetupIntegration.ts", import.meta.url), "utf8");

describe("Meetup integration route contract", () => {
  it("uses the current Meetup GraphQL endpoint and OAuth server flow", () => {
    expect(source).toContain('https://api.meetup.com/gql-ext');
    expect(source).toContain('https://secure.meetup.com/oauth2/authorize');
    expect(source).toContain('https://secure.meetup.com/oauth2/access');
    expect(source).toContain('eventsSearch(input: { first: 100, filter: { status: "UPCOMING" } })');
  });

  it("keeps connection and manual sync behind event-admin access", () => {
    expect(source).toContain('app.get("/api/admin/integrations/meetup/connect", requireEventAdmin');
    expect(source).toContain('app.post("/api/admin/integrations/meetup/sync", requireEventAdmin');
    expect(source).toContain('app.get("/api/auth/meetup/callback"');
  });

  it("syncs aggregate RSVP counts without querying member emails", () => {
    expect(source).toContain('rsvps { totalCount }');
    expect(UPCOMING_QUERY(source)).not.toMatch(/member\s*\{[^}]*email/s);
  });
});

function UPCOMING_QUERY(value: string): string {
  return value.slice(value.indexOf("const UPCOMING_EVENTS_QUERY"), value.indexOf("function config"));
}
