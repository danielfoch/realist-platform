/**
 * Meetup.com network feed — every upcoming meetup across the Meetup Pro
 * network "The Canadian Real Estate Investor" (~17 city groups), served to the
 * site as one list.
 *
 * Two strategies, tried in order (ported from realist-lean
 * lib/community/meetup.ts and widened from one group to the whole network):
 *
 * 1. GRAPHQL (needs credentials): one `proNetwork` query against
 *    https://api.meetup.com/gql-ext returns the member groups AND their
 *    upcoming events, with RSVP counts and photos. Any failure — token,
 *    network, HTTP, schema drift — is logged once and falls through. The
 *    query lives in MEETUP_PRO_NETWORK_QUERY and every field is parsed as
 *    optional, because the live schema may not match it exactly.
 * 2. ICAL (zero auth, always available): each group's public feed at
 *    https://www.meetup.com/<urlname>/events/ical/ is fetched in parallel and
 *    parsed by the dependency-free RFC 5545 parser below. Groups come from the
 *    registry in shared/meetupNetwork.ts, MEETUP_GROUP_URLNAMES, and (when
 *    GraphQL worked) the discovered network; groups whose events GraphQL
 *    already returned are skipped. A feed with zero VEVENTs is a valid answer
 *    — most groups have nothing posted most of the time.
 *
 * Cache: one in-memory snapshot with a 20-minute TTL, a deduped in-flight
 * refresh, and stale-beats-broken (an old snapshot is served with
 * `stale: true` when a refresh fails outright; a group whose feed fails keeps
 * its previous events).
 *
 * Environment (all optional — with nothing set, the iCal path serves the
 * registry groups):
 *   MEETUP_PRO_URLNAME           Pro network urlname
 *                                (default "the-canadian-real-estate-investor").
 *   MEETUP_GROUP_URLNAMES        Comma-separated extra group urlnames merged
 *                                with the registry, for groups not yet listed
 *                                in shared/meetupNetwork.ts.
 *   MEETUP_ACCESS_TOKEN          Static OAuth bearer token. When set it is used
 *                                as-is and the JWT flow is skipped.
 *   MEETUP_CLIENT_ID             OAuth consumer key (the JWT `iss`).
 *   MEETUP_CLIENT_SECRET         OAuth consumer secret. Not needed by the JWT
 *                                grant itself; accepted so the consumer's four
 *                                settings can be pasted together.
 *   MEETUP_JWT_PRIVATE_KEY       PEM RSA private key whose public half is
 *                                registered on the consumer. Literal "\n"
 *                                escapes are accepted so it fits on one line.
 *   MEETUP_AUTHORIZED_MEMBER_ID  Meetup member id the consumer acts as (the
 *                                JWT `sub`); must be an admin of the network.
 *
 * Routes (registerMeetupNetworkRoutes):
 *   GET /api/meetups/network[?includePast=1]   → MeetupNetworkResponse
 *   GET /api/meetups/next?city=<name>&limit=3  → next events, optionally per city
 */

import crypto from "crypto";
// Express's Response is aliased so the global fetch Response keeps its name below.
import type { Express, Request, Response as ExpressResponse } from "express";
import {
  MEETUP_NETWORK_GROUPS,
  MEETUP_PRO_URLNAME_DEFAULT,
  cityFromLocation,
  meetupGroupFromUrlname,
  meetupGroupIcalUrl,
  meetupGroupUrl,
  meetupUrlnameKey,
  mergeGroupLists,
  type MeetupDiscoveredGroup,
  type MeetupEvent,
  type MeetupMergedGroup,
  type MeetupNetworkGroup,
  type MeetupNetworkResponse,
  type MeetupNetworkSource,
} from "@shared/meetupNetwork";

export const MEETUP_TOKEN_URL = "https://secure.meetup.com/oauth2/access";
export const MEETUP_GQL_ENDPOINT = "https://api.meetup.com/gql-ext";
export const MEETUP_JWT_AUDIENCE = "api.meetup.com";

