import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  ExternalLink,
  MapPin,
  PlusCircle,
  Users,
} from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { FlagshipEventBanner } from "@/components/events/FlagshipEventBanner";
import { MeetupRsvpDialog, type RsvpTarget } from "@/components/meetups/MeetupRsvpDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SHARED_ROUTE_META } from "@shared/routeMeta";
import { groupByCity, nextByCity, nextSecondTuesday, type CalendarEvent } from "@shared/meetupCalendar";
import { MEETUP_NETWORK_GROUPS, MEETUP_PRO_URLNAME_DEFAULT, type MeetupNetworkResponse } from "@shared/meetupNetwork";

/**
 * /meetups — the one calendar for the community.
 *
 * Every free monthly meetup across the Canadian Real Estate Investor network
 * (Meetup.com), the cities that run on Eventbrite, native Realist events and
 * the flagship conferences render here, deduplicated by city and date on the
 * server (/api/meetups/calendar). RSVP captures the person on Realist first,
 * then hands off to wherever the RSVP lives.
 */

interface CalendarResponse {
  events: CalendarEvent[];
  sources: { meetup: string; eventbrite: string; realist: string };
}

interface CityCard {
  city: string;
  province: string | null;
  groupName: string | null;
  groupUrl: string | null;
  memberCount: number | null;
  status: "active" | "transition" | "closing" | "unknown";
  next: CalendarEvent | null;
}

const dayFormat = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric" });

function formatWhen(iso: string, timezone: string | null, opts: Intl.DateTimeFormatOptions): string {
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

function cityAnchor(city: string): string {
  return city.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default function Meetups() {
  const [target, setTarget] = useState<RsvpTarget | null>(null);
  const meta = SHARED_ROUTE_META["/meetups"];

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

  const structuredData = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@graph": events.slice(0, 20).map((event) => ({
        "@type": "Event",
        name: event.title,
        startDate: event.startsAt,
        ...(event.endsAt ? { endDate: event.endsAt } : {}),
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        isAccessibleForFree: event.isFree,
        url: event.url.startsWith("/") ? `https://realist.ca${event.url}` : event.url,
        ...(event.venueName || event.city
          ? {
              location: {
                "@type": "Place",
                name: event.venueName ?? event.city,
                ...(event.venueAddress ? { address: event.venueAddress } : {}),
              },
            }
          : {}),
        organizer: { "@type": "Organization", name: "The Canadian Real Estate Investor", url: "https://realist.ca" },
      })),
    }),
    [events],
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SEO title={meta.title} description={meta.description} canonicalUrl="/meetups" structuredData={structuredData} />

      <section className="border-b bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="container mx-auto max-w-5xl px-4 py-14">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">Free · monthly · in person</p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl" data-testid="text-meetups-title">
            Real estate investor meetups <span className="text-primary">across Canada.</span>
          </h1>
          <p className="mb-6 max-w-2xl text-lg text-muted-foreground">
            Hosted by the Canadian Real Estate Investor podcast community, usually the second Tuesday of the month. RSVP in
            ten seconds; your email doubles as a free Realist account with the deal analyzer.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => document.getElementById("upcoming")?.scrollIntoView({ behavior: "smooth" })} data-testid="button-browse-meetups">
              See what's coming up
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" asChild data-testid="button-host-meetup">
              <Link href="/community/meetups/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Host a meetup
              </Link>
            </Button>
            <a
              href={proUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline"
              data-testid="link-meetup-network"
            >
              Our network on Meetup.com
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </section>

      <main className="container mx-auto max-w-5xl space-y-14 px-4 py-12">
        <FlagshipEventBanner />

        <section id="upcoming" className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold">Coming up</h2>
            {events.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {events.length} {events.length === 1 ? "event" : "events"} posted
              </p>
            )}
          </div>

          {calendar.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : events.length === 0 ? (
            <Card>
              <CardContent className="space-y-3 py-12 text-center">
                <p className="font-medium">Next dates are being posted.</p>
                <p className="text-sm text-muted-foreground">
                  Most cities meet on the second Tuesday; the next one is {expectedNext}. Pick your city below and we'll email
                  you when it's up.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {byDay.map(([day, dayEvents]) => (
                <div key={day} className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {formatWhen(dayEvents[0].startsAt, dayEvents[0].timezone, { weekday: "long", month: "long", day: "numeric" })}
                  </h3>
                  {dayEvents.map((event) => (
                    <Card key={event.key} id={event.city ? cityAnchor(event.city) : undefined} data-testid={`card-meetup-${event.key}`}>
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
                            <Button size="sm" onClick={() => setTarget({ mode: "rsvp", event })} data-testid={`button-rsvp-${event.key}`}>
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
          )}
        </section>

        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold">Your city</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every group in the network. Where a date isn't posted yet, ask to be notified and we'll email you the moment it is.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((card) => (
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
                      Date not posted yet. Usually the second Tuesday; next is {expectedNext}.
                    </p>
                  )}

                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                    {card.next ? (
                      card.next.source === "realist" ? (
                        <Button asChild size="sm">
                          <Link href={card.next.url}>RSVP</Link>
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => setTarget({ mode: "rsvp", event: card.next! })} data-testid={`button-city-rsvp-${cityAnchor(card.city)}`}>
                          RSVP
                        </Button>
                      )
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setTarget({ mode: "notify", city: card.city })} data-testid={`button-city-notify-${cityAnchor(card.city)}`}>
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
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card className="bg-muted/30">
            <CardContent className="space-y-3 py-8">
              <h2 className="text-xl font-semibold">Bring the meetup to your city</h2>
              <p className="text-sm text-muted-foreground">
                Local hosts run the monthly meetup, get the network's promotion behind it, and become their market's
                Realist local expert for investor referrals.
              </p>
              <Button asChild variant="outline">
                <Link href="/about/local-experts">
                  Become a host
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="space-y-3 py-8">
              <h2 className="text-xl font-semibold">How RSVPs work</h2>
              <p className="text-sm text-muted-foreground">
                Most meetups take RSVPs on Meetup.com or Eventbrite. Tap RSVP here, tell us who you are, and finish on the
                event page in one tap. We send the reminders, and your free Realist account is ready when you want to run a deal.
              </p>
            </CardContent>
          </Card>
        </section>
      </main>

      <MeetupRsvpDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
