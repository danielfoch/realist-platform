import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Unlock, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { track } from "@/lib/analytics";

/**
 * Capture card shown when an anonymous visitor hits the daily underwrite cap.
 *
 * The cap used to end in a red error banner — a dead end at the exact moment
 * someone had proven they were working real sites, which is the strongest buying
 * signal the product produces. Trading the rest of the day's underwrites for an
 * email converts that moment instead of wasting it.
 *
 * Deliberately not a wall on the first underwrite: gating a first impression
 * costs more in reach and shareability than it gains in addresses. This only
 * appears once someone has already run three.
 */
export function UnlockMoreUnderwrites({
  address,
  onUnlocked,
}: {
  /** The address they were trying to underwrite, for lead context. */
  address?: string;
  onUnlocked: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);

  const unlock = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/multiplex-underwriter/unlock", {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        consentEmail: true,
        address,
      });
      return res.json();
    },
    onSuccess: () => {
      setDone(true);
      track({ event: "cta_clicked", cta: "multiplex_unlock_completed", location: "/tools/multiplex-underwriter" });
      onUnlocked();
    },
  });

  const valid = name.trim().length > 0 && /\S+@\S+\.\S+/.test(email.trim());

  if (done) {
    return (
      <Card className="mx-auto max-w-xl border-emerald-500/30 bg-emerald-500/5">
        <CardHeader className="text-center">
          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" aria-hidden="true" />
          <CardTitle className="mt-2">You're good for the rest of today</CardTitle>
          <CardDescription>Run your next address — we'll be in touch about the sites you're looking at.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-xl border-primary/30" data-testid="unlock-more-underwrites">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Unlock className="h-5 w-5 text-primary" aria-hidden="true" />
          Keep going — that's today's free underwrites
        </CardTitle>
        <CardDescription>
          You've clearly got sites to work through. Leave your details and we'll open up the rest of
          the day, and Daniel and Nick can weigh in on what you're looking at.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="unlock-name">Name</Label>
            <Input
              id="unlock-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jordan Investor"
              autoComplete="name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unlock-email">Email</Label>
            <Input
              id="unlock-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unlock-phone">
            Phone <span className="text-muted-foreground">(optional — faster if a site looks live)</span>
          </Label>
          <Input
            id="unlock-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="416 555 1234"
            autoComplete="tel"
          />
        </div>

        {unlock.isError && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Couldn't unlock — please try again.
          </p>
        )}

        <Button className="w-full gap-2" disabled={!valid || unlock.isPending} onClick={() => unlock.mutate()}>
          {unlock.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Unlocking…</>
          ) : (
            <><Unlock className="h-4 w-4" aria-hidden="true" /> Unlock the rest of today</>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Or <a href="/signup" className="font-medium text-primary hover:underline">create a free account</a> for
          a higher limit every day.
        </p>
      </CardContent>
    </Card>
  );
}
