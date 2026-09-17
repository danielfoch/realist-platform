/**
 * One calendar out of three event sources.
 *
 * realist.ca lists community events from three places that historically did
 * not agree with each other:
 *
 *   - Meetup.com  — the Pro network's city groups (calendar of record for the
 *                   free monthly meetups; RSVPs live there)
 *   - Eventbrite  — some cities' meetups plus ticketed flagship events
 *   - Realist     — native events in realist_events (flagship pages, member
 *                   meetups, the Monday Deal Room)
 *
 * This module normalizes each into one `CalendarEvent`, dedupes the same
 * meetup posted on two systems (same city, same local date), and offers the
 * groupings the /meetups page and the homepage strip render. Pure and
 * dependency-free so it runs on the client and under vitest.
 */

export type CalendarSource = "meetup" | "eventbrite" | "realist";

export interface CalendarEvent {
  /** `${source}:${id}` — unique across sources. */
  key: string;
  source: CalendarSource;
  id: string;
  title: string;
  /** ISO 8601 instant. */
  startsAt: string;
  endsAt: string | null;
  /** IANA zone for display; null when the source does not say. */
  timezone: string | null;
  /** Normalized city label (see normalizeCity), or null when unknown. */
  city: string | null;
  venueName: string | null;
  venueAddress: string | null;
  /** Where the RSVP actually happens. Realist events point at /events/:slug. */
  url: string;
  rsvpCount: number | null;
  isFree: boolean;
  /** Meetup group urlname, when the event came from Meetup.com. */
  groupUrlname: string | null;
  /** Realist event slug, when native. */
  slug: string | null;
}

// ---------------------------------------------------------------------------
// Input shapes (structural, so this module does not import server types)
// ---------------------------------------------------------------------------

export interface MeetupEventLike {
  id: string;
  groupUrlname: string;
  groupName?: string | null;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  timezone?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  city?: string | null;
  url: string;
  rsvpCount?: number | null;
}

export interface EventbriteEventLike {
  id: string;
  name: string;
  startDate: string;
  endDate?: string | null;
  timezone?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  eventUrl: string;
  /** Eventbrite marks free events; absent means unknown → treated as free for meetups. */
  isFree?: boolean | null;
}

export interface RealistEventLike {
  id: string;
  slug: string;
  title: string;
  startsAt: string | Date;
  endsAt?: string | Date | null;
  timezone?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  city?: string | null;
  kind?: string | null;
  rsvpCount?: number | null;
  minPriceCents?: number | null;
}

// ---------------------------------------------------------------------------
// City normalization
// ---------------------------------------------------------------------------

/**
 * Suburbs and alternate spellings collapse onto the meetup city they belong
 * to, so "Pickering" (where the Durham meetup meets) and "Durham" are one
 * card, and "Kitchener" and "Waterloo" are one card.
 */
