import { describe, expect, it } from "vitest";
import {
  buildCalendar,
  cityFromAddress,
  cityFromEventName,
  dedupeCalendar,
  groupByCity,
  localDateKey,
  nextByCity,
  nextSecondTuesday,
  normalizeCity,
  normalizeEventbriteEvent,
  normalizeMeetupEvent,
  normalizeRealistEvent,
  upcomingCalendar,
} from "./meetupCalendar";

describe("normalizeCity", () => {
  it("strips provinces and title-cases", () => {
    expect(normalizeCity("Ottawa, ON")).toBe("Ottawa");
    expect(normalizeCity("  calgary ")).toBe("Calgary");
    expect(normalizeCity("st. john's")).toBe("St. John's");
  });
  it("collapses suburbs onto the meetup city", () => {
    expect(normalizeCity("Pickering")).toBe("Durham Region");
    expect(normalizeCity("kitchener")).toBe("Kitchener-Waterloo");
    expect(normalizeCity("Kitchener Waterloo")).toBe("Kitchener-Waterloo");
  });
  it("returns null for empty input", () => {
    expect(normalizeCity(null)).toBeNull();
    expect(normalizeCity("   ")).toBeNull();
  });
});

describe("cityFromEventName", () => {
  it("reads the network's naming patterns", () => {
    expect(cityFromEventName("Ottawa Real Estate Meetup")).toBe("Ottawa");
    expect(cityFromEventName("Pickering Real Estate Meetup")).toBe("Durham Region");
    expect(cityFromEventName("Vancouver Real Estate Investors")).toBe("Vancouver");
    expect(cityFromEventName("Toronto Real Estate")).toBe("Toronto");
    expect(cityFromEventName("Kitchener Waterloo Real Estate")).toBe("Kitchener-Waterloo");
    expect(cityFromEventName("Moncton Real Estate Investor - In person meet up")).toBe("Moncton");
  });
  it("does not invent a city from flagship titles", () => {
    expect(cityFromEventName("Unpacking Multiplexes Toronto")).toBeNull();
    expect(cityFromEventName("The Canadian Real Estate Investor Podcast")).toBeNull();
    expect(cityFromEventName("")).toBeNull();
  });
});

describe("cityFromAddress", () => {
  it("takes the locality part of a Canadian address", () => {
    expect(cityFromAddress("329 March Road, Ottawa, ON K2K 2E1")).toBe("Ottawa");
    expect(cityFromAddress("Madison Avenue Pub, 14 Madison Ave, Toronto, ON")).toBe("Toronto");
    expect(cityFromAddress("14 Madison Ave, Toronto")).toBe("Toronto");
  });
  it("gives up rather than guessing", () => {
    expect(cityFromAddress("Toronto, ON M5J 1A7")).toBeNull();
    expect(cityFromAddress(null)).toBeNull();
  });
});

describe("normalizers", () => {
  it("maps a Meetup.com event", () => {
    const event = normalizeMeetupEvent({
      id: "300123",
      groupUrlname: "toronto-real-estate-realist",
      groupName: "Toronto Real Estate",
      title: "Toronto Real Estate Investor Meetup",
      startsAt: "2026-10-13T22:00:00.000Z",
      endsAt: null,
      timezone: "America/Toronto",
      venueName: "Madison Avenue Pub",
      venueAddress: "14 Madison Ave, Toronto, ON",
      url: "https://www.meetup.com/toronto-real-estate-realist/events/300123/",
      rsvpCount: 14,
    });
    expect(event.key).toBe("meetup:300123");
    expect(event.city).toBe("Toronto");
    expect(event.isFree).toBe(true);
    expect(event.rsvpCount).toBe(14);
  });

  it("maps an Eventbrite meetup and infers the city from the name", () => {
    const event = normalizeEventbriteEvent({
      id: "1992078179460",
      name: "Ottawa Real Estate Meetup",
      startDate: "2026-10-13T22:00:00Z",
      endDate: "2026-10-14T00:00:00Z",
      timezone: "America/Toronto",
      venueName: "329 March Rd",
      venueAddress: "329 March Road, Ottawa, ON K2K 2E1",
      eventUrl: "https://www.eventbrite.ca/e/ottawa-real-estate-meetup-tickets-1992078179460",
    });
    expect(event.city).toBe("Ottawa");
    expect(event.source).toBe("eventbrite");
    expect(event.isFree).toBe(true);
  });

  it("maps a native Realist event to its own page", () => {
    const event = normalizeRealistEvent({
      id: "abc",
      slug: "deal-room-2026-10-19",
      title: "Live Deal Room",
      startsAt: new Date("2026-10-19T15:30:00.000Z"),
      timezone: "America/Toronto",
      city: null,
      kind: "meetup",
      rsvpCount: 3,
    });
    expect(event.url).toBe("/events/deal-room-2026-10-19");
    expect(event.city).toBeNull();
    expect(event.isFree).toBe(true);
  });
});

