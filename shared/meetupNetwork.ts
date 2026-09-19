/**
 * Meetup.com network — registry, public types, and pure helpers shared by the
 * server feed (server/meetupNetwork.ts) and any client that renders it.
 *
 * Nothing here touches Node APIs or the environment. The server module reads
 * env vars, fetches, and caches; this file only knows what "The Canadian Real
 * Estate Investor" Meetup Pro network looks like and how to reason about it.
 */

/** Meetup Pro network urlname (https://www.meetup.com/pro/<urlname>/). */
export const MEETUP_PRO_URLNAME_DEFAULT = "the-canadian-real-estate-investor";

/**
 * Lifecycle of a city group inside the network:
 *  - active:     hosting regularly; list it everywhere.
 *  - transition: changing hosts/venues; list it but do not promote it.
 *  - closing:    winding down; keep for archive links only.
 */
export type MeetupGroupStatus = "active" | "transition" | "closing";

export interface MeetupNetworkGroup {
  /** Meetup group urlname — the path segment in https://www.meetup.com/<urlname>/. */
  urlname: string;
  name: string;
  city: string;
  /** Two-letter province code (ON, BC, …). */
  province: string;
  status: MeetupGroupStatus;
}

/**
 * Groups verified via their public iCal feeds (2026-09-16). The remaining
 * network groups — Calgary, Edmonton, Halifax, Montreal, Ottawa, Mississauga,
 * Durham, Hamilton, London, … — are discovered automatically from the Pro
 * network via GraphQL once MEETUP_* credentials exist, or can be appended here
 * or through MEETUP_GROUP_URLNAMES (server/meetupNetwork.ts).
 */
export const MEETUP_NETWORK_GROUPS: MeetupNetworkGroup[] = [
  {
    // `canadian-real-estate-investor-toronto` is an old alias that redirects here.
    urlname: "toronto-real-estate-realist",
    name: "Toronto Real Estate",
    city: "Toronto",
    province: "ON",
    status: "active",
  },
  {
    urlname: "the-canadian-real-estate-investor-podcast-vancouver-group",
    name: "Vancouver Real Estate Investors",
    city: "Vancouver",
    province: "BC",
    status: "active",
  },
  {
    urlname: "the-canadian-real-estate-investor-kitchener-waterloo",
    name: "Kitchener Waterloo Real Estate",
    city: "Kitchener-Waterloo",
    province: "ON",
    status: "transition",
  },
  {
    urlname: "the-canadian-real-estate-investor-podcast-vaughan-group",
    name: "Vaughan Real Estate",
    city: "Vaughan",
    province: "ON",
    status: "transition",
  },
  {
    urlname: "canadian-real-estate-investors-meetups-moncton",
    name: "Moncton Real Estate Investor - In person meet up",
    city: "Moncton",
    province: "NB",
    status: "active",
  },
  {
    urlname: "calgary-real-estate",
    name: "Calgary Real Estate",
    city: "Calgary",
    province: "AB",
    status: "active",
  },
  {
    urlname: "canadian-real-estate-investor-meetups-prince-edward-island",
    name: "Prince Edward Island Real Estate",
    city: "Charlottetown",
    province: "PE",
    status: "active",
  },
];

// ---------------------------------------------------------------------------
// Public types (shared with the client)
// ---------------------------------------------------------------------------

export type MeetupEventSource = "graphql" | "ical";

export interface MeetupEvent {
  /** GraphQL event id, or the ICS UID ("event_123@meetup.com") from the feed. */
  id: string;
  groupUrlname: string;
  groupName: string | null;
  title: string;
  /** ISO 8601 UTC instant. */
  startsAt: string;
  /** ISO 8601 UTC instant, or null when the source omits an end. */
  endsAt: string | null;
  /** IANA timezone declared by the source, for display. */
  timezone: string | null;
  venueName: string | null;
  venueAddress: string | null;
  /** Best-effort city: venue city, else parsed from the address, else the group's. */
  city: string | null;
  description: string | null;
  url: string;
  /** GraphQL-only extras; null from the iCal branch. */
  rsvpCount: number | null;
  imageUrl: string | null;
  source: MeetupEventSource;
}

