import { useEffect, useState } from "react";
import { useRoute, useSearch } from "wouter";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface PackageDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  eventScope: string | null;
  priceCents: number;
  currency: string;
  perks: string[];
  contractUrl: string | null;
  salesDeckUrl: string | null;
  soldOut: boolean;
}

/**
 * Private sponsorship package page. Unlisted — reachable only with the
 * direct link + access key we send to a prospect. They can review the
 * package, the sales deck, the agreement, and buy on the spot.
 */
export default function SponsorPackagePage() {
  const [, params] = useRoute("/sponsor/:slug");
  const search = useSearch();
  const query = new URLSearchParams(search);
  const key = query.get("key") || "";
  const purchased = query.get("purchased") === "1";

  const [pkg, setPkg] = useState<PackageDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState({ company: "", contactName: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.slug || !key) {
      setNotFound(true);
      return;
    }
    fetch(`/api/sponsor-packages/${params.slug}?key=${encodeURIComponent(key)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setPkg)
      .catch(() => setNotFound(true));
  }, [params?.slug, key]);

  async function buy() {
    if (!pkg) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sponsor-packages/${pkg.slug}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-2xl px-4 py-16">
          <h1 className="text-2xl font-bold">Package not available</h1>
          <p className="mt-2 text-muted-foreground">
            This link may have expired. Contact <a className="underline" href="mailto:jonathan@realist.ca">jonathan@realist.ca</a> for current sponsorship options.
          </p>
        </main>
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-2xl px-4 py-16 text-muted-foreground">Loading…</main>
      </div>
    );
  }

  const price = (pkg.priceCents / 100).toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Badge variant="secondary">Realist sponsorship — private offer</Badge>
        <h1 className="mt-3 text-3xl font-bold">{pkg.name}</h1>
        {pkg.eventScope && <p className="mt-1 text-muted-foreground">{pkg.eventScope}</p>}
        <p className="mt-4 text-4xl font-bold">{price} <span className="text-base font-normal text-muted-foreground">CAD</span></p>

        {purchased && (
          <Card className="mt-6 border-green-500/50">
            <CardContent className="p-5">
              <p className="font-semibold">✅ Sponsorship confirmed</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Receipt is in your inbox. Our team will reach out within one business day for logo assets and activation.
              </p>
            </CardContent>
          </Card>
        )}

        {pkg.description && (
          <div className="prose prose-neutral mt-6 max-w-none dark:prose-invert">
            {pkg.description.split("\n").map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>
        )}

        {pkg.perks.length > 0 && (
          <Card className="mt-6">
            <CardHeader><CardTitle className="text-base">What's included</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {pkg.perks.map((perk, index) => (
                  <li key={index} className="flex gap-2"><span>✔</span><span>{perk}</span></li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {pkg.salesDeckUrl && (
            <Button asChild variant="outline">
              <a href={pkg.salesDeckUrl} target="_blank" rel="noreferrer">View sales package</a>
            </Button>
          )}
          {pkg.contractUrl && (
            <Button asChild variant="outline">
              <a href={pkg.contractUrl} target="_blank" rel="noreferrer">View agreement</a>
            </Button>
          )}
        </div>

        {!purchased && (
          <Card className="mt-8">
            <CardHeader><CardTitle className="text-base">{pkg.soldOut ? "Sold out" : "Secure this sponsorship"}</CardTitle></CardHeader>
            {!pkg.soldOut && (
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="s-company">Company</Label>
                    <Input id="s-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s-contact">Contact name</Label>
                    <Input id="s-contact" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-email">Email</Label>
                  <Input id="s-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button className="w-full" size="lg" onClick={buy} disabled={busy || !form.company.trim() || !form.email.trim()}>
                  {busy ? "Redirecting to payment…" : `Purchase — ${price}`}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Payment is processed securely by Stripe. By purchasing you agree to the linked sponsorship agreement.
                </p>
              </CardContent>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