const SNAPSHOT_TTL_MS = 20 * 60 * 1000;
/** Tonight's meetup stays listed for a few hours after doors open. */
const UPCOMING_GRACE_MS = 3 * 60 * 60 * 1000;
const ICAL_TIMEOUT_MS = 8_000;
const GRAPHQL_TIMEOUT_MS = 10_000;
const TOKEN_TIMEOUT_MS = 10_000;
const JWT_TTL_SECONDS = 120;

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function getMeetupProUrlname(): string {
  return meetupUrlnameKey(env("MEETUP_PRO_URLNAME")) || MEETUP_PRO_URLNAME_DEFAULT;
}

/** Registry groups plus any extra urlnames from MEETUP_GROUP_URLNAMES. */
export function getRegistryGroups(): MeetupNetworkGroup[] {
  const extra = env("MEETUP_GROUP_URLNAMES")
    .split(",")
    .map((urlname) => meetupUrlnameKey(urlname))
    .filter(Boolean)
    .map((urlname) => meetupGroupFromUrlname(urlname));
  return [...MEETUP_NETWORK_GROUPS, ...extra];
}

export interface MeetupJwtCredentials {
  clientId: string;
  memberId: string;
  privateKeyPem: string;
}

/** The JWT server-flow credentials, or null unless all three are present. */
function readJwtCredentials(): MeetupJwtCredentials | null {
  const clientId = env("MEETUP_CLIENT_ID");
  const memberId = env("MEETUP_AUTHORIZED_MEMBER_ID");
  const privateKeyPem = env("MEETUP_JWT_PRIVATE_KEY");
  if (!clientId || !memberId || !privateKeyPem) return null;
  return { clientId, memberId, privateKeyPem };
}

// ---------------------------------------------------------------------------
// OAuth2 JWT server flow (pure builder + cached token)
// ---------------------------------------------------------------------------

/** Accept a PEM pasted on one line with literal "\n" escapes and/or quotes. */
export function normalizePrivateKeyPem(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n")
    .trim();
}

function base64Url(input: string | Buffer): string {
  return (typeof input === "string" ? Buffer.from(input, "utf8") : input).toString("base64url");
}

/**
 * Signed assertion for Meetup's OAuth2 JWT flow: header {alg: RS256, typ: JWT},
 * claims {sub: member, iss: client, aud: api.meetup.com, exp: now + 120s},
 * RS256 over the private key registered on the OAuth consumer.
 */
