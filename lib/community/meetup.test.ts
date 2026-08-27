import { describe, expect, it } from "vitest";
import {
  cityFromLocation,
  meetupEventUrlFromUid,
  parseIcsDate,
  parseIcsEvents,
  parseIcsProperty,
  unescapeIcsText,
  unfoldIcsLines,
  upcomingEvents,
} from "./meetup";

// A representative Meetup export: VTIMEZONE with nested DTSTART lines (which
// must NOT become events), a TZID event with folded SUMMARY/DESCRIPTION and
// escaped commas, a UTC event with no DTEND and no URL, and a bare-minimum
// event with almost every field missing.
const ics = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Meetup//EN",
  "BEGIN:VTIMEZONE",
  "TZID:America/Toronto",
  "BEGIN:DAYLIGHT",
  "DTSTART:19700308T020000",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "DTSTART:19701101T020000",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "END:STANDARD",
  "END:VTIMEZONE",
  "BEGIN:VEVENT",
  "DTSTAMP:20260801T120000Z",
  "DTSTART;TZID=America/Toronto:20260915T180000",
  "DTEND;TZID=America/Toronto:20260915T210000",
  "SUMMARY:The Canadian Real Estate Investor liv",
  " e — Toronto",
  "DESCRIPTION:Doors at 6\\, panel at 7.\\nBring your ca",
  " p rate questions.",
  "LOCATION:The Rec Room\\, 255 Bremner Blvd\\, Toronto\\, ON",
  "URL:https://www.meetup.com/crei-toronto/events/300000001/",
  "UID:event_300000001@meetup.com",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20261201T000000Z",
  "SUMMARY:Vancouver investor social",
  "LOCATION:Steamworks\\, 375 Water St\\, Vancouver\\, BC",
  "UID:event_300000002@meetup.com",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20270110T170000Z",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("unfoldIcsLines", () => {
  it("joins CRLF + space continuations into one logical line", () => {
    const lines = unfoldIcsLines("SUMMARY:Hello\r\n  world\r\nURL:x");
    // RFC 5545: the fold consumes CRLF plus exactly one whitespace char.
    expect(lines).toEqual(["SUMMARY:Hello world", "URL:x"]);
  });

  it("handles bare-LF folds and tab continuations", () => {
    expect(unfoldIcsLines("DESCRIPTION:a\n\tb")).toEqual(["DESCRIPTION:ab"]);
  });
});

describe("unescapeIcsText", () => {
  it("unescapes commas, semicolons, newlines, and backslashes", () => {
    expect(unescapeIcsText("a\\, b\\; c\\nd \\\\e")).toBe("a, b; c\nd \\e");
  });
});

describe("parseIcsProperty", () => {
  it("splits name, params, and value", () => {
    const prop = parseIcsProperty("DTSTART;TZID=America/Toronto:20260915T180000");
    expect(prop).toEqual({
      name: "DTSTART",
      params: { TZID: "America/Toronto" },
      value: "20260915T180000",
    });
  });

  it("keeps colons inside quoted params out of the name/value split", () => {
    const prop = parseIcsProperty(
      'LOCATION;ALTREP="https://maps.example.com/?q=1":The Rec Room',
    );
    expect(prop?.value).toBe("The Rec Room");
    expect(prop?.params.ALTREP).toBe("https://maps.example.com/?q=1");
  });
});

describe("parseIcsDate", () => {
  it("reads Zulu timestamps as UTC", () => {
    expect(parseIcsDate("20261201T230000Z")?.iso).toBe("2026-12-01T23:00:00.000Z");
  });

  it("converts TZID wall-clock time to UTC during daylight saving", () => {
    // September in Toronto is EDT (UTC-4).
    const parsed = parseIcsDate("20260915T180000", "America/Toronto");
    expect(parsed?.iso).toBe("2026-09-15T22:00:00.000Z");
    expect(parsed?.timezone).toBe("America/Toronto");
  });

  it("converts TZID wall-clock time to UTC during standard time", () => {
    // January in Toronto is EST (UTC-5).
    expect(parseIcsDate("20260115T190000", "America/Toronto")?.iso).toBe(
      "2026-01-16T00:00:00.000Z",
    );
  });

  it("degrades an unknown TZID to a UTC reading instead of throwing", () => {
    expect(parseIcsDate("20260915T180000", "Not/AZone")?.iso).toBe(
      "2026-09-15T18:00:00.000Z",
    );
  });

  it("accepts all-day DATE values and rejects garbage", () => {
    expect(parseIcsDate("20260915")?.iso).toBe("2026-09-15T00:00:00.000Z");
    expect(parseIcsDate("next tuesday")).toBeNull();
  });
});

