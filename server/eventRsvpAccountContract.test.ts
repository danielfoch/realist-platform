import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const serverSource = readFileSync(new URL("./eventsGrowth.ts", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("../client/src/components/events/RsvpPanel.tsx", import.meta.url), "utf8");

describe("event RSVP account contract", () => {
  it("requires explicit account/email consent from a signed-out visitor", () => {
    expect(serverSource).toContain("payload.accountConsent !== true");
    expect(panelSource).toContain("checkbox-rsvp-consent");
    expect(panelSource).toContain("Create my free Realist account");
  });

  it("does not mark an address verified until the emailed setup link is redeemed", () => {
    expect(serverSource).toContain("emailVerified: false");
    expect(serverSource).toContain("accountCreated: account.created");
  });

  it("checks capacity before silently creating an account", () => {
    expect(serverSource.indexOf("This event is full")).toBeLessThan(serverSource.indexOf("await ensureUserByEmail(email"));
  });
});
