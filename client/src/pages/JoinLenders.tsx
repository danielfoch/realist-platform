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
import { Landmark, TrendingUp, BarChart3, CheckCircle2, ArrowRight, Shield, FileText, DollarSign } from "lucide-react";

const LENDING_TYPES = ["A Lender", "B Lender", "Private Lender", "CMHC Insured", "Construction", "Bridge", "Mezzanine", "Syndicated Mortgage"];
const CANADIAN_MARKETS = [
  "Ontario", "British Columbia", "Alberta", "Quebec", "Manitoba",
  "Saskatchewan", "Nova Scotia", "New Brunswick", "Newfoundland", "PEI",
  "National",
];

export default function JoinLenders() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    lendingTypes: [] as string[],
    targetMarkets: [] as string[],
    loanSizeMin: "",
    loanSizeMax: "",
    preferredDscr: "",
    preferredLtv: "",
    turnaroundTime: "",
    referralAgreement: false,
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/join/lender", data);
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

  const toggleArrayItem = (field: "lendingTypes" | "targetMarkets", item: string) => {
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
          <h1 className="text-3xl font-bold mb-4">Application Received!</h1>
          <p className="text-muted-foreground text-lg mb-8">
            Thank you for joining Realist.ca's lender network. We'll review your application and start routing qualified deal flow to you shortly.
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
        title="Join as a Lender Partner - Realist.ca"
        description="Receive qualified investor deal flow with underwriting already completed. Join Realist.ca's lender network."
        canonicalUrl="/join/lenders"
      />

      <div className="bg-gradient-to-br from-primary/10 via-background to-background border-b">
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-4" data-testid="badge-lender-hero">
              <Landmark className="h-3 w-3 mr-1" />
              Lender Partner Network
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" data-testid="text-lender-headline">
              Receive qualified deal flow <br className="hidden md:block" />
              <span className="text-primary">with underwriting completed.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Investors on Realist.ca underwrite deals before they seek financing.
              Get pre-analyzed deals with cap rates, DSCR, and cash flow projections already done.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {[
              { icon: FileText, label: "Pre-Underwritten Deals", desc: "Full financial analysis included" },
              { icon: Shield, label: "Verified Intent", desc: "Investors actively seeking financing" },
              { icon: DollarSign, label: "Pay Per Funded Deal", desc: "Only pay when deals close" },
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
            <CardTitle data-testid="text-lender-form-title">Join Free — Start Receiving Deal Flow</CardTitle>
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
              data-testid="form-lender-application"
            >
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" required data-testid="input-lender-name" />
                </div>
                <div>
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="Capital Corp" data-testid="input-lender-company" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="john@lender.ca" required data-testid="input-lender-email" />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(416) 555-0123" data-testid="input-lender-phone" />
                </div>
              </div>

              <div>
                <Label>Lending Types</Label>
                <div className="flex flex-wrap gap-2 mt-2" data-testid="select-lender-types">
                  {LENDING_TYPES.map(type => (
                    <Badge
                      key={type}
                      variant={form.lendingTypes.includes(type) ? "default" : "outline"}
                      className="cursor-pointer transition-colors"
                      onClick={() => toggleArrayItem("lendingTypes", type)}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Target Markets</Label>
                <div className="flex flex-wrap gap-2 mt-2" data-testid="select-lender-markets">
                  {CANADIAN_MARKETS.map(market => (
                    <Badge
                      key={market}
                      variant={form.targetMarkets.includes(market) ? "default" : "outline"}
                      className="cursor-pointer transition-colors"
                      onClick={() => toggleArrayItem("targetMarkets", market)}
                    >
                      {market}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="loanMin">Minimum Loan Size</Label>
                  <Select value={form.loanSizeMin} onValueChange={v => setForm(p => ({ ...p, loanSizeMin: v }))}>
                    <SelectTrigger data-testid="select-lender-loan-min">
                      <SelectValue placeholder="Select minimum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50k">$50K</SelectItem>
                      <SelectItem value="100k">$100K</SelectItem>
                      <SelectItem value="250k">$250K</SelectItem>
                      <SelectItem value="500k">$500K</SelectItem>
                      <SelectItem value="1m">$1M</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="loanMax">Maximum Loan Size</Label>
                  <Select value={form.loanSizeMax} onValueChange={v => setForm(p => ({ ...p, loanSizeMax: v }))}>
                    <SelectTrigger data-testid="select-lender-loan-max">
                      <SelectValue placeholder="Select maximum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="500k">$500K</SelectItem>
                      <SelectItem value="1m">$1M</SelectItem>
                      <SelectItem value="5m">$5M</SelectItem>
                      <SelectItem value="10m">$10M</SelectItem>
                      <SelectItem value="25m">$25M</SelectItem>
                      <SelectItem value="unlimited">No Limit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dscr">Preferred Minimum DSCR</Label>
                  <Select value={form.preferredDscr} onValueChange={v => setForm(p => ({ ...p, preferredDscr: v }))}>
                    <SelectTrigger data-testid="select-lender-dscr">
                      <SelectValue placeholder="Select DSCR" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.0">1.0x</SelectItem>
                      <SelectItem value="1.1">1.1x</SelectItem>
                      <SelectItem value="1.2">1.2x</SelectItem>
                      <SelectItem value="1.25">1.25x</SelectItem>
                      <SelectItem value="1.3">1.3x</SelectItem>
                      <SelectItem value="flexible">Flexible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ltv">Maximum LTV</Label>
                  <Select value={form.preferredLtv} onValueChange={v => setForm(p => ({ ...p, preferredLtv: v }))}>
                    <SelectTrigger data-testid="select-lender-ltv">
                      <SelectValue placeholder="Select LTV" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="65">65%</SelectItem>
                      <SelectItem value="70">70%</SelectItem>
                      <SelectItem value="75">75%</SelectItem>
                      <SelectItem value="80">80%</SelectItem>
                      <SelectItem value="85">85%</SelectItem>
                      <SelectItem value="90">90%</SelectItem>
                      <SelectItem value="95">95%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="turnaround">Typical Turnaround Time</Label>
                <Select value={form.turnaroundTime} onValueChange={v => setForm(p => ({ ...p, turnaroundTime: v }))}>
                  <SelectTrigger data-testid="select-lender-turnaround">
                    <SelectValue placeholder="Select timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">24 hours</SelectItem>
                    <SelectItem value="48h">48 hours</SelectItem>
                    <SelectItem value="1-week">1 week</SelectItem>
                    <SelectItem value="2-weeks">2 weeks</SelectItem>
                    <SelectItem value="30-days">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
                <Checkbox
                  id="referral"
                  checked={form.referralAgreement}
                  onCheckedChange={(checked) => setForm(p => ({ ...p, referralAgreement: checked === true }))}
                  data-testid="checkbox-lender-referral"
                />
                <Label htmlFor="referral" className="text-sm leading-relaxed cursor-pointer">
                  I agree to pay a referral fee on funded deals sourced through Realist.ca's investor network.
                </Label>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={mutation.isPending}
                data-testid="button-lender-submit"
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
