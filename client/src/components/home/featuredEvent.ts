/**
 * Pure display logic for the homepage featured-event frame, kept apart from
 * the component so it can run under vitest's node environment.
 */

export type FeaturedEventResponse = {
  event: {
    slug: string;
    title: string;
    shortDescription: string | null;
    headerImageUrl: string | null;
    startsAt: string;
    endsAt: string | null;
    timezone: string;
    venueName: string | null;
    venueAddress: string | null;
    city: string | null;
    kind: "flagship" | "meetup";
    minPriceCents: number | null;
  } | null;
};

export type DisplayEvent = {
  title: string;
  tagline: string | null;
  description: string | null;
  href: string;
  heroImage: string | null;
  dateLabel: string;
  timeLabel: string | null;
  venueTitle: string | null;
  venueDetail: string | null;
  audienceLabel: string | null;
  ticketBadge: string | null;
  ticketNote: string;
  kicker: string;
};

/**
 * Events with a bespoke marketing page (own pixel funnel, richer copy) should
 * land there instead of the generic /events/:slug template.
 */
export const STATIC_EVENT_PATHS: Record<string, string> = {
  "unpacking-multiplexes-toronto": "/community/events/unpacking-multiplexes-toronto",
};

export function formatEventSchedule(startsAtIso: string, endsAtIso: string | null, timezone: string) {
  const startsAt = new Date(startsAtIso);
  if (Number.isNaN(startsAt.getTime())) return { dateLabel: null, timeLabel: null };
  const timeZone = timezone || "America/Toronto";
  const dateLabel = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(startsAt);
  const timeFormat = new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  });
  const startTime = timeFormat.format(startsAt);
  const endsAt = endsAtIso ? new Date(endsAtIso) : null;
  if (!endsAt || Number.isNaN(endsAt.getTime())) return { dateLabel, timeLabel: startTime };
  // "5:00 p.m. EDT" twice reads noisy; strip the zone from the start half.
  const startWithoutZone = new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(startsAt);
  return { dateLabel, timeLabel: `${startWithoutZone} to ${timeFormat.format(endsAt)}` };
}

export function toDisplayEvent(event: NonNullable<FeaturedEventResponse["event"]>): DisplayEvent | null {
  const { dateLabel, timeLabel } = formatEventSchedule(event.startsAt, event.endsAt, event.timezone);
  if (!dateLabel) return null;
  const isFree = event.kind === "meetup" || event.minPriceCents === 0;
  return {
    title: event.title,
    tagline: event.shortDescription,
    description: null,
    href: STATIC_EVENT_PATHS[event.slug] ?? `/events/${event.slug}`,
    heroImage: event.headerImageUrl,
    dateLabel,
    timeLabel,
    venueTitle: event.venueName || event.city,
    venueDetail: event.venueAddress || (event.venueName ? event.city : null),
    audienceLabel: null,
    ticketBadge: isFree ? "Free to attend" : event.minPriceCents != null ? "Tickets on sale now" : null,
    ticketNote: isFree ? "RSVP on the event page" : "Ticketing details on the event page",
    kicker: event.city ? `${event.city} event` : "Realist event",
  };
}
