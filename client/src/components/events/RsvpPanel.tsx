import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * One-tap RSVP for free events. For logged-out visitors this doubles as
 * account creation — two fields, no password (a set-password link is
 * emailed). Keeping this frictionless is the whole funnel.
 */
export function RsvpPanel({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
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
        body: JSON.stringify({ email: email.trim() || undefined, name: name.trim() || undefined }),
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
        {state === "account_created" && (
          <Button asChild className="mt-3 w-full" variant="outline">
            <a href="/deal-analyzer">Try the 60-second deal analyzer →</a>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-5">
      <div>
        <p className="text-lg font-semibold">Free event — RSVP</p>
        <p className="text-sm text-muted-foreground">Takes 10 seconds. No account? We'll make you one.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="rsvp-name">Name</Label>
        <Input id="rsvp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Investor" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rsvp-email">Email</Label>
        <Input id="rsvp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" size="lg" onClick={rsvp} disabled={state === "busy"}>
        {state === "busy" ? "Saving…" : "RSVP — I'm going"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Already have an account? RSVPs use your login automatically when signed in.
      </p>
    </div>
  );
}
