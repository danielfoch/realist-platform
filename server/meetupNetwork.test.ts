/**
 * Tests for the Meetup.com network feed (server/meetupNetwork.ts and
 * shared/meetupNetwork.ts).
 *
 * The RFC 5545 parser cases are ported from realist-lean
 * lib/community/meetup.test.ts. Nothing here touches the network: the
 * integration-style cases stub `fetch` to exercise the public iCal path with
 * no credentials, the GraphQL → iCal fallback, the JWT server flow with a
 * throwaway RSA key, and the stale-beats-broken cache contract.
 */
import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MEETUP_NETWORK_GROUPS,
  MEETUP_PRO_URLNAME_DEFAULT,
  cityFromLocation,
  meetupGroupFromUrlname,
  meetupGroupUrl,
  mergeGroupLists,
  type MeetupEvent,
} from "@shared/meetupNetwork";
import {
  MEETUP_GQL_ENDPOINT,
  MEETUP_TOKEN_URL,
  buildMeetupJwtAssertion,
  dedupeMeetupEvents,
  icsEventToMeetupEvent,
  meetupEventUrlFromUid,
  nextMeetupEvents,
  parseDurationMs,
  parseIcsDate,
  parseIcsEvents,
  parseIcsProperty,
  splitIcsLocation,
  unescapeIcsText,
  unfoldIcsLines,
  upcomingMeetupEvents,
} from "./meetupNetwork";

const [TORONTO, VANCOUVER, KITCHENER, VAUGHAN, MONCTON] = MEETUP_NETWORK_GROUPS.map((group) => group.urlname);
const CALGARY = "the-canadian-real-estate-investor-calgary";

// A representative Meetup export: VTIMEZONE with nested DTSTART lines (which
// must NOT become events), a TZID event with folded SUMMARY/DESCRIPTION and
// escaped commas, a UTC event with no DTEND and no URL, and a bare-minimum
// event with almost every field missing.
const SAMPLE_ICS = [
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

// ---------------------------------------------------------------------------
// ICS parser (ported from realist-lean)
// ---------------------------------------------------------------------------

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
    expect(unescapeIcsText("a\\, b\; c\\nd \\\\e")).toBe("a, b; c\nd \\e");
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
    const prop = parseIcsProperty('LOCATION;ALTREP="https://maps.example.com/?q=1":The Rec Room');
    expect(prop?.value).toBe("The Rec Room");
    expect(prop?.params.ALTREP).toBe("https://maps.example.com/?q=1");
  });

  it("returns null for a line with no property separator", () => {
    expect(parseIcsProperty("not a property")).toBeNull();
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
    expect(parseIcsDate("20260115T190000", "America/Toronto")?.iso).toBe("2026-01-16T00:00:00.000Z");
  });

  it("degrades an unknown TZID to a UTC reading instead of throwing", () => {
    expect(parseIcsDate("20260915T180000", "Not/AZone")?.iso).toBe("2026-09-15T18:00:00.000Z");
  });

  it("accepts all-day DATE values and rejects garbage", () => {
    expect(parseIcsDate("20260915")?.iso).toBe("2026-09-15T00:00:00.000Z");
    expect(parseIcsDate("next tuesday")).toBeNull();
  });
});

describe("parseIcsEvents", () => {
  const events = parseIcsEvents(SAMPLE_ICS, "crei-toronto");

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
    expect(events[0].description).toBe("Doors at 6, panel at 7.\nBring your cap rate questions.");
  });

  it("keeps the explicit URL property when present", () => {
    expect(events[0].url).toBe("https://www.meetup.com/crei-toronto/events/300000001/");
  });

  it("leaves endsAt null when DTEND is missing", () => {
    expect(events[1].endsAt).toBeNull();
  });

  it("constructs the event link from the Meetup UID when URL is absent", () => {
    expect(events[1].url).toBe("https://www.meetup.com/crei-toronto/events/300000002/");
  });

  it("survives a VEVENT with nearly everything missing", () => {
    expect(events[2].title).toBe("Meetup event");
    expect(events[2].startsAt).toBe("2027-01-10T17:00:00.000Z");
    expect(events[2].uid).toBe("2027-01-10T17:00:00.000Z:Meetup event");
    expect(events[2].location).toBeNull();
    expect(events[2].description).toBeNull();
    expect(events[2].url).toBeNull();
  });

  it("drops a VEVENT with no DTSTART rather than inventing a date", () => {
    const broken = "BEGIN:VEVENT\r\nSUMMARY:No date\r\nEND:VEVENT";
    expect(parseIcsEvents(broken)).toHaveLength(0);
  });

  it("treats a calendar with no VEVENTs as empty, not broken", () => {
    expect(parseIcsEvents("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR", "x")).toEqual([]);
  });
});

