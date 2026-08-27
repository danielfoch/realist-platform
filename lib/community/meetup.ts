/**
 * Meetup.com event source for /community.
 *
 * Two strategies, tried in order:
 *
 * 1. OAUTH (optional upgrade): when MEETUP_ACCESS_TOKEN is set, query the
 *    Meetup GraphQL API for richer data (RSVP counts, event images). Any
 *    failure — network, auth, schema drift — falls through to the iCal feed.
 * 2. PUBLIC (primary, zero auth): fetch + parse the group's public iCal feed
 *    at https://www.meetup.com/<urlname>/events/ical/. The small RFC 5545
 *    parser below is dependency-free and deliberately forgiving — a broken
 *    property should drop one field, never the whole feed.
 *
 * Same caching contract as lib/podcast/feed.ts: one in-memory cache with a
 * 30-minute TTL, deduped in-flight fetch, stale-beats-broken on refresh
 * failure.
 */

export interface MeetupEvent {
  uid: string;
  title: string;
  /** ISO 8601 UTC instant. */
  startsAt: string;
  /** ISO 8601 UTC instant, or null when the feed omits DTEND. */
  endsAt: string | null;
  /** IANA timezone declared by the feed (DTSTART;TZID=…), for display. */
  timezone: string | null;
  location: string | null;
  description: string | null;
  url: string | null;
  /** GraphQL-only extras; null from the iCal branch. */
  rsvpCount: number | null;
  imageUrl: string | null;
}

export function getMeetupGroupUrlname(): string | null {
  return getMeetupGroupUrlnames()[0] ?? null;
}

/**
 * The CREI meetup network spans many city groups with inconsistent urlnames
 * (canadian-real-estate-investor-toronto,
 * the-canadian-real-estate-investor-podcast-vancouver-group, …), so the env
 * var accepts a comma-separated list; events merge across all of them.
 */
export function getMeetupGroupUrlnames(): string[] {
  return (process.env.MEETUP_GROUP_URLNAME ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

/** Public group page, or null while the integration is unconfigured. */
export function getMeetupGroupUrl(): string | null {
  const urlname = getMeetupGroupUrlname();
  return urlname ? `https://www.meetup.com/${urlname}/` : null;
}

// ---------------------------------------------------------------------------
// ICS parsing (pure, unit-tested)
// ---------------------------------------------------------------------------

/**
 * Unfold RFC 5545 folded lines (CRLF or LF followed by one space/tab
 * continues the previous line) and split into logical lines.
 */
export function unfoldIcsLines(ics: string): string[] {
  return ics
    .replace(/\r?\n[ \t]/g, "")
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
}

/** Unescape ICS TEXT values: \n → newline, \, → ",", \; → ";", \\ → "\". */
export function unescapeIcsText(value: string): string {
  return value.replace(/\\([nN;,\\])/g, (_, ch: string) =>
    ch === "n" || ch === "N" ? "\n" : ch,
  );
}

export interface IcsProperty {
  name: string;
  params: Record<string, string>;
  /** Raw (still-escaped) value; callers unescape TEXT properties. */
  value: string;
}

/** Split on a separator, ignoring separators inside double-quoted params. */
function splitOutsideQuotes(input: string, separator: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of input) {
    if (ch === '"') inQuotes = !inQuotes;
    if (ch === separator && !inQuotes) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/** Parse one unfolded content line ("NAME;PARAM=V:value") or null. */
export function parseIcsProperty(line: string): IcsProperty | null {
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ":" && !inQuotes) {
      colon = i;
      break;
    }
  }
  if (colon <= 0) return null;

  const [rawName, ...rawParams] = splitOutsideQuotes(line.slice(0, colon), ";");
  const params: Record<string, string> = {};
  for (const raw of rawParams) {
    const eq = raw.indexOf("=");
    if (eq <= 0) continue;
    params[raw.slice(0, eq).trim().toUpperCase()] = raw
      .slice(eq + 1)
      .trim()
      .replace(/^"(.*)"$/, "$1");
  }
  return { name: rawName.trim().toUpperCase(), params, value: line.slice(colon + 1) };
}

/** Offset (ms) of `timeZone` relative to UTC at the given UTC instant. */
function tzOffsetMs(timeZone: string, utcMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const fields: Record<string, number> = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) {
    if (part.type !== "literal") fields[part.type] = parseInt(part.value, 10);
  }
  const asUtc = Date.UTC(
    fields.year,
    (fields.month ?? 1) - 1,
    fields.day ?? 1,
    fields.hour === 24 ? 0 : (fields.hour ?? 0),
    fields.minute ?? 0,
    fields.second ?? 0,
  );
  return asUtc - utcMs;
}

