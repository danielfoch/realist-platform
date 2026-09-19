import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, ExternalLink, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { CalendarEvent } from "@shared/meetupCalendar";

/**
 * The RSVP moment for a meetup whose RSVP lives on Meetup.com or Eventbrite.
 * Realist captures the person first (free account + lead), then either the
 * RSVP is placed through Meetup's API (connected member) or the visitor gets
 * the event page to finish in one tap. In "notify" mode there is no event
 * yet; the same capture becomes a "tell me when the date is posted".
 */
export type RsvpTarget =
  | { mode: "rsvp"; event: CalendarEvent }
  | { mode: "notify"; city: string };

interface RsvpResponse {
  ok: boolean;
  placed: boolean;
  url: string | null;
  accountCreated: boolean;
  duplicate: boolean;
}

function formatWhen(iso: string, timezone: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone || "America/Toronto",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function MeetupRsvpDialog({
  target,
  onClose,
}: {
  target: RsvpTarget | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<RsvpResponse | null>(null);

  // Prefill from the account and reset between targets.
  useEffect(() => {
    if (!target) return;
    setResult(null);
    setName([user?.firstName, user?.lastName].filter(Boolean).join(" "));
    setEmail(user?.email ?? "");
  }, [target, user?.firstName, user?.lastName, user?.email]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error("Nothing selected");
      const body =
        target.mode === "rsvp"
          ? {
              source: target.event.source,
              eventId: target.event.id,
              title: target.event.title,
              city: target.event.city,
              startsAt: target.event.startsAt,
              url: target.event.url.startsWith("/") ? `${window.location.origin}${target.event.url}` : target.event.url,
              name: name.trim() || undefined,
              email: email.trim() || undefined,
            }
          : {
              source: "notify",
              eventId: target.city,
              title: `${target.city} meetup`,
              city: target.city,
              name: name.trim() || undefined,
              email: email.trim() || undefined,
            };
      const response = await apiRequest("POST", "/api/meetups/rsvp", body);
      return (await response.json()) as RsvpResponse;
    },
    onSuccess: (data) => setResult(data),
  });

  const open = target !== null;
  const title =
    target?.mode === "rsvp" ? target.event.title : target ? `${target.city} meetup` : "";
  const externalHost =
    target?.mode === "rsvp"
      ? target.event.source === "meetup"
        ? "Meetup.com"
        : target.event.source === "eventbrite"
          ? "Eventbrite"
          : "Realist"
      : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-meetup-rsvp">
        {target && !result && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>{target.mode === "rsvp" ? "Save my spot" : "Tell me when it's posted"}</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{title}</p>
                  {target.mode === "rsvp" && (
                    <p className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatWhen(target.event.startsAt, target.event.timezone)}
                    </p>
                  )}
                  {target.mode === "rsvp" && (target.event.venueName || target.event.city) && (
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {[target.event.venueName, target.event.city].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>

            {!user && (
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="meetup-rsvp-name">Name</Label>
                  <Input id="meetup-rsvp-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required data-testid="input-meetup-rsvp-name" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="meetup-rsvp-email">Email</Label>
                  <Input id="meetup-rsvp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required data-testid="input-meetup-rsvp-email" />
                </div>
              </div>
            )}

            {mutation.isError && (
              <p className="text-sm text-destructive" role="alert">
                {(mutation.error as Error).message || "Something went wrong. Try again."}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-meetup-rsvp-submit">
              {mutation.isPending ? "Saving…" : target.mode === "rsvp" ? "Continue" : "Notify me"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {target.mode === "rsvp" && externalHost !== "Realist"
                ? `RSVPs for this meetup are hosted on ${externalHost}; you'll finish there in one tap. `
                : ""}
              Your email creates a free Realist account (reminders, the deal analyzer, nothing else). Unsubscribe any time.
            </p>
          </form>
        )}

        {target && result && (
          <div className="space-y-4" data-testid="meetup-rsvp-success">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                {target.mode === "notify" ? "You're on the list" : result.placed ? "You're in" : "One more tap"}
              </DialogTitle>
              <DialogDescription>
                {target.mode === "notify"
                  ? `We'll email you the moment the ${target.city} date is posted.`
                  : result.placed
                    ? `Your RSVP for ${title} is confirmed.`
                    : `Confirm your spot on ${externalHost} so the host can plan for you. We've also emailed you the link.`}
              </DialogDescription>
            </DialogHeader>
            {target.mode === "rsvp" && !result.placed && result.url && (
              <Button asChild className="w-full" data-testid="button-meetup-rsvp-open">
                <a href={result.url} target={result.url.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer">
                  Confirm on {externalHost}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            )}
            <Button variant="outline" className="w-full" onClick={onClose} data-testid="button-meetup-rsvp-done">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
