import { Link } from "wouter";
import { CalendarDays, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FLAGSHIP_EVENT, hasEnded } from "@/lib/flagshipEvent";

/**
 * Big always-on promo bar for the current flagship event, pinned to the top of
 * the events page. Deliberately self-contained (not driven by the Eventbrite
 * feed or the native events query) so it can never silently disappear the way
 * the feed-driven "Featured Event" card did when those sources returned empty.
 *
 * Event details come from @/lib/flagshipEvent — they used to be hardcoded here
 * and in EventPromoFrame, and the two had already drifted to different taglines
 * for the same evening. It still auto-hides once the event has ended.
 */
const FLAGSHIP = {
  ...FLAGSHIP_EVENT,
  dateLabel: `${FLAGSHIP_EVENT.dateLabel} · ${FLAGSHIP_EVENT.timeLabel}`,
  venueLabel: FLAGSHIP_EVENT.venueDetail,
};

export function FlagshipEventBanner() {
  if (hasEnded()) return null;

  return (
    <section aria-label="Featured event" className="border-b border-primary/20 bg-gradient-to-r from-primary/15 via-primary/5 to-accent/15">
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-5">
        <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center">
          <img
            src={FLAGSHIP.heroImage}
            alt={FLAGSHIP.title}
            className="hidden h-20 w-32 shrink-0 rounded-lg object-cover md:block"
            loading="eager"
          />
          <div className="min-w-0 flex-1">
            <div className="mb-1 inline-flex items-center gap-2">
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary-foreground">
                Featured event
              </span>
              <span className="text-xs font-medium text-muted-foreground">Tickets on sale now</span>
            </div>
            <h2 className="truncate text-lg font-bold md:text-xl" data-testid="text-flagship-title">
              {FLAGSHIP.title}
            </h2>
            <div className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-4">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 shrink-0 text-primary" /> {FLAGSHIP.dateLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0 text-primary" /> {FLAGSHIP.venueLabel}
              </span>
            </div>
          </div>
          <div className="shrink-0">
            <Button asChild size="lg" className="w-full gap-2 md:w-auto" data-testid="button-flagship-cta">
              <Link href={FLAGSHIP.href}>
                Get tickets <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
