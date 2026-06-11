import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SponsorStrip } from "./SponsorStrip";
import type { RealistEventPayload } from "./types";

type ListedEvent = RealistEventPayload & { id: string };

function formatShortDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timezone || "America/Toronto",
  }).format(new Date(value));
}

function priceLabel(event: ListedEvent): string {
  if (event.kind === "meetup" || event.minPriceCents == null) return "Free";
  if (event.minPriceCents === 0) return "Free";
  return `From $${(event.minPriceCents / 100).toFixed(0)}`;
}

function EventCard({ event }: { event: ListedEvent }) {
  return (
    <Link href={`/events/${event.slug}`}>
      <Card className="cursor-pointer transition hover:border-primary/50 hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Badge variant={event.kind === "meetup" ? "secondary" : "default"}>
              {event.kind === "meetup" ? "Meetup" : "Event"}
            </Badge>
            {event.isRecurring && (
              <Badge variant="outline" className="gap-1"><Repeat className="h-3 w-3" /> Recurring</Badge>
            )}
            <span className="ml-auto text-sm font-medium">{priceLabel(event)}</span>
          </div>
          <h3 className="mt-2 font-semibold leading-snug">{event.title}</h3>
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatShortDate(event.startsAt, event.timezone)}
            </p>
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {event.city || event.venueName || "Online"}
            </p>
          </div>
          {(event.rsvpCount ?? 0) > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">{event.rsvpCount} going</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * Native Realist events + meetups — replaces the Eventbrite/meetup.com
 * dependency. Mounted at the top of the community events hub.
 */
export function NativeEventsList() {
  const { data: events, isLoading } = useQuery<ListedEvent[]>({
    queryKey: ["/api/realist-events"],
  });
  const [city, setCity] = useState<string>("all");

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const event of events ?? []) if (event.city) set.add(event.city);
    return Array.from(set).sort();
  }, [events]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return (events ?? [])
      .filter((event) => new Date(event.startsAt).getTime() > now - 6 * 60 * 60 * 1000)
      .filter((event) => city === "all" || event.city === city);
  }, [events, city]);

  if (isLoading || !events?.length) return null;

  const flagships = upcoming.filter((event) => event.kind !== "meetup");
  const meetups = upcoming.filter((event) => event.kind === "meetup");

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Realist events & meetups</h2>
          <p className="text-sm text-muted-foreground">
            Tickets and RSVPs right here — your Realist account is your pass.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/community/meetups/new">Host a meetup</Link>
        </Button>
      </div>

      {cities.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={city === "all" ? "default" : "outline"} onClick={() => setCity("all")}>
            All cities
          </Button>
          {cities.map((value) => (
            <Button key={value} size="sm" variant={city === value ? "default" : "outline"} onClick={() => setCity(value)}>
              {value}
            </Button>
          ))}
        </div>
      )}

      {flagships.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold">Flagship events</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {flagships.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        </div>
      )}

      {meetups.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold">Investor meetups</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {meetups.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        </div>
      )}

      <SponsorStrip />
    </section>
  );
}
