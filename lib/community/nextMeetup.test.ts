import { describe, expect, it } from "vitest";
import type { MeetupEvent } from "./meetup";
import { pickMeetupFor } from "./nextMeetup";

const event = (uid: string, title: string, location: string, startsAt: string): MeetupEvent => ({
  uid, title, startsAt, endsAt: null, timezone: "America/Toronto", location, description: null, url: null, rsvpCount: null, imageUrl: null,
});
const now = new Date("2026-09-19T12:00:00Z");
const events = [
  event("past", "Toronto Investor Meetup", "Valery Office, 100 King St W, Toronto, ON", "2026-09-10T22:00:00Z"),
  event("mon", "Real Estate Investing - meet up", "Tide & Boar, 700 Main St, Moncton, NB", "2026-09-25T22:00:00Z"),
  event("tor2", "Toronto Investor Meetup", "Valery Office, 100 King St W, Toronto, ON", "2026-10-20T22:00:00Z"),
  event("tor1", "Toronto Investor Meetup", "Valery Office, 100 King St W, Toronto, ON", "2026-10-06T22:00:00Z"),
];

describe("pickMeetupFor", () => {
  it("offers the next meetup in the person's own market", () => {
    expect(pickMeetupFor(events, "Toronto", now)?.uid).toBe("tor1");
    expect(pickMeetupFor(events, "moncton", now)?.uid).toBe("mon");
  });

  it("knows the suburbs go to the city's meetup", () => {
    expect(pickMeetupFor(events, "Etobicoke", now)?.uid).toBe("tor1");
    expect(pickMeetupFor(events, "Dieppe", now)?.uid).toBe("mon");
  });

  it("says nothing rather than suggest a meetup across the country", () => {
    expect(pickMeetupFor(events, "Hamilton", now)).toBeNull();
    expect(pickMeetupFor(events, null, now)).toBeNull();
  });
});
