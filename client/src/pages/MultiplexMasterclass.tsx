import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2, CheckCircle2, ArrowRight, DollarSign, Users,
  BookOpen, Shield, TrendingUp, MapPin, Loader2,
  Play, Award, Calendar, Phone, Zap, Target, Star,
  GraduationCap, Hammer, FileText, Calculator, Video,
  ChevronDown, X, BarChart3, Activity
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface PlatformStats {
  totalDeals: number;
  communityMembers: number;
  marketsCovered: number;
  avgCapRate: number | null;
  avgCashOnCash: number | null;
  avgDscr: number | null;
}

const PRICE = 999;
const CURRENCY = "CAD";

export default function MultiplexMasterclass() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    intent: "",
    consent: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const { toast } = useToast();
  const formRef = useRef<HTMLDivElement>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const { data: stats } = useQuery<PlatformStats>({
    queryKey: ["/api/platform-stats"],
    staleTime: 1000 * 60 * 30,
  });

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/masterclass/lead", formData);
      setFormSubmitted(true);
      toast({ title: "Information saved! Proceeding to checkout..." });
    } catch (err: any) {
      toast({ title: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    try {
      const res = await apiRequest("POST", "/api/masterclass/checkout", {
        email: formData.email,
        name: formData.name,
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "Checkout error. Please try again.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Failed to start checkout. Please try again.", variant: "destructive" });
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <>
      <SEO
        title="Multiplex Masterclass Canada - Build Your First Multiplex"
        description="Learn how to build a multiplex in Canada. Financing, zoning, construction, and CMHC rebates simplified. Get instant access to the Multiplex Masterclass."
        keywords="multiplex, fourplex, triplex, Canada real estate, CMHC, MLI Select, missing middle housing, real estate investing"
        canonicalUrl="/masterclass"
      />

      <div className="min-h-screen bg-white dark:bg-gray-950">
        {/* Sticky CTA Bar */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-gray-900 text-white py-2.5 px-4 text-center text-sm font-medium" data-testid="sticky-cta-bar">
          <span className="hidden sm:inline">Limited Time — </span>
          <span>Multiplex Masterclass Canada</span>
          <span className="mx-2">·</span>
          <span className="font-bold">${PRICE} {CURRENCY}</span>
          <Button
            size="sm"
            onClick={scrollToForm}
            className="ml-3 bg-red-500 hover:bg-red-600 text-white h-7 text-xs px-3"
            data-testid="sticky-cta-button"
          >
            Get Access
          </Button>
        </div>

        {/* HERO */}
        <section className="relative pt-20 pb-16 md:pt-28 md:pb-24 overflow-hidden" data-testid="hero-section">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: "radial-gradient(circle at 25% 50%, rgba(239,68,68,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(249,115,22,0.2) 0%, transparent 50%)"
          }} />
          <div className="relative max-w-5xl mx-auto px-4 text-center">
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 mb-6 text-xs uppercase tracking-wider" data-testid="hero-badge">
              The Only Course You Need
            </Badge>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight tracking-tight mb-6" data-testid="hero-headline">
              Build a Multiplex<br />
              <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">in Canada</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-4" data-testid="hero-subheadline">
              Financing, zoning, construction, and CMHC rebates — simplified into one actionable program.
            </p>
            <p className="text-sm text-gray-400 mb-8">
              {stats ? (
                <>Join {stats.communityMembers}+ members who have analyzed {stats.totalDeals}+ deals across {stats.marketsCovered}+ Canadian markets.</>
              ) : (
                <>Join hundreds of Canadian investors who are building wealth through missing middle housing.</>
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                onClick={scrollToForm}
                className="bg-red-500 hover:bg-red-600 text-white text-lg px-8 py-6 rounded-xl shadow-lg shadow-red-500/25"
                data-testid="hero-cta"
              >
                Get Instant Access <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
            <div className="mt-8 flex items-center justify-center gap-6 text-sm text-gray-400 flex-wrap">
              <span className="flex items-center gap-1.5"><Shield className="w-4 h-4" /> 30-Day Guarantee</span>
              <span className="flex items-center gap-1.5"><Play className="w-4 h-4" /> Instant Access</span>
              <span className="flex items-center gap-1.5"><BarChart3 className="w-4 h-4" /> {stats ? `${stats.totalDeals}+` : "Dozens of"} Deals Analyzed</span>
            </div>
          </div>
        </section>

        {/* OPPORTUNITY */}
        <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-900" data-testid="opportunity-section">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                The Biggest Opportunity in Canadian Real Estate
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Canada's housing crisis has created a once-in-a-generation window. Governments are fast-tracking zoning changes and CMHC is offering unprecedented financing terms for multiplex builders.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="border-0 shadow-md bg-white dark:bg-gray-800" data-testid="opportunity-card-zoning">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                    <MapPin className="w-6 h-6 text-red-500" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">Zoning is Changing</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Toronto, Vancouver, Calgary, and more are allowing up to 4 units on single-family lots. First movers win.</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md bg-white dark:bg-gray-800" data-testid="opportunity-card-financing">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
                    <DollarSign className="w-6 h-6 text-orange-500" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">CMHC Advantage</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">MLI Select offers up to 95% LTV, 50-year amortization, and premium discounts for energy-efficient multiplexes.</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md bg-white dark:bg-gray-800" data-testid="opportunity-card-demand">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">Missing Middle Demand</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Canada needs 5.8M new homes by 2030. Multiplexes are the fastest path to rental supply — and cash flow.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* WHAT YOU'LL LEARN */}
        <section className="py-16 md:py-24" data-testid="curriculum-section">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
              <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 mb-4">Curriculum</Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Everything You Need to Build Confidently
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                From financing to framing — no gaps, no fluff, just the playbook.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { icon: DollarSign, title: "Financing & MLI Select", desc: "Master CMHC's MLI Select program. Learn how to qualify for 95% LTV and 50-year amortization on multiplex projects." },
                { icon: MapPin, title: "Zoning Rules by City", desc: "Detailed zoning breakdown for Toronto, Vancouver, Ottawa, Calgary, and other major markets. Know what's buildable." },
                { icon: Target, title: "Site Selection", desc: "How to find and evaluate land. Lot dimensions, setbacks, FSI calculations, and the math behind site viability." },
                { icon: Hammer, title: "Construction & Costs", desc: "Hard costs, soft costs, timelines, and how to manage contractors. Real budgets from real projects across Canada." },
                { icon: Calculator, title: "Underwriting & Returns", desc: `Run the numbers like a pro. Cap rates, cash-on-cash, DSCR, and how to stress-test your deal before committing.${stats ? ` Our community has underwritten ${stats.totalDeals}+ deals and counting.` : ""}` },
                { icon: FileText, title: "Real Deal Walkthroughs", desc: "Step-by-step breakdowns of completed multiplex projects. See what worked, what didn't, and the actual financials." },
              ].map((item, i) => (
                <div key={i} className="flex gap-4 p-5 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors" data-testid={`curriculum-item-${i}`}>
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHO IT'S FOR */}
        <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-900" data-testid="audience-section">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Built For Canadians Ready to Act
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: TrendingUp, title: "Real Estate Investors", desc: "You want to scale beyond single-family. Multiplexes offer better cash flow, better financing, and better returns per dollar invested.", color: "red" },
                { icon: Building2, title: "Homeowners", desc: "You own a lot and want to maximize it. Learn what's possible on your property and how to finance the build.", color: "orange" },
                { icon: Users, title: "Realtors & Advisors", desc: "Differentiate yourself. Advise clients on multiplex opportunities with confidence. Become the go-to expert in your market.", color: "blue" },
              ].map((item, i) => (
                <Card key={i} className="border-0 shadow-md bg-white dark:bg-gray-800" data-testid={`audience-card-${i}`}>
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 rounded-xl bg-${item.color}-500/10 flex items-center justify-center mb-4`}>
                      <item.icon className={`w-6 h-6 text-${item.color}-500`} />
                    </div>
                    <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">{item.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* PROOF / SOCIAL */}
        <section className="py-16 md:py-24" data-testid="proof-section">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Backed by Real Data
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                This isn't theory — Realist.ca is Canada's most active deal analysis platform. Our community runs the numbers every day.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-12">
              {[
                { value: stats ? `${stats.totalDeals}+` : "—", label: "Deals Analyzed", icon: BarChart3 },
                { value: stats ? `${stats.communityMembers}+` : "—", label: "Community Members", icon: Users },
                { value: stats ? `${stats.marketsCovered}+` : "—", label: "Markets Covered", icon: MapPin },
                { value: stats?.avgCapRate != null ? `${stats.avgCapRate}%` : "—", label: "Avg Cap Rate", icon: TrendingUp },
              ].map((stat, i) => (
                <div key={i} className="text-center p-5 md:p-6 rounded-xl bg-gray-50 dark:bg-gray-800" data-testid={`proof-stat-${i}`}>
                  <stat.icon className="w-6 h-6 text-red-500 mx-auto mb-2" />
                  <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white font-mono">{stat.value}</div>
                  <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-0 shadow-md bg-white dark:bg-gray-800" data-testid="proof-credibility-1">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                      <Award className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">Built by Practitioners</div>
                      <div className="text-xs text-gray-500">Not Theorists</div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Created by active multiplex developers and real estate professionals who have built and financed projects across Canada. Every lesson comes from direct experience.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md bg-white dark:bg-gray-800" data-testid="proof-credibility-2">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-violet-500" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">Live Platform KPIs</div>
                      <div className="text-xs text-gray-500">Updated in Real-Time</div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {stats ? (
                      <>{stats.communityMembers}+ members have analyzed {stats.totalDeals}+ deals across {stats.marketsCovered}+ cities{stats.avgDscr != null ? `, with an average DSCR of ${stats.avgDscr}x` : ''}. These are real numbers from real Canadian investors running real underwriting — and you'll learn exactly how they do it.</>
                    ) : (
                      <>Our community runs deal analysis across Canadian markets every day. The stats above come from real underwriting by real investors — and you'll learn exactly how they do it.</>
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* OFFER */}
        <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-900" data-testid="offer-section">
          <div className="max-w-4xl mx-auto px-4">
            <div className="text-center mb-8">
              <Badge className="bg-red-500/20 text-red-500 border-red-500/30 mb-4">Your Investment</Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Everything You Get Today
              </h2>
            </div>
            <Card className="border-2 border-red-500/20 shadow-xl bg-white dark:bg-gray-800 overflow-hidden" data-testid="offer-card">
              <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white py-3 px-6 text-center text-sm font-semibold">
                MULTIPLEX MASTERCLASS CANADA — COMPLETE PROGRAM
              </div>
              <CardContent className="p-6 md:p-8">
                <div className="space-y-3 mb-8">
                  {[
                    "Everything you need to know to build a multiplex in Canada",
                    "The only type of investment that is working right now",
                    "How to access up to $100,000 in rebates",
                    "Access to a team of professionals",
                    "Weekly group coaching calls",
                    "Underwriting templates & financial models",
                    "Site selection checklists & zoning guides",
                    "Real deal breakdowns with actual numbers",
                    "Private community access",
                    `Full access to Realist.ca deal analyzer${stats ? ` (${stats.totalDeals}+ deals analyzed to date)` : ""}`,
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3" data-testid={`offer-item-${i}`}>
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 pt-6 text-center">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">One-time investment</div>
                  <div className="text-5xl font-bold text-gray-900 dark:text-white font-mono mb-1" data-testid="offer-price">
                    ${PRICE}
                    <span className="text-lg font-normal text-gray-500 ml-1">{CURRENCY}</span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-6">Lifetime access · No recurring fees</div>
                  <Button
                    size="lg"
                    onClick={scrollToForm}
                    className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white text-lg px-10 py-6 rounded-xl shadow-lg shadow-red-500/25"
                    data-testid="offer-cta"
                  >
                    Get Instant Access <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                  <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> 30-Day Money Back</span>
                    <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> Instant Access</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 md:py-24" data-testid="faq-section">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-8 text-center">
              Frequently Asked Questions
            </h2>
            <div className="space-y-2">
              {[
                { q: "Is this relevant outside of Toronto?", a: "Yes. The program covers zoning and financing across all major Canadian markets including Vancouver, Calgary, Ottawa, Montreal, and more. We include province-specific guidance for every module." },
                { q: "Do I need construction experience?", a: "No. We walk you through every step from site selection to managing contractors. The program is designed for investors and homeowners, not builders." },
                { q: "How long do I have access?", a: "Lifetime. Once you purchase, you have permanent access to all course materials, future updates, and the private community." },
                { q: "What if I'm not satisfied?", a: "We offer a full 30-day money-back guarantee. If the program doesn't meet your expectations, email us for a complete refund — no questions asked." },
                { q: "Are the coaching calls included?", a: "Yes. Weekly group coaching calls are included with your purchase for up to 1 year. You'll be able to ask questions and get live feedback from the team." },
              ].map((faq, i) => (
                <div key={i} className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden" data-testid={`faq-item-${i}`}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    data-testid={`faq-toggle-${i}`}
                  >
                    <span className="font-medium text-gray-900 dark:text-white pr-4">{faq.q}</span>
                    <ChevronDown className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FORM + CHECKOUT */}
        <section className="py-16 md:py-24 bg-gray-900" ref={formRef} data-testid="checkout-section">
          <div className="max-w-xl mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                {formSubmitted ? "Complete Your Purchase" : "Get Started Now"}
              </h2>
              <p className="text-gray-400">
                {formSubmitted
                  ? "Click below to complete your secure checkout."
                  : "Fill in your details below, then proceed to secure checkout."
                }
              </p>
            </div>

            {!formSubmitted ? (
              <Card className="border-0 shadow-2xl bg-white dark:bg-gray-800" data-testid="lead-form-card">
                <CardContent className="p-6 md:p-8">
                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name *</Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="John Smith"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="mt-1"
                        required
                        data-testid="input-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="mt-1"
                        required
                        data-testid="input-email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(416) 555-0123"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="mt-1"
                        required
                        data-testid="input-phone"
                      />
                    </div>
                    <div>
                      <Label htmlFor="intent" className="text-sm font-medium text-gray-700 dark:text-gray-300">What best describes you?</Label>
                      <Select
                        value={formData.intent}
                        onValueChange={(val) => setFormData({ ...formData, intent: val })}
                      >
                        <SelectTrigger className="mt-1" data-testid="select-intent">
                          <SelectValue placeholder="Select one..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="investor">Real Estate Investor</SelectItem>
                          <SelectItem value="homeowner">Homeowner Looking to Build</SelectItem>
                          <SelectItem value="realtor">Realtor / Advisor</SelectItem>
                          <SelectItem value="developer">Developer / Builder</SelectItem>
                          <SelectItem value="curious">Just Exploring</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-start gap-2 pt-2">
                      <Checkbox
                        id="consent"
                        checked={formData.consent}
                        onCheckedChange={(checked) => setFormData({ ...formData, consent: checked === true })}
                        data-testid="checkbox-consent"
                      />
                      <Label htmlFor="consent" className="text-xs text-gray-500 dark:text-gray-400 leading-tight cursor-pointer">
                        I agree to receive communications about the Multiplex Masterclass and related programs.
                      </Label>
                    </div>
                    <Button
                      type="submit"
                      size="lg"
                      disabled={isSubmitting}
                      className="w-full bg-red-500 hover:bg-red-600 text-white text-lg py-6 rounded-xl shadow-lg shadow-red-500/25"
                      data-testid="button-submit-form"
                    >
                      {isSubmitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Saving...</> : <>Continue to Checkout · ${PRICE} {CURRENCY}</>}
                    </Button>
                  </form>
                  <p className="text-xs text-gray-400 text-center mt-4">
                    Your information is secure. We never share your data.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-2xl bg-white dark:bg-gray-800" data-testid="checkout-card">
                <CardContent className="p-6 md:p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Details Saved!</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                    Hi {formData.name.split(" ")[0]}, click below to complete your purchase securely via Stripe.
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white font-mono">${PRICE} <span className="text-base font-normal text-gray-500">{CURRENCY}</span></div>
                    <div className="text-xs text-gray-400 mt-1">One-time payment · Lifetime access</div>
                  </div>
                  <Button
                    size="lg"
                    onClick={handleCheckout}
                    disabled={isCheckingOut}
                    className="w-full bg-red-500 hover:bg-red-600 text-white text-lg py-6 rounded-xl shadow-lg shadow-red-500/25"
                    data-testid="button-checkout"
                  >
                    {isCheckingOut ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Redirecting to Stripe...</> : <>Complete Purchase · ${PRICE} {CURRENCY}</>}
                  </Button>
                  <button
                    onClick={() => setFormSubmitted(false)}
                    className="text-sm text-gray-400 hover:text-gray-600 mt-3 inline-block"
                    data-testid="button-edit-details"
                  >
                    ← Edit my details
                  </button>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {/* FOOTER */}
        <footer className="py-8 bg-gray-950 text-center" data-testid="footer-section">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-sm text-gray-500">
              © {new Date().getFullYear()} Realist.ca · Multiplex Masterclass Canada
            </div>
            <div className="text-xs text-gray-600 mt-2">
              <a href="/privacy" className="hover:text-gray-400">Privacy Policy</a>
              <span className="mx-2">·</span>
              <a href="/terms" className="hover:text-gray-400">Terms of Service</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}