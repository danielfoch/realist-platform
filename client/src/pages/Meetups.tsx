import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, MapPin, Users, Repeat, ArrowRight, PlusCircle } from "lucide-react";
import type { RealistEvent } from "@shared/schema";

type MeetupListItem = RealistEvent & { rsvpCount: number; minPriceCents: number | null };

function formatWhen(value: string | Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone || "America/Toronto",
  }).format(new Date(value));
}

export default function Meetups() {
  const [, navigate] = useLocation();
  const { data: events, isLoading } = useQuery<MeetupListItem[]>({
    queryKey: ["/api/realist-events?kind=meetup"],
  });

  const { byCity, cities } = useMemo(() => {
    const now = Date.now();
    const upcoming = (events ?? []).filter((event) => new Date(event.startsAt).getTime() >= now);
    const byCity = new Map<string, MeetupListItem[]>();
    for (const event of upcoming) {
      const city = event.city || "Online";
      if (!byCity.has(city)) byCity.set(city, []);
      byCity.get(city)!.push(event);
    }
    return { byCity, cities: Array.from(byCity.keys()).sort() };
  }, [events]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SEO
        title="Realist Meetups — Real Estate Investor Meetups Across Canada"
        description="Free real estate investor meetups in Toronto, Vancouver, Montreal, Edmonton and more. Hosted by Realist and local investors. RSVP free — no Meetup.com account needed."
        canonicalUrl="/meetups"
      />

      <div className="bg-gradient-to-br from-primary/10 via-background to-background border-b">
        <div className="container mx-auto max-w-4xl px-4 py-14 text-center">
          <Badge variant="secondary" className="mb-4">Realist Meetups</Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" data-testid="text-meetups-title">
            Investor meetups, <span className="text-primary">now on Realist.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
            Our meetups have moved off Meetup.com and live here now. Free to attend, RSVP in 10 seconds — your RSVP
            doubles as a free Realist account with the AI deal analyzer included.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button size="lg" onClick={() => document.getElementById("upcoming")?.scrollIntoView({ behavior: "smooth" })} data-testid="button-browse-meetups">
              Browse meetups
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/community/meetups/new")} data-testid="button-host-meetup">
              <PlusCircle className="mr-2 h-4 w-4" />
              Host your own
            </Button>
          </div>
        </div>
      </div>

      <main id="upcoming" className="container mx-auto max-w-4xl px-4 py-12 space-y-10">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : cities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-muted-foreground">No upcoming meetups posted yet — new dates land here first.</p>
              <Button variant="outline" onClick={() => navigate("/community/meetups/new")}>
                Be the first: host a meetup
              </Button>
            </CardContent>
          </Card>
        ) : (
          cities.map((city) => (
            <section key={city} className="space-y-4">
              <h2 className="flex items-center gap-2 text-2xl font-semibold">
                <MapPin className="h-5 w-5 text-primary" />
                {city}
              </h2>
              <div className="space-y-3">
                {byCity.get(city)!.map((event) => (
                  <Card
                    key={event.id}
                    className="cursor-pointer transition-colors hover:border-primary/60"
                    onClick={() => navigate(`/events/${event.slug}`)}
                    data-testid={`card-meetup-${event.slug}`}
                  >
                    <CardContent className="flex items-center justify-between gap-4 py-4 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-semibold">{event.title}</p>
                        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatWhen(event.startsAt, event.timezone)}
                          </span>
                          {event.venueName && <span>{event.venueName}</span>}
                          {event.rsvpCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {event.rsvpCount} going
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {event.isRecurring && (
                          <Badge variant="outline" className="gap-1">
                            <Repeat className="h-3 w-3" />
                            {event.recurrenceNote || "Recurring"}
                          </Badge>
                        )}
                        <Badge>Free</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))
        )}

        <Card className="bg-muted/30">
          <CardContent className="py-8 text-center space-y-3">
            <h2 className="text-xl font-semibold">Coming from Meetup.com?</h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              Same meetups, same hosts, new home. RSVP to any event above and you're in — we'll email you the details
              and reminders, and your free Realist account unlocks the 60-second AI deal analyzer.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
