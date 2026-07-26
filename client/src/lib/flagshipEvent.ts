/**
 * Single source of truth for the current flagship event.
 *
 * The same event was hardcoded in three places — FlagshipEventBanner, the
 * EventPromoFrame fallback, and (partly) featuredEvent.ts — and they had already
 * drifted: two different taglines for the same evening. Anything promoting the
 * flagship should import from here so a date change is one edit, not a hunt.
 *
 * Every consumer must respect `hasEnded()`. A promo bar advertising a date that
 * has passed is worse than no promo bar: it reads as an abandoned site.
 */

export interface FlagshipEvent {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  href: string;
  heroImage: string;
  dateLabel: string;
  timeLabel: string;
  venueTitle: string;
  venueDetail: string;
  audienceLabel: string;
  ticketBadge: string;
  ticketNote: string;
  kicker: string;
  /** Local start, used for countdown copy. */
  startsAt: Date;
  /** Promos hide after this. */
  endsAt: Date;
}

export const FLAGSHIP_EVENT: FlagshipEvent = {
  slug: "unpacking-multiplexes-toronto",
  title: "Unpacking Multiplexes Toronto",
  tagline: "Toronto's premier multiplex development conference",
  description:
    "A focused evening for people turning missing middle policy into real projects: site selection, zoning, architecture, financing, construction, exit strategy, and underwriting.",
  href: "/community/events/unpacking-multiplexes-toronto",
  heroImage: "/events/unpacking-multiplexes-toronto-ai-hero.png",
  dateLabel: "Tuesday, September 15, 2026",
  timeLabel: "5:00–10:00 PM EDT",
  venueTitle: "Toronto waterfront",
  venueDetail: "The Terminal Theatre, Queens Quay Terminal",
  audienceLabel: "Developers, investors, architects, planners, lenders, and builders",
  ticketBadge: "Tickets on sale now",
  ticketNote: "Ticketing details on the event page",
  kicker: "Toronto multiplex event",
  startsAt: new Date("2026-09-15T17:00:00-04:00"),
  endsAt: new Date("2026-09-15T22:00:00-04:00"),
};

/** True once the event is over — every promo surface must check this. */
export function hasEnded(now: Date = new Date()): boolean {
  return now.getTime() > FLAGSHIP_EVENT.endsAt.getTime();
}

/**
 * Whole days until the event, or null once it has started/ended.
 *
 * Counts calendar days rather than 24-hour blocks, so "2 days away" on Sunday
 * means Tuesday — which is how a reader interprets it.
 */
export function daysUntil(now: Date = new Date()): number | null {
  if (now.getTime() >= FLAGSHIP_EVENT.startsAt.getTime()) return null;
  const startOfDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfDay(FLAGSHIP_EVENT.startsAt) - startOfDay(now)) / 86_400_000);
  return days > 0 ? days : null;
}

/**
 * Urgency line for promo surfaces, or null when there is nothing honest to say.
 *
 * Deliberately no fake scarcity — it counts real days and goes quiet rather than
 * inventing "only a few seats left".
 */
export function urgencyLabel(now: Date = new Date()): string | null {
  if (hasEnded(now)) return null;
  const days = daysUntil(now);
  if (days === null) return "Happening today";
  if (days === 1) return "Tomorrow";
  if (days <= 14) return `In ${days} days`;
  return null;
}
