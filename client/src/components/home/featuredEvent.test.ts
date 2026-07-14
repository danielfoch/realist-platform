import { describe, expect, it } from "vitest";
import { formatEventSchedule, toDisplayEvent, type FeaturedEventResponse } from "./featuredEvent";

type ApiEvent = NonNullable<FeaturedEventResponse["event"]>;

const baseEvent: ApiEvent = {
  slug: "calgary-cash-flow-summit",
  title: "Calgary Cash Flow Summit",
  shortDescription: "A day of underwriting Alberta rentals",
  headerImageUrl: "/events/calgary.png",
  startsAt: "2026-10-20T23:00:00.000Z", // 5:00 p.m. in Calgary (MDT)
  endsAt: "2026-10-21T03:00:00.000Z", // 9:00 p.m. in Calgary
  timezone: "America/Edmonton",
  venueName: "Calgary Telus Convention Centre",
  venueAddress: "120 9 Ave SE, Calgary",
  city: "Calgary",
  kind: "flagship",
  minPriceCents: 9900,
};

describe("formatEventSchedule", () => {
  it("renders the date and a start-to-end range in the event's own timezone", () => {
    const { dateLabel, timeLabel } = formatEventSchedule(baseEvent.startsAt, baseEvent.endsAt, "America/Edmonton");
    expect(dateLabel).toBe("Tuesday, October 20, 2026");
    expect(timeLabel).toMatch(/^5:00.*to 9:00.*MDT$/);
    // The zone appears once, on the end time only.
    expect(timeLabel?.match(/MDT/g)).toHaveLength(1);
  });

  it("falls back to a start time with zone when there is no end time", () => {
    const { timeLabel } = formatEventSchedule(baseEvent.startsAt, null, "America/Edmonton");
    expect(timeLabel).toMatch(/^5:00.*MDT$/);
  });

  it("returns null labels for an unparseable start", () => {
    expect(formatEventSchedule("not-a-date", null, "America/Toronto")).toEqual({ dateLabel: null, timeLabel: null });
  });

  it("defaults to Toronto time when the timezone is empty", () => {
    const { timeLabel } = formatEventSchedule(baseEvent.startsAt, null, "");
    expect(timeLabel).toMatch(/7:00.*EDT$/);
  });
});

describe("toDisplayEvent", () => {
  it("maps a paid flagship to the ticketed frame", () => {
    const display = toDisplayEvent(baseEvent);
    expect(display).not.toBeNull();
    expect(display?.href).toBe("/events/calgary-cash-flow-summit");
    expect(display?.ticketBadge).toBe("Tickets on sale now");
    expect(display?.ticketNote).toBe("Ticketing details on the event page");
    expect(display?.venueTitle).toBe("Calgary Telus Convention Centre");
    expect(display?.venueDetail).toBe("120 9 Ave SE, Calgary");
    expect(display?.kicker).toBe("Calgary event");
  });

  it("treats meetups and zero-price events as free", () => {
    expect(toDisplayEvent({ ...baseEvent, kind: "meetup" })?.ticketBadge).toBe("Free to attend");
    expect(toDisplayEvent({ ...baseEvent, minPriceCents: 0 })?.ticketBadge).toBe("Free to attend");
    expect(toDisplayEvent({ ...baseEvent, kind: "meetup" })?.ticketNote).toBe("RSVP on the event page");
  });

  it("omits the ticket badge when no active ticket tier exists", () => {
    expect(toDisplayEvent({ ...baseEvent, minPriceCents: null })?.ticketBadge).toBeNull();
  });

  it("routes bespoke-page slugs to their static marketing page", () => {
    const display = toDisplayEvent({ ...baseEvent, slug: "unpacking-multiplexes-toronto" });
    expect(display?.href).toBe("/community/events/unpacking-multiplexes-toronto");
  });

  it("falls back to the city when venue fields are missing", () => {
    const display = toDisplayEvent({ ...baseEvent, venueName: null, venueAddress: null });
    expect(display?.venueTitle).toBe("Calgary");
    expect(display?.venueDetail).toBeNull();
  });

  it("returns null when the start date is unusable", () => {
    expect(toDisplayEvent({ ...baseEvent, startsAt: "garbage" })).toBeNull();
  });
});
