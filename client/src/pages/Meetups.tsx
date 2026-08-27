import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  CalendarDays,
  ExternalLink,
  MapPin,
  PlusCircle,
  RefreshCw,
  Repeat,
  Users,
} from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { RealistEventPayload } from "@/components/events/types";

type CommunityEvent = RealistEventPayload & {
  id: string;
  rsvpCount: number;
  minPriceCents: number | null;
};

const MEETUP_NETWORK_URL = "https://www.meetup.com/pro/the-canadian-real-estate-investor/";

function formatWhen(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone || "America/Toronto",
  }).format(new Date(value));
}

function eventPrice(event: CommunityEvent): string {
  if (event.kind === "meetup" || event.minPriceCents == null || event.minPriceCents === 0) return "Free";
  return `From $${Math.round(event.minPriceCents / 100)}`;
}

function attendeeLabel(event: CommunityEvent): string | null {
  const native = event.rsvpCount || 0;
  const meetup = event.externalRsvpCount || 0;
  if (meetup > 0 && native > 0) return `${meetup} on Meetup · ${native} on Realist`;
  if (meetup > 0) return `${meetup} going on Meetup`;
  if (native > 0) return `${native} going on Realist`;
  return null;
}

function EventCard({ event }: { event: CommunityEvent }) {
  const location = event.city || event.venueName || event.externalGroupName || (event.eventType === "WEBINAR" ? "Online" : "Canada");
  const attendees = attendeeLabel(event);
  return (
    <Link href={`/events/${event.slug}`}>
      <Card className="group h-full cursor-pointer overflow-hidden border-border/70 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg" data-testid={`card-community-event-${event.slug}`}>
        {event.headerImageUrl && (
          <div className="aspect-[16/8] overflow-hidden bg-muted">
            <img src={event.headerImageUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
          </div>
        )}
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={event.kind === "meetup" ? "secondary" : "default"}>
              {event.kind === "meetup" ? "Investor meetup" : "Flagship event"}
            </Badge>
            {event.externalSource === "meetup" && <Badge variant="outline">Synced from Meetup</Badge>}
            {event.isRecurring && <Badge variant="outline"><Repeat className="mr-1 h-3 w-3" />Recurring</Badge>}
            <span className="ml-auto text-sm font-semibold text-primary">{eventPrice(event)}</span>
          </div>
          <div>
            <h3 className="text-xl font-semibold leading-tight group-hover:text-primary">{event.title}</h3>
            {event.shortDescription && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{event.shortDescription}</p>}
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />{formatWhen(event.startsAt, event.timezone)}</p>
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{location}</p>
            {attendees && <p className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" />{attendees}</p>}
          </div>
          <span className="inline-flex items-center text-sm font-semibold text-primary">
            View details and RSVP <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Meetups() {
  const [, navigate] = useLocation();
  const [city, setCity] = useState("all");
  const { data: events = [], isLoading, isFetching, refetch } = useQuery<CommunityEvent[]>({
    queryKey: ["/api/realist-events"],
  });

  const upcoming = useMemo(() => events.filter((event) => {
    const finalTime = Date.parse(event.endsAt || event.startsAt);
    return Number.isFinite(finalTime) && finalTime >= Date.now() - 2 * 60 * 60 * 1000;
  }), [events]);
  const flagships = upcoming.filter((event) => event.kind !== "meetup");
  const meetups = upcoming.filter((event) => event.kind === "meetup");
  const cities = useMemo(() => Array.from(new Set(meetups.map((event) => event.city).filter((value): value is string => Boolean(value)))).sort(), [meetups]);
  const visibleMeetups = city === "all" ? meetups : meetups.filter((event) => event.city === city);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SEO
        title="Canadian Real Estate Investor Meetups & Events | Realist.ca"
        description="Find free Canadian real estate investor meetups and Realist flagship events in one live calendar. RSVP on Realist and get a free investor account, event reminders, and deal-analysis tools."
        canonicalUrl="/meetups"
      />

      <header className="border-b bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-[1fr_360px] md:px-6 md:py-20">
          <div>
            <Badge className="mb-5" variant="secondary">Realist investor community</Badge>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl" data-testid="text-meetups-title">
              Meet the people behind the deals.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              One Canadian calendar for local investor meetups, live underwriting sessions, and flagship Realist events.
              Meetup publishes the network; Realist gives every event a useful home, a discussion, and a free investor account.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => document.getElementById("calendar")?.scrollIntoView({ behavior: "smooth" })}>
                Find an event <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/community/meetups/new")}>
                <PlusCircle className="mr-2 h-4 w-4" /> Host a meetup
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 self-end">
            <div className="rounded-2xl border bg-card p-5"><p className="text-3xl font-bold">11,000+</p><p className="mt-1 text-sm text-muted-foreground">in-person community members</p></div>
            <div className="rounded-2xl border bg-card p-5"><p className="text-3xl font-bold">17</p><p className="mt-1 text-sm text-muted-foreground">Meetup groups across Canada</p></div>
            <div className="col-span-2 rounded-2xl border bg-card p-5"><p className="text-lg font-semibold">RSVP once. Keep the relationship.</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Your Realist account holds your event RSVP, discussions, reminders, and investor tools—without making you rebuild a profile for every event.</p></div>
          </div>
        </div>
      </header>

      <main id="calendar" className="mx-auto max-w-7xl space-y-14 px-4 py-14 md:px-6">
        {isLoading ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => <Skeleton key={item} className="h-80 w-full rounded-xl" />)}
          </div>
        ) : (
          <>
            {flagships.length > 0 && (
              <section className="space-y-5">
                <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Worth travelling for</p><h2 className="mt-2 text-3xl font-bold">Flagship events</h2></div>
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{flagships.map((event) => <EventCard key={event.id} event={event} />)}</div>
              </section>
            )}

            <section className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">In your market</p><h2 className="mt-2 text-3xl font-bold">Upcoming investor meetups</h2><p className="mt-2 text-muted-foreground">Free, practical, and built for regular investors—not institutional conference theatre.</p></div>
                <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Refresh calendar</Button>
              </div>

              {cities.length > 1 && (
                <div className="flex flex-wrap gap-2" aria-label="Filter meetups by city">
                  <Button size="sm" variant={city === "all" ? "default" : "outline"} onClick={() => setCity("all")}>All cities</Button>
                  {cities.map((value) => <Button key={value} size="sm" variant={city === value ? "default" : "outline"} onClick={() => setCity(value)}>{value}</Button>)}
                </div>
              )}

              {visibleMeetups.length > 0 ? (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{visibleMeetups.map((event) => <EventCard key={event.id} event={event} />)}</div>
              ) : (
                <Card><CardContent className="space-y-4 py-12 text-center"><CalendarDays className="mx-auto h-10 w-10 text-primary" /><div><h3 className="text-xl font-semibold">The next dates are being posted</h3><p className="mt-2 text-sm text-muted-foreground">Check the Meetup network or host the first Realist meetup in your market.</p></div><div className="flex justify-center gap-2"><Button variant="outline" asChild><a href={MEETUP_NETWORK_URL} target="_blank" rel="noreferrer">Meetup network <ExternalLink className="ml-2 h-4 w-4" /></a></Button><Button onClick={() => navigate("/community/meetups/new")}>Host one</Button></div></CardContent></Card>
              )}
            </section>
          </>
        )}

        <section id="host" className="grid gap-6 rounded-3xl border bg-muted/30 p-7 md:grid-cols-[1fr_auto] md:items-center md:p-10">
          <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Bring Realist to your city</p><h2 className="mt-2 text-3xl font-bold">Host the room you wish existed.</h2><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Create a free local meetup, set a capacity and recurrence, and let Realist handle the event page, accounts, confirmations, reminders, and investor discussion.</p></div>
          <Button size="lg" onClick={() => navigate("/community/meetups/new")}><PlusCircle className="mr-2 h-4 w-4" />Create a meetup</Button>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