describe("meetupEventUrlFromUid", () => {
  it("returns null without a group urlname or a non-Meetup UID", () => {
    expect(meetupEventUrlFromUid("event_1@meetup.com")).toBeNull();
    expect(meetupEventUrlFromUid("abc@example.com", "crei")).toBeNull();
  });
});

describe("icsEventToMeetupEvent", () => {
  const group = MEETUP_NETWORK_GROUPS[0];
  const [withVenue, withoutLocation] = parseIcsEvents(SAMPLE_ICS, group.urlname);

  it("splits the venue name off the address and reads the city from the location", () => {
    const event = icsEventToMeetupEvent(withVenue, group);
    expect(event).toMatchObject({
      id: "event_300000001@meetup.com",
      groupUrlname: TORONTO,
      groupName: "Toronto Real Estate",
      venueName: "The Rec Room",
      venueAddress: "255 Bremner Blvd, Toronto, ON",
      city: "Toronto",
      rsvpCount: null,
      imageUrl: null,
      source: "ical",
    });
  });

  it("falls back to the registry city and the UID-derived link", () => {
    const vancouverGroup = MEETUP_NETWORK_GROUPS[1];
    const event = icsEventToMeetupEvent({ ...withoutLocation, location: null }, vancouverGroup);
    expect(event.city).toBe("Vancouver");
    expect(event.venueName).toBeNull();
    expect(event.url).toBe(`https://www.meetup.com/${TORONTO}/events/300000002/`);
  });

  it("links to the group's events page when no URL can be derived at all", () => {
    const event = icsEventToMeetupEvent({ ...withoutLocation, url: null }, group);
    expect(event.url).toBe(`https://www.meetup.com/${TORONTO}/events/`);
  });
});

describe("splitIcsLocation", () => {
  it("needs three segments before the first one counts as a venue", () => {
    expect(splitIcsLocation("Steamworks, 375 Water St, Vancouver, BC")).toEqual({
      venueName: "Steamworks",
      venueAddress: "375 Water St, Vancouver, BC",
    });
    expect(splitIcsLocation("Toronto, ON")).toEqual({ venueName: null, venueAddress: "Toronto, ON" });
    expect(splitIcsLocation("Online event")).toEqual({ venueName: null, venueAddress: "Online event" });
    expect(splitIcsLocation(null)).toEqual({ venueName: null, venueAddress: null });
  });
});

describe("cityFromLocation", () => {
  it("finds the city before a province code, with or without a postal code", () => {
    expect(cityFromLocation("The Rec Room, 255 Bremner Blvd, Toronto, ON")).toBe("Toronto");
    expect(cityFromLocation("Steamworks, 375 Water St, Vancouver, BC V6B 5C6, Canada")).toBe("Vancouver");
    expect(cityFromLocation("123 8 Ave SW, Calgary, Alberta")).toBe("Calgary");
  });

  it("handles short and empty locations gracefully", () => {
    expect(cityFromLocation("Toronto, ON")).toBe("Toronto");
    expect(cityFromLocation("Online event")).toBe("Online event");
    expect(cityFromLocation(null)).toBeNull();
    expect(cityFromLocation("")).toBeNull();
  });
});

