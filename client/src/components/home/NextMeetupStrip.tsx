import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays } from "lucide-react";
import type { CalendarEvent } from "@shared/meetupCalendar";

interface CalendarResponse {
  events: CalendarEvent[];
}

function shortWhen(iso: string, timezone: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: timezone || "America/Toronto",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

/**
 * Homepage band: the next few meetups across the network, one per city.
 * Renders nothing while loading or when nothing is posted, so the homepage
 * never shows an empty promise.
 */
export function NextMeetupStrip() {
  const { data } = useQuery<CalendarResponse>({
    queryKey: ["/api/meetups/calendar?limit=12"],
    staleTime: 5 * 60 * 1000,
  });

  const seen = new Set<string>();
  const events = (data?.events ?? []).filter((event) => {
    const key = event.city ?? event.key;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);

  if (events.length === 0) return null;

  return (
    <section className="border-b border-border/60 bg-background py-6" data-testid="section-next-meetups">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 md:flex-row md:items-center md:px-6">
        <div className="flex shrink-0 items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <CalendarDays className="h-4 w-4 text-primary" />
          Next meetups
        </div>
        <ul className="flex flex-1 flex-wrap gap-2">
          {events.map((event) => (
            <li key={event.key}>
              <Link
                href={`/meetups#${encodeURIComponent((event.city ?? "online").toLowerCase())}`}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/60"
                data-testid={`link-next-meetup-${(event.city ?? "online").toLowerCase().replace(/\s+/g, "-")}`}
              >
                <span className="font-medium">{event.city ?? event.title}</span>
                <span className="text-muted-foreground">{shortWhen(event.startsAt, event.timezone)}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/meetups" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary" data-testid="link-all-meetups">
          All cities
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
