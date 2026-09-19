import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ExternalLink, PlusCircle } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { FlagshipEventBanner } from "@/components/events/FlagshipEventBanner";
import { MeetupRsvpDialog, type RsvpTarget } from "@/components/meetups/MeetupRsvpDialog";
import { CalendarByDay, CityGrid, useNetworkCalendar } from "@/components/meetups/NetworkCalendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SHARED_ROUTE_META } from "@shared/routeMeta";

/**
 * /meetups — the one calendar for the community.
 *
 * Every free monthly meetup across the Canadian Real Estate Investor network
 * (Meetup.com), the cities that run on Eventbrite, native Realist events and
 * the flagship conferences render here, deduplicated by city and date on the
 * server (/api/meetups/calendar). RSVP captures the person on Realist first,
 * then hands off to wherever the RSVP lives.
 */

export default function Meetups() {
  const [target, setTarget] = useState<RsvpTarget | null>(null);
  const meta = SHARED_ROUTE_META["/meetups"];
  const calendar = useNetworkCalendar();
  const { events, proUrl } = calendar;

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
          <CalendarByDay calendar={calendar} onTarget={setTarget} />
        </section>

        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold">Your city</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every group in the network. Where a date isn't posted yet, ask to be notified and we'll email you the moment it is.
            </p>
          </div>
          <CityGrid calendar={calendar} onTarget={setTarget} />
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