describe("parseDurationMs", () => {
  it("reads ISO 8601 durations and raw milliseconds, rejecting the rest", () => {
    expect(parseDurationMs("PT2H")).toBe(2 * 60 * 60 * 1000);
    expect(parseDurationMs("PT1H30M")).toBe(90 * 60 * 1000);
    expect(parseDurationMs("P1DT1H")).toBe(25 * 60 * 60 * 1000);
    expect(parseDurationMs(5400000)).toBe(5400000);
    expect(parseDurationMs("2 hours")).toBeNull();
    expect(parseDurationMs(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Registry helpers
// ---------------------------------------------------------------------------

describe("meetupGroupUrl / meetupGroupFromUrlname", () => {
  it("builds the canonical group page and a readable placeholder name", () => {
    expect(meetupGroupUrl("Toronto-Real-Estate-Realist/")).toBe("https://www.meetup.com/toronto-real-estate-realist/");
    expect(meetupGroupFromUrlname(CALGARY)).toEqual({
      urlname: CALGARY,
      name: "The Canadian Real Estate Investor Calgary",
      city: "",
      province: "",
      status: "active",
    });
  });
});

describe("mergeGroupLists", () => {
  it("keeps registry status and city, takes discovered name and memberCount, appends unknown groups", () => {
    const merged = mergeGroupLists(MEETUP_NETWORK_GROUPS, [
      { urlname: VAUGHAN, name: "Vaughan Real Estate Investors (network)", city: "Woodbridge", memberCount: 640 },
      { urlname: CALGARY, name: "Calgary Real Estate Investors", city: "Calgary", province: "AB", memberCount: 812 },
      { urlname: "no-details-yet" },
    ]);

    expect(merged.map((group) => group.urlname)).toEqual([
      TORONTO,
      VANCOUVER,
      KITCHENER,
      VAUGHAN,
      MONCTON,
      CALGARY,
      "no-details-yet",
    ]);
    expect(merged[3]).toMatchObject({
      name: "Vaughan Real Estate Investors (network)",
      city: "Vaughan",
      province: "ON",
      status: "transition",
      memberCount: 640,
    });
    expect(merged[0].memberCount).toBeNull();
    expect(merged[5]).toEqual({
      urlname: CALGARY,
      name: "Calgary Real Estate Investors",
      city: "Calgary",
      province: "AB",
      status: "active",
      memberCount: 812,
    });
    expect(merged[6]).toMatchObject({ name: "No Details Yet", city: "", status: "active", memberCount: null });
  });

  it("dedupes case-insensitively, keeping the first spelling, and fills blank registry cities", () => {
    const merged = mergeGroupLists(
      [
        { urlname: "Toronto-X", name: "Toronto X", city: "", province: "", status: "closing" },
        { urlname: "toronto-x", name: "duplicate", city: "Elsewhere", province: "QC", status: "active" },
      ],
      [{ urlname: "TORONTO-X/", city: "Toronto", province: "ON", memberCount: 5 }],
    );
    expect(merged).toEqual([
      { urlname: "Toronto-X", name: "Toronto X", city: "Toronto", province: "ON", status: "closing", memberCount: 5 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Event merge helpers
// ---------------------------------------------------------------------------

function event(id: string, startsAt: string, extra: Partial<MeetupEvent> = {}): MeetupEvent {
  return {
    id,
    groupUrlname: TORONTO,
    groupName: "Toronto Real Estate",
    title: `Event ${id}`,
    startsAt,
    endsAt: null,
    timezone: null,
    venueName: null,
    venueAddress: null,
    city: "Toronto",
    description: null,
    url: `https://www.meetup.com/${TORONTO}/events/${id}/`,
    rsvpCount: null,
    imageUrl: null,
    source: "ical",
    ...extra,
  };
}

describe("dedupeMeetupEvents", () => {
  it("keeps the first of duplicate ids and matches GraphQL ids to ICS UIDs", () => {
    const deduped = dedupeMeetupEvents([
      event("123", "2035-01-01T00:00:00.000Z", { source: "graphql", rsvpCount: 9 }),
      event("event_123@meetup.com", "2035-01-01T00:00:00.000Z"),
      event("event_456@meetup.com", "2035-02-01T00:00:00.000Z"),
      event("event_456@meetup.com", "2035-02-01T00:00:00.000Z", { title: "later copy" }),
    ]);
    expect(deduped.map((item) => item.id)).toEqual(["123", "event_456@meetup.com"]);
    expect(deduped[0].rsvpCount).toBe(9);
    expect(deduped[1].title).toBe("Event event_456@meetup.com");
  });
});

describe("upcomingMeetupEvents", () => {
  it("drops events older than the 3h grace window and sorts ascending", () => {
    const now = new Date("2026-09-16T01:00:00Z");
    const upcoming = upcomingMeetupEvents(
      [
        event("far", "2026-12-01T00:00:00.000Z"),
        event("tonight", "2026-09-15T22:30:00.000Z"), // 2.5h ago: still on
        event("yesterday", "2026-09-14T22:00:00.000Z"),
        event("soon", "2026-09-20T22:00:00.000Z"),
      ],
      now,
    );
    expect(upcoming.map((item) => item.id)).toEqual(["tonight", "soon", "far"]);
  });
});

describe("nextMeetupEvents", () => {
  const groups = MEETUP_NETWORK_GROUPS;
  const events = [
    event("a", "2035-01-01T00:00:00.000Z", { city: "Toronto" }),
    event("b", "2035-01-02T00:00:00.000Z", { city: "Mississauga" }), // Toronto group, suburb venue
    event("c", "2035-01-03T00:00:00.000Z", { groupUrlname: KITCHENER, city: "Kitchener-Waterloo" }),
    event("d", "2035-01-04T00:00:00.000Z", { groupUrlname: VANCOUVER, city: "Vancouver" }),
    event("e", "2035-01-05T00:00:00.000Z", { city: "Toronto" }),
  ];

  it("returns the next few network-wide when no city is given", () => {
    expect(nextMeetupEvents(events, groups).map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(nextMeetupEvents(events, groups, { limit: 1 }).map((item) => item.id)).toEqual(["a"]);
  });

  it("matches the city case-insensitively, in both directions, and via the group's home city", () => {
    expect(nextMeetupEvents(events, groups, { city: "TORONTO", limit: 10 }).map((item) => item.id)).toEqual([
      "a",
      "b",
      "e",
    ]);
    expect(nextMeetupEvents(events, groups, { city: "waterloo" }).map((item) => item.id)).toEqual(["c"]);
    expect(nextMeetupEvents(events, groups, { city: "Halifax" })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// OAuth2 JWT server flow
// ---------------------------------------------------------------------------

describe("buildMeetupJwtAssertion", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const now = new Date("2026-09-16T12:00:00Z");

  function verify(jwt: string, key: crypto.KeyObject): boolean {
    const [header, claims, signature] = jwt.split(".");
    return crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${header}.${claims}`, "utf8"),
      key,
      Buffer.from(signature, "base64url"),
    );
  }

  it("produces an RS256 JWT with Meetup's claims that verifies against the public key", () => {
    const jwt = buildMeetupJwtAssertion({ clientId: "client-key", memberId: "424242", privateKeyPem: pem, now });
    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);
    expect(jwt).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"))).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))).toEqual({
      sub: "424242",
      iss: "client-key",
      aud: "api.meetup.com",
      exp: Math.floor(now.getTime() / 1000) + 120,
    });
    expect(verify(jwt, publicKey)).toBe(true);
  });

  it("accepts a single-line PEM with literal \\n escapes (how it lands in env vars)", () => {
    const escaped = `"${pem.replace(/\n/g, "\\n")}"`;
    const jwt = buildMeetupJwtAssertion({ clientId: "c", memberId: "m", privateKeyPem: escaped, now });
    expect(verify(jwt, publicKey)).toBe(true);
  });

  it("does not verify against a different key", () => {
    const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwt = buildMeetupJwtAssertion({ clientId: "c", memberId: "m", privateKeyPem: pem, now });
    expect(verify(jwt, other.publicKey)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration: getMeetupNetwork() with a stubbed fetch
// ---------------------------------------------------------------------------

const MEETUP_ENV = [
  "MEETUP_PRO_URLNAME",
  "MEETUP_GROUP_URLNAMES",
  "MEETUP_ACCESS_TOKEN",
  "MEETUP_CLIENT_ID",
  "MEETUP_CLIENT_SECRET",
  "MEETUP_JWT_PRIVATE_KEY",
  "MEETUP_AUTHORIZED_MEMBER_ID",
] as const;
const savedEnv: Record<string, string | undefined> = {};

function vcalendar(...vevents: string[]): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Meetup//EN", ...vevents, "END:VCALENDAR"].join("\r\n");
}

function vevent(fields: { uid: string; start: string; summary: string; location?: string }): string {
  const lines = ["BEGIN:VEVENT", `UID:${fields.uid}`, `DTSTART:${fields.start}`, `SUMMARY:${fields.summary}`];
  if (fields.location) lines.push(`LOCATION:${fields.location}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

function icalFeed(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/calendar" } });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function icalUrl(urlname: string): string {
  return `https://www.meetup.com/${urlname}/events/ical/`;
}

type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;

/** Route stubbed fetches by URL; a thrown error becomes a rejected fetch. */
function stubFetch(handler: FetchHandler) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** A fresh module instance, so each test starts with an empty snapshot cache. */
async function loadFreshModule() {
  vi.resetModules();
  return import("./meetupNetwork");
}

describe("getMeetupNetwork", () => {
  beforeEach(() => {
    for (const key of MEETUP_ENV) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const key of MEETUP_ENV) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("serves the registry groups from their public iCal feeds with no credentials", async () => {
    const feeds: Record<string, string> = {
      [TORONTO]: vcalendar(
        vevent({
          uid: "event_300000001@meetup.com",
          start: "20351215T230000Z",
          summary: "Toronto December meetup",
          location: "The Rec Room\\, 255 Bremner Blvd\\, Toronto\\, ON",
        }),
        vevent({ uid: "event_300000003@meetup.com", start: "20351101T230000Z", summary: "Toronto November meetup" }),
        vevent({ uid: "event_200000000@meetup.com", start: "20200101T000000Z", summary: "Long ago" }),
      ),
      [VANCOUVER]: vcalendar(
        vevent({
          uid: "event_300000002@meetup.com",
          start: "20351120T030000Z",
          summary: "Vancouver social",
          location: "Steamworks\\, 375 Water St\\, Vancouver\\, BC",
        }),
      ),
      [KITCHENER]: vcalendar(), // nothing posted: valid, not an error
    };
    const fetchMock = stubFetch((url) => {
      if (url === icalUrl(VAUGHAN)) return icalFeed("", 500);
      if (url === icalUrl(MONCTON)) return icalFeed("<html>Please verify you are human</html>");
      for (const [urlname, body] of Object.entries(feeds)) {
        if (url === icalUrl(urlname)) return icalFeed(body);
      }
      return icalFeed("not found", 404);
    });

    const { getMeetupNetwork } = await loadFreshModule();
    const data = await getMeetupNetwork();

    expect(fetchMock).toHaveBeenCalledTimes(5);
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.sort()).toEqual(MEETUP_NETWORK_GROUPS.map((group) => icalUrl(group.urlname)).sort());
    expect(urls.some((url) => url.includes("api.meetup.com"))).toBe(false);

    expect(data.proUrlname).toBe(MEETUP_PRO_URLNAME_DEFAULT);
    expect(data.source).toBe("ical");
    expect(data.stale).toBe(false);
    expect(Date.parse(data.fetchedAt)).not.toBeNaN();

    // Upcoming only, soonest first; the 2020 event is filtered out.
    expect(data.events.map((item) => item.id)).toEqual([
      "event_300000003@meetup.com",
      "event_300000002@meetup.com",
      "event_300000001@meetup.com",
    ]);
    expect(data.events[2]).toMatchObject({
      groupUrlname: TORONTO,
      groupName: "Toronto Real Estate",
      title: "Toronto December meetup",
      venueName: "The Rec Room",
      venueAddress: "255 Bremner Blvd, Toronto, ON",
      city: "Toronto",
      url: `https://www.meetup.com/${TORONTO}/events/300000001/`,
      rsvpCount: null,
      imageUrl: null,
      source: "ical",
    });
    // No LOCATION in the feed: the registry city fills in.
    expect(data.events[0].city).toBe("Toronto");

    expect(data.groups).toHaveLength(5);
    expect(data.groups[0]).toMatchObject({
      urlname: TORONTO,
      url: `https://www.meetup.com/${TORONTO}/`,
      status: "active",
      memberCount: null,
    });
    expect(data.groups[0].nextEvent?.id).toBe("event_300000003@meetup.com");
    expect(data.groups[1].nextEvent?.id).toBe("event_300000002@meetup.com");
    expect(data.groups.find((group) => group.urlname === KITCHENER)?.nextEvent).toBeNull();

    // The two broken feeds are reported once, together.
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(console.warn).mock.calls[0][0])).toContain("iCal failed for 2 group(s)");

    // Past events on request; the snapshot is reused, not refetched.
    const withPast = await getMeetupNetwork({ includePast: true });
    expect(withPast.events[0].id).toBe("event_200000000@meetup.com");
    expect(withPast.events).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("dedupes concurrent refreshes into one fetch per group", async () => {
    const fetchMock = stubFetch(() => icalFeed(vcalendar()));
    const { getMeetupNetwork } = await loadFreshModule();
    const [a, b] = await Promise.all([getMeetupNetwork(), getMeetupNetwork()]);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(a.fetchedAt).toBe(b.fetchedAt);
    expect(a.source).toBe("empty");
  });

  it("merges MEETUP_GROUP_URLNAMES into the registry and honours MEETUP_PRO_URLNAME", async () => {
    process.env.MEETUP_GROUP_URLNAMES = ` ${CALGARY}, ${TORONTO} ,`;
    process.env.MEETUP_PRO_URLNAME = "some-other-network";
    const fetchMock = stubFetch((url) =>
      icalFeed(
        url === icalUrl(CALGARY)
          ? vcalendar(
              vevent({
                uid: "event_310000001@meetup.com",
                start: "20351002T000000Z",
                summary: "Calgary investor night",
                location: "Civic Tavern\\, 213 12 Ave SW\\, Calgary\\, AB",
              }),
            )
          : vcalendar(),
      ),
    );

    const { getMeetupNetwork } = await loadFreshModule();
    const data = await getMeetupNetwork();

    expect(fetchMock).toHaveBeenCalledTimes(6); // registry + Calgary; Toronto not fetched twice
    expect(data.proUrlname).toBe("some-other-network");
    expect(data.groups[5]).toMatchObject({
      urlname: CALGARY,
      name: "The Canadian Real Estate Investor Calgary",
      city: "",
      status: "active",
    });
    expect(data.groups[5].nextEvent).toMatchObject({ id: "event_310000001@meetup.com", city: "Calgary" });
  });

  it("falls back to iCal when the GraphQL query fails, logging once", async () => {
    process.env.MEETUP_ACCESS_TOKEN = "static-token";
    const fetchMock = stubFetch((url) => {
      if (url === MEETUP_GQL_ENDPOINT) {
        return jsonResponse({ errors: [{ message: 'Cannot query field "eventsSearch" on type "ProNetwork"' }] });
      }
      return icalFeed(
        url === icalUrl(TORONTO)
          ? vcalendar(vevent({ uid: "event_300000001@meetup.com", start: "20351215T230000Z", summary: "Toronto" }))
          : vcalendar(),
      );
    });

    const { getMeetupNetwork } = await loadFreshModule();
    const data = await getMeetupNetwork();

    const [gqlUrl, gqlInit] = fetchMock.mock.calls[0];
    expect(String(gqlUrl)).toBe(MEETUP_GQL_ENDPOINT);
    expect(gqlInit?.headers).toMatchObject({ Authorization: "Bearer static-token" });
    expect(JSON.parse(String(gqlInit?.body))).toMatchObject({
      variables: { urlname: MEETUP_PRO_URLNAME_DEFAULT },
    });
    expect(String(JSON.parse(String(gqlInit?.body)).query)).toContain("proNetwork(urlname: $urlname)");
    expect(fetchMock).toHaveBeenCalledTimes(1 + MEETUP_NETWORK_GROUPS.length);

    expect(data.source).toBe("ical");
    expect(data.stale).toBe(false);
    expect(data.events.map((item) => item.id)).toEqual(["event_300000001@meetup.com"]);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(console.warn).mock.calls[0][0])).toContain("GraphQL unavailable");
    expect(String(vi.mocked(console.warn).mock.calls[0][0])).toContain("Cannot query field");
  });

  it("mints a token through the JWT flow, merges the GraphQL network, and fills the rest from iCal", async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    process.env.MEETUP_CLIENT_ID = "client-key";
    process.env.MEETUP_CLIENT_SECRET = "client-secret";
    process.env.MEETUP_AUTHORIZED_MEMBER_ID = "424242";
    process.env.MEETUP_JWT_PRIVATE_KEY = pem.replace(/\n/g, "\\n");

    const calgaryEvent = {
      id: "310000001",
      title: "Calgary investor night",
      eventUrl: `https://www.meetup.com/${CALGARY}/events/310000001/`,
      description: "Doors at 6.",
      dateTime: "2035-10-02T18:00:00-06:00",
      endTime: null,
      duration: "PT2H",
      timezone: "America/Edmonton",
      going: 42,
      venue: { name: "Civic Tavern", address: "213 12 Ave SW", city: "Calgary", state: "AB" },
      group: { urlname: CALGARY, name: "Calgary Real Estate Investors", city: "Calgary" },
      featuredEventPhoto: { highResUrl: "https://img.example/calgary.jpg" },
    };
    const torontoEvent = {
      id: "310000002",
      title: "Toronto from GraphQL",
      dateTime: "2035-11-01T23:00:00Z",
      group: { urlname: TORONTO, name: "Toronto Real Estate" },
    };
    const network = {
      data: {
        proNetwork: {
          groupsSearch: {
            edges: [
              {
                node: {
                  id: "g1",
                  name: "Calgary Real Estate Investors",
                  urlname: CALGARY,
                  city: "Calgary",
                  state: "AB",
                  country: "ca",
                  memberships: { totalCount: 812 },
                },
              },
              { node: { id: "g2", name: "Toronto Real Estate (network)", urlname: TORONTO, city: "Toronto", state: "ON", memberships: { totalCount: 4100 } } },
              { node: { id: "g3", name: "No urlname, dropped" } },
            ],
          },
          eventsSearch: { edges: [{ node: calgaryEvent }, { node: torontoEvent }, { node: { id: "no-date" } }, {}] },
        },
      },
    };

    const calls: Array<{ url: string; init?: RequestInit }> = [];
    stubFetch((url, init) => {
      calls.push({ url, init });
      if (url === MEETUP_TOKEN_URL) {
        return jsonResponse({ access_token: "minted-token", token_type: "bearer", expires_in: 3600 });
      }
      if (url === MEETUP_GQL_ENDPOINT) return jsonResponse(network);
      return icalFeed(
        url === icalUrl(VANCOUVER)
          ? vcalendar(vevent({ uid: "event_300000002@meetup.com", start: "20351120T030000Z", summary: "Vancouver social" }))
          : vcalendar(),
      );
    });

    const { getMeetupNetwork } = await loadFreshModule();
    const data = await getMeetupNetwork();

    // 1. Token exchange: a signed jwt-bearer assertion, form-encoded.
    expect(calls[0].url).toBe(MEETUP_TOKEN_URL);
    expect(calls[0].init?.method).toBe("POST");
    expect(calls[0].init?.headers).toMatchObject({ "Content-Type": "application/x-www-form-urlencoded" });
    const form = new URLSearchParams(String(calls[0].init?.body));
    expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    const [header, claims, signature] = String(form.get("assertion")).split(".");
    expect(JSON.parse(Buffer.from(claims, "base64url").toString("utf8"))).toMatchObject({
      sub: "424242",
      iss: "client-key",
      aud: "api.meetup.com",
    });
    expect(
      crypto.verify("RSA-SHA256", Buffer.from(`${header}.${claims}`), publicKey, Buffer.from(signature, "base64url")),
    ).toBe(true);

    // 2. GraphQL with the minted token.
    expect(calls[1].url).toBe(MEETUP_GQL_ENDPOINT);
    expect(calls[1].init?.headers).toMatchObject({ Authorization: "Bearer minted-token" });

    // 3. iCal only for the groups GraphQL did not cover.
    const icalUrls = calls.map((call) => call.url).filter((url) => url.endsWith("/events/ical/"));
    expect(icalUrls.sort()).toEqual([KITCHENER, MONCTON, VANCOUVER, VAUGHAN].map(icalUrl).sort());

    expect(data.source).toBe("mixed");
    expect(data.stale).toBe(false);
    expect(data.groups.map((group) => group.urlname)).toEqual([TORONTO, VANCOUVER, KITCHENER, VAUGHAN, MONCTON, CALGARY]);
    expect(data.groups[0]).toMatchObject({
      name: "Toronto Real Estate (network)",
      city: "Toronto",
      province: "ON",
      status: "active",
      memberCount: 4100,
    });
    expect(data.groups[5]).toMatchObject({
      name: "Calgary Real Estate Investors",
      city: "Calgary",
      province: "AB",
      status: "active",
      memberCount: 812,
      url: `https://www.meetup.com/${CALGARY}/`,
    });
    expect(data.groups[5].nextEvent).toEqual({
      id: "310000001",
      groupUrlname: CALGARY,
      groupName: "Calgary Real Estate Investors",
      title: "Calgary investor night",
      startsAt: "2035-10-03T00:00:00.000Z",
      endsAt: "2035-10-03T02:00:00.000Z", // dateTime + duration
      timezone: "America/Edmonton",
      venueName: "Civic Tavern",
      venueAddress: "213 12 Ave SW, Calgary, AB",
      city: "Calgary",
      description: "Doors at 6.",
      url: `https://www.meetup.com/${CALGARY}/events/310000001/`,
      rsvpCount: 42,
      imageUrl: "https://img.example/calgary.jpg",
      source: "graphql",
    });
    // Sparse node: every missing field degrades to null, the link is derived.
    expect(data.groups[0].nextEvent).toMatchObject({
      id: "310000002",
      city: null,
      venueName: null,
      rsvpCount: null,
      url: `https://www.meetup.com/${TORONTO}/events/310000002/`,
      source: "graphql",
    });
    expect(data.events.map((item) => item.id)).toEqual(["310000001", "310000002", "event_300000002@meetup.com"]);
  });

  it("caches the minted access token until it nears expiry", async () => {
    const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    process.env.MEETUP_CLIENT_ID = "client-key";
    process.env.MEETUP_AUTHORIZED_MEMBER_ID = "424242";
    process.env.MEETUP_JWT_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    const fetchMock = stubFetch(() => jsonResponse({ access_token: "minted-token", expires_in: 600 }));

    const { getMeetupAccessToken } = await loadFreshModule();
    const t0 = new Date("2026-09-16T12:00:00Z");
    expect(await getMeetupAccessToken(t0)).toBe("minted-token");
    expect(await getMeetupAccessToken(new Date(t0.getTime() + 500 * 1000))).toBe("minted-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // expires_in - 60s has elapsed: mint again.
    expect(await getMeetupAccessToken(new Date(t0.getTime() + 541 * 1000))).toBe("minted-token");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("serves the previous snapshot with stale: true when a refresh fails outright", async () => {
    vi.useFakeTimers();
    let healthy = true;
    const fetchMock = stubFetch((url) => {
      if (!healthy) throw new Error("ECONNRESET");
      return icalFeed(
        url === icalUrl(TORONTO)
          ? vcalendar(vevent({ uid: "event_300000001@meetup.com", start: "20351215T230000Z", summary: "Toronto" }))
          : vcalendar(),
      );
    });

    const { getMeetupNetwork, invalidateMeetupNetworkCache } = await loadFreshModule();
    const first = await getMeetupNetwork();
    expect(first.stale).toBe(false);
    expect(first.events).toHaveLength(1);

    // Within the TTL nothing is refetched, even though the network is down.
    healthy = false;
    vi.advanceTimersByTime(19 * 60 * 1000);
    expect((await getMeetupNetwork()).stale).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(5);

    // Past the TTL the refresh is attempted, fails everywhere, and the old
    // snapshot is served flagged as stale.
    vi.advanceTimersByTime(2 * 60 * 1000);
    const second = await getMeetupNetwork();
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(second.stale).toBe(true);
    expect(second.fetchedAt).toBe(first.fetchedAt);
    expect(second.events.map((item) => item.id)).toEqual(["event_300000001@meetup.com"]);

    // With nothing cached at all, the registry is still served, flagged.
    invalidateMeetupNetworkCache();
    const third = await getMeetupNetwork();
    expect(third).toMatchObject({ source: "empty", stale: true, events: [] });
    expect(third.groups.map((group) => group.urlname)).toEqual(MEETUP_NETWORK_GROUPS.map((group) => group.urlname));
    expect(third.groups.every((group) => group.nextEvent === null)).toBe(true);
  });

  it("keeps a group's previous events when only its feed fails", async () => {
    vi.useFakeTimers();
    let torontoDown = false;
    const fetchMock = stubFetch((url) => {
      if (url === icalUrl(TORONTO)) {
        if (torontoDown) return icalFeed("", 503);
        return icalFeed(vcalendar(vevent({ uid: "event_300000001@meetup.com", start: "20351215T230000Z", summary: "Toronto" })));
      }
      return icalFeed(vcalendar());
    });

    const { getMeetupNetwork } = await loadFreshModule();
    await getMeetupNetwork();
    torontoDown = true;
    vi.advanceTimersByTime(21 * 60 * 1000);
    const data = await getMeetupNetwork();

    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(data.stale).toBe(false); // the refresh as a whole succeeded
    expect(data.events.map((item) => item.id)).toEqual(["event_300000001@meetup.com"]);
    expect(String(vi.mocked(console.warn).mock.calls.at(-1)?.[0])).toContain(`${TORONTO} (HTTP 503)`);
  });
});
