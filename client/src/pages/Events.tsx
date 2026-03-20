import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, MapPin, Clock, ExternalLink, RefreshCw, Users, Handshake, Linkedin, Instagram, UserPlus, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { format, parseISO, isPast, isFuture, startOfDay, isToday, isTomorrow } from "date-fns";
import { marketExperts, type MarketExpert } from "@/lib/marketExperts";
import { getHostByEventName } from "@/lib/meetupHosts";
import { ContactHostDialog } from "@/components/ContactHostDialog";
import { MarketExpertApplicationDialog } from "@/components/MarketExpertApplicationDialog";

interface GroupedEvents {
  date: Date;
  dateKey: string;
  events: EventbriteEvent[];
}

interface EventbriteEvent {
  id: string;
  name: string;
  description: string;
  summary?: string;
  startDate: string;
  endDate: string;
  timezone: string;
  venueName: string;
  venueAddress: string;
  imageUrl: string;
  logoUrl?: string;
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

function groupEventsByDay(events: EventbriteEvent[]): GroupedEvents[] {
  const groups: Map<string, GroupedEvents> = new Map();
  
  for (const event of events) {
    if (!event.startDate) continue;
    const eventDate = parseISO(event.startDate);
    const dayStart = startOfDay(eventDate);
    const dateKey = format(dayStart, "yyyy-MM-dd");
    
    if (!groups.has(dateKey)) {
      groups.set(dateKey, {
        date: dayStart,
        dateKey,
        events: [],
      });
    }
    groups.get(dateKey)!.events.push(event);
  }
  
  return Array.from(groups.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
}

function formatDayHeader(date: Date): string {
  if (isToday(date)) {
    return `Today - ${format(date, "EEEE, MMMM d")}`;
  }
  if (isTomorrow(date)) {
    return `Tomorrow - ${format(date, "EEEE, MMMM d")}`;
  }
  return format(date, "EEEE, MMMM d, yyyy");
}

function extractCityFromEvent(event: EventbriteEvent): string {
  if (event.venueName) {
    const parts = event.venueName.split(",");
    if (parts.length > 0) {
      return parts[0].trim();
    }
  }
  if (event.venueAddress) {
    const parts = event.venueAddress.split(",");
    if (parts.length >= 2) {
      return parts[parts.length - 2].trim();
    }
  }
  const nameMatch = event.name.match(/(?:in|at)\s+([A-Z][a-zA-Z\s]+?)(?:\s*[-–]|\s*$)/);
  if (nameMatch) {
    return nameMatch[1].trim();
  }
  return "Location TBD";
}

function MeetupDaySection({ group }: { group: GroupedEvents }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const cities = group.events.map(event => ({
    city: extractCityFromEvent(event),
    event,
  }));

  return (
    <Card className="overflow-visible" data-testid={`card-meetup-day-${group.dateKey}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover-elevate rounded-md">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{formatDayHeader(group.date)}</h3>
                <p className="text-sm text-muted-foreground">
                  {cities.length} {cities.length === 1 ? "city" : "cities"} hosting meetups
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" data-testid={`button-toggle-day-${group.dateKey}`}>
              {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-2 border-t">
            <div className="grid gap-3 mt-3">
              {cities.map(({ city, event }) => {
                const host = getHostByEventName(event.name);
                return (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-testid={`card-meetup-city-${event.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <span className="font-medium">{event.name}</span>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{city}</span>
                          {event.startDate && (
                            <span>at {format(parseISO(event.startDate), "h:mm a")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ContactHostDialog host={host} eventName={event.name} eventId={event.id}>
                        <Button size="sm" variant="ghost" className="gap-1" data-testid={`button-contact-host-${event.id}`}>
                          <MessageCircle className="h-3 w-3" />
                          Contact Host
                        </Button>
                      </ContactHostDialog>
                      <a
                        href={event.eventUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`link-register-${event.id}`}
                      >
                        <Button size="sm" variant="outline" className="gap-1">
                          Register
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function Events() {
  const { data, isLoading, refetch, isRefetching } = useQuery<EventsResponse>({
    queryKey: ["/api/events"],
  });

  // Check if an event is a "featured" special event (not a regular meetup)
  const isFeaturedEvent = (event: EventbriteEvent): boolean => {
    const nameLower = event.name.toLowerCase();
    return nameLower.includes("multiplex") || 
           nameLower.includes("unpacking") ||
           nameLower.includes("workshop") ||
           nameLower.includes("conference") ||
           nameLower.includes("summit");
  };

  const allUpcoming = (data?.events?.filter(e => {
    if (!e.startDate) return true;
    return isFuture(parseISO(e.startDate));
  }) || []).sort((a, b) => {
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  // Separate featured events from regular meetups
  const featuredEvents = allUpcoming.filter(isFeaturedEvent);
  const upcomingMeetups = allUpcoming.filter(e => !isFeaturedEvent(e));

  const pastEvents = (data?.events?.filter(e => {
    if (!e.startDate) return false;
    return isPast(parseISO(e.startDate));
  }) || []).sort((a, b) => {
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  const groupedUpcoming = groupEventsByDay(upcomingMeetups);
  const groupedPast = groupEventsByDay(pastEvents).reverse();

  const eventsSchema = {
    "@context": "https://schema.org",
    "@type": "EventSeries",
    "name": "Canadian Real Estate Investor Events",
    "organizer": {
      "@type": "Organization",
      "name": "Realist.ca",
      "url": "https://realist.ca"
    },
    "description": "Real estate investing events, workshops, and networking opportunities for Canadian investors hosted by the Canadian Real Estate Investor Podcast team."
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Real Estate Investor Events - Toronto & Canada Networking"
        description="Join 11,000+ Canadian real estate investors at our exclusive events. Network with Daniel Foch and the Canadian Real Estate Investor Podcast community. Workshops, meetups, and conferences in Toronto and across Canada."
        keywords="real estate investor events toronto, canadian real estate meetup, real estate networking canada, daniel foch events, investor conference canada, real estate workshop toronto"
        canonicalUrl="/events"
        structuredData={eventsSchema}
      />
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
            <div className="space-y-8">
              <div>
                <Skeleton className="h-8 w-64 mb-4" />
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(3)].map((_, i) => (
                    <EventSkeleton key={i} />
                  ))}
                </div>
              </div>
              <div>
                <Skeleton className="h-8 w-48 mb-4" />
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(2)].map((_, i) => (
                    <EventSkeleton key={i} />
                  ))}
                </div>
              </div>
            </div>
          ) : (featuredEvents.length > 0 || groupedUpcoming.length > 0) ? (
            <>
              {/* Featured Events Section */}
              {featuredEvents.length > 0 && (
                <div className="mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <Calendar className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl font-bold">Featured Event</h2>
                    <Badge className="bg-primary text-primary-foreground">Special</Badge>
                  </div>
                  <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-6">
                    {featuredEvents.map((event) => (
                      <Card key={event.id} className="overflow-hidden border-primary/20" data-testid={`card-featured-event-${event.id}`}>
                        <div className="md:flex">
                          {(event.logoUrl || event.imageUrl) && (
                            <div className="md:w-1/3 shrink-0">
                              <img
                                src={event.logoUrl || event.imageUrl}
                                alt={event.name}
                                className="w-full h-48 md:h-full object-cover"
                              />
                            </div>
                          )}
                          <CardContent className={`p-6 flex flex-col justify-between ${(event.logoUrl || event.imageUrl) ? 'md:w-2/3' : 'w-full'}`}>
                            <div>
                              <h3 className="text-xl font-bold mb-2" data-testid={`text-featured-title-${event.id}`}>
                                {event.name}
                              </h3>
                              {event.summary && (
                                <p className="text-muted-foreground mb-4 line-clamp-3">{event.summary}</p>
                              )}
                              <div className="space-y-2 mb-4">
                                {event.startDate && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Clock className="h-4 w-4 text-primary" />
                                    <span className="font-medium">
                                      {format(parseISO(event.startDate), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                                    </span>
                                  </div>
                                )}
                                {event.venueName && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <MapPin className="h-4 w-4" />
                                    <span>{event.venueName}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <a
                              href={event.eventUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button className="w-full gap-2" data-testid={`button-featured-register-${event.id}`}>
                                Register Now
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </a>
                          </CardContent>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* 2026 Event Partners Section */}
              <div className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <Handshake className="h-6 w-6 text-primary" />
                  <h2 className="text-2xl font-bold">2026 Event Partners</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                  {[
                    { name: "CMHC", logo: "/partners/cmhc.png", url: "https://www.cmhc-schl.gc.ca" },
                    { name: "Vancity", logo: "/partners/vancity.png", url: "https://www.vancity.com" },
                    { name: "BLD Financial", logo: "/partners/bld-financial.png", url: "https://bldfinancial.ca/" },
                    { name: "Forefront Multiplex Marketing", logo: "/partners/forefront.png", url: "https://forefrontmultiplex.com" },
                    { name: "Theorem Developments", logo: "/partners/theorem.png", url: "https://theoremdevelopments.com" },
                    { name: "Burke by Burke", logo: "/partners/burke-by-burke.png", url: "https://burkebyburke.com" },
                    { name: "Greater Vancouver Tenant & Property Management Ltd", logo: "/partners/gvtpm.png", url: "https://gvtpm.com" },
                    { name: "Homies", logo: "/partners/homies.png", url: "https://meetyourhomies.com" },
                  ].map((partner) => (
                    <a
                      key={partner.name}
                      href={partner.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-center rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 transition-all duration-200 p-6 h-24"
                      data-testid={`link-partner-${partner.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <img
                        src={partner.logo}
                        alt={partner.name}
                        className="max-h-12 max-w-full object-contain grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
                      />
                    </a>
                  ))}
                </div>
              </div>

              {/* Regular Meetups Section */}
              {groupedUpcoming.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl font-bold">Upcoming Meetups</h2>
                    <Badge variant="outline" className="text-xs">
                      First Tuesday of every month
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    Join investors across Canada at our monthly meetups. Click on a date to see all cities.
                  </p>
                  
                  <div className="space-y-4">
                    {groupedUpcoming.map((group) => (
                      <MeetupDaySection key={group.dateKey} group={group} />
                    ))}
                  </div>
                </div>
              )}

              {groupedPast.length > 0 && (
                <div className="mt-16">
                  <h2 className="text-2xl font-bold mb-6 text-muted-foreground">Past Meetups</h2>
                  <div className="space-y-4 opacity-75">
                    {groupedPast.slice(0, 2).map((group) => (
                      <MeetupDaySection key={group.dateKey} group={group} />
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

          {/* Meetup Hosts Section */}
          <div className="mt-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-hosts-title">
                Meet Your Local Hosts
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Our trusted market experts across Canada host local meetups and provide investment guidance in their regions.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.values(marketExperts).map((expert: MarketExpert) => (
                <Card key={expert.provinceCode} className="hover-elevate" data-testid={`card-host-${expert.provinceCode}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16 border-2 border-primary/20">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                          {expert.name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg" data-testid={`text-host-name-${expert.provinceCode}`}>
                            {expert.name}
                          </h3>
                          {expert.linkedIn && (
                            <a href={expert.linkedIn} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                              <Linkedin className="h-4 w-4" />
                            </a>
                          )}
                          {expert.instagram && (
                            <a href={expert.instagram} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                              <Instagram className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{expert.title}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3" />
                          {expert.city}, {expert.province}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">
                      {expert.bio}
                    </p>
                  </CardContent>
                </Card>
              ))}

              {/* Partner Application Card */}
              <Card className="border-dashed border-2 hover-elevate" data-testid="card-become-partner">
                <CardContent className="pt-6 h-full flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <UserPlus className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Become a Host</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Are you a trusted realtor or investor looking to host meetups in your area?
                  </p>
                  <MarketExpertApplicationDialog 
                    trigger={
                      <Button variant="outline" className="gap-2" data-testid="button-become-partner">
                        <Handshake className="h-4 w-4" />
                        Apply Now
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Past Event Partners Section */}
          <div className="mt-24">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-muted-foreground mb-2" data-testid="text-past-partners-title">
                Past Event Partners
              </h2>
              <p className="text-sm text-muted-foreground">
                Companies that have supported our community events.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5">
              {[
                { name: "Sherwin Williams", logo: "/partners/sherwin-williams.png", url: "https://www.sherwin-williams.com" },
                { name: "Dorr Capital", logo: "/partners/dorr-capital.png", url: "https://dorrcapital.com" },
                { name: "Landlord.net", logo: "/partners/landlord-net.png", url: "https://landlord.net" },
                { name: "Foremost Financial", logo: "/partners/foremost-financial.png", url: "https://foremostfinancial.ca" },
                { name: "Cognitive Capital", logo: "/partners/cognitive-capital.png", url: "https://cognitivecapital.ca" },
              ].map((partner) => (
                <a
                  key={partner.name}
                  href={partner.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-center rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 transition-all duration-200 p-5 h-20"
                  data-testid={`link-past-partner-${partner.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <img
                    src={partner.logo}
                    alt={partner.name}
                    className="max-h-10 max-w-full object-contain grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-90 transition-all duration-300"
                  />
                </a>
              ))}
            </div>
          </div>

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
