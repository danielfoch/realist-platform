import { CalendarDays, MapPin, MonitorPlay, Users } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SpeakerCard } from "./SpeakerCard";
import { TicketSelector } from "./TicketSelector";
import { RsvpPanel } from "./RsvpPanel";
import { SponsorStrip } from "./SponsorStrip";
import { EventComments } from "./EventComments";
import type { RealistEventPayload } from "./types";

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone || "America/Toronto",
  }).format(new Date(value));
}

export function EventPageTemplate({ event }: { event: RealistEventPayload }) {
  const sold = event.ticketTypes.reduce((sum, ticket) => sum + (ticket.quantitySold || 0), 0);
  const soldOutByCapacity = event.capacity != null && sold >= event.capacity;
  const onlineLabel = event.eventType === "WEBINAR" ? "Online" : event.eventType === "HYBRID" ? "Hybrid" : "In person";
  const isFreeMeetup = event.kind === "meetup" || event.ticketTypes.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      {event.headerImageUrl && (
        <div className="h-[34vh] min-h-[280px] w-full overflow-hidden bg-muted">
          <img src={event.headerImageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1fr_360px] md:px-6">
        <section className="space-y-8">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{onlineLabel}</Badge>
              {event.kind === "meetup" && <Badge>Free meetup</Badge>}
              {event.city && <Badge variant="outline">{event.city}</Badge>}
              {event.isRecurring && <Badge variant="outline">{event.recurrenceNote || "Recurring"}</Badge>}
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{event.title}</h1>
            {event.shortDescription && <p className="max-w-3xl text-lg text-muted-foreground">{event.shortDescription}</p>}
            <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
              <div className="flex gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formatDate(event.startsAt, event.timezone)}</span>
              </div>
              <div className="flex gap-2">
                {event.eventType === "WEBINAR" ? <MonitorPlay className="mt-0.5 h-4 w-4 shrink-0" /> : <MapPin className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>{event.venueName || onlineLabel}{event.venueAddress ? ` · ${event.venueAddress}` : ""}</span>
              </div>
              {event.capacity != null && (
                <div className="flex gap-2">
                  <Users className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{soldOutByCapacity ? "Sold out" : `${Math.max(0, event.capacity - sold)} spots remaining`}</span>
                </div>
              )}
            </div>
          </div>

          {event.longDescription && (
            <div className="prose prose-neutral max-w-none dark:prose-invert">
              {event.longDescription.split("\n").map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          )}

          {event.speakers.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Speakers</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {event.speakers.map((speaker) => <SpeakerCard key={speaker.id || speaker.name} speaker={speaker} />)}
              </div>
            </section>
          )}

          {event.agendaSections.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Agenda</h2>
              <div className="divide-y rounded-lg border">
                {event.agendaSections.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="grid gap-2 p-4 md:grid-cols-[120px_1fr]">
                    <div className="text-sm font-medium text-muted-foreground">{item.time || ""}</div>
                    <div>
                      <h3 className="font-semibold">{item.title}</h3>
                      {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {event.onlineUrl && (
            <section className="rounded-lg border bg-muted/40 p-5">
              <h2 className="font-semibold">Online access</h2>
              <a className="mt-2 block text-sm text-primary underline" href={event.onlineUrl} target="_blank" rel="noreferrer">
                Join the event
              </a>
            </section>
          )}

          <SponsorStrip />

          <EventComments slug={event.slug} />

          {event.refundPolicy && (
            <section className="space-y-3">
              <Separator />
              <h2 className="text-xl font-semibold">Refund policy</h2>
              <p className="text-sm leading-6 text-muted-foreground">{event.refundPolicy}</p>
            </section>
          )}
        </section>

        <aside className="md:sticky md:top-24 md:self-start">
          {soldOutByCapacity ? (
            <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">This event is sold out.</div>
          ) : isFreeMeetup ? (
            <RsvpPanel slug={event.slug} />
          ) : (
            <TicketSelector slug={event.slug} tickets={event.ticketTypes} />
          )}
        </aside>
      </main>
    </div>
  );
}
