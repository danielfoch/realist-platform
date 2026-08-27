import { describe, expect, it } from "vitest";
import {
  meetupEventSlug,
  normalizeMeetupEvent,
  parseIsoDurationMs,
  signMeetupOAuthState,
  stripMeetupHtml,
  verifyMeetupOAuthState,
} from "./meetupIntegration";

describe("Meetup event normalization", () => {
  it("turns a GraphQL event into a safe native Realist event", () => {
    const event = normalizeMeetupEvent({
      id: "309001234",
      title: "Toronto Real Estate Meetup",
      eventUrl: "https://www.meetup.com/creitoronto/events/309001234/",
      description: "<p>Cap rates &amp; networking.</p><p>In person at the pub.</p>",
      dateTime: "2026-09-08T18:00:00-04:00",
      duration: "PT2H30M",
      eventHosts: [{ name: "Daniel" }, { name: "Nick" }],
      featuredEventPhoto: {
        id: "501175080",
        baseUrl: "https://secure-content.meetupstatic.com/images/classic-events/",
      },
      group: { name: "Toronto Real Estate", urlname: "creitoronto" },
      rsvps: { totalCount: 42 },
    });

    expect(event).toMatchObject({
      externalEventId: "309001234",
      city: "Toronto",
      eventType: "IN_PERSON",
      externalRsvpCount: 42,
      slug: "meetup-creitoronto-309001234",
      hostNames: ["Daniel", "Nick"],
      timezone: "America/Toronto",
    });
    expect(event?.longDescription).toBe("Cap rates & networking.\n\nIn person at the pub.");
    expect(event?.endsAt?.toISOString()).toBe("2026-09-09T00:30:00.000Z");
    expect(event?.headerImageUrl).toContain("/501175080/676x380.webp");
  });

  it("rejects malformed or non-Meetup event URLs", () => {
    expect(normalizeMeetupEvent({ id: "1", title: "Bad", dateTime: "2026-01-01", eventUrl: "https://evil.test/e" })).toBeNull();
    expect(normalizeMeetupEvent({ id: "1", title: "Bad", dateTime: "not-a-date", eventUrl: "https://meetup.com/e" })).toBeNull();
  });

  it("uses the event city's Canadian timezone", () => {
    const event = normalizeMeetupEvent({
      id: "309009999",
      title: "Edmonton Rental Property Meetup",
      eventUrl: "https://www.meetup.com/crei-edmonton/events/309009999/",
      dateTime: "2026-12-03T18:30:00-07:00",
      group: { name: "Edmonton Real Estate Investors", urlname: "crei-edmonton" },
    });
    expect(event?.city).toBe("Edmonton");
    expect(event?.timezone).toBe("America/Edmonton");
  });

  it("keeps slugs deterministic and parses ISO durations", () => {
    expect(meetupEventSlug("ABC! 123", "The Canadian Real Estate Investor")).toBe("meetup-the-canadian-real-estate-investor-abc-123");
    expect(parseIsoDurationMs("P1DT1H15M")).toBe(90_900_000);
    expect(parseIsoDurationMs("not-duration")).toBeNull();
    expect(stripMeetupHtml("<script>bad()</script><p>Hello&nbsp;there</p>")).toBe("Hello there");
  });
});

describe("Meetup OAuth state", () => {
  const secret = "a-long-test-state-secret";

  it("round trips and expires", () => {
    const state = signMeetupOAuthState("user-123", secret, 1_000_000);
    expect(verifyMeetupOAuthState(state, secret, 1_000_500)).toBe("user-123");
    expect(verifyMeetupOAuthState(state, secret, 1_000_000 + 16 * 60 * 1000)).toBeNull();
  });

  it("rejects tampering and another secret", () => {
    const state = signMeetupOAuthState("user-123", secret, 1_000_000);
    expect(verifyMeetupOAuthState(`${state}x`, secret, 1_000_500)).toBeNull();
    expect(verifyMeetupOAuthState(state, "another-long-test-secret", 1_000_500)).toBeNull();
  });
});
