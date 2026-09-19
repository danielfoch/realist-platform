import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { BellRing, CalendarDays, ExternalLink, MapPin, Users } from "lucide-react";
import type { RsvpTarget } from "@/components/meetups/MeetupRsvpDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { groupByCity, nextByCity, nextSecondTuesday, type CalendarEvent } from "@shared/meetupCalendar";
import { MEETUP_NETWORK_GROUPS, MEETUP_PRO_URLNAME_DEFAULT, type MeetupNetworkResponse } from "@shared/meetupNetwork";

/**
 * The meetup network calendar, shared by /meetups and /community/events.
 *
 * One hook owns the two feeds (/api/meetups/calendar — Meetup.com, Eventbrite
 * and native events deduplicated by city and date — and /api/meetups/network
 * for group metadata); two presentational components render it. The page owns
 * the RSVP dialog state so a single dialog serves both lists.
 */

interface CalendarResponse {
  events: CalendarEvent[];
  sources: { meetup: string; eventbrite: string; realist: string };
}

export interface CityCard {
  city: string;
  province: string | null;
  groupName: string | null;
  groupUrl: string | null;
  memberCount: number | null;
  status: "active" | "transition" | "closing" | "unknown";
  next: CalendarEvent | null;
}

const dayFormat = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric" });

export function formatWhen(iso: string, timezone: string | null, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { ...opts, timeZone: timezone || "America/Toronto" }).format(new Date(iso));
  } catch {
    return "";
  }
}

function dayKey(iso: string, timezone: string | null): string {
  return formatWhen(iso, timezone, { year: "numeric", month: "2-digit", day: "2-digit" });
}

function sourceLabel(source: CalendarEvent["source"]): string {
  return source === "meetup" ? "Meetup.com" : source === "eventbrite" ? "Eventbrite" : "Realist";
}

export function cityAnchor(city: string): string {
  return city.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export interface NetworkCalendarData {
  events: CalendarEvent[];
  byDay: Array<[string, CalendarEvent[]]>;
  cities: CityCard[];
  isLoading: boolean;
  /** "Tuesday, October 13" — the usual cadence, for cities with no date posted. */
  expectedNext: string;
  proUrl: string;
}

export function useNetworkCalendar(): NetworkCalendarData {
  const calendar = useQuery<CalendarResponse>({ queryKey: ["/api/meetups/calendar"], staleTime: 5 * 60 * 1000 });
  const network = useQuery<MeetupNetworkResponse>({ queryKey: ["/api/meetups/network"], staleTime: 5 * 60 * 1000 });

  const events = calendar.data?.events ?? [];

  const byDay = useMemo(() => {
    const groups = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = dayKey(event.startsAt, event.timezone);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(event);
    }
    return [...groups.entries()];
  }, [events]);

  const cities = useMemo<CityCard[]>(() => {
    const next = nextByCity(events);
    const cards = new Map<string, CityCard>();
    const seed = (city: string, patch: Partial<CityCard>) => {
      const existing = cards.get(city) ?? {
        city,
        province: null,
        groupName: null,
        groupUrl: null,
        memberCount: null,
        status: "unknown" as const,
        next: next.get(city) ?? null,
      };
      cards.set(city, { ...existing, ...patch, next: existing.next ?? next.get(city) ?? null });
    };
    for (const group of MEETUP_NETWORK_GROUPS) {
      seed(group.city, { province: group.province, groupName: group.name, groupUrl: `https://www.meetup.com/${group.urlname}/`, status: group.status });
    }
    for (const group of network.data?.groups ?? []) {
      seed(group.city, {
        province: group.province ?? null,
        groupName: group.name,
        groupUrl: group.url,
        memberCount: group.memberCount,
        status: group.status ?? "unknown",
      });
    }
    for (const [city] of groupByCity(events)) {
      if (city !== "Online & other") seed(city, {});
    }
    return [...cards.values()]
      .filter((card) => card.status !== "closing")
      .sort((a, b) => {
        if (a.next && b.next) return new Date(a.next.startsAt).getTime() - new Date(b.next.startsAt).getTime();
        if (a.next) return -1;
        if (b.next) return 1;
        return a.city.localeCompare(b.city);
      });
  }, [events, network.data]);

  const expectedNext = useMemo(() => dayFormat.format(nextSecondTuesday()), []);
  const proUrl = `https://www.meetup.com/pro/${network.data?.proUrlname ?? MEETUP_PRO_URLNAME_DEFAULT}/`;

  return { events, byDay, cities, isLoading: calendar.isLoading, expectedNext, proUrl };
}

