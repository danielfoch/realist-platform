import { useEffect, useRef, useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { track } from "@/lib/analytics";

const PROPERTY_TYPES = [
  { value: "detached", label: "Detached" },
  { value: "semi", label: "Semi-Detached" },
  { value: "townhouse", label: "Townhouse" },
  { value: "condo", label: "Condo" },
  { value: "duplex", label: "Duplex" },
  { value: "triplex", label: "Triplex" },
  { value: "fourplex", label: "Fourplex" },
  { value: "multiplex", label: "Multiplex" },
  { value: "other", label: "Other" },
];

interface SubmitResult {
  opportunityId: string;
  dealId: string | null;
  intentScore: number;
  band: "hot" | "warm" | "nurture" | "audience";
  dealScore: number | null;
  suggestedNextAction: string | null;
}

function bandMessage(band: SubmitResult["band"]): { headline: string; detail: string } {
  if (band === "hot") {
    return {
      headline: "You're at the top of our queue — expect a call shortly",
      detail: "Our team prioritizes deals like this one. Keep your phone handy.",
    };
  }
  if (band === "warm") {
    return {
      headline: "We'll reach out within 24 hours",
      detail: "Your deal is in our review queue and a team member will follow up soon.",
    };
  }
  return {
    headline: "We'll be in touch — keep analyzing deals",
    detail: "The more deals you analyze, the better we can match you with opportunities.",
  };
}

export default function DealDesk() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");

  const prefillAddress = params.get("address") ?? "";
  const prefillMarket = params.get("market") ?? "";
  const prefillPrice = params.get("price") ?? "";
  const prefillRent = params.get("rent") ?? "";
  const prefillAnalysisId = params.get("analysisId") ?? "";
  const src = params.get("src") ?? "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [propertyAddress, setPropertyAddress] = useState(prefillAddress);
  const [listingUrl, setListingUrl] = useState("");
  const [market, setMarket] = useState(prefillMarket);
  const [propertyType, setPropertyType] = useState("");
  const [purchasePrice, setPurchasePrice] = useState(prefillPrice);
  const [estimatedRent, setEstimatedRent] = useState(prefillRent);
  const [financingHelp, setFinancingHelp] = useState(false);
  const [buyingHelp, setBuyingHelp] = useState(false);
  const [notes, setNotes] = useState("");
  const [consentEmail, setConsentEmail] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);

  const trackedCta = useRef(false);

  useEffect(() => {
    const hasPrefill =
      prefillAddress || prefillMarket || prefillPrice || prefillRent || prefillAnalysisId || src;
    if (hasPrefill && !trackedCta.current) {
      trackedCta.current = true;
      track({ event: "deal_desk_cta_clicked", source: src });
    }
  }, [prefillAddress, prefillMarket, prefillPrice, prefillRent, prefillAnalysisId, src]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !propertyAddress.trim()) {
      setError("Email and property address are required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/deal-desk/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim(),
          phone: phone.trim() || undefined,
          propertyAddress: propertyAddress.trim(),
          listingUrl: listingUrl.trim() || undefined,
          market: market.trim() || undefined,
          propertyType: propertyType || undefined,
          purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
          estimatedRent: estimatedRent ? Number(estimatedRent) : undefined,
          financingHelp,
          buyingHelp,
          notes: notes.trim() || undefined,
          consentEmail,
          analysisId: prefillAnalysisId || undefined,
          sessionId: sessionStorage.getItem("_rsid") ?? undefined,
          source: src || "deal_desk_page",
        }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        throw new Error(body?.error || `Submission failed (${res.status})`);
      }

      const data = body.data as SubmitResult;
      setResult(data);
      track({
        event: "deal_submitted",
        band: data.band,
        source: src || "deal_desk_page",
        analysis_id: data.dealId ?? undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const msg = bandMessage(result.band);
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-12 max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl" data-testid="text-deal-desk-success-title">Deal submitted ✓</CardTitle>
              <CardDescription>{propertyAddress}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
                <p className="font-semibold text-emerald-900 dark:text-emerald-100">{msg.headline}</p>
                <p className="text-sm text-emerald-800 dark:text-emerald-200 mt-1">{msg.detail}</p>
              </div>
              {result.suggestedNextAction && (
                <p className="text-sm text-muted-foreground">
                  Suggested next step: {result.suggestedNextAction}
                </p>
              )}
              {result.dealScore !== null && (
                <p className="text-xs text-muted-foreground">
                  Deal score {result.dealScore} · Intent score {result.intentScore}
                </p>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-12 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl" data-testid="text-deal-desk-title">Submit to Deal Desk</CardTitle>
            <CardDescription>
              Send us a deal you're serious about and our team will review it with you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dd-name">Name</Label>
                  <Input
                    id="dd-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    data-testid="input-deal-desk-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dd-email">Email *</Label>
                  <Input
                    id="dd-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    data-testid="input-deal-desk-email"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dd-phone">Phone</Label>
                <Input
                  id="dd-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(416) 555-0123"
                  data-testid="input-deal-desk-phone"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dd-address">Property address *</Label>
                <Input
                  id="dd-address"
                  required
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  placeholder="123 Main St, Toronto, ON"
                  data-testid="input-deal-desk-address"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dd-listing-url">Listing URL</Label>
                <Input
                  id="dd-listing-url"
                  type="url"
                  value={listingUrl}
                  onChange={(e) => setListingUrl(e.target.value)}
                  placeholder="https://..."
                  data-testid="input-deal-desk-listing-url"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dd-market">Market / City</Label>
                  <Input
                    id="dd-market"
                    value={market}
                    onChange={(e) => setMarket(e.target.value)}
                    placeholder="Toronto"
                    data-testid="input-deal-desk-market"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dd-property-type">Property type</Label>
                  <Select value={propertyType} onValueChange={setPropertyType}>
                    <SelectTrigger id="dd-property-type" data-testid="select-deal-desk-property-type">
                      <SelectValue placeholder="Select type…" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dd-price">Purchase price ($)</Label>
                  <Input
                    id="dd-price"
                    type="number"
                    min="0"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="850000"
                    data-testid="input-deal-desk-price"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dd-rent">Estimated monthly rent ($)</Label>
                  <Input
                    id="dd-rent"
                    type="number"
                    min="0"
                    value={estimatedRent}
                    onChange={(e) => setEstimatedRent(e.target.value)}
                    placeholder="3200"
                    data-testid="input-deal-desk-rent"
                  />
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="dd-financing"
                    checked={financingHelp}
                    onCheckedChange={(checked) => setFinancingHelp(checked === true)}
                    data-testid="checkbox-deal-desk-financing"
                  />
                  <Label htmlFor="dd-financing" className="font-normal cursor-pointer">
                    I want financing help
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="dd-buying"
                    checked={buyingHelp}
                    onCheckedChange={(checked) => setBuyingHelp(checked === true)}
                    data-testid="checkbox-deal-desk-buying"
                  />
                  <Label htmlFor="dd-buying" className="font-normal cursor-pointer">
                    I want help buying this property
                  </Label>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dd-notes">Notes</Label>
                <Textarea
                  id="dd-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="Anything we should know about this deal…"
                  className="resize-none"
                  data-testid="input-deal-desk-notes"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="dd-consent"
                  checked={consentEmail}
                  onCheckedChange={(checked) => setConsentEmail(checked === true)}
                  data-testid="checkbox-deal-desk-consent"
                />
                <Label htmlFor="dd-consent" className="font-normal cursor-pointer">
                  Email me about this deal and similar opportunities
                </Label>
              </div>

              {error && (
                <div
                  className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting} data-testid="button-deal-desk-submit">
                {submitting ? "Submitting…" : "Submit to Deal Desk"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
