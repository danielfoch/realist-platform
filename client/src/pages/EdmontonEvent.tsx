import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { SEO } from "@/components/SEO";
import { Navigation } from "@/components/Navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { track } from "@/lib/analytics";
import { ArrowRight, Building2, CalendarDays, Loader2, Target, Zap } from "lucide-react";

// Source attribution for everything captured from this page. The QR code at
// the event points at /edmonton (alias /yeg) — every lead, user enrollment,
// and activity event from here must carry this source.
const EVENT_SOURCE = "edmonton-event";
const EVENT_MEDIUM = "qr";
const EVENT_CAMPAIGN = "multiplex-edmonton-2026";

type ListedRealistEvent = {
  id: string;
  slug: string;
  title: string;
  city?: string | null;
  venueName?: string | null;
  startsAt: string;
  endsAt?: string | null;
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

const VALUE_BULLETS = [
  {
    icon: Zap,
    title: "Cash flow + DSCR instantly",
    description: "Monthly cash flow, cap rate, and debt coverage the moment you enter a property.",
  },
  {
    icon: Target,
    title: "Max offer price",
    description: "Work backwards from your target return to the most you should pay.",
  },
  {
    icon: Building2,
    title: "Works on any listing",
    description: "Any address or MLS listing — Edmonton or anywhere in Canada.",
  },
] as const;

export default function EdmontonEvent() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    track({ event: "page_viewed", path: location, title: "Realist Multiplex Edmonton" });
  }, [location]);

  // Secondary CTA: link to today's agenda only if an Edmonton event exists in
  // the native events module (admins create it separately — skip otherwise).
  const { data: events } = useQuery<ListedRealistEvent[]>({
    queryKey: ["/api/realist-events"],
    staleTime: 5 * 60 * 1000,
  });

  const edmontonEvent = useMemo(() => {
    if (!events?.length) return null;
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const candidates = events.filter((event) => {
      const haystack = `${event.slug} ${event.title} ${event.city ?? ""} ${event.venueName ?? ""}`.toLowerCase();
      if (!haystack.includes("edmonton")) return false;
      // Keep events that end today or later (don't link a long-past agenda).
      const endsAt = Date.parse(event.endsAt ?? event.startsAt);
      return !Number.isFinite(endsAt) || endsAt >= now - DAY_MS;
    });
    candidates.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    return candidates[0] ?? null;
  }, [events]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      toast({
        title: "Enter a valid email",
        description: "That's all we need to get you analyzing.",
        variant: "destructive",
      });
      return;
    }
    if (submitting) return;
    setSubmitting(true);

    // Derive a display name from the email — this page deliberately has no
    // name field. "dan.foch@..." → "dan foch".
    const displayName = cleanEmail.split("@")[0].replace(/[._+-]+/g, " ").trim() || cleanEmail;

    try {
      // Existing lead-capture path: creates the lead row (leadSource + utm
      // attribution), pipes to GHL/Sheets, notifies, and auto-enrolls a user
      // account by email alone (password setup link arrives by email).
      await apiRequest("POST", "/api/leads/engage", {
        name: displayName,
        email: cleanEmail,
        consent: true,
        formType: EVENT_SOURCE,
        formTag: "edmonton_event_landing",
        tags: ["edmonton_event", EVENT_CAMPAIGN],
        city: "Edmonton",
        province: "AB",
        utmSource: EVENT_SOURCE,
        utmMedium: EVENT_MEDIUM,
        utmCampaign: EVENT_CAMPAIGN,
      });
    } catch (err) {
      // Never strand an attendee mid-event: the analyzer works without the
      // server lead, and the activity event below still carries attribution.
      console.error("Edmonton event lead capture error:", err);
    }

    try {
      // Same flag Home.tsx writes after its lead-capture modal — unlocks the
      // analyzer results without re-prompting for contact info.
      localStorage.setItem(
        "realist_lead_info",
        JSON.stringify({ name: displayName, email: cleanEmail, phone: "", source: EVENT_SOURCE }),
      );
    } catch {}

    track({ event: "lead_captured", source: EVENT_SOURCE, geography: "Edmonton, AB" });

    const params = new URLSearchParams({
      q: "Edmonton multiplex",
      city: "Edmonton",
      state: "AB",
      utm_source: EVENT_SOURCE,
      utm_medium: EVENT_MEDIUM,
      utm_campaign: EVENT_CAMPAIGN,
    });
    setLocation(`/tools/analyzer?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SEO
        title="Realist Multiplex Edmonton — Free AI Deal Analyzer for Attendees"
        description="Free for Realist Multiplex Edmonton attendees: analyze any rental property with AI in 60 seconds. Cash flow, cap rate, and max offer price on any Edmonton property."
        canonicalUrl="/edmonton"
        noIndex
      />
      <Navigation />

      <main>
        {/* Hero — everything an attendee needs above the fold at 390px */}
        <section className="px-4 pt-10 pb-12 md:pt-20 md:pb-16">
          <div className="max-w-xl mx-auto text-center">
            <Badge className="mb-5 gap-1.5 px-3 py-1 text-xs md:text-sm" data-testid="badge-edmonton-event">
              <CalendarDays className="h-3.5 w-3.5" />
              Realist Multiplex Edmonton
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">
              Analyze any rental property with AI in 60 seconds
            </h1>
            <p className="mt-4 text-base md:text-lg text-muted-foreground">
              Free for event attendees — see the cash flow, cap rate, and max offer price on any Edmonton property.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row" data-testid="form-edmonton-signup">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-14 text-base flex-1"
                data-testid="input-edmonton-email"
              />
              <Button
                type="submit"
                size="lg"
                className="h-14 text-base gap-2 sm:px-6"
                disabled={submitting}
                data-testid="button-edmonton-start"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                {submitting ? "Setting you up..." : "Start analyzing"}
                {!submitting && <ArrowRight className="h-5 w-5" />}
              </Button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              No password needed. We&apos;ll email you a link to save your analyses.
            </p>
          </div>
        </section>

        {/* Below the fold — three tight value bullets */}
        <section className="px-4 pb-10 md:pb-14 border-t border-border/50 pt-10">
          <div className="max-w-xl mx-auto space-y-4">
            {VALUE_BULLETS.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start gap-4" data-testid={`bullet-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold leading-snug">{title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Secondary CTA — only when an Edmonton event exists in the events module */}
        {edmontonEvent && (
          <section className="px-4 pb-16">
            <div className="max-w-xl mx-auto">
              <Card>
                <CardContent className="p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">At the event today?</p>
                    <p className="text-sm text-muted-foreground">{edmontonEvent.title}</p>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2 shrink-0"
                    onClick={() => {
                      track({
                        event: "cta_clicked",
                        cta: "edmonton_event_agenda",
                        location: "edmonton_landing",
                        destination: `/events/${edmontonEvent.slug}`,
                      });
                      setLocation(`/events/${edmontonEvent.slug}`);
                    }}
                    data-testid="button-edmonton-agenda"
                  >
                    See today&apos;s agenda
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