const ICS_DATE_RE = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/;

/**
 * Parse an ICS DATE or DATE-TIME value into a UTC ISO instant.
 * - Trailing "Z" → UTC.
 * - With a TZID param → wall-clock time in that IANA zone (DST-aware via
 *   Intl; an unknown zone degrades to a UTC reading rather than throwing).
 * - Floating (no Z, no TZID) and all-day DATE values are read as UTC — a
 *   documented compromise that keeps the parser dependency-free.
 */
export function parseIcsDate(
  value: string,
  tzid?: string,
): { iso: string; timezone: string | null } | null {
  const match = ICS_DATE_RE.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h = "0", mi = "0", s = "0", zulu] = match;
  const year = parseInt(y, 10);
  const month = parseInt(mo, 10);
  const day = parseInt(d, 10);
  const hour = parseInt(h, 10);
  const minute = parseInt(mi, 10);
  const second = parseInt(s, 10);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(asUtc)) return null;

  if (!zulu && tzid) {
    try {
      // Iterate twice so instants near a DST transition settle correctly.
      let offset = tzOffsetMs(tzid, asUtc);
      offset = tzOffsetMs(tzid, asUtc - offset);
      return { iso: new Date(asUtc - offset).toISOString(), timezone: tzid };
    } catch {
      // Unknown/invalid TZID: fall through to the UTC reading.
    }
  }
  return { iso: new Date(asUtc).toISOString(), timezone: null };
}

/** Meetup UIDs look like "event_123456789@meetup.com" — recover the link. */
export function meetupEventUrlFromUid(uid: string, groupUrlname?: string): string | null {
  if (!groupUrlname) return null;
  const match = /^event_([a-z0-9-]+)@meetup\.com$/i.exec(uid.trim());
  return match ? `https://www.meetup.com/${groupUrlname}/events/${match[1]}/` : null;
}

/**
 * Parse VEVENT blocks out of an iCal document. VTIMEZONE (and anything else
 * that is not a top-level VEVENT property — VALARM, STANDARD, DAYLIGHT) is
 * ignored via the component stack, so their DTSTART lines never leak into
 * events. Events missing DTSTART are dropped; every other field degrades to
 * null.
 */
export function parseIcsEvents(ics: string, groupUrlname?: string): MeetupEvent[] {
  const events: MeetupEvent[] = [];
  const stack: string[] = [];
  let props: Map<string, IcsProperty> | null = null;

  for (const line of unfoldIcsLines(ics)) {
    const upper = line.toUpperCase();
    if (upper.startsWith("BEGIN:")) {
      const component = upper.slice(6).trim();
      stack.push(component);
      if (component === "VEVENT") props = new Map();
      continue;
    }
    if (upper.startsWith("END:")) {
      const component = upper.slice(4).trim();
      if (component === "VEVENT" && props) {
        const event = buildEvent(props, groupUrlname);
        if (event) events.push(event);
        props = null;
      }
      // Pop back to the matching BEGIN if the file is well-formed; shrug if not.
      const at = stack.lastIndexOf(component);
      if (at >= 0) stack.length = at;
      continue;
    }
    if (props && stack[stack.length - 1] === "VEVENT") {
      const prop = parseIcsProperty(line);
      if (prop && !props.has(prop.name)) props.set(prop.name, prop);
    }
  }

  return events;
}

