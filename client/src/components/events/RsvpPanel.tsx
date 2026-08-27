import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { ExternalLink } from "lucide-react";

/**
 * One-tap RSVP for free events. For logged-out visitors this doubles as
 * account creation — two fields, no password (a set-password link is
 * emailed). Keeping this frictionless is the whole funnel.
 */
export function RsvpPanel({ slug, externalUrl }: { slug: string; externalUrl?: string | null }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [accountConsent, setAccountConsent] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done" | "account_created">("idle");
  const [error, setError] = useState<string | null>(null);

  async function rsvp() {
    setState("busy");
    setError(null);
    try {
      const res = await fetch(`/api/realist-events/${slug}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim() || undefined,
          name: name.trim() || undefined,
          accountConsent: isAuthenticated ? undefined : accountConsent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to RSVP");
      setState(data.accountCreated ? "account_created" : "done");
    } catch (err: any) {
      setError(err.message);
      setState("idle");
    }
  }

  if (state === "done" || state === "account_created") {
    return (
      <div className="rounded-lg border bg-card p-5">
        <p className="font-semibold">🎉 You're on the list!</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {state === "account_created"
            ? "We created your free Realist account — check your email to set a password. Your account also gets you our AI deal analyzer."
            : "Check your email for the confirmation. See you there."}
        </p>
        {externalUrl && (
          <p className="mt-2 text-xs text-muted-foreground">
            This confirms your Realist RSVP. Meetup.com keeps a separate attendee list.
          </p>
        )}
        {state === "account_created" && (
          <Button asChild className="mt-3 w-full" variant="outline">
            <a href="/deal-analyzer">Try the 60-second deal analyzer →</a>
          </Button>
        )}
        {externalUrl && (
          <Button asChild className="mt-2 w-full" variant="ghost">
            <a href={externalUrl} target="_blank" rel="noreferrer">
              View the original Meetup listing <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-5">
      <div>
        <p className="text-lg font-semibold">Reserve your spot</p>
        <p className="text-sm text-muted-foreground">
          {isAuthenticated
            ? `You're signed in${user?.firstName ? ` as ${user.firstName}` : ""}.`
            : "One RSVP creates your free Realist investor account."}
        </p>
      </div>
      {!isLoading && !isAuthenticated && (
        <>
          <div className="space-y-2">
            <Label htmlFor="rsvp-name">Name</Label>
            <Input id="rsvp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Investor" autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rsvp-email">Email</Label>
            <Input id="rsvp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </div>
          <div className="flex items-start gap-2 rounded-md bg-muted/40 p-3">
            <Checkbox
              id="rsvp-consent"
              checked={accountConsent}
              onCheckedChange={(checked) => setAccountConsent(checked === true)}
              data-testid="checkbox-rsvp-consent"
            />
            <Label htmlFor="rsvp-consent" className="cursor-pointer text-xs font-normal leading-5 text-muted-foreground">
              Create my free Realist account and send event confirmations and reminders. I agree to the{" "}
              <a href="/terms" className="underline" onClick={(event) => event.stopPropagation()}>terms</a> and{" "}
              <a href="/privacy" className="underline" onClick={(event) => event.stopPropagation()}>privacy policy</a>.
            </Label>
          </div>
        </>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        className="w-full"
        size="lg"
        onClick={rsvp}
        disabled={state === "busy" || isLoading || (!isAuthenticated && (!email.trim() || !accountConsent))}
      >
        {state === "busy" ? "Saving…" : "RSVP — I'm going"}
      </Button>
      <p className="text-xs text-muted-foreground">
        {externalUrl
          ? "Your Realist RSVP and Meetup.com RSVP are separate. Event details stay synchronized here."
          : "Already have an account? Sign in first and your RSVP attaches automatically."}
      </p>
      {externalUrl && (
        <Button asChild className="w-full" variant="outline">
          <a href={externalUrl} target="_blank" rel="noreferrer">
            View on Meetup.com <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      )}
    </div>
  );
}
