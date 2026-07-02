import { type ReactNode, useMemo, useState, useEffect } from "react";
import { usePersistedTab } from "@/hooks/use-persisted-tab";
import { Link } from "wouter";
import { SEO, organizationSchema, softwareSchema, websiteSchema } from "@/components/SEO";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  BrainCircuit,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Database,
  FileSearch,
  Handshake,
  Network,
  ShieldCheck,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import {
  calculateListingUnderwriting,
  exportFeedbackTrainingEvents,
  getFeedbackWeight,
  sampleListingFeedbackEvents,
  sampleListingIntelligence,
  sampleProfessionals,
  summarizeFeedbackEvents,
  type ListingFeedbackEvent,
  type ListingFeedbackInputType,
  type ProfessionalRole,
} from "@shared/listingIntelligence";

const roleOptions: Array<{ value: ProfessionalRole; label: string }> = [
  { value: "investor", label: "Investor" },
  { value: "realtor", label: "Realtor" },
  { value: "contractor", label: "Contractor" },
  { value: "property_manager", label: "Property manager" },
  { value: "lender", label: "Lender / broker" },
  { value: "appraiser", label: "Appraiser" },
  { value: "inspector", label: "Inspector" },
  { value: "insurance_broker", label: "Insurance broker" },
  { value: "lawyer", label: "Lawyer" },
  { value: "wholesaler", label: "Wholesaler" },
  { value: "admin", label: "Realist admin" },
];

const inputTypeOptions: Array<{ value: ListingFeedbackInputType; label: string }> = [
  { value: "comment", label: "General comment" },
  { value: "deal_rating", label: "Deal rating" },
  { value: "price_feedback", label: "Price feedback" },
  { value: "rent_feedback", label: "Rent feedback" },
  { value: "expense_feedback", label: "Expense feedback" },
  { value: "repair_estimate", label: "Repair estimate" },
  { value: "arv_feedback", label: "ARV feedback" },
  { value: "offer_strategy", label: "Offer strategy" },
  { value: "risk_flag", label: "Risk flag" },
  { value: "financing_feedback", label: "Financing feedback" },
  { value: "comparable_note", label: "Comparable note" },
  { value: "inspection_note", label: "Inspection note" },
  { value: "professional_quote", label: "Professional quote" },
];

