import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Users, TrendingUp, BarChart3, CheckCircle2, ArrowRight, Building2, MapPin, DollarSign } from "lucide-react";

const ASSET_TYPES = ["Residential", "Multiplex (2-4 units)", "Multi-Family (5+)", "Commercial", "Mixed-Use", "Land", "Pre-Construction"];
const DEAL_TYPES = ["Investment", "End User", "Off-Market", "Assignment", "Pre-Construction"];
const CANADIAN_MARKETS = [
  "Toronto, ON", "Vancouver, BC", "Calgary, AB", "Edmonton, AB", "Ottawa, ON",
  "Montreal, QC", "Winnipeg, MB", "Hamilton, ON", "Kitchener, ON", "London, ON",
  "Halifax, NS", "Victoria, BC", "Saskatoon, SK", "Regina, SK", "St. Catharines, ON",
  "Windsor, ON", "Oshawa, ON", "Barrie, ON", "Kelowna, BC", "Guelph, ON",
];

export default function JoinRealtors() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    brokerage: "",
    markets: [] as string[],
    assetTypes: [] as string[],
    dealTypes: [] as string[],
    avgDealSize: "",
    referralAgreement: false,
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/join/realtor", data);
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "Application submitted!", description: "We'll be in touch shortly." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleArrayItem = (field: "markets" | "assetTypes" | "dealTypes", item: string) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item],
    }));
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-20 max-w-2xl text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-4">You're In!</h1>
          <p className="text-muted-foreground text-lg mb-8">
            Your application has been submitted. We're reviewing it now and will connect you with active investors in your market shortly.
          </p>
          <Button onClick={() => window.location.href = "/"} data-testid="button-back-home">
            Back to Realist.ca
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SEO
        title="Join as a Realtor Partner - Realist.ca"
        description="Get access to active real estate investors analyzing deals right now. Join Realist.ca's realtor partner network."
        canonicalUrl="/join/realtors"
      />

      <div className="bg-gradient-to-br from-primary/10 via-background to-background border-b">
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-4" data-testid="badge-realtor-hero">
              <Building2 className="h-3 w-3 mr-1" />
              Realtor Partner Network
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" data-testid="text-realtor-headline">
              Get access to active investors <br className="hidden md:block" />
              <span className="text-primary">analyzing deals right now.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              11,000+ investors use Realist.ca to underwrite deals daily.
              Get matched with high-intent buyers in your market.
              Only pay on closed referrals.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {[
              { icon: Users, label: "11,000+ Active Investors", desc: "Real buyers analyzing real deals" },
              { icon: TrendingUp, label: "High-Intent Leads", desc: "Pre-qualified with underwriting data" },
              { icon: DollarSign, label: "Pay Per Close", desc: "Only pay when referrals convert" },
            ].map((item) => (
              <Card key={item.label} className="text-center">
                <CardContent className="pt-6 pb-4">
                  <item.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="font-semibold text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-realtor-form-title">Join Free — Start Receiving Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.name || !form.email) {
                  toast({ title: "Required fields", description: "Please fill in your name and email.", variant: "destructive" });
                  return;
                }
                mutation.mutate(form);
              }}
              className="space-y-6"
              data-testid="form-realtor-application"
            >
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Jane Smith" required data-testid="input-realtor-name" />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="jane@brokerage.ca" required data-testid="input-realtor-email" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(416) 555-0123" data-testid="input-realtor-phone" />
                </div>
                <div>
                  <Label htmlFor="brokerage">Brokerage</Label>
                  <Input id="brokerage" value={form.brokerage} onChange={e => setForm(p => ({ ...p, brokerage: e.target.value }))} placeholder="Royal LePage" data-testid="input-realtor-brokerage" />
                </div>
              </div>

              <div>
                <Label>Markets Served</Label>
                <div className="flex flex-wrap gap-2 mt-2" data-testid="select-realtor-markets">
                  {CANADIAN_MARKETS.map(market => (
                    <Badge
                      key={market}
                      variant={form.markets.includes(market) ? "default" : "outline"}
                      className="cursor-pointer transition-colors"
                      onClick={() => toggleArrayItem("markets", market)}
                      data-testid={`market-${market.split(",")[0].toLowerCase()}`}
                    >
                      {market}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Asset Types</Label>
                <div className="flex flex-wrap gap-2 mt-2" data-testid="select-realtor-assets">
                  {ASSET_TYPES.map(type => (
                    <Badge
                      key={type}
                      variant={form.assetTypes.includes(type) ? "default" : "outline"}
                      className="cursor-pointer transition-colors"
                      onClick={() => toggleArrayItem("assetTypes", type)}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Deal Types</Label>
                <div className="flex flex-wrap gap-2 mt-2" data-testid="select-realtor-deals">
                  {DEAL_TYPES.map(type => (
                    <Badge
                      key={type}
                      variant={form.dealTypes.includes(type) ? "default" : "outline"}
                      className="cursor-pointer transition-colors"
                      onClick={() => toggleArrayItem("dealTypes", type)}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="avgDealSize">Average Deal Size</Label>
                <Select value={form.avgDealSize} onValueChange={v => setForm(p => ({ ...p, avgDealSize: v }))}>
                  <SelectTrigger data-testid="select-realtor-deal-size">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="under-500k">Under $500K</SelectItem>
                    <SelectItem value="500k-1m">$500K – $1M</SelectItem>
                    <SelectItem value="1m-2m">$1M – $2M</SelectItem>
                    <SelectItem value="2m-5m">$2M – $5M</SelectItem>
                    <SelectItem value="5m-plus">$5M+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
                <Checkbox
                  id="referral"
                  checked={form.referralAgreement}
                  onCheckedChange={(checked) => setForm(p => ({ ...p, referralAgreement: checked === true }))}
                  data-testid="checkbox-realtor-referral"
                />
                <Label htmlFor="referral" className="text-sm leading-relaxed cursor-pointer">
                  I agree to pay a referral fee on closed deals from investor leads provided through Realist.ca.
                  Standard referral rate is 25% of gross commission.
                </Label>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={mutation.isPending}
                data-testid="button-realtor-submit"
              >
                {mutation.isPending ? "Submitting..." : "Join Free"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
