import { Link } from "wouter";
import { CalendarDays, MapPin, ArrowRight, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { FLAGSHIP_EVENT, hasEnded, urgencyLabel } from "@/lib/flagshipEvent";

/**
 * Flagship-event CTA for the multiplex tool pages.
 *
 * The multiplex tools and the multiplex event had no links between them in
 * either direction, which is a strange gap: someone who has just been told their
 * lot supports six units as-of-right is the single best-qualified attendee the
 * event will ever see, and they were being shown nothing.
 *
 * `placement="result"` is the high-intent variant — shown after an underwrite
 * completes, where the copy can reference what the person just did. `"inline"`
 * is the quieter pre-result version.
 *
 * Renders nothing once the event has passed (see hasEnded), so this does not need
 * removing after September.
 */
export function MultiplexEventCta({
  placement = "inline",
  sourcePage,
  className,
}: {
  placement?: "inline" | "result";
  sourcePage: string;
  className?: string;
}) {
  if (hasEnded()) return null;

  const urgency = urgencyLabel();
  const isResult = placement === "result";

  const onClick = () =>
    track({
      event: "cta_clicked",
      cta: `multiplex_event_${placement}`,
      location: sourcePage,
      destination: FLAGSHIP_EVENT.href,
    });

  return (
    <section
      aria-label="Multiplex event"
      className={[
        "rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 p-5",
        className ?? "",
      ].join(" ")}
      data-testid={`multiplex-event-cta-${placement}`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <img
          src={FLAGSHIP_EVENT.heroImage}
          alt=""
          aria-hidden="true"
          className="hidden h-20 w-32 shrink-0 rounded-lg object-cover md:block"
          loading="lazy"
        />

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary-foreground">
              <Ticket className="h-3 w-3" aria-hidden="true" />
              {FLAGSHIP_EVENT.kicker}
            </span>
            {urgency && (
              <span className="text-xs font-semibold text-primary">{urgency}</span>
            )}
          </div>

          <h3 className="text-base font-bold md:text-lg">
            {isResult
              ? "Take this site to the people who build them"
              : FLAGSHIP_EVENT.title}
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            {isResult
              ? "Bring this underwrite to Unpacking Multiplexes Toronto and pressure-test it with the architects, planners, lenders and builders who do this work — the same people who'd stamp, finance and frame it."
              : FLAGSHIP_EVENT.description}
          </p>

          <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-4">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              {FLAGSHIP_EVENT.dateLabel} · {FLAGSHIP_EVENT.timeLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              {FLAGSHIP_EVENT.venueDetail}
            </span>
          </div>
        </div>

        <div className="shrink-0">
          <Button asChild size="lg" className="w-full gap-2 md:w-auto" onClick={onClick}>
            <Link href={FLAGSHIP_EVENT.href}>
              Get tickets <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