function buildEvent(
  props: Map<string, IcsProperty>,
  groupUrlname?: string,
): MeetupEvent | null {
  const dtstart = props.get("DTSTART");
  if (!dtstart) return null;
  const start = parseIcsDate(dtstart.value, dtstart.params.TZID);
  if (!start) return null;

  const dtend = props.get("DTEND");
  const end = dtend
    ? parseIcsDate(dtend.value, dtend.params.TZID ?? dtstart.params.TZID)
    : null;

  const title = props.get("SUMMARY")
    ? unescapeIcsText(props.get("SUMMARY")!.value.trim())
    : "Meetup event";
  const uid = props.get("UID")?.value.trim() || `${start.iso}:${title}`;
  const location = props.get("LOCATION")
    ? unescapeIcsText(props.get("LOCATION")!.value.trim()) || null
    : null;
  const description = props.get("DESCRIPTION")
    ? unescapeIcsText(props.get("DESCRIPTION")!.value.trim()) || null
    : null;
  const url =
    props.get("URL")?.value.trim() || meetupEventUrlFromUid(uid, groupUrlname);

  return {
    uid,
    title,
    startsAt: start.iso,
    endsAt: end?.iso ?? null,
    timezone: start.timezone,
    location,
    description,
    url: url || null,
    rsvpCount: null,
    imageUrl: null,
  };
}

/** Future events (grace window keeps tonight's meetup listed), soonest first. */
export function upcomingEvents(
  events: MeetupEvent[],
  now: Date = new Date(),
  graceMs = 6 * 60 * 60 * 1000,
): MeetupEvent[] {
  const cutoff = now.getTime() - graceMs;
  return events
    .filter((event) => Date.parse(event.startsAt) >= cutoff)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

/**
 * Best-effort city from a Meetup LOCATION line ("Venue, 255 Bremner Blvd,
 * Toronto, ON" → "Toronto"). Heuristic, display-only.
 */
export function cityFromLocation(location: string | null): string | null {
  if (!location) return null;
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  while (parts.length > 1 && /^(canada|usa|united states)$/i.test(parts[parts.length - 1])) {
    parts.pop();
  }
  if (parts.length === 0) return null;
  const last = parts[parts.length - 1];
  // Province segment may carry a postal code ("ON M5V 2T6").
  const provinceLike =
    (/^(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\b/i.test(last) &&
      (last.length <= 2 || /^[A-Z]{2}[\s.]/i.test(last))) ||
    /^(alberta|british columbia|manitoba|new brunswick|newfoundland( and labrador)?|nova scotia|northwest territories|nunavut|ontario|prince edward island|quebec|québec|saskatchewan|yukon)$/i.test(
      last,
    );
  if (provinceLike) return parts.length >= 2 ? parts[parts.length - 2] : null;
  return parts.length >= 2 ? last : parts[0];
}

// ---------------------------------------------------------------------------
// Fetching: OAuth GraphQL upgrade → public iCal fallback
// ---------------------------------------------------------------------------

const ICAL_FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; Realist/1.0)",
  Accept: "text/calendar, text/plain, */*",
};