export function buildMeetupJwtAssertion(input: {
  clientId: string;
  memberId: string;
  privateKeyPem: string;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    sub: input.memberId,
    iss: input.clientId,
    aud: MEETUP_JWT_AUDIENCE,
    exp: Math.floor(now.getTime() / 1000) + JWT_TTL_SECONDS,
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const signature = crypto.sign(
    "RSA-SHA256",
    Buffer.from(signingInput, "utf8"),
    normalizePrivateKeyPem(input.privateKeyPem),
  );
  return `${signingInput}.${base64Url(signature)}`;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Bearer token for the GraphQL API: the static MEETUP_ACCESS_TOKEN when set,
 * else one minted through the JWT flow and cached for `expires_in - 60s`.
 * Returns null when no credentials are configured; throws when they are but
 * the exchange fails (the caller logs and falls back to iCal).
 */
export async function getMeetupAccessToken(now: Date = new Date()): Promise<string | null> {
  const staticToken = env("MEETUP_ACCESS_TOKEN");
  if (staticToken) return staticToken;

  const credentials = readJwtCredentials();
  if (!credentials) return null;
  if (tokenCache && now.getTime() < tokenCache.expiresAt) return tokenCache.token;

  const assertion = buildMeetupJwtAssertion({ ...credentials, now });
  const response = await fetchWithTimeout(
    MEETUP_TOKEN_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
    },
    TOKEN_TIMEOUT_MS,
  );
  if (!response.ok) throw new Error(`token request failed: HTTP ${response.status}`);

  const json = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
  if (typeof json.access_token !== "string" || !json.access_token) {
    throw new Error("token response had no access_token");
  }
  const expiresIn =
    typeof json.expires_in === "number" && json.expires_in > 0 ? json.expires_in : 3600;
  tokenCache = {
    token: json.access_token,
    expiresAt: now.getTime() + Math.max(expiresIn - 60, 30) * 1000,
  };
  return tokenCache.token;
}

// ---------------------------------------------------------------------------
// GraphQL branch (Pro network: groups + upcoming events in one query)
// ---------------------------------------------------------------------------

/**
 * Kept in one place because the live gql-ext schema may spell some of these
 * differently (e.g. `filter` as a sibling argument of `input`, `going` as
 * `rsvps { yesCount }`). Any error here falls through to the iCal feeds.
 */
export const MEETUP_PRO_NETWORK_QUERY = `
  query realistMeetupNetwork($urlname: String!) {
    proNetwork(urlname: $urlname) {
      groupsSearch(input: { first: 60 }) {
        edges {
          node {
            id
            name
            urlname
            city
            state
            country
            memberships { totalCount }
          }
        }
      }
      eventsSearch(input: { first: 100, filter: { status: UPCOMING } }) {
        edges {
          node {
            id
            title
            eventUrl
            description
            dateTime
            endTime
            duration
            timezone
            going
            venue { name address city state }
            group { urlname name city }
            featuredEventPhoto { highResUrl }
          }
        }
      }
    }
  }
`;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toIsoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** Relay-style `{ edges: [{ node }] }` → the node records, tolerating any shape. */
function nodesOf(connection: unknown): UnknownRecord[] {
  const edges = asRecord(connection)?.edges;
  if (!Array.isArray(edges)) return [];
  return edges.map((edge) => asRecord(asRecord(edge)?.node)).filter((node): node is UnknownRecord => !!node);
}

const ISO_DURATION_RE = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i;

/** Meetup's `duration` is an ISO 8601 duration ("PT2H"); tolerate milliseconds too. */
export function parseDurationMs(value: unknown): number | null {
  if (typeof value === "number") return value > 0 ? value : null;
  if (typeof value !== "string") return null;
  const match = ISO_DURATION_RE.exec(value.trim());
  if (!match) return null;
  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  const ms =
    ((Number(days) * 24 + Number(hours)) * 60 + Number(minutes)) * 60 * 1000 + Number(seconds) * 1000;
  return ms > 0 ? ms : null;
}

function parseGraphqlGroup(node: UnknownRecord): MeetupDiscoveredGroup | null {
  const urlname = asString(node.urlname);
  if (!urlname) return null;
  return {
    urlname,
    name: asString(node.name),
    city: asString(node.city),
    province: asString(node.state),
    memberCount: asNumber(asRecord(node.memberships)?.totalCount),
  };
}

function parseGraphqlEvent(node: UnknownRecord): MeetupEvent | null {
  const startsAt = toIsoOrNull(node.dateTime);
  if (!startsAt) return null;
  const id = asString(node.id) ?? startsAt;
  const group = asRecord(node.group);
  const venue = asRecord(node.venue);
  const groupUrlname = asString(group?.urlname) ?? "";
  const durationMs = parseDurationMs(node.duration);
  const address = [asString(venue?.address), asString(venue?.city), asString(venue?.state)]
    .filter((part): part is string => !!part)
    .join(", ");
  return {
    id,
    groupUrlname,
    groupName: asString(group?.name),
    title: asString(node.title) ?? "Meetup event",
    startsAt,
    endsAt:
      toIsoOrNull(node.endTime) ??
      (durationMs ? new Date(Date.parse(startsAt) + durationMs).toISOString() : null),
    timezone: asString(node.timezone),
    venueName: asString(venue?.name),
    venueAddress: address || null,
    city: asString(venue?.city) ?? asString(group?.city),
    description: asString(node.description),
    url:
      asString(node.eventUrl) ??
      (groupUrlname ? `${meetupGroupUrl(groupUrlname)}events/${id}/` : `https://www.meetup.com/`),
    rsvpCount: asNumber(node.going),
    imageUrl: asString(asRecord(node.featuredEventPhoto)?.highResUrl),
    source: "graphql",
  };
}

interface GraphqlNetwork {
  groups: MeetupDiscoveredGroup[];
  events: MeetupEvent[];
}

async function fetchNetworkFromGraphql(proUrlname: string, token: string): Promise<GraphqlNetwork> {
  const response = await fetchWithTimeout(
    MEETUP_GQL_ENDPOINT,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: MEETUP_PRO_NETWORK_QUERY, variables: { urlname: proUrlname } }),
    },
    GRAPHQL_TIMEOUT_MS,
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const json = asRecord(await response.json());
  const errors = json?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = asString(asRecord(errors[0])?.message) ?? "unknown error";
    throw new Error(`GraphQL errors (${errors.length}): ${first}`);
  }
  const network = asRecord(asRecord(json?.data)?.proNetwork);
  if (!network) throw new Error("proNetwork missing from response");

  return {
    groups: nodesOf(network.groupsSearch)
      .map(parseGraphqlGroup)
      .filter((group): group is MeetupDiscoveredGroup => !!group),
    events: nodesOf(network.eventsSearch)
      .map(parseGraphqlEvent)
      .filter((event): event is MeetupEvent => !!event),
  };
}

