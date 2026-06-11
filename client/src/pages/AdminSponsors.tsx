import { useCallback, useEffect, useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import type { RealistSponsor } from "@/components/events/types";

interface PackageRow {
  id: string;
  slug: string;
  accessKey: string;
  name: string;
  eventScope: string | null;
  priceCents: number;
  quantityTotal: number | null;
  quantitySold: number;
  isActive: boolean;
}

const TIERS = ["title", "gold", "silver", "partner"];

export default function AdminSponsors() {
  const [sponsors, setSponsors] = useState<RealistSponsor[]>([]);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [sponsorForm, setSponsorForm] = useState({ name: "", logoUrl: "", websiteUrl: "", tier: "partner" });
  const [pkgForm, setPkgForm] = useState({
    name: "", slug: "", eventScope: "", priceCents: "1000000", perks: "", contractUrl: "", salesDeckUrl: "", description: "", quantityTotal: "",
  });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [sponsorRes, pkgRes] = await Promise.all([
        fetch("/api/admin/sponsors", { credentials: "include" }),
        fetch("/api/admin/sponsor-packages", { credentials: "include" }),
      ]);
      if (sponsorRes.status === 401 || sponsorRes.status === 403) {
        window.location.href = "/login?next=/admin/sponsors";
        return;
      }
      setSponsors(await sponsorRes.json());
      setPackages(await pkgRes.json());
    } catch (err) {
      console.error("Failed to load sponsors admin", err);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addSponsor() {
    setError(null);
    try {
      await apiRequest("POST", "/api/admin/sponsors", {
        ...sponsorForm,
        logoUrl: sponsorForm.logoUrl || null,
        websiteUrl: sponsorForm.websiteUrl || null,
      });
      setSponsorForm({ name: "", logoUrl: "", websiteUrl: "", tier: "partner" });
      await load();
    } catch (err: any) { setError(err.message); }
  }

  async function toggleSponsor(sponsor: RealistSponsor) {
    await apiRequest("PATCH", `/api/admin/sponsors/${sponsor.id}`, { isActive: !sponsor.isActive });
    await load();
  }

  async function addPackage() {
    setError(null);
    try {
      await apiRequest("POST", "/api/admin/sponsor-packages", {
        name: pkgForm.name,
        slug: pkgForm.slug,
        eventScope: pkgForm.eventScope || null,
        priceCents: Number(pkgForm.priceCents),
        perks: pkgForm.perks.split("\n").map((perk) => perk.trim()).filter(Boolean),
        contractUrl: pkgForm.contractUrl || null,
        salesDeckUrl: pkgForm.salesDeckUrl || null,
        description: pkgForm.description || null,
        quantityTotal: pkgForm.quantityTotal ? Number(pkgForm.quantityTotal) : null,
      });
      setPkgForm({ name: "", slug: "", eventScope: "", priceCents: "1000000", perks: "", contractUrl: "", salesDeckUrl: "", description: "", quantityTotal: "" });
      await load();
    } catch (err: any) { setError(err.message); }
  }

  function packageLink(pkg: PackageRow): string {
    return `${window.location.origin}/sponsor/${pkg.slug}?key=${pkg.accessKey}`;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold">Sponsors</h1>
          <p className="text-sm text-muted-foreground">
            Active sponsors show on event pages and the events hub. Packages are private buy-now links.
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}

        <Card>
          <CardHeader><CardTitle className="text-base">Sponsor logos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-5">
              <Input placeholder="Name" value={sponsorForm.name} onChange={(e) => setSponsorForm({ ...sponsorForm, name: e.target.value })} />
              <Input placeholder="Logo URL" value={sponsorForm.logoUrl} onChange={(e) => setSponsorForm({ ...sponsorForm, logoUrl: e.target.value })} />
              <Input placeholder="Website" value={sponsorForm.websiteUrl} onChange={(e) => setSponsorForm({ ...sponsorForm, websiteUrl: e.target.value })} />
              <Select value={sponsorForm.tier} onValueChange={(tier) => setSponsorForm({ ...sponsorForm, tier })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIERS.map((tier) => <SelectItem key={tier} value={tier}>{tier}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={addSponsor} disabled={!sponsorForm.name.trim()}>Add sponsor</Button>
            </div>
            <div className="divide-y">
              {sponsors.map((sponsor) => (
                <div key={sponsor.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    {sponsor.logoUrl && <img src={sponsor.logoUrl} alt="" className="h-8 max-w-[100px] object-contain" />}
                    <span className="font-medium">{sponsor.name}</span>
                    <Badge variant="outline">{sponsor.tier}</Badge>
                    {!sponsor.isActive && <Badge variant="secondary">Hidden</Badge>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => toggleSponsor(sponsor)}>
                    {sponsor.isActive ? "Hide" : "Show"}
                  </Button>
                </div>
              ))}
              {sponsors.length === 0 && <p className="py-3 text-sm text-muted-foreground">No sponsors yet.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Sponsorship packages (private links)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="Package name (e.g. Toronto 2026 — Gold)" value={pkgForm.name} onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value, slug: pkgForm.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} />
              <Input placeholder="Slug" value={pkgForm.slug} onChange={(e) => setPkgForm({ ...pkgForm, slug: e.target.value })} />
              <Input placeholder="Event scope (e.g. Multiplex Conference Toronto, Sep 2026)" value={pkgForm.eventScope} onChange={(e) => setPkgForm({ ...pkgForm, eventScope: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input type="number" placeholder="Price (cents)" value={pkgForm.priceCents} onChange={(e) => setPkgForm({ ...pkgForm, priceCents: e.target.value })} />
                <Input type="number" placeholder="Qty (blank = unlimited)" value={pkgForm.quantityTotal} onChange={(e) => setPkgForm({ ...pkgForm, quantityTotal: e.target.value })} />
              </div>
              <Input placeholder="Contract URL" value={pkgForm.contractUrl} onChange={(e) => setPkgForm({ ...pkgForm, contractUrl: e.target.value })} />
              <Input placeholder="Sales deck URL" value={pkgForm.salesDeckUrl} onChange={(e) => setPkgForm({ ...pkgForm, salesDeckUrl: e.target.value })} />
              <Textarea className="md:col-span-2" placeholder="Description (shown on the private page)" value={pkgForm.description} onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })} />
              <Textarea className="md:col-span-2" placeholder={"Perks — one per line\nLogo on stage + site\n2 VIP tickets"} value={pkgForm.perks} onChange={(e) => setPkgForm({ ...pkgForm, perks: e.target.value })} />
            </div>
            <Button onClick={addPackage} disabled={!pkgForm.name.trim() || !pkgForm.slug.trim()}>Create package</Button>

            <div className="divide-y">
              {packages.map((pkg) => (
                <div key={pkg.id} className="space-y-1 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{pkg.name}</span>
                      <Badge variant="outline">${(pkg.priceCents / 100).toLocaleString()}</Badge>
                      {pkg.quantityTotal !== null && (
                        <Badge variant="secondary">{pkg.quantitySold}/{pkg.quantityTotal} sold</Badge>
                      )}
                      {!pkg.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(packageLink(pkg))}>
                      Copy private link
                    </Button>
                  </div>
                  <p className="break-all text-xs text-muted-foreground">{packageLink(pkg)}</p>
                </div>
              ))}
              {packages.length === 0 && <p className="py-3 text-sm text-muted-foreground">No packages yet.</p>}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