describe("localDateKey", () => {
  it("uses the event's zone, not UTC", () => {
    // 22:00Z on Oct 13 is still Oct 13 in Toronto, but 02:30Z on Oct 14 is Oct 13 in Toronto too.
    expect(localDateKey("2026-10-13T22:00:00Z", "America/Toronto")).toBe("2026-10-13");
    expect(localDateKey("2026-10-14T02:30:00Z", "America/Toronto")).toBe("2026-10-13");
  });
});

describe("dedupeCalendar", () => {
  const meetup = normalizeMeetupEvent({
    id: "m1",
    groupUrlname: "ottawa",
    title: "Ottawa Real Estate Meetup",
    startsAt: "2026-10-13T22:00:00Z",
    timezone: "America/Toronto",
    url: "https://www.meetup.com/ottawa/events/m1/",
    rsvpCount: 22,
  });
  const eventbrite = normalizeEventbriteEvent({
    id: "e1",
    name: "Ottawa Real Estate Meetup",
    startDate: "2026-10-13T22:30:00Z",
    timezone: "America/Toronto",
    eventUrl: "https://www.eventbrite.ca/e/e1",
  });
  const realist = normalizeRealistEvent({
    id: "r1",
    slug: "ottawa-oct",
    title: "Ottawa Real Estate Meetup",
    startsAt: "2026-10-13T22:00:00Z",
    timezone: "America/Toronto",
    city: "Ottawa",
    kind: "meetup",
  });

  it("keeps one copy per city and local date, Meetup over Eventbrite", () => {
    const merged = dedupeCalendar([eventbrite, meetup]);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("meetup");
  });

  it("prefers the native Realist event and carries the RSVP count across", () => {
    const merged = dedupeCalendar([meetup, realist]);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("realist");
    expect(merged[0].rsvpCount).toBe(22);
  });

  it("keeps different dates and city-less events apart", () => {
    const nextMonth = { ...meetup, id: "m2", key: "meetup:m2", startsAt: "2026-11-10T23:00:00Z" };
    const online = { ...meetup, id: "m3", key: "meetup:m3", city: null };
    const online2 = { ...meetup, id: "m4", key: "meetup:m4", city: null };
    expect(dedupeCalendar([meetup, nextMonth, online, online2])).toHaveLength(4);
  });
});

describe("upcoming, grouping, next", () => {
  const now = new Date("2026-09-16T20:00:00Z");
  const past = normalizeMeetupEvent({ id: "p", groupUrlname: "g", title: "Toronto Real Estate Meetup", startsAt: "2026-09-08T22:00:00Z", url: "u" });
  const soon = normalizeMeetupEvent({ id: "s", groupUrlname: "g", title: "Toronto Real Estate Meetup", startsAt: "2026-10-13T21:00:00Z", url: "u" });
  const later = normalizeMeetupEvent({ id: "l", groupUrlname: "g", title: "Toronto Real Estate Meetup", startsAt: "2026-11-10T23:00:00Z", url: "u" });
  const ottawa = normalizeMeetupEvent({ id: "o", groupUrlname: "g2", title: "Ottawa Real Estate Meetup", startsAt: "2026-10-13T22:00:00Z", url: "u" });

  it("drops finished events but keeps one in progress", () => {
    const inProgress = { ...soon, key: "meetup:x", id: "x", startsAt: "2026-09-16T18:00:00Z" };
    const result = upcomingCalendar([past, later, soon, inProgress], now);
    expect(result.map((event) => event.id)).toEqual(["x", "s", "l"]);
  });

  it("groups by city in date order and finds the next per city", () => {
    const groups = groupByCity([later, ottawa, soon]);
    expect([...groups.keys()]).toEqual(["Toronto", "Ottawa"]);
    expect(groups.get("Toronto")!.map((event) => event.id)).toEqual(["s", "l"]);
    expect(nextByCity([later, soon, ottawa]).get("Toronto")!.id).toBe("s");
  });

  it("builds the whole calendar in one call", () => {
    const calendar = buildCalendar({
      meetup: [{ id: "m", groupUrlname: "g", title: "Toronto Real Estate Meetup", startsAt: "2026-10-13T22:00:00Z", timezone: "America/Toronto", url: "u" }],
      eventbrite: [{ id: "e", name: "Toronto Real Estate Meetup", startDate: "2026-10-13T22:00:00Z", timezone: "America/Toronto", eventUrl: "u2" }],
      realist: [{ id: "r", slug: "r", title: "Live Deal Room", startsAt: "2026-09-21T15:30:00Z", kind: "meetup" }],
      now,
    });
    expect(calendar.map((event) => event.source)).toEqual(["realist", "meetup"]);
  });
});

describe("nextSecondTuesday", () => {
  it("finds the next second Tuesday after a mid-month date", () => {
    const next = nextSecondTuesday(new Date(2026, 8, 16, 12));
    expect([next.getFullYear(), next.getMonth(), next.getDate(), next.getDay()]).toEqual([2026, 9, 13, 2]);
  });
  it("stays in the current month when it has not happened yet", () => {
    const next = nextSecondTuesday(new Date(2026, 8, 1, 12));
    expect([next.getMonth(), next.getDate()]).toEqual([8, 8]);
  });
});
