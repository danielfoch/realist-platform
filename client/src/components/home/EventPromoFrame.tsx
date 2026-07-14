import { Link } from "wouter";
import { ArrowRight, CalendarDays, MapPin, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { track } from "@/lib/analytics";

const EVENT = {
  title: "Unpacking Multiplexes Toronto",
  tagline: "Toronto's missing middle and multiplex development conference",
  href: "/community/events/unpacking-multiplexes-toronto",
  heroImage: "/events/unpacking-multiplexes-toronto-ai-hero.png",
  dateLabel: "Tuesday, September 15, 2026",
  timeLabel: "5:00-10:00 PM EDT",
  venueLabel: "The Terminal Theatre, Queens Quay Terminal",
  audienceLabel: "Developers, investors, architects, planners, lenders, and builders",
  endsAt: new Date("2026-09-15T22:00:00-04:00"),
};

export function EventPromoFrame() {
  if (Date.now() > EVENT.endsAt.getTime()) return null;

  return (
    <section
      aria-label="Featured Realist event"
      className="border-t border-border/50 bg-muted/30 py-10 md:py-14"
      data-testid="event-promo-frame"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="overflow-hidden rounded-lg border border-primary/20 bg-background shadow-sm">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative min-h-[220px] lg:min-h-full">
              <img
                src={EVENT.heroImage}
                alt={EVENT.title}
                className="absolute inset-0 h-full w-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-background/10 via-background/0 to-background/65 lg:to-background/25" />
            </div>

            <div className="p-6 md:p-8 lg:p-10">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge className="bg-primary text-primary-foreground">
                  Featured event
                </Badge>
                <Badge variant="outline">Tickets on sale now</Badge>
              </div>

              <div className="max-w-3xl">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Toronto multiplex event
                </p>
                <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                  {EVENT.title}
                </h2>
                <p className="mt-3 text-lg text-muted-foreground">
                  {EVENT.tagline}
                </p>
                <p className="mt-4 text-sm leading-6 text-muted-foreground md:text-base">
                  A focused evening for people turning missing middle policy into
                  real projects: site selection, zoning, architecture, financing,
                  construction, exit strategy, and underwriting.
                </p>
              </div>

              <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/50 px-4 py-3">
                  <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <div className="font-semibold">{EVENT.dateLabel}</div>
                    <div className="text-muted-foreground">{EVENT.timeLabel}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/50 px-4 py-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <div className="font-semibold">Toronto waterfront</div>
                    <div className="text-muted-foreground">{EVENT.venueLabel}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/50 px-4 py-3 sm:col-span-2">
                  <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <div className="font-semibold">Built for practitioners</div>
                    <div className="text-muted-foreground">{EVENT.audienceLabel}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="gap-2">
                  <Link
                    href={EVENT.href}
                    onClick={() => track({ event: "cta_clicked", cta: "homepage_event_frame", location: "homepage_event_frame", destination: EVENT.href })}
                    data-testid="button-homepage-event-cta"
                  >
                    Explore the event
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Ticket className="h-4 w-4 text-primary" />
                  Ticketing details on the event page
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