let lastGraphqlFailure: string | null = null;

/** GraphQL network, or null (logged once per distinct failure) when unavailable. */
async function tryGraphql(proUrlname: string): Promise<GraphqlNetwork | null> {
  try {
    const token = await getMeetupAccessToken();
    if (!token) return null;
    const network = await fetchNetworkFromGraphql(proUrlname, token);
    lastGraphqlFailure = null;
    return network;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (lastGraphqlFailure !== message) {
      lastGraphqlFailure = message;
      console.warn(`[meetup-network] GraphQL unavailable (${message}); using public iCal feeds`);
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// ICS parsing (pure, unit-tested; ported from realist-lean)
// ---------------------------------------------------------------------------

/** One VEVENT as the feed describes it, before it is attributed to a group. */
export interface IcsEvent {
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
  location: string | null;
  description: string | null;
  url: string | null;
}

/**
 * Unfold RFC 5545 folded lines (CRLF or LF followed by one space/tab continues
 * the previous line) and split into logical lines.
 */
export function unfoldIcsLines(ics: string): string[] {
  return ics
    .replace(/\r?\n[ \t]/g, "")
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
}

/** Unescape ICS TEXT values: \n → newline, \, → ",", \; → ";", \\ → "\". */
export function unescapeIcsText(value: string): string {
  return value.replace(/\\([nN;,\\])/g, (_, ch: string) => (ch === "n" || ch === "N" ? "\n" : ch));
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
 * - With a TZID param → wall-clock time in that IANA zone (DST-aware via Intl;
 *   an unknown zone degrades to a UTC reading rather than throwing).
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
  const asUtc = Date.UTC(
    parseInt(y, 10),
    parseInt(mo, 10) - 1,
    parseInt(d, 10),
    parseInt(h, 10),
    parseInt(mi, 10),
    parseInt(s, 10),
  );
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
  return match ? `${meetupGroupUrl(groupUrlname)}events/${match[1]}/` : null;
}

/**
 * Parse VEVENT blocks out of an iCal document. VTIMEZONE (and anything else
 * that is not a top-level VEVENT property — VALARM, STANDARD, DAYLIGHT) is
 * ignored via the component stack, so their DTSTART lines never leak into
 * events. Events missing DTSTART are dropped; every other field degrades to
 * null.
 */
export function parseIcsEvents(ics: string, groupUrlname?: string): IcsEvent[] {
  const events: IcsEvent[] = [];
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
        const event = buildIcsEvent(props, groupUrlname);
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

function buildIcsEvent(props: Map<string, IcsProperty>, groupUrlname?: string): IcsEvent | null {
  const dtstart = props.get("DTSTART");
  if (!dtstart) return null;
  const start = parseIcsDate(dtstart.value, dtstart.params.TZID);
  if (!start) return null;

  const dtend = props.get("DTEND");
  const end = dtend ? parseIcsDate(dtend.value, dtend.params.TZID ?? dtstart.params.TZID) : null;

  const text = (name: string): string | null => {
    const prop = props.get(name);
    if (!prop) return null;
    return unescapeIcsText(prop.value.trim()) || null;
  };
  const title = text("SUMMARY") ?? "Meetup event";
  const uid = props.get("UID")?.value.trim() || `${start.iso}:${title}`;
  const url = props.get("URL")?.value.trim() || meetupEventUrlFromUid(uid, groupUrlname);

  return {
    uid,
    title,
    startsAt: start.iso,
    endsAt: end?.iso ?? null,
    timezone: start.timezone,
    location: text("LOCATION"),
    description: text("DESCRIPTION"),
    url: url || null,
  };
}

/**
 * Meetup writes LOCATION as "Venue, street, city, province". With three or
 * more segments the first is the venue name; shorter strings ("Online event",
 * "Toronto, ON") have no venue to split off.
 */
export function splitIcsLocation(location: string | null): {
  venueName: string | null;
  venueAddress: string | null;
} {
  if (!location) return { venueName: null, venueAddress: null };
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 3) return { venueName: parts[0], venueAddress: parts.slice(1).join(", ") };
  return { venueName: null, venueAddress: parts.join(", ") || null };
}

/** Attribute a parsed VEVENT to its group and lift it to the public shape. */
export function icsEventToMeetupEvent(event: IcsEvent, group: MeetupNetworkGroup): MeetupEvent {
  const { venueName, venueAddress } = splitIcsLocation(event.location);
  return {
    id: event.uid,
    groupUrlname: group.urlname,
    groupName: group.name || null,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
    venueName,
    venueAddress,
    city: cityFromLocation(event.location) ?? (group.city || null),
    description: event.description,
    url: event.url ?? `${meetupGroupUrl(group.urlname)}events/`,
    rsvpCount: null,
    imageUrl: null,
    source: "ical",
  };
}

// ---------------------------------------------------------------------------
// iCal branch (public feeds, fetched in parallel)
// ---------------------------------------------------------------------------

const ICAL_FETCH_HEADERS = {
  // Meetup serves the feed to browsers but 403s bare/bot user agents.
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/calendar, text/plain, */*",
  "Accept-Language": "en-CA,en;q=0.9",
};

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchIcalEvents(group: MeetupNetworkGroup): Promise<MeetupEvent[]> {
  const response = await fetchWithTimeout(
    meetupGroupIcalUrl(group.urlname),
    { headers: ICAL_FETCH_HEADERS },
    ICAL_TIMEOUT_MS,
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  // A bot wall or error page comes back 200 with HTML; do not mistake it for "no events".
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("response is not an iCal document");
  return parseIcsEvents(text, group.urlname).map((event) => icsEventToMeetupEvent(event, group));
}

interface IcalResult {
  events: MeetupEvent[];
  succeeded: number;
  failed: number;
}

/**
 * Every group's feed in parallel. A failed feed keeps that group's events from
 * the previous snapshot (per-group stale-beats-broken) and is reported in one
 * aggregated warning rather than one line per group.
 */
async function fetchIcalForGroups(
  groups: MeetupNetworkGroup[],
  previous: MeetupEvent[],
): Promise<IcalResult> {
  const results = await Promise.allSettled(groups.map((group) => fetchIcalEvents(group)));
  const events: MeetupEvent[] = [];
  const failures: string[] = [];
  results.forEach((result, index) => {
    const group = groups[index];
    if (result.status === "fulfilled") {
      events.push(...result.value);
      return;
    }
    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
    failures.push(`${group.urlname} (${reason})`);
    events.push(...previous.filter((event) => sameGroup(event.groupUrlname, group.urlname)));
  });
  if (failures.length > 0) {
    console.warn(`[meetup-network] iCal failed for ${failures.length} group(s): ${failures.join(", ")}`);
  }
  return { events, succeeded: results.length - failures.length, failed: failures.length };
}

// ---------------------------------------------------------------------------
// Merge helpers (pure, unit-tested)
// ---------------------------------------------------------------------------

function sameGroup(a: string, b: string): boolean {
  return meetupUrlnameKey(a) === meetupUrlnameKey(b);
}

/**
 * Identity for dedupe across sources: GraphQL reports "123456789", the iCal
 * feed "event_123456789@meetup.com" — the same event.
 */
export function meetupEventKey(event: Pick<MeetupEvent, "id">): string {
  const match = /^event_([a-z0-9-]+)@meetup\.com$/i.exec(event.id.trim());
  return (match ? match[1] : event.id.trim()).toLowerCase();
}

/** First occurrence wins, so list the richer (GraphQL) events first. */
export function dedupeMeetupEvents(events: MeetupEvent[]): MeetupEvent[] {
  const seen = new Map<string, MeetupEvent>();
  for (const event of events) {
    const key = meetupEventKey(event);
    if (!seen.has(key)) seen.set(key, event);
  }
  return [...seen.values()];
}

export function sortMeetupEvents(events: MeetupEvent[]): MeetupEvent[] {
  return [...events].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

/** Future events (grace window keeps tonight's meetup listed), soonest first. */
export function upcomingMeetupEvents(
  events: MeetupEvent[],
  now: Date = new Date(),
  graceMs: number = UPCOMING_GRACE_MS,
): MeetupEvent[] {
  const cutoff = now.getTime() - graceMs;
  return sortMeetupEvents(events.filter((event) => Date.parse(event.startsAt) >= cutoff));
}

function normalizeCity(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Next `limit` events, optionally for one city. The match is case-insensitive
 * and forgiving in both directions ("waterloo" finds Kitchener-Waterloo), and
 * a group's home city counts too — a Toronto group meeting in Mississauga is
 * still what someone asking for Toronto wants.
 */
export function nextMeetupEvents(
  events: MeetupEvent[],
  groups: Pick<MeetupNetworkGroup, "urlname" | "city">[],
  options: { city?: string | null; limit?: number } = {},
): MeetupEvent[] {
  const wanted = normalizeCity(options.city);
  const limit = Math.max(1, Math.floor(options.limit ?? 3));
  const groupCity = new Map(groups.map((group) => [meetupUrlnameKey(group.urlname), normalizeCity(group.city)]));
  const matches = (candidate: string): boolean =>
    candidate.length > 0 && (candidate.includes(wanted) || wanted.includes(candidate));
  const filtered = wanted
    ? events.filter(
        (event) =>
          matches(normalizeCity(event.city)) ||
          matches(groupCity.get(meetupUrlnameKey(event.groupUrlname)) ?? ""),
      )
    : events;
  return filtered.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Snapshot cache (20 min TTL, deduped in-flight refresh, stale-beats-broken)
// ---------------------------------------------------------------------------

interface Snapshot {
  proUrlname: string;
  groups: MeetupMergedGroup[];
  /** Every event we know about, past ones included; filtered per request. */
  events: MeetupEvent[];
  source: MeetupNetworkSource;
  fetchedAt: number;
}

let snapshot: Snapshot | null = null;
let inflight: Promise<Snapshot> | null = null;

/**
 * One full refresh: GraphQL for the network when credentials allow, then the
 * public iCal feeds for every group GraphQL did not cover. Throws only when
 * nothing at all succeeded, so the caller can fall back to the old snapshot.
 */
async function refreshSnapshot(previous: Snapshot | null): Promise<Snapshot> {
  const proUrlname = getMeetupProUrlname();
  const graphql = await tryGraphql(proUrlname);
  const groups = mergeGroupLists(getRegistryGroups(), graphql?.groups ?? []);

  // Trust GraphQL's event list for the groups it knows about only when it
  // actually returned events; an empty answer may be schema drift, so the
  // feeds are consulted for everyone in that case.
  const coveredByGraphql = new Set(
    graphql && graphql.events.length > 0 ? graphql.groups.map((group) => meetupUrlnameKey(group.urlname)) : [],
  );
  const icalTargets = groups.filter((group) => !coveredByGraphql.has(meetupUrlnameKey(group.urlname)));
  const ical = await fetchIcalForGroups(icalTargets, previous?.events ?? []);

  if (!graphql && icalTargets.length > 0 && ical.succeeded === 0) {
    throw new Error(`all ${ical.failed} iCal feed(s) failed and GraphQL is unavailable`);
  }

  const graphqlEvents = graphql?.events ?? [];
  const events = sortMeetupEvents(dedupeMeetupEvents([...graphqlEvents, ...ical.events]));
  const source: MeetupNetworkSource =
    graphqlEvents.length > 0 && ical.events.length > 0
      ? "mixed"
      : graphqlEvents.length > 0
        ? "graphql"
        : ical.events.length > 0
          ? "ical"
          : "empty";

  return { proUrlname, groups, events, source, fetchedAt: Date.now() };
}

export interface MeetupNetworkOptions {
  /** Include events that already happened (default: upcoming only). */
  includePast?: boolean;
}

function toResponse(snap: Snapshot, stale: boolean, options: MeetupNetworkOptions): MeetupNetworkResponse {
  const upcoming = upcomingMeetupEvents(snap.events);
  return {
    proUrlname: snap.proUrlname,
    groups: snap.groups.map((group) => ({
      ...group,
      url: meetupGroupUrl(group.urlname),
      nextEvent: upcoming.find((event) => sameGroup(event.groupUrlname, group.urlname)) ?? null,
    })),
    events: options.includePast ? sortMeetupEvents(snap.events) : upcoming,
    source: snap.source,
    fetchedAt: new Date(snap.fetchedAt).toISOString(),
    stale,
  };
}

/**
 * The network feed, served from the snapshot while it is fresh. A failed
 * refresh serves the previous snapshot with `stale: true`; with no snapshot at
 * all it serves the registry groups and no events rather than throwing.
 */
export async function getMeetupNetwork(options: MeetupNetworkOptions = {}): Promise<MeetupNetworkResponse> {
  if (snapshot && Date.now() - snapshot.fetchedAt < SNAPSHOT_TTL_MS) {
    return toResponse(snapshot, false, options);
  }
  if (!inflight) {
    inflight = refreshSnapshot(snapshot)
      .then((fresh) => {
        snapshot = fresh;
        return fresh;
      })
      .finally(() => {
        inflight = null;
      });
  }
  try {
    return toResponse(await inflight, false, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (snapshot) {
      console.warn(`[meetup-network] refresh failed (${message}); serving stale snapshot`);
      return toResponse(snapshot, true, options);
    }
    console.error(`[meetup-network] refresh failed with nothing cached (${message})`);
    return toResponse(
      {
        proUrlname: getMeetupProUrlname(),
        groups: mergeGroupLists(getRegistryGroups(), []),
        events: [],
        source: "empty",
        fetchedAt: Date.now(),
      },
      true,
      options,
    );
  }
}

/** Drop the snapshot and any cached token so the next request refetches. */
export function invalidateMeetupNetworkCache(): void {
  snapshot = null;
  tokenCache = null;
  lastGraphqlFailure = null;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

function queryString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function queryFlag(value: unknown): boolean {
  const text = queryString(value).toLowerCase();
  return text === "1" || text === "true";
}

function queryLimit(value: unknown, fallback: number, max: number): number {
  const parsed = parseInt(queryString(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function registerMeetupNetworkRoutes(app: Express): void {
  // Whole network: groups (with their next event) plus every upcoming event.
  app.get("/api/meetups/network", async (req: Request, res: ExpressResponse) => {
    try {
      const data = await getMeetupNetwork({ includePast: queryFlag(req.query.includePast) });
      res.set("Cache-Control", "public, max-age=300");
      res.json(data);
    } catch (error) {
      console.error("[meetup-network] network route failed:", error);
      res.status(502).json({ error: "Meetup network feed unavailable" });
    }
  });

  // The next few events, network-wide or for one city (case-insensitive).
  app.get("/api/meetups/next", async (req: Request, res: ExpressResponse) => {
    try {
      const city = queryString(req.query.city) || null;
      const limit = queryLimit(req.query.limit, 3, 20);
      const data = await getMeetupNetwork();
      res.set("Cache-Control", "public, max-age=300");
      res.json({
        city,
        limit,
        events: nextMeetupEvents(data.events, data.groups, { city, limit }),
        source: data.source,
        fetchedAt: data.fetchedAt,
        stale: data.stale,
      });
    } catch (error) {
      console.error("[meetup-network] next route failed:", error);
      res.status(502).json({ error: "Meetup network feed unavailable" });
    }
  });
}
