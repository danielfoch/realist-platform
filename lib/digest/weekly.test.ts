import { afterEach, describe, expect, it, vi } from "vitest";
import { composeWeeklyDigest, digestNudge, digestSubject, type DigestInput } from "./weekly";
import { unsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe";

const base: DigestInput = {
  firstName: "Dana",
  stats: { deals: 62, thisWeek: 0, streakWeeks: 9, score: 565 },
  lastWeekDeals: 7,
  lastWeekRank: 2,
  ahead: { name: "Priya R.", deals: 9 },
  board: [
    { rank: 1, name: "Priya R.", city: "Calgary", deals: 9 },
    { rank: 2, name: "Dana T.", city: "Hamilton", deals: 7 },
  ],
  badge: { name: "Power user", next: { name: "Deal hunter", at: 100 } },
  meetup: { title: "Hamilton Investor Meetup", when: "Thu, Oct 1, 7:00 p.m." },
  unsubscribeUrl: "https://realist.ca/unsubscribe?u=u1&t=tok",
  postalAddress: "100 King St W, Toronto, ON M5X 1A9",
};

afterEach(() => vi.unstubAllEnvs());

describe("weekly digest", () => {
  it("leads with where the person finished", () => {
    expect(digestSubject(base)).toBe("You finished #2 on Realist last week");
    expect(digestSubject({ ...base, lastWeekRank: 14 })).toBe("#14 last week — the board just reset");
    expect(digestSubject({ ...base, lastWeekRank: null })).toBe("Your 9-week streak is on the line");
    expect(digestSubject({ ...base, lastWeekRank: null, stats: { ...base.stats, streakWeeks: 0 } })).toMatch(/board just reset/);
  });

  it("gives one concrete thing to do", () => {
    expect(digestNudge(base)).toBe("Underwrite one deal this week and your streak becomes 10 weeks.");
    expect(digestNudge({ ...base, stats: { ...base.stats, deals: 98 } })).toBe("2 more deals and you're a Deal hunter.");
    expect(digestNudge({ ...base, stats: { ...base.stats, deals: 9 }, badge: { name: "First underwrite", next: { name: "Analyst", at: 10 } } })).toBe("1 more deal and you're an Analyst.");
    expect(digestNudge({ ...base, stats: { ...base.stats, streakWeeks: 0 } })).toMatch(/^Priya R\. finished just ahead of you with 9 deals/);
  });

  it("is a compliant commercial message: sender, postal address, unsubscribe — in both parts", () => {
    const email = composeWeeklyDigest(base);
    for (const part of [email.text, email.html]) {
      expect(part).toContain("100 King St W, Toronto, ON M5X 1A9");
      expect(part).toContain("https://realist.ca/unsubscribe?u=u1&amp;t=tok".replace("&amp;", part === email.text ? "&" : "&"));
      expect(part).toContain("Hamilton Investor Meetup");
    }
    expect(email.text).toContain("Last week you underwrote 7 deals and finished #2.");
  });

  it("refuses to exist without an unsubscribe link or an address", () => {
    expect(() => composeWeeklyDigest({ ...base, postalAddress: " " })).toThrow();
    expect(() => composeWeeklyDigest({ ...base, unsubscribeUrl: "" })).toThrow();
  });

  it("escapes names in the HTML part", () => {
    const email = composeWeeklyDigest({ ...base, firstName: "<b>Dana</b>" });
    expect(email.html).not.toContain("<b>Dana</b>");
    expect(email.html).toContain("&lt;b&gt;Dana&lt;/b&gt;");
  });
});

describe("unsubscribe tokens", () => {
  it("only ever unsubscribe the person they were issued to", () => {
    vi.stubEnv("EMAIL_LINK_SECRET", "test-secret");
    const token = unsubscribeToken("user-1")!;
    expect(verifyUnsubscribeToken("user-1", token)).toBe(true);
    expect(verifyUnsubscribeToken("user-2", token)).toBe(false);
    expect(verifyUnsubscribeToken("user-1", `${token}x`)).toBe(false);
    expect(verifyUnsubscribeToken("user-1", "")).toBe(false);
  });

  it("can't be minted or checked without a secret", () => {
    vi.stubEnv("EMAIL_LINK_SECRET", "");
    vi.stubEnv("CRON_SECRET", "");
    expect(unsubscribeToken("user-1")).toBeNull();
    expect(verifyUnsubscribeToken("user-1", "anything")).toBe(false);
  });
});
