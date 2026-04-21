import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, AlertCircle, Loader2, Building, MapPin, ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { Helmet } from "react-helmet-async";

interface ProjectDetail {
  summary: {
    slug: string;
    project: string;
    developer: string;
    city: string;
    region: string;
    category: string;
    totalFloorplans: number;
    cuts: number;
    raises: number;
    flat: number;
    avgDeltaPct: number;
    maxCutPct: number | null;
    maxRaisePct: number | null;
  };
  floorplans: Array<{
    floorplan: string;
    bed: string;
    fromPsf: number;
    toPsf: number;
    deltaPct: number;
    direction: "CUT" | "RAISE" | "FLAT";
    fromDate: string;
    toDate: string;
  }>;
  comparableProjects: Array<{
    slug: string;
    project: string;
    city: string;
    avgDeltaPct: number;
    cuts: number;
    raises: number;
    totalFloorplans: number;
  }>;
}

const fmtPct = (n: number, d = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;

export default function SeoProjectDetail() {
  const [, params] = useRoute("/projects/:slug");
  const slug = params?.slug || "";
  const { data, isLoading, error } = useQuery<ProjectDetail>({
    queryKey: ["/api/seo/projects", slug],
    queryFn: async () => {
      const r = await fetch(`/api/seo/projects/${slug}`);
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
    enabled: !!slug,
    staleTime: 60 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container max-w-5xl mx-auto px-4 py-20 flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <SEO title="Project not found | Realist.ca" description="This pre-construction project page is no longer available." />
        <Navigation />
        <div className="container max-w-5xl mx-auto px-4 py-20 flex flex-col items-center gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-muted-foreground">Project not found.</p>
          <Link href="/biggest-price-drops-gta"><Button variant="outline">Browse all projects</Button></Link>
        </div>
      </div>
    );
  }

  const s = data.summary;
  const direction = s.avgDeltaPct < -1 ? "cutting" : s.avgDeltaPct > 1 ? "raising" : "holding";
  const directionLabel = direction === "cutting" ? "Lowered" : direction === "raising" ? "Raised" : "Held";
  const headline = `${s.project} (${s.city}) — ${directionLabel} pricing on ${s.cuts || s.raises} of ${s.totalFloorplans} floorplans`;
  const meta = `${s.project} by ${s.developer} in ${s.city}. ${s.cuts} price cuts, ${s.raises} raises across ${s.totalFloorplans} active floorplans. Avg PSF change ${fmtPct(s.avgDeltaPct, 1)}.`;

  // Article + Product schema
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${s.project} — Pre-Construction Pricing`,
    description: meta,
    brand: { "@type": "Brand", name: s.developer },
    category: s.category.replace(/_/g, " "),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "CAD",
      lowPrice: data.floorplans[0]?.toPsf || 0,
      highPrice: data.floorplans[data.floorplans.length - 1]?.toPsf || 0,
      offerCount: s.totalFloorplans,
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title={`${s.project} ${s.city} - Pre-Construction Prices & Cuts | Realist.ca`} description={meta} />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
      </Helmet>
      <Navigation />

      <div className="container max-w-5xl mx-auto px-4 py-8">
        <Link href="/biggest-price-drops-gta" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to all projects
        </Link>

        <div className="mb-6">
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant="outline"><Building className="h-3 w-3 mr-1" />{s.category.replace(/_/g, " ")}</Badge>
            <Badge variant="outline"><MapPin className="h-3 w-3 mr-1" />{s.city}, {s.region}</Badge>
            <Badge variant={direction === "cutting" ? "destructive" : direction === "raising" ? "default" : "secondary"}>
              {direction === "cutting" ? <TrendingDown className="h-3 w-3 mr-1" /> : direction === "raising" ? <TrendingUp className="h-3 w-3 mr-1" /> : null}
              Avg PSF {fmtPct(s.avgDeltaPct, 1)}
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2" data-testid="text-h1">{s.project}</h1>
          <p className="text-muted-foreground">{s.developer}</p>
          <p className="mt-4 text-lg leading-relaxed" data-testid="text-summary">{headline}. The deepest individual cut is {s.maxCutPct != null ? fmtPct(s.maxCutPct, 1) : "n/a"}; the largest raise is {s.maxRaisePct != null ? fmtPct(s.maxRaisePct, 1) : "n/a"}.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Stat label="Floorplans" value={s.totalFloorplans} />
          <Stat label="Cuts" value={s.cuts} className="text-red-600" />
          <Stat label="Raises" value={s.raises} className="text-green-600" />
          <Stat label="Avg Δ%" value={fmtPct(s.avgDeltaPct, 1)} className={s.avgDeltaPct < 0 ? "text-red-600" : "text-green-600"} />
        </div>

        {/* Floorplan table */}
        <Card className="mb-8">
          <CardHeader><CardTitle className="text-base">All floorplans — current pricing & movement</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th scope="col" className="px-4 py-2">Floorplan</th>
                    <th scope="col" className="px-4 py-2">Bed</th>
                    <th scope="col" className="px-4 py-2 text-right">From PSF</th>
                    <th scope="col" className="px-4 py-2 text-right">To PSF</th>
                    <th scope="col" className="px-4 py-2 text-right">Δ%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.floorplans.map((f, i) => (
                    <tr key={i} className="border-t" data-testid={`row-fp-${i}`}>
                      <td className="px-4 py-2">{f.floorplan || "—"}</td>
                      <td className="px-4 py-2">{f.bed}</td>
                      <td className="px-4 py-2 text-right tabular-nums">${f.fromPsf.toFixed(0)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">${f.toPsf.toFixed(0)}</td>
                      <td className={`px-4 py-2 text-right font-mono ${f.deltaPct < 0 ? "text-red-600" : f.deltaPct > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                        {fmtPct(f.deltaPct, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Comparable projects */}
        {data.comparableProjects.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-3">Similar projects in {s.region}</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {data.comparableProjects.map((c) => (
                <Link key={c.slug} href={`/projects/${c.slug}`} className="block p-4 rounded-lg border hover:border-primary hover:bg-muted/30 transition" data-testid={`link-comp-${c.slug}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{c.project}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-xs text-muted-foreground">{c.city} · {c.cuts} cuts / {c.raises} raises · Avg {fmtPct(c.avgDeltaPct, 1)}</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg mb-1">Is this project a deal? Run the numbers.</h3>
              <p className="text-sm text-muted-foreground">Free Canadian rental analyzer. Cap rate, IRR, cash flow, multiplex viability.</p>
            </div>
            <Link href="/tools/analyzer"><Button>Open Deal Analyzer</Button></Link>
          </CardContent>
        </Card>

        <p className="mt-6 text-xs text-muted-foreground">
          Source: Realist.ca analysis of public new construction listings via Red Bricks Data and Valery.ca.
          Pricing reflects published PSF movement only — not including builder incentives.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className={`text-2xl font-bold tabular-nums ${className || ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
