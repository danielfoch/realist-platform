import { useEffect, useState } from "react";
import { Link, useRoute, useSearch } from "wouter";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type VerifyState =
  | { status: "loading" }
  | { status: "paid"; eventTitle: string }
  | { status: "processing" }
  | { status: "error"; message: string };

export default function EventSuccess() {
  const [, params] = useRoute("/events/:slug/success");
  const slug = params?.slug || "";
  const search = useSearch();
  const sessionId = new URLSearchParams(search).get("session_id") || "";
  const [state, setState] = useState<VerifyState>({ status: "loading" });

  useEffect(() => {
    if (!slug || !sessionId) {
      setState({ status: "error", message: "Missing checkout session." });
      return;
    }
    let cancelled = false;
    let attempts = 0;

    async function verify() {
      attempts += 1;
      try {
        const res = await fetch(
          `/api/events/${encodeURIComponent(slug)}/verify-payment?session_id=${encodeURIComponent(sessionId)}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: "error", message: data.error || "We couldn't verify your payment." });
          return;
        }
        if (data.outcome === "paid") {
          setState({ status: "paid", eventTitle: data.eventTitle });
        } else if (data.outcome === "processing" && attempts < 4) {
          // Async payment methods can take a few seconds to settle.
          setTimeout(verify, 2000);
          setState({ status: "processing" });
        } else if (data.outcome === "processing") {
          setState({ status: "processing" });
        } else {
          setState({ status: "error", message: "This payment did not complete." });
        }
      } catch {
        if (!cancelled) setState({ status: "error", message: "We couldn't reach the server to verify your payment." });
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [slug, sessionId]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-2xl px-4 py-16">
        <Card>
          <CardContent className="p-8 text-center">
            {state.status === "loading" && (
              <>
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                <h1 className="mt-4 text-3xl font-bold tracking-tight">Confirming your payment…</h1>
              </>
            )}
            {state.status === "paid" && (
              <>
                <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
                <h1 className="mt-4 text-3xl font-bold tracking-tight">You're registered</h1>
                <p className="mt-3 text-muted-foreground">
                  Your ticket for <strong>{state.eventTitle}</strong> is confirmed. A confirmation email is on its way.
                </p>
              </>
            )}
            {state.status === "processing" && (
              <>
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                <h1 className="mt-4 text-3xl font-bold tracking-tight">Payment received</h1>
                <p className="mt-3 text-muted-foreground">
                  Your payment is still settling. We'll email your confirmation as soon as it clears — you can safely close this page.
                </p>
              </>
            )}
            {state.status === "error" && (
              <>
                <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
                <h1 className="mt-4 text-3xl font-bold tracking-tight">We couldn't confirm your payment</h1>
                <p className="mt-3 text-muted-foreground">{state.message} If you were charged, email hello@realist.ca and we'll sort it out.</p>
              </>
            )}
            <Button asChild className="mt-6">
              <Link href={`/events/${slug}`}>Back to event</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