const CITY_ALIASES: Record<string, string> = {
  pickering: "Durham Region",
  ajax: "Durham Region",
  whitby: "Durham Region",
  oshawa: "Durham Region",
  durham: "Durham Region",
  "durham region": "Durham Region",
  kitchener: "Kitchener-Waterloo",
  waterloo: "Kitchener-Waterloo",
  "kitchener waterloo": "Kitchener-Waterloo",
  "kitchener-waterloo": "Kitchener-Waterloo",
  kw: "Kitchener-Waterloo",
  montréal: "Montreal",
  québec: "Quebec City",
  "st. john's": "St. John's",
  "st johns": "St. John's",
  "saint john's": "St. John's",
  yeg: "Edmonton",
  yyc: "Calgary",
  yvr: "Vancouver",
  gta: "Toronto",
};

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((part) => (/^[\s-]+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
}

/** Trim, drop a trailing province ("Ottawa, ON" → "Ottawa"), apply aliases, title-case. */
export function normalizeCity(city: string | null | undefined): string | null {
  if (!city) return null;
  let value = city.trim();
  if (!value) return null;
  value = value.split(",")[0].trim();
  const alias = CITY_ALIASES[value.toLowerCase()];
  if (alias) return alias;
  return titleCase(value);
}

/**
 * The network names events "<City> Real Estate Meetup" (Eventbrite) or
 * "<City> Real Estate Investors" (Meetup.com group names). Pull the city out
 * of that pattern; null when the title does not follow it.
 */
const NOT_A_CITY = new Set(["the", "canadian", "realist", "monthly", "free", "unpacking", "live", "online", "virtual"]);

export function cityFromEventName(name: string | null | undefined): string | null {
  if (!name) return null;
  const match = name.match(/^\s*(?:the\s+)?([A-Za-zÀ-ÿ.'\- ]+?)\s+(?:real\s+estate|investors?|meetup)\b/i);
  if (!match) return null;
  const words = match[1].trim().split(/\s+/).filter(Boolean);
  // A city is one to three words and never one of the network's own brand words.
  if (words.length === 0 || words.length > 3) return null;
  if (words.some((word) => NOT_A_CITY.has(word.toLowerCase()))) return null;
  return normalizeCity(words.join(" "));
}

/** Last resort: the city is usually the second comma-separated part of a Canadian address. */
export function cityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  // "329 March Road, Ottawa, ON K2K 2E1" → parts[1] = "Ottawa"
  const candidate = parts.length >= 3 ? parts[parts.length - 2] : parts[1];
  const withoutPostal = candidate.replace(/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i, "").replace(/\b(ON|QC|BC|AB|MB|SK|NS|NB|PE|NL|YT|NT|NU)\b/, "").trim();
  return normalizeCity(withoutPostal || null);
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function normalizeMeetupEvent(event: MeetupEventLike): CalendarEvent {
  const city =
    normalizeCity(event.city) ?? cityFromEventName(event.groupName) ?? cityFromEventName(event.title) ?? cityFromAddress(event.venueAddress);
  return {
    key: `meetup:${event.id}`,
    source: "meetup",
    id: event.id,
    title: event.title,
    startsAt: toIso(event.startsAt),
    endsAt: event.endsAt ? toIso(event.endsAt) : null,
    timezone: event.timezone ?? null,
    city,
    venueName: event.venueName ?? null,
    venueAddress: event.venueAddress ?? null,
    url: event.url,
    rsvpCount: event.rsvpCount ?? null,
    isFree: true,
    groupUrlname: event.groupUrlname,
    slug: null,
  };
}

export function normalizeEventbriteEvent(event: EventbriteEventLike): CalendarEvent {
  const city = cityFromEventName(event.name) ?? cityFromAddress(event.venueAddress);
  return {
    key: `eventbrite:${event.id}`,
    source: "eventbrite",
    id: event.id,
    title: event.name,
    startsAt: toIso(event.startDate),
    endsAt: event.endDate ? toIso(event.endDate) : null,
    timezone: event.timezone ?? null,
    city,
    venueName: event.venueName ?? null,
    venueAddress: event.venueAddress ?? null,
    url: event.eventUrl,
    rsvpCount: null,
    isFree: event.isFree ?? /meetup/i.test(event.name),
    groupUrlname: null,
    slug: null,
  };
}

export function normalizeRealistEvent(event: RealistEventLike): CalendarEvent {
  return {
    key: `realist:${event.id}`,
    source: "realist",
    id: event.id,
    title: event.title,
    startsAt: toIso(event.startsAt),
    endsAt: event.endsAt ? toIso(event.endsAt) : null,
    timezone: event.timezone ?? null,
    city: normalizeCity(event.city) ?? cityFromEventName(event.title) ?? cityFromAddress(event.venueAddress),
    venueName: event.venueName ?? null,
    venueAddress: event.venueAddress ?? null,
    url: `/events/${event.slug}`,
    rsvpCount: event.rsvpCount ?? null,
    isFree: event.kind === "meetup" || event.minPriceCents === 0 || event.minPriceCents == null,
    groupUrlname: null,
    slug: event.slug,
  };
}

// ---------------------------------------------------------------------------
// Merge, dedupe, group
// ---------------------------------------------------------------------------

/** YYYY-MM-DD of the instant in the event's own zone (falls back to Toronto). */
export function localDateKey(iso: string, timezone: string | null): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Which copy wins when the same meetup is posted on two systems. A native
 * Realist event keeps the RSVP in-house; otherwise Meetup.com is the calendar
 * of record; Eventbrite is the fallback.
 */
const SOURCE_PRIORITY: Record<CalendarSource, number> = { realist: 0, meetup: 1, eventbrite: 2 };

/**
 * Same city + same local date = same meetup. Events without a city never
 * dedupe against each other (a missing city is not evidence of sameness).
 */
export function dedupeCalendar(events: CalendarEvent[]): CalendarEvent[] {
  const byKey = new Map<string, CalendarEvent>();
  const passthrough: CalendarEvent[] = [];
  for (const event of events) {
    if (!event.city) {
      passthrough.push(event);
      continue;
    }
    const key = `${event.city.toLowerCase()}|${localDateKey(event.startsAt, event.timezone)}`;
    const existing = byKey.get(key);
    if (!existing || SOURCE_PRIORITY[event.source] < SOURCE_PRIORITY[existing.source]) {
      // Carry the RSVP count across when the winner does not have one.
      byKey.set(key, existing && existing.rsvpCount != null && event.rsvpCount == null ? { ...event, rsvpCount: existing.rsvpCount } : event);
    } else if (existing.rsvpCount == null && event.rsvpCount != null) {
      byKey.set(key, { ...existing, rsvpCount: event.rsvpCount });
    }
  }
  return sortByStart([...byKey.values(), ...passthrough]);
}

export function sortByStart(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

/** Events that have not finished yet (a meetup in progress still shows for a few hours). */
export function upcomingCalendar(events: CalendarEvent[], now: Date = new Date(), graceHours = 4): CalendarEvent[] {
  const cutoff = now.getTime() - graceHours * 60 * 60 * 1000;
  return sortByStart(events.filter((event) => new Date(event.startsAt).getTime() >= cutoff));
}

export function groupByCity(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of sortByStart(events)) {
    const city = event.city ?? "Online & other";
    if (!groups.has(city)) groups.set(city, []);
    groups.get(city)!.push(event);
  }
  return groups;
}

/** The soonest event per city, keyed by normalized city. */
export function nextByCity(events: CalendarEvent[]): Map<string, CalendarEvent> {
  const next = new Map<string, CalendarEvent>();
  for (const event of sortByStart(events)) {
    if (!event.city || next.has(event.city)) continue;
    next.set(event.city, event);
  }
  return next;
}

/** Build the merged, deduped, upcoming calendar in one call. */
export function buildCalendar(input: {
  meetup?: MeetupEventLike[];
  eventbrite?: EventbriteEventLike[];
  realist?: RealistEventLike[];
  now?: Date;
}): CalendarEvent[] {
  const all = [
    ...(input.realist ?? []).map(normalizeRealistEvent),
    ...(input.meetup ?? []).map(normalizeMeetupEvent),
    ...(input.eventbrite ?? []).map(normalizeEventbriteEvent),
  ];
  return upcomingCalendar(dedupeCalendar(all), input.now ?? new Date());
}

/**
 * The network meets monthly on the second Tuesday. For a city with nothing
 * posted yet, this is the honest "expected next date" to show instead of a
 * blank card. Returns the next second Tuesday strictly after `now` in
 * Toronto time, at 18:00.
 */
export function nextSecondTuesday(now: Date = new Date()): Date {
  for (let offset = 0; offset < 3; offset += 1) {
    const year = now.getFullYear();
    const month = now.getMonth() + offset;
    const first = new Date(year, month, 1, 18, 0, 0, 0);
    const firstDay = first.getDay(); // 0 Sun … 2 Tue
    const daysUntilTuesday = (2 - firstDay + 7) % 7;
    const second = new Date(year, month, 1 + daysUntilTuesday + 7, 18, 0, 0, 0);
    if (second.getTime() > now.getTime()) return second;
  }
  return new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);
}
