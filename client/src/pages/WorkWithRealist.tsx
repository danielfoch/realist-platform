import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { loadPropertyContext } from "@/lib/propertyContext";
import { track } from "@/lib/analytics";
import {
  ArrowRight, BadgeCheck, Calculator, CheckCircle2, Handshake,
  ShieldCheck, Users,
} from "lucide-react";

// This page deliberately does NOT collect a signature or create any binding
// agreement. Representation is a serious commitment: we capture interest here,
// then a licensed advisor walks the investor through the actual (lawyer-
// reviewed) agreement with full disclosure. Never turn this into a
// click-to-sign flow — that's the dark pattern the old "free premium for a
// BRA" tier was removed for.
const STEPS = [
  {
    icon: Calculator,
    title: "You analyze, we review",
    description: "Run your numbers on Realist. When a deal looks real, send it to us — an advisor reviews the underwriting with you, for free.",
  },
  {
    icon: Users,
    title: "We staff the deal",
    description: "A vetted local realtor, mortgage broker, and the building pros the deal needs (inspector, architect, planner) — matched from the Realist network.",
  },
  {
    icon: Handshake,
    title: "We see it through",
    description: "Offers, financing, diligence, closing. Investors rarely need to see properties in person — we run the deal so you can run your portfolio.",
  },
];

const HONEST_TERMS = [
  "The software stays free. Working with our team is optional and never required to use any Realist tool.",
  "If you choose representation, you'll review and sign a standard, plain-language agreement with a licensed brokerage — sent to you in writing, never buried in a checkout.",
  "Realist is compensated through standard industry commissions and referral arrangements on closed transactions, disclosed to you up front.",
  "You can talk to an advisor first with zero commitment.",
];

export default function WorkWithRealist() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const ctx = loadPropertyContext();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    dealAddress: ctx?.address ? [ctx.address, ctx.city].filter(Boolean).join(", ") : "",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/leads/engage", {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        formType: "Representation Interest",
        formTag: "representation_interest",
        tags: ["representation_interest"],
        dealInfo: {
          address: form.dealAddress || undefined,
          notes: form.notes || undefined,
        },
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      track({ event: "cta_clicked", cta: "representation_interest_submitted", location: "work_with_realist" });
    },
    onError: () => {
      toast({ title: "Couldn't send that", description: "Please try again or email us directly.", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Work with Realist — we see your deal through"
        description="Analyze deals free on Realist. When one is worth pursuing, our licensed team and vetted professional network take it from analysis to closing."
        canonicalUrl="/work-with-realist"
      />
      <Navigation />

      <main className="max-w-5xl mx-auto px-4 py-12 md:py-16 space-y-14">
        <section className="max-w-3xl space-y-5">
          <Badge variant="secondary" className="gap-1">
            <BadgeCheck className="h-3.5 w-3.5" />
            Deal-through representation
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-balance">
            The tools are free. When a deal is real, we see it through with you.
          </h1>
          <p className="text-lg text-muted-foreground">
            Realist isn't a software subscription business — we make money when your deal closes,
            through the professionals who execute it. That means our incentive is simple: help you
            find a deal that actually works, then staff it with people who can get it done.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {STEPS.map((step) => (
            <Card key={step.title}>
              <CardContent className="pt-6 space-y-3">
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <h2 className="font-semibold">{step.title}</h2>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="rounded-xl border border-border/60 bg-muted/20 p-6 md:p-8">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">How this works — no fine print</h2>
          </div>
          <ul className="space-y-3">
            {HONEST_TERMS.map((term) => (
              <li key={term} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                {term}
              </li>
            ))}
          </ul>
        </section>

        <section className="max-w-xl" id="talk-to-us">
          {submitted ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-6 text-center space-y-3">
                <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
                <h2 className="text-xl font-bold">You're in the queue</h2>
                <p className="text-sm text-muted-foreground">
                  An advisor will reach out within one business day. In the meantime, keep analyzing —
                  the more we know about your buy box, the better the match.
                </p>
                <Link href="/tools/analyzer">
                  <Button variant="outline" className="gap-2 mt-2">
                    Back to the analyzer
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <h2 className="text-xl font-bold">Talk to an advisor</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Zero commitment — tell us about you (and the deal, if there is one).
                  </p>
                </div>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!form.name.trim() || !form.email.trim()) {
                      toast({ title: "Name and email required", variant: "destructive" });
                      return;
                    }
                    mutation.mutate();
                  }}
                >
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="rep-name">Name *</Label>
                      <Input id="rep-name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} data-testid="input-rep-name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="rep-email">Email *</Label>
                      <Input id="rep-email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} data-testid="input-rep-email" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rep-phone">Phone (optional)</Label>
                    <Input id="rep-phone" type="tel" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} data-testid="input-rep-phone" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rep-address">Deal address (if you have one)</Label>
                    <Input id="rep-address" value={form.dealAddress} onChange={(e) => setForm((p) => ({ ...p, dealAddress: e.target.value }))} data-testid="input-rep-address" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rep-notes">What are you trying to do?</Label>
                    <Textarea id="rep-notes" rows={3} placeholder="e.g. First multiplex in Hamilton, $900k budget, want it fully managed" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} data-testid="input-rep-notes" />
                  </div>
                  <Button type="submit" size="lg" className="w-full gap-2" disabled={mutation.isPending} data-testid="button-rep-submit">
                    Talk to an advisor
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    This sends a message to our team — it doesn't sign you up for anything.
                  </p>
                </form>
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}