const fieldOptions = [
  { value: "none", label: "No numeric field" },
  { value: "purchasePrice", label: "Purchase price" },
  { value: "monthlyRent", label: "Monthly rent" },
  { value: "renovationBudget", label: "Renovation budget" },
  { value: "afterRepairValue", label: "After-repair value" },
  { value: "annualPropertyTax", label: "Property tax" },
  { value: "annualInsurance", label: "Insurance" },
  { value: "annualUtilities", label: "Utilities" },
  { value: "annualRepairsMaintenance", label: "Repairs and maintenance" },
  { value: "annualPropertyManagement", label: "Property management" },
  { value: "annualOtherExpenses", label: "Other expenses" },
  { value: "interestRate", label: "Interest rate" },
  { value: "zoning", label: "Zoning / legal use" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function scoreTone(score: number) {
  if (score >= 72) return "text-emerald-600";
  if (score >= 55) return "text-amber-600";
  return "text-rose-600";
}

function MetricTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function ScorePanel({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <p className="text-sm font-semibold">{label}</p>
        </div>
        <p className={`text-xl font-bold ${scoreTone(value)}`}>{value}</p>
      </div>
      <Progress value={value} className="mt-3 h-2" />
    </div>
  );
}

export default function ListingIntelligence() {
  const [activeTab, setActiveTab] = usePersistedTab("listingIntelligence.activeTab", "underwriting", ["underwriting", "feedback", "professionals", "training"]);
  const [events, setEvents] = useState<ListingFeedbackEvent[]>(sampleListingFeedbackEvents);
  const [role, setRole] = useState<ProfessionalRole>("investor");
  const [inputType, setInputType] = useState<ListingFeedbackInputType>("rent_feedback");
  const [fieldAffected, setFieldAffected] = useState("monthlyRent");
  const [suggestedValue, setSuggestedValue] = useState("6800");
  const [confidence, setConfidence] = useState("70");
  const [comment, setComment] = useState("This only works if the rent assumption is validated by leases or a property manager.");
  const [inspected, setInspected] = useState(false);

  const result = useMemo(() => calculateListingUnderwriting(sampleListingIntelligence, events), [events]);
  const feedbackSummary = useMemo(() => summarizeFeedbackEvents(events), [events]);
  const trainingEvents = useMemo(() => exportFeedbackTrainingEvents(events), [events]);

  const handleAddFeedback = () => {
    const selectedField = fieldAffected === "none" ? undefined : fieldAffected;
    const numericValue = suggestedValue.trim() === "" ? undefined : Number(suggestedValue);
    const newEvent: ListingFeedbackEvent = {
      id: `feedback-local-${Date.now()}`,
      listingId: sampleListingIntelligence.id,
      userName: role === "investor" ? "Demo investor" : "Demo professional",
      userRole: role,
      inputType,
      fieldAffected: selectedField,
      originalValue: selectedField && selectedField in result.assumptionsUsed
        ? result.assumptionsUsed[selectedField as keyof typeof result.assumptionsUsed] as number | string
        : undefined,
      suggestedValue: Number.isFinite(numericValue) ? numericValue : undefined,
      confidence: Number(confidence) || 50,
      physicallyInspected: inspected,
      verifiedProfessional: role !== "investor",
      reputationScore: role === "investor" ? 35 : 82,
      comment,
      createdAt: new Date().toISOString(),
    };
    setEvents((current) => [newEvent, ...current]);
  };

  const combinedSchema = {
    "@context": "https://schema.org",
    "@graph": [organizationSchema, websiteSchema, softwareSchema],
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Listing Intelligence Card for Canadian Investors"
        description="Prototype Listing Intelligence Card for AI-ready underwriting, structured deal feedback, professional contributions, and Canadian investment property analysis."
        keywords="Canadian real estate investing, AI real estate underwriting, real estate deal analyzer, BRRRR calculator, investment property underwriting"
        canonicalUrl="/listing-intelligence"
        structuredData={combinedSchema}
      />
      <Navigation />

      <main>
        <div className="mx-auto max-w-7xl px-4 pt-6 md:px-6">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400" data-testid="banner-sample-data">
            Labs preview — everything below runs on sample data. It shows where collaborative underwriting is headed, not live listings.
          </div>
        </div>
        <section className="border-b border-border/60 bg-[linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.32))]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
            <div>
              <Badge className="gap-1.5">
                <BrainCircuit className="h-3.5 w-3.5" />
                Prototype scoring engine, not trained AI
              </Badge>
              <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-6xl">
                Listing Intelligence Card
              </h1>
              <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
                A collaborative deal workspace for underwriting, professional feedback, risk flags, and AI-ready training events.
                Every rent correction, repair quote, financing concern, and offer note is captured as structured data.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href="/tools/analyzer">
                  <Button size="lg" className="gap-2">
                    <Calculator className="h-4 w-4" />
                    Analyze another deal
                  </Button>
                </Link>
                <Link href="/community/network">
                  <Button size="lg" variant="outline" className="gap-2">
                    <Network className="h-4 w-4" />
                    Find deal help
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Local demo data only. No production database, payments, securities, or live referral routing are created here.
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{sampleListingIntelligence.listingSource}</p>
                  <h2 className="mt-1 text-2xl font-bold">{sampleListingIntelligence.address}</h2>
                  <p className="text-muted-foreground">
                    {sampleListingIntelligence.city}, {sampleListingIntelligence.province} · {sampleListingIntelligence.propertyType}
                  </p>
                </div>
                <Badge variant="secondary">{sampleListingIntelligence.status.replace(/_/g, " ")}</Badge>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <MetricTile label="Asking price" value={formatCurrency(sampleListingIntelligence.askingPrice)} />
                <MetricTile label="Units" value={String(sampleListingIntelligence.units)} detail={`${sampleListingIntelligence.bedrooms} beds · ${sampleListingIntelligence.bathrooms} baths`} />
                <MetricTile label="Est. rent" value={formatCurrency(result.grossMonthlyRent)} detail="weighted by feedback" />
                <MetricTile label="DOM" value={`${sampleListingIntelligence.daysOnMarket}`} detail="days on market" />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <ScorePanel label="Opportunity" value={result.opportunityScore} icon={<TrendingUp className="h-4 w-4" />} />
                <ScorePanel label="Risk" value={result.riskScore} icon={<AlertTriangle className="h-4 w-4" />} />
                <ScorePanel label="Confidence" value={result.confidenceScore} icon={<ShieldCheck className="h-4 w-4" />} />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-4">
              <TabsTrigger value="underwriting">Underwriting</TabsTrigger>
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
              <TabsTrigger value="professionals">Network</TabsTrigger>
              <TabsTrigger value="training">AI-ready data</TabsTrigger>
            </TabsList>

            <TabsContent value="underwriting" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricTile label="Monthly mortgage" value={formatCurrency(result.monthlyMortgagePayment)} />
                <MetricTile label="NOI" value={formatCurrency(result.noi)} detail="annual" />
                <MetricTile label="Cash flow" value={formatCurrency(result.monthlyCashFlow)} detail="monthly after debt service" />
                <MetricTile label="DSCR" value={result.dscr.toFixed(2)} />
                <MetricTile label="Cap rate" value={formatPercent(result.capRate)} />
                <MetricTile label="Cash-on-cash" value={formatPercent(result.cashOnCashReturn)} />
                <MetricTile label="Rent-to-price" value={formatPercent(result.rentToPriceRatio)} />
                <MetricTile label="BRRRR potential" value={result.brrrrViability} detail={formatCurrency(result.refinancePotential)} />
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-primary" />
                      Investment Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <p className="text-sm font-semibold">Thesis</p>
                      <p className="mt-1 text-sm text-muted-foreground">{result.analysisSummary.investmentThesis}</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold">Key upside</p>
                        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                          {sampleListingIntelligence.keyUpside.map((item) => <li key={item}>· {item}</li>)}
                        </ul>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Key risk</p>
                        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                          {sampleListingIntelligence.keyRisks.map((item) => <li key={item}>· {item}</li>)}
                          {result.warnings.map((item) => <li key={item}>· {item}</li>)}
                        </ul>
                      </div>
                    </div>
                    <Separator />
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-sm font-semibold">Why the score moved</p>
                        <p className="mt-1 text-sm text-muted-foreground">{result.analysisSummary.whyScoreMoved}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">What makes it work</p>
                        <p className="mt-1 text-sm text-muted-foreground">{result.analysisSummary.whatWouldMakeItWork}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Next step</p>
                        <p className="mt-1 text-sm text-muted-foreground">{result.analysisSummary.recommendedNextStep}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileSearch className="h-5 w-5 text-primary" />
                      Assumptions Used
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {[
                      ["Purchase price", formatCurrency(result.assumptionsUsed.purchasePrice)],
                      ["Down payment", `${result.assumptionsUsed.downPaymentPercent}%`],
                      ["Interest rate", `${result.assumptionsUsed.interestRate}%`],
                      ["Amortization", `${result.assumptionsUsed.amortizationYears} years`],
                      ["Monthly rent", formatCurrency(result.assumptionsUsed.monthlyRent)],
                      ["Vacancy", `${result.assumptionsUsed.vacancyPercent}%`],
                      ["Annual tax", formatCurrency(result.assumptionsUsed.annualPropertyTax)],
                      ["Annual insurance", formatCurrency(result.assumptionsUsed.annualInsurance)],
                      ["Annual utilities", formatCurrency(result.assumptionsUsed.annualUtilities)],
                      ["Repairs and maintenance", formatCurrency(result.assumptionsUsed.annualRepairsMaintenance)],
                      ["Property management", formatCurrency(result.assumptionsUsed.annualPropertyManagement)],
                      ["Renovation budget", formatCurrency(result.assumptionsUsed.renovationBudget)],
                      ["ARV", formatCurrency(result.assumptionsUsed.afterRepairValue)],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-4 rounded-md border border-border/60 px-3 py-2">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="feedback" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Submit Structured Feedback
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={role} onValueChange={(value) => setRole(value as ProfessionalRole)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{roleOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Input type</Label>
                        <Select value={inputType} onValueChange={(value) => setInputType(value as ListingFeedbackInputType)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{inputTypeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Field affected</Label>
                        <Select value={fieldAffected} onValueChange={setFieldAffected}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{fieldOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Suggested value</Label>
                        <Input inputMode="decimal" value={suggestedValue} onChange={(event) => setSuggestedValue(event.target.value)} placeholder="Example: 6800" />
                      </div>
                      <div className="space-y-2">
                        <Label>Confidence</Label>
                        <Input inputMode="numeric" value={confidence} onChange={(event) => setConfidence(event.target.value)} placeholder="0-100" />
                      </div>
                      <label className="flex items-end gap-2 rounded-md border border-border/70 px-3 py-2 text-sm">
                        <input type="checkbox" checked={inspected} onChange={(event) => setInspected(event.target.checked)} />
                        Physically inspected
                      </label>
                    </div>
                    <div className="space-y-2">
                      <Label>Structured note</Label>
                      <Textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} />
                    </div>
                    <Button className="w-full gap-2" onClick={handleAddFeedback}>
                      <Database className="h-4 w-4" />
                      Add feedback event
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Feedback-Weighted Signals
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-4">
                      <MetricTile label="Events" value={String(feedbackSummary.totalEvents)} />
                      <MetricTile label="Weight" value={feedbackSummary.totalWeight.toFixed(2)} />
                      <MetricTile label="Verified pros" value={String(feedbackSummary.verifiedProfessionalCount)} />
                      <MetricTile label="Risk flags" value={String(feedbackSummary.riskFlags)} />
                    </div>
                    <div className="space-y-3">
                      {events.map((event) => (
                        <div key={event.id} className="rounded-lg border border-border/70 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={event.verifiedProfessional ? "default" : "secondary"}>{event.userRole.replace(/_/g, " ")}</Badge>
                              <Badge variant="outline">{event.inputType.replace(/_/g, " ")}</Badge>
                              <span className="text-xs text-muted-foreground">weight {getFeedbackWeight(event)}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleDateString("en-CA")}</span>
                          </div>
                          <p className="mt-3 text-sm text-muted-foreground">{event.comment}</p>
                          {event.fieldAffected && (
                            <p className="mt-2 text-sm">
                              <span className="font-medium">{event.fieldAffected}</span>
                              {event.originalValue !== undefined && <> from {String(event.originalValue)}</>}
                              {event.suggestedValue !== undefined && <> to {String(event.suggestedValue)}</>}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="professionals" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {sampleProfessionals.map((pro) => (
                  <Card key={pro.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-lg">{pro.name}</CardTitle>
                        {pro.verified && <BadgeCheck className="h-5 w-5 text-primary" />}
                      </div>
                      <p className="text-sm text-muted-foreground">{pro.role.replace(/_/g, " ")} · {pro.market}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span>Rating {pro.rating.toFixed(1)}</span>
                        <span>{pro.contributionCount} contributions</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {pro.specialties.map((specialty) => <Badge key={specialty} variant="secondary">{specialty}</Badge>)}
                      </div>
                      <Button variant="outline" className="w-full gap-2">
                        {pro.role === "contractor" ? <Wrench className="h-4 w-4" /> : <Handshake className="h-4 w-4" />}
                        {pro.responseCta}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ["Ask realtor for CMA", "Comparable sales, pricing opinion, seller motivation, and offer strategy."],
                  ["Validate rent with manager", "Rent estimate, tenant demand, vacancy risk, and maintenance expectations."],
                  ["Check financing", "Rate, LTV, debt service, CMHC/MLI considerations, and financing risk."],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-lg border border-border/70 bg-card p-5">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <h3 className="mt-3 font-semibold">{title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{body}</p>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="training" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-primary" />
                      Future Model-Training Foundation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-muted-foreground">
                    <p>
                      This page does not train a model. It creates the structured event layer a future model could learn from:
                      role, field affected, original value, suggested value, confidence, source weight, inspection status, and timestamp.
                    </p>
                    <p>
                      Examples include rent corrections, contractor quotes, realtor pricing notes, financing flags,
                      Realist admin score adjustments, and later outcomes such as sold or rented results.
                    </p>
                    <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
                      <p className="font-medium text-foreground">Export shape</p>
                      <p className="mt-1">Normalized for future data review, analytics, model evaluation, and small language model fine-tuning once proper infrastructure exists.</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BrainCircuit className="h-5 w-5 text-primary" />
                      Training Event Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[460px] overflow-auto rounded-lg border border-border/70 bg-muted/30 p-4">
                      <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                        {JSON.stringify(trainingEvents.slice(0, 6), null, 2)}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

          </Tabs>
        </section>
      </main>
    </div>
  );
}