/** A group as the Pro-network GraphQL query reports it; only urlname is certain. */
export interface MeetupDiscoveredGroup {
  urlname: string;
  name?: string | null;
  city?: string | null;
  province?: string | null;
  memberCount?: number | null;
}

/** Registry ∪ discovered, before events are attached. */
export interface MeetupMergedGroup extends MeetupNetworkGroup {
  memberCount: number | null;
}

export interface MeetupNetworkGroupSummary extends MeetupMergedGroup {
  url: string;
  nextEvent: MeetupEvent | null;
}

/** Which strategy produced the events in a response. */
export type MeetupNetworkSource = "graphql" | "ical" | "mixed" | "empty";

export interface MeetupNetworkResponse {
  proUrlname: string;
  groups: MeetupNetworkGroupSummary[];
  /** Deduped, soonest first; upcoming only unless the caller asked for past events. */
  events: MeetupEvent[];
  source: MeetupNetworkSource;
  /** ISO instant of the snapshot behind this response. */
  fetchedAt: string;
  /**
   * True when the response is not backed by a fresh successful refresh: an
   * older snapshot served after a failed refresh (stale beats broken), or an
   * empty response because nothing has ever loaded.
   */
  stale: boolean;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Meetup urlnames are case-insensitive; compare and dedupe on this key. */
export function meetupUrlnameKey(urlname: string): string {
  return urlname.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
}

/** Public group page. */
export function meetupGroupUrl(urlname: string): string {
  return `https://www.meetup.com/${meetupUrlnameKey(urlname)}/`;
}

/** Public iCal feed of a group's upcoming events (no auth required). */
export function meetupGroupIcalUrl(urlname: string): string {
  return `${meetupGroupUrl(urlname)}events/ical/`;
}

/**
 * Placeholder registry entry for a group known only by urlname (from
 * MEETUP_GROUP_URLNAMES). The GraphQL branch fills in name/city when it runs.
 */
export function meetupGroupFromUrlname(urlname: string): MeetupNetworkGroup {
  const key = meetupUrlnameKey(urlname);
  const name = key
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return { urlname: key, name: name || key, city: "", province: "", status: "active" };
}

/**
 * Registry ∪ discovered, deduped by urlname (case-insensitive, first spelling
 * kept). Discovered data wins for name and memberCount; the registry's status
 * and city/province win whenever they are present — the registry is where a
 * human recorded that Vaughan is in transition, and Meetup's own city field is
 * sometimes a suburb or blank. Groups only the network knows about default to
 * "active".
 */
export function mergeGroupLists(
  registry: MeetupNetworkGroup[],
  discovered: MeetupDiscoveredGroup[],
): MeetupMergedGroup[] {
  const merged = new Map<string, MeetupMergedGroup>();

  for (const group of registry) {
    const key = meetupUrlnameKey(group.urlname);
    if (!key || merged.has(key)) continue;
    merged.set(key, { ...group, memberCount: null });
  }

  for (const found of discovered) {
    const key = meetupUrlnameKey(found.urlname);
    if (!key) continue;
    const name = found.name?.trim() || "";
    const city = found.city?.trim() || "";
    const province = found.province?.trim() || "";
    const memberCount = typeof found.memberCount === "number" ? found.memberCount : null;
    const existing = merged.get(key);
    if (existing) {
      merged.set(key, {
        ...existing,
        name: name || existing.name,
        city: existing.city || city,
        province: existing.province || province,
        memberCount: memberCount ?? existing.memberCount,
      });
      continue;
    }
    merged.set(key, {
      urlname: key,
      name: name || meetupGroupFromUrlname(key).name,
      city,
      province,
      status: "active",
      memberCount,
    });
  }

  return [...merged.values()];
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