/**
 * A group that posts a recurring series a year out would bury every other
 * city. With `maxPerCity`, each city shows only its next few dates (events
 * arrive soonest-first, so "first seen" is "soonest").
 */
function capPerCity(byDay: Array<[string, CalendarEvent[]]>, maxPerCity: number): Array<[string, CalendarEvent[]]> {
  const seen = new Map<string, number>();
  const capped: Array<[string, CalendarEvent[]]> = [];
  for (const [day, dayEvents] of byDay) {
    const kept = dayEvents.filter((event) => {
      const cityKey = event.city ?? event.groupUrlname ?? event.key;
      const count = seen.get(cityKey) ?? 0;
      seen.set(cityKey, count + 1);
      return count < maxPerCity;
    });
    if (kept.length > 0) capped.push([day, kept]);
  }
  return capped;
}

export function CalendarByDay({
  calendar,
  onTarget,
  maxPerCity,
}: {
  calendar: NetworkCalendarData;
  onTarget: (target: RsvpTarget) => void;
  /** Show at most this many upcoming dates per city; omit for the full calendar. */
  maxPerCity?: number;
}) {
  const days = useMemo(
    () => (maxPerCity ? capPerCity(calendar.byDay, maxPerCity) : calendar.byDay),
    [calendar.byDay, maxPerCity],
  );

  if (calendar.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (calendar.events.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 py-12 text-center">
          <p className="font-medium">Next dates are being posted.</p>
          <p className="text-sm text-muted-foreground">
            Most cities meet on the second Tuesday; the next one is {calendar.expectedNext}. Pick your city below and
            we'll email you when it's up.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {days.map(([day, dayEvents]) => (
        <div key={day} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {formatWhen(dayEvents[0].startsAt, dayEvents[0].timezone, { weekday: "long", month: "long", day: "numeric" })}
          </h3>
          {dayEvents.map((event) => (
            <Card key={event.key} data-testid={`card-meetup-${event.key}`}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {event.city && <Badge variant="secondary">{event.city}</Badge>}
                    <p className="font-semibold">{event.title}</p>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatWhen(event.startsAt, event.timezone, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
                    </span>
                    {event.venueName && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {event.venueName}
                      </span>
                    )}
                    {event.rsvpCount != null && event.rsvpCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {event.rsvpCount} going
                      </span>
                    )}
                    <span className="text-xs">via {sourceLabel(event.source)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {event.isFree && <Badge variant="outline">Free</Badge>}
                  {event.source === "realist" ? (
                    <Button asChild size="sm" data-testid={`button-rsvp-${event.key}`}>
                      <Link href={event.url}>RSVP</Link>
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => onTarget({ mode: "rsvp", event })} data-testid={`button-rsvp-${event.key}`}>
                      RSVP
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CityGrid({
  calendar,
  onTarget,
}: {
  calendar: NetworkCalendarData;
  onTarget: (target: RsvpTarget) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {calendar.cities.map((card) => (
        <Card key={card.city} id={cityAnchor(card.city)} className="flex flex-col" data-testid={`card-city-${cityAnchor(card.city)}`}>
          <CardContent className="flex flex-1 flex-col gap-3 py-5">
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold">
                  {card.city}
                  {card.province && <span className="ml-1 text-sm font-normal text-muted-foreground">{card.province}</span>}
                </h3>
                {card.status === "transition" && <Badge variant="outline">New host coming</Badge>}
              </div>
              {card.memberCount != null && (
                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {card.memberCount.toLocaleString("en-CA")} members
                </p>
              )}
            </div>

            {card.next ? (
              <div className="text-sm">
                <p className="font-medium">
                  {formatWhen(card.next.startsAt, card.next.timezone, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
                {card.next.venueName && <p className="text-muted-foreground">{card.next.venueName}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Date not posted yet. Usually the second Tuesday; next is {calendar.expectedNext}.
              </p>
            )}

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
              {card.next ? (
                card.next.source === "realist" ? (
                  <Button asChild size="sm">
                    <Link href={card.next.url}>RSVP</Link>
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => onTarget({ mode: "rsvp", event: card.next! })} data-testid={`button-city-rsvp-${cityAnchor(card.city)}`}>
                    RSVP
                  </Button>
                )
              ) : (
                <Button size="sm" variant="outline" onClick={() => onTarget({ mode: "notify", city: card.city })} data-testid={`button-city-notify-${cityAnchor(card.city)}`}>
                  <BellRing className="mr-1.5 h-3.5 w-3.5" />
                  Notify me
                </Button>
              )}
              {card.groupUrl && (
                <a
                  href={card.groupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  Group page
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
