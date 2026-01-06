import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, Clock, ExternalLink, RefreshCw } from "lucide-react";
import { format, parseISO, isPast, isFuture } from "date-fns";

interface EventbriteEvent {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  timezone: string;
  venueName: string;
  venueAddress: string;
  imageUrl: string;
  eventUrl: string;
  status: string;
}

interface EventsResponse {
  events: EventbriteEvent[];
  cached: boolean;
  lastFetched: string | null;
}

function EventCard({ event }: { event: EventbriteEvent }) {
  const startDate = event.startDate ? parseISO(event.startDate) : null;
  const isUpcoming = startDate ? isFuture(startDate) : true;

  return (
    <Card 
      className="overflow-hidden hover-elevate transition-all duration-300"
      data-testid={`card-event-${event.id}`}
    >
      {event.imageUrl && (
        <div className="relative h-48 overflow-hidden">
          <img
            src={event.imageUrl}
            alt={event.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <Badge
            variant={isUpcoming ? "default" : "secondary"}
            className="absolute top-4 left-4"
            size="sm"
          >
            {isUpcoming ? "Upcoming" : "Past Event"}
          </Badge>
        </div>
      )}
      {!event.imageUrl && (
        <div className="relative h-32 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <Calendar className="h-12 w-12 text-muted-foreground" />
          <Badge
            variant={isUpcoming ? "default" : "secondary"}
            className="absolute top-4 left-4"
            size="sm"
          >
            {isUpcoming ? "Upcoming" : "Past Event"}
          </Badge>
        </div>
      )}
      <CardContent className="pt-4 space-y-4">
        <div>
          <h3 className="font-semibold text-lg line-clamp-2" data-testid={`text-event-name-${event.id}`}>
            {event.name}
          </h3>
          {event.description && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {event.description}
            </p>
          )}
        </div>

        <div className="space-y-2">
          {startDate && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span data-testid={`text-event-date-${event.id}`}>
                {format(startDate, "EEEE, MMMM d, yyyy")}
              </span>
            </div>
          )}
          {startDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{format(startDate, "h:mm a")}</span>
            </div>
          )}
          {event.venueName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{event.venueName}</span>
            </div>
          )}
        </div>

        <a
          href={event.eventUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Button className="w-full gap-2" data-testid={`button-event-register-${event.id}`}>
            {isUpcoming ? "Register Now" : "View Details"}
            <ExternalLink className="h-4 w-4" />
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}

function EventSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-48 w-full" />
      <CardContent className="pt-4 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

export default function Events() {
  const { data, isLoading, refetch, isRefetching } = useQuery<EventsResponse>({
    queryKey: ["/api/events"],
  });

  const upcomingEvents = (data?.events?.filter(e => {
    if (!e.startDate) return true;
    return isFuture(parseISO(e.startDate));
  }) || []).sort((a, b) => {
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  const pastEvents = (data?.events?.filter(e => {
    if (!e.startDate) return false;
    return isPast(parseISO(e.startDate));
  }) || []).sort((a, b) => {
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-events-title">
              Upcoming Events
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Join The Canadian Real Estate Investor Podcast community at our exclusive events, 
              workshops, and networking opportunities.
            </p>
            {data?.lastFetched && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span>Last updated: {format(new Date(data.lastFetched), "MMM d, yyyy h:mm a")}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isRefetching}
                  className="gap-1"
                  data-testid="button-refresh-events"
                >
                  <RefreshCw className={`h-3 w-3 ${isRefetching ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <EventSkeleton key={i} />
              ))}
            </div>
          ) : upcomingEvents.length > 0 ? (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>

              {pastEvents.length > 0 && (
                <div className="mt-16">
                  <h2 className="text-2xl font-bold mb-6 text-muted-foreground">Past Events</h2>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75">
                    {pastEvents.slice(0, 3).map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No upcoming events</h3>
              <p className="text-muted-foreground mb-6">
                Check back soon for new events from The Canadian Real Estate Investor Podcast.
              </p>
              <a
                href="https://www.eventbrite.ca/o/the-canadian-real-estate-investor-podcast-87580319633"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="gap-2" data-testid="button-view-eventbrite">
                  View on Eventbrite
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            </div>
          )}

          <div className="mt-16 text-center">
            <Card className="inline-block p-8 bg-gradient-to-br from-primary/10 to-accent/10">
              <h3 className="text-xl font-semibold mb-2">Don't miss an event</h3>
              <p className="text-muted-foreground mb-4">
                Follow us on Eventbrite to get notified about new events.
              </p>
              <a
                href="https://www.eventbrite.ca/o/the-canadian-real-estate-investor-podcast-87580319633"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="gap-2" data-testid="button-follow-eventbrite">
                  Follow on Eventbrite
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            </Card>
          </div>
        </div>
      </main>

      <footer className="py-8 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">R</span>
              </div>
              <span>Realist.ca</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="/about" className="hover:text-foreground transition-colors">About</a>
              <a href="/events" className="hover:text-foreground transition-colors">Events</a>
              <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