describe("parseIcsEvents", () => {
  const events = parseIcsEvents(ics, "crei-toronto");

  it("parses one event per VEVENT and ignores VTIMEZONE DTSTART lines", () => {
    expect(events).toHaveLength(3);
  });

  it("unfolds the folded SUMMARY into a single title", () => {
    expect(events[0].title).toBe("The Canadian Real Estate Investor live — Toronto");
  });

  it("resolves TZID start/end to UTC instants and keeps the zone for display", () => {
    expect(events[0].startsAt).toBe("2026-09-15T22:00:00.000Z");
    expect(events[0].endsAt).toBe("2026-09-16T01:00:00.000Z");
    expect(events[0].timezone).toBe("America/Toronto");
  });

  it("unescapes commas in LOCATION and newlines in DESCRIPTION", () => {
    expect(events[0].location).toBe("The Rec Room, 255 Bremner Blvd, Toronto, ON");
    expect(events[0].description).toBe(
      "Doors at 6, panel at 7.\nBring your cap rate questions.",
    );
  });

  it("keeps the explicit URL property when present", () => {
    expect(events[0].url).toBe(
      "https://www.meetup.com/crei-toronto/events/300000001/",
    );
  });

  it("leaves endsAt null when DTEND is missing", () => {
    expect(events[1].endsAt).toBeNull();
  });

  it("constructs the event link from the Meetup UID when URL is absent", () => {
    expect(events[1].url).toBe(
      "https://www.meetup.com/crei-toronto/events/300000002/",
    );
  });

  it("survives a VEVENT with nearly everything missing", () => {
    expect(events[2].title).toBe("Meetup event");
    expect(events[2].startsAt).toBe("2027-01-10T17:00:00.000Z");
    expect(events[2].location).toBeNull();
    expect(events[2].description).toBeNull();
    expect(events[2].rsvpCount).toBeNull();
  });

  it("drops a VEVENT with no DTSTART rather than inventing a date", () => {
    const broken = "BEGIN:VEVENT\r\nSUMMARY:No date\r\nEND:VEVENT";
    expect(parseIcsEvents(broken)).toHaveLength(0);
  });
});

describe("meetupEventUrlFromUid", () => {
  it("returns null without a group urlname or a non-Meetup UID", () => {
    expect(meetupEventUrlFromUid("event_1@meetup.com")).toBeNull();
    expect(meetupEventUrlFromUid("abc@example.com", "crei")).toBeNull();
  });
});

describe("upcomingEvents", () => {
  it("filters past events (with a same-day grace window) and sorts ascending", () => {
    const events = parseIcsEvents(ics, "crei-toronto");
    const now = new Date("2026-11-30T00:00:00Z");
    const upcoming = upcomingEvents(events, now);
    expect(upcoming.map((event) => event.uid)).toEqual([
      "event_300000002@meetup.com",
      "2027-01-10T17:00:00.000Z:Meetup event",
    ]);
    // Sept 15 is long past by Nov 30, but still listed the evening it runs.
    expect(
      upcomingEvents(events, new Date("2026-09-16T01:00:00Z")).map((e) => e.uid),
    ).toContain("event_300000001@meetup.com");
  });
});

describe("cityFromLocation", () => {
  it("finds the city before a province code, with or without a postal code", () => {
    expect(cityFromLocation("The Rec Room, 255 Bremner Blvd, Toronto, ON")).toBe(
      "Toronto",
    );
    expect(cityFromLocation("Steamworks, 375 Water St, Vancouver, BC V6B 5C6, Canada")).toBe(
      "Vancouver",
    );
    expect(cityFromLocation("123 8 Ave SW, Calgary, Alberta")).toBe("Calgary");
  });

  it("handles short and empty locations gracefully", () => {
    expect(cityFromLocation("Toronto, ON")).toBe("Toronto");
    expect(cityFromLocation("Online event")).toBe("Online event");
    expect(cityFromLocation(null)).toBeNull();
    expect(cityFromLocation("")).toBeNull();
  });
});