async function fetchEventsFromIcal(urlname: string): Promise<MeetupEvent[]> {
  const response = await fetch(`https://www.meetup.com/${urlname}/events/ical/`, {
    headers: ICAL_FETCH_HEADERS,
    // One cache with one TTL (the in-memory layer below), same as the podcast feed.
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Meetup iCal fetch failed: ${response.status}`);
  return parseIcsEvents(await response.text(), urlname);
}

/** Kept deliberately thin: any failure here falls back to the iCal feed. */
const MEETUP_GQL_QUERY = `
  query realistUpcomingEvents($urlname: String!) {
    groupByUrlname(urlname: $urlname) {
      upcomingEvents(input: { first: 20 }) {
        edges {
          node {
            id
            title
            description
            dateTime
            endTime
            timezone
            eventUrl
            going
            imageUrl
            venue { name address city }
          }
        }
      }
    }
  }
`;

function toIsoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

async function fetchEventsFromGraphql(
  urlname: string,
  accessToken: string,
): Promise<MeetupEvent[]> {
  const response = await fetch("https://api.meetup.com/gql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: MEETUP_GQL_QUERY, variables: { urlname } }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Meetup GraphQL failed: ${response.status}`);

  const json = (await response.json()) as {
    errors?: unknown[];
    data?: {
      groupByUrlname?: {
        upcomingEvents?: { edges?: Array<{ node?: Record<string, unknown> }> };
      } | null;
    };
  };
  if (json.errors?.length) throw new Error("Meetup GraphQL returned errors");
  const edges = json.data?.groupByUrlname?.upcomingEvents?.edges;
  if (!Array.isArray(edges)) throw new Error("Meetup GraphQL returned no events");

  const events: MeetupEvent[] = [];
  for (const edge of edges) {
    const node = edge?.node;
    if (!node) continue;
    const startsAt = toIsoOrNull(node.dateTime);
    if (!startsAt) continue;
    const venue = (node.venue ?? null) as
      | { name?: unknown; address?: unknown; city?: unknown }
      | null;
    const location =
      venue
        ? [venue.name, venue.address, venue.city]
            .filter((part): part is string => typeof part === "string" && part.length > 0)
            .join(", ") || null
        : null;
    events.push({
      uid: typeof node.id === "string" ? node.id : startsAt,
      title: typeof node.title === "string" ? node.title : "Meetup event",
      startsAt,
      endsAt: toIsoOrNull(node.endTime),
      timezone: typeof node.timezone === "string" ? node.timezone : null,
      location,
      description: typeof node.description === "string" ? node.description : null,
      url: typeof node.eventUrl === "string" ? node.eventUrl : null,
      rsvpCount: typeof node.going === "number" ? node.going : null,
      imageUrl: typeof node.imageUrl === "string" ? node.imageUrl : null,
    });
  }
  return events;
}

async function fetchMeetupEvents(urlname: string): Promise<MeetupEvent[]> {
  const accessToken = process.env.MEETUP_ACCESS_TOKEN?.trim();
  if (accessToken) {
    try {
      return await fetchEventsFromGraphql(urlname, accessToken);
    } catch {
      // Fall through: the public feed needs no auth and always exists.
    }
  }
  return fetchEventsFromIcal(urlname);
}

// ---------------------------------------------------------------------------
// In-memory cache (30 min TTL, deduped in-flight fetch, stale-on-error)
// ---------------------------------------------------------------------------

const MEETUP_TTL_MS = 30 * 60 * 1000;

let cache: { events: MeetupEvent[]; fetchedAt: number } | null = null;
let inflight: Promise<MeetupEvent[]> | null = null;

/**
 * Cached upcoming events, soonest first. Returns [] when the integration is
 * unconfigured (no MEETUP_GROUP_URLNAME) or the feed has never loaded — the
 * community page renders a complete document either way.
 */
export async function getUpcomingMeetupEvents(): Promise<MeetupEvent[]> {
  const urlnames = getMeetupGroupUrlnames();
  if (urlnames.length === 0) return [];

  if (cache && Date.now() - cache.fetchedAt < MEETUP_TTL_MS) {
    return upcomingEvents(cache.events);
  }
  if (!inflight) {
    inflight = Promise.allSettled(urlnames.map((urlname) => fetchMeetupEvents(urlname)))
      .then((results) => {
        const fulfilled = results.filter(
          (result): result is PromiseFulfilledResult<MeetupEvent[]> =>
            result.status === "fulfilled",
        );
        if (fulfilled.length === 0) throw new Error("every meetup group feed failed");
        const byUid = new Map(
          fulfilled.flatMap((result) => result.value).map((event) => [event.uid, event]),
        );
        const events = [...byUid.values()];
        cache = { events, fetchedAt: Date.now() };
        return events;
      })
      .finally(() => {
        inflight = null;
      });
  }
  try {
    return upcomingEvents(await inflight);
  } catch {
    if (cache) return upcomingEvents(cache.events); // stale beats broken
    return [];
  }
}
