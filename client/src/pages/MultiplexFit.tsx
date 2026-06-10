import { useState, useCallback } from "react";
import { Navigation } from "@/components/Navigation";
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
  Building2, CheckCircle2, ArrowRight, ArrowLeft, Target,
  TrendingUp, Shield, MapPin, DollarSign, Users,
  BookOpen, Phone, Clock, Loader2, Sparkles
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const PROVINCES = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick",
  "Newfoundland & Labrador", "Nova Scotia", "Ontario",
  "Prince Edward Island", "Quebec", "Saskatchewan",
];

interface AssessmentData {
  province: string;
  city: string;
  investingLocally: string;
  goal: string;
  capital: string;
  experience: string;
  contractorComfort: string;
  delayTolerance: string;
  geographicFlexibility: string;
  helpPreference: string;
}

interface FitResult {
  score: number;
  tier: "high" | "moderate" | "early";
  headline: string;
  summary: string;
  recommendation: "course" | "consult" | "nurture";
  strengths: string[];
  considerations: string[];
}

function computeFitResult(data: AssessmentData): FitResult {
  let score = 0;

  if (["100k–200k", "200k–400k", "400k+"].includes(data.capital)) score += 25;
  else if (data.capital === "50k–100k") score += 15;
  else score += 5;

  if (data.experience === "Have done development / multifamily work") score += 25;
  else if (data.experience === "Have done renovations / BRRRR") score += 18;
  else if (data.experience === "Own a rental") score += 12;
  else score += 5;

  if (data.contractorComfort === "Very comfortable") score += 12;
  else if (data.contractorComfort === "Somewhat comfortable") score += 8;
  else score += 3;

  if (data.delayTolerance === "Yes") score += 10;
  else if (data.delayTolerance === "Somewhat") score += 6;
  else score += 2;

  if (data.geographicFlexibility === "Yes") score += 8;
  else if (data.geographicFlexibility === "Somewhat") score += 5;
  else score += 2;

  if (["Small development / build and hold", "Add rental income"].includes(data.goal)) score += 10;
  else if (data.goal === "House-hack") score += 8;
  else if (data.goal === "Long-term appreciation") score += 6;
  else score += 3;

  if (data.investingLocally === "Home market") score += 5;
  else score += 3;

  score = Math.min(score, 100);

  const strengths: string[] = [];
  const considerations: string[] = [];

  if (["200k–400k", "400k+"].includes(data.capital)) {
    strengths.push("Strong capital position for multiplex acquisition");
  } else if (data.capital === "100k–200k") {
    strengths.push("Solid starting capital for smaller multiplex projects");
  } else {
    considerations.push("Capital may limit initial project scope — consider starting with a house-hack duplex");
  }

  if (["Have done development / multifamily work", "Have done renovations / BRRRR"].includes(data.experience)) {
    strengths.push("Relevant hands-on real estate experience");
  } else {
    considerations.push("Building foundational knowledge will accelerate your timeline");
  }

  if (data.contractorComfort === "Very comfortable") {
    strengths.push("Comfort managing contractors is a major advantage");
  } else if (data.contractorComfort === "Not comfortable") {
    considerations.push("Contractor management is essential — consider building this skill first");
  }

  if (data.delayTolerance === "Yes") {
    strengths.push("Patience with timelines is critical for multiplex success");
  } else if (data.delayTolerance === "No") {
    considerations.push("Multiplex projects often face delays — mental preparation helps");
  }

  if (data.geographicFlexibility === "Yes") {
    strengths.push("Geographic flexibility opens more profitable markets");
  }

  if (data.goal === "Small development / build and hold") {
    strengths.push("Development mindset aligns perfectly with multiplex strategy");
  }

  let tier: "high" | "moderate" | "early";
  let headline: string;
  let summary: string;
  let recommendation: "course" | "consult" | "nurture";

  if (score >= 70) {
    tier = "high";
    headline = "Strong Multiplex Fit";
    summary = "Your capital, experience, and risk tolerance position you well for multiplex investing. You're ready to take the next step — whether that's deepening your knowledge with a structured program or getting personalized guidance from someone who's done it.";
    recommendation = data.experience === "Have done development / multifamily work" ? "consult" : "course";
  } else if (score >= 45) {
    tier = "moderate";
    headline = "Promising Fit — With the Right Foundation";
    summary = "You have several strengths that align with multiplex investing, but there are a few areas where building knowledge or adjusting your approach could make a big difference. A structured learning path would help you avoid costly mistakes.";
    recommendation = "course";
  } else {
    tier = "early";
    headline = "Early Stage — Build Your Foundation First";
    summary = "Multiplex investing is a powerful strategy, but it works best when you've built a solid foundation of knowledge and resources. The good news: you can start building that foundation today.";
    recommendation = "nurture";
  }

  return { score, tier, headline, summary, recommendation, strengths, considerations };
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="w-full" data-testid="progress-bar">
      <div className="flex justify-between text-xs text-muted-foreground mb-2">
        <span>Step {current} of {total}</span>
        <span>{Math.round((current / total) * 100)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

function OptionButton({
  selected,
  onClick,
  children,
  testId,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/40 hover:bg-accent/50"
      }`}
      data-testid={testId}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
            selected ? "border-primary bg-primary" : "border-muted-foreground/30"
          }`}
        >
          {selected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
        </div>
        <span className={`text-sm ${selected ? "font-medium" : ""}`}>{children}</span>
      </div>
    </button>
  );
}

export default function MultiplexFit() {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<FitResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [data, setData] = useState<AssessmentData>({
    province: "",
    city: "",
    investingLocally: "",
    goal: "",
    capital: "",
    experience: "",
    contractorComfort: "",
    delayTolerance: "",
    geographicFlexibility: "",
    helpPreference: "",
  });
  const [contactInfo, setContactInfo] = useState({
    name: "",
    email: "",
    phone: "",
    consent: false,
  });

  const updateField = useCallback((field: keyof AssessmentData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  }, []);

  const canAdvance = useCallback(() => {
    switch (step) {
      case 1: return data.province && data.city && data.investingLocally;
      case 2: return data.goal;
      case 3: return data.capital && data.experience;
      case 4: return data.contractorComfort && data.delayTolerance && data.geographicFlexibility;
      case 5: return data.helpPreference;
      case 6: return contactInfo.name && contactInfo.email && contactInfo.phone && contactInfo.consent;
      default: return true;
    }
  }, [step, data, contactInfo]);

  const handleSubmit = async () => {
    if (!canAdvance()) return;
    setSubmitting(true);

    const fitResult = computeFitResult(data);
    setResult(fitResult);

    try {
      await apiRequest("POST", "/api/multiplex-fit", {
        ...contactInfo,
        assessmentData: data,
        fitScore: fitResult.score,
        fitTier: fitResult.tier,
        recommendation: fitResult.recommendation,
      });
    } catch (err) {
      console.error("Failed to submit assessment:", err);
    }

    setSubmitting(false);
    setShowResult(true);
  };

  const renderHero = () => (
    <div className="text-center max-w-3xl mx-auto py-12 md:py-20 px-4">
      <Badge variant="outline" className="mb-4 gap-1.5 text-xs px-3 py-1">
        <Building2 className="h-3 w-3" /> Free Assessment Tool
      </Badge>
      <h1
        className="text-3xl md:text-5xl font-bold tracking-tight mb-4"
        data-testid="text-hero-title"
      >
        Should You Be a{" "}
        <span className="text-primary">Multiplex Investor?</span>
      </h1>
      <p
        className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed"
        data-testid="text-hero-subtitle"
      >
        Get a fast assessment based on your budget, market, timeline, and risk
        tolerance — then decide whether to self-study with Multiplex Masterclass
        Canada or book a free consult call.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          size="lg"
          className="gap-2 text-base px-8"
          onClick={() => setStep(1)}
          data-testid="button-start-assessment"
        >
          Start the Assessment <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="gap-2"
          onClick={() => {
            document.getElementById("whats-included")?.scrollIntoView({ behavior: "smooth" });
          }}
          data-testid="button-see-included"
        >
          See What's Included
        </Button>
      </div>
    </div>
  );

  const renderTrustStrip = () => (
    <div className="border-y bg-muted/30 py-8 px-4">
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { icon: MapPin, text: "National framework for Canadian investors" },
          { icon: BookOpen, text: "Based on the Multiplex Masterclass curriculum" },
          { icon: Users, text: "Built by the Realist & Canadian Real Estate Investor team" },
          { icon: Shield, text: "Designed to help avoid zoning, financing & permitting mistakes" },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-3" data-testid={`trust-item-${i}`}>
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <item.icon className="h-4.5 w-4.5 text-primary" />
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderProblem = () => (
    <div className="max-w-3xl mx-auto py-12 px-4 text-center" id="whats-included">
      <h2 className="text-2xl md:text-3xl font-bold mb-4" data-testid="text-problem-title">
        Most people like the idea of multiplexes long before they know if it actually fits them.
      </h2>
      <p className="text-muted-foreground text-base md:text-lg leading-relaxed mb-6">
        Between zoning complexity, capital requirements, contractor management,
        and municipal approvals — multiplex investing isn't for everyone. This
        tool helps you figure out where you stand in under 5 minutes, so you can
        make an informed decision about your next step.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
        {[
          { icon: Target, label: "Clarity", desc: "Know if multiplex investing fits your situation" },
          { icon: TrendingUp, label: "Direction", desc: "Get a personalized next-step recommendation" },
          { icon: Clock, label: "5 Minutes", desc: "Quick assessment with actionable results" },
        ].map((item, i) => (
          <Card key={i} className="text-center" data-testid={`benefit-card-${i}`}>
            <CardContent className="pt-6 space-y-2">
              <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">{item.label}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6" data-testid="step-1-market">
      <div>
        <h2 className="text-xl font-bold mb-1">Your Market</h2>
        <p className="text-sm text-muted-foreground">Where are you looking to invest?</p>
      </div>
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium mb-2 block">Province</Label>
          <Select value={data.province} onValueChange={v => updateField("province", v)}>
            <SelectTrigger data-testid="select-province">
              <SelectValue placeholder="Select province" />
            </SelectTrigger>
            <SelectContent>
              {PROVINCES.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium mb-2 block">City / Target Market</Label>
          <Input
            placeholder="e.g. Toronto, Calgary, Ottawa"
            value={data.city}
            onChange={e => updateField("city", e.target.value)}
            data-testid="input-city"
          />
        </div>
        <div>
          <Label className="text-sm font-medium mb-2 block">Are you investing in your home market or remotely?</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <OptionButton
              selected={data.investingLocally === "Home market"}
              onClick={() => updateField("investingLocally", "Home market")}
              testId="option-home-market"
            >
              Home market
            </OptionButton>
            <OptionButton
              selected={data.investingLocally === "Remotely"}
              onClick={() => updateField("investingLocally", "Remotely")}
              testId="option-remotely"
            >
              Remotely
            </OptionButton>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6" data-testid="step-2-goal">
      <div>
        <h2 className="text-xl font-bold mb-1">Your Goal</h2>
        <p className="text-sm text-muted-foreground">What are you trying to accomplish?</p>
      </div>
      <div className="space-y-3">
        {[
          "House-hack",
          "Add rental income",
          "Long-term appreciation",
          "Small development / build and hold",
          "Just learning for now",
        ].map(option => (
          <OptionButton
            key={option}
            selected={data.goal === option}
            onClick={() => updateField("goal", option)}
            testId={`option-goal-${option.replace(/\s+/g, "-").toLowerCase()}`}
          >
            {option}
          </OptionButton>
        ))}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6" data-testid="step-3-capital">
      <div>
        <h2 className="text-xl font-bold mb-1">Capital & Experience</h2>
        <p className="text-sm text-muted-foreground">Help us understand your starting point.</p>
      </div>
      <div className="space-y-5">
        <div>
          <Label className="text-sm font-medium mb-3 block">Approximate liquid capital available?</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {["Under 50k", "50k–100k", "100k–200k", "200k–400k", "400k+"].map(option => (
              <OptionButton
                key={option}
                selected={data.capital === option}
                onClick={() => updateField("capital", option)}
                testId={`option-capital-${option.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`}
              >
                {option}
              </OptionButton>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-sm font-medium mb-3 block">Current investing experience?</Label>
          <div className="space-y-3">
            {[
              "None",
              "Own a rental",
              "Have done renovations / BRRRR",
              "Have done development / multifamily work",
            ].map(option => (
              <OptionButton
                key={option}
                selected={data.experience === option}
                onClick={() => updateField("experience", option)}
                testId={`option-experience-${option.replace(/\s+/g, "-").toLowerCase()}`}
              >
                {option}
              </OptionButton>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6" data-testid="step-4-complexity">
      <div>
        <h2 className="text-xl font-bold mb-1">Complexity Tolerance</h2>
        <p className="text-sm text-muted-foreground">Multiplex projects come with moving parts. How ready are you?</p>
      </div>
      <div className="space-y-5">
        <div>
          <Label className="text-sm font-medium mb-3 block">
            Comfort dealing with contractors, consultants, and approvals?
          </Label>
          <div className="space-y-3">
            {["Very comfortable", "Somewhat comfortable", "Not comfortable"].map(option => (
              <OptionButton
                key={option}
                selected={data.contractorComfort === option}
                onClick={() => updateField("contractorComfort", option)}
                testId={`option-contractor-${option.replace(/\s+/g, "-").toLowerCase()}`}
              >
                {option}
              </OptionButton>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-sm font-medium mb-3 block">
            Open to delays and some execution risk?
          </Label>
          <div className="grid grid-cols-3 gap-3">
            {["Yes", "Somewhat", "No"].map(option => (
              <OptionButton
                key={option}
                selected={data.delayTolerance === option}
                onClick={() => updateField("delayTolerance", option)}
                testId={`option-delay-${option.toLowerCase()}`}
              >
                {option}
              </OptionButton>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-sm font-medium mb-3 block">
            Willing to invest outside your neighborhood if the economics are better?
          </Label>
          <div className="grid grid-cols-3 gap-3">
            {["Yes", "Somewhat", "No"].map(option => (
              <OptionButton
                key={option}
                selected={data.geographicFlexibility === option}
                onClick={() => updateField("geographicFlexibility", option)}
                testId={`option-geo-${option.toLowerCase()}`}
              >
                {option}
              </OptionButton>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6" data-testid="step-5-preference">
      <div>
        <h2 className="text-xl font-bold mb-1">Your Preference</h2>
        <p className="text-sm text-muted-foreground">How would you like to move forward?</p>
      </div>
      <div className="space-y-3">
        {[
          "I want a course and templates to do this myself",
          "I'd like personalized guidance from an experienced investor",
          "I'm just exploring — not ready to commit yet",
        ].map(option => (
          <OptionButton
            key={option}
            selected={data.helpPreference === option}
            onClick={() => updateField("helpPreference", option)}
            testId={`option-pref-${option.substring(0, 20).replace(/\s+/g, "-").toLowerCase()}`}
          >
            {option}
          </OptionButton>
        ))}
      </div>
    </div>
  );

  const renderOptIn = () => (
    <div className="space-y-6" data-testid="step-6-optin">
      <div>
        <h2 className="text-xl font-bold mb-1">Almost There</h2>
        <p className="text-sm text-muted-foreground">
          Enter your details to see your personalized fit score and recommendation.
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium mb-2 block">Full Name</Label>
          <Input
            placeholder="John Smith"
            value={contactInfo.name}
            onChange={e => setContactInfo(prev => ({ ...prev, name: e.target.value }))}
            data-testid="input-name"
          />
        </div>
        <div>
          <Label className="text-sm font-medium mb-2 block">Email</Label>
          <Input
            type="email"
            placeholder="john@example.com"
            value={contactInfo.email}
            onChange={e => setContactInfo(prev => ({ ...prev, email: e.target.value }))}
            data-testid="input-email"
          />
        </div>
        <div>
          <Label className="text-sm font-medium mb-2 block">Phone</Label>
          <Input
            type="tel"
            placeholder="(416) 555-1234"
            value={contactInfo.phone}
            onChange={e => setContactInfo(prev => ({ ...prev, phone: e.target.value }))}
            data-testid="input-phone"
          />
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="consent"
            checked={contactInfo.consent}
            onCheckedChange={(checked) =>
              setContactInfo(prev => ({ ...prev, consent: checked === true }))
            }
            data-testid="checkbox-consent"
          />
          <Label htmlFor="consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
            I agree to receive my assessment results and occasional educational content about multiplex investing. 
            You can unsubscribe anytime.
          </Label>
        </div>
      </div>
    </div>
  );

  const renderResult = () => {
    if (!result) return null;

    const tierColors = {
      high: "text-green-600 dark:text-green-400",
      moderate: "text-amber-600 dark:text-amber-400",
      early: "text-blue-600 dark:text-blue-400",
    };

    const tierBg = {
      high: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
      moderate: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
      early: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
    };

    return (
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-8" data-testid="assessment-result">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-result-headline">
            {result.headline}
          </h1>
          <div className="flex items-center justify-center gap-3">
            <span className="text-sm text-muted-foreground">Fit Score:</span>
            <span className={`text-3xl font-bold ${tierColors[result.tier]}`} data-testid="text-fit-score">
              {result.score}/100
            </span>
          </div>
        </div>

        <Card className={`border ${tierBg[result.tier]}`}>
          <CardContent className="pt-6">
            <p className="text-sm leading-relaxed" data-testid="text-result-summary">{result.summary}</p>
          </CardContent>
        </Card>

        {result.strengths.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" /> Your Strengths
            </h3>
            <ul className="space-y-2">
              {result.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" data-testid={`strength-${i}`}>
                  <span className="text-green-500 mt-0.5">+</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.considerations.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-500" /> Things to Consider
            </h3>
            <ul className="space-y-2">
              {result.considerations.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" data-testid={`consideration-${i}`}>
                  <span className="text-amber-500 mt-0.5">!</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-t pt-6 space-y-4">
          <h3 className="font-bold text-lg text-center">Your Recommended Next Step</h3>

          {result.recommendation === "course" && (
            <Card className="border-primary/30 bg-primary/5" data-testid="cta-course">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <BookOpen className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-lg">Multiplex Masterclass Canada</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      A structured, self-paced course covering zoning, financing, permitting, 
                      construction management, and deal analysis — built specifically for Canadian investors.
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={() => window.open("https://www.skool.com/realist/classroom/ed10579b?md=bdef7de8690640b599435fc633f90c10", "_blank")}
                  data-testid="button-buy-course"
                >
                  Learn More About the Course <ArrowRight className="h-4 w-4" />
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Or{" "}
                  <button
                    className="text-primary underline"
                    onClick={() => window.open("https://calendly.com/realistca", "_blank")}
                    data-testid="button-alt-consult"
                  >
                    book a free consult call
                  </button>{" "}
                  if you'd prefer personalized guidance.
                </p>
              </CardContent>
            </Card>
          )}

          {result.recommendation === "consult" && (
            <Card className="border-primary/30 bg-primary/5" data-testid="cta-consult">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <Phone className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-lg">Book a Free Strategy Call</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      You've got the experience and capital. A personalized strategy session can help you 
                      identify the right market, structure, and timeline for your next multiplex project.
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={() => window.open("https://calendly.com/realistca", "_blank")}
                  data-testid="button-book-consult"
                >
                  Book Your Free Consult <ArrowRight className="h-4 w-4" />
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Or check out the{" "}
                  <button
                    className="text-primary underline"
                    onClick={() => window.open("https://www.skool.com/realist/classroom/ed10579b?md=bdef7de8690640b599435fc633f90c10", "_blank")}
                    data-testid="button-alt-course"
                  >
                    Multiplex Masterclass
                  </button>{" "}
                  to learn at your own pace.
                </p>
              </CardContent>
            </Card>
          )}

          {result.recommendation === "nurture" && (
            <Card className="border-blue-300/30 bg-blue-50/50 dark:bg-blue-950/20" data-testid="cta-nurture">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <BookOpen className="h-6 w-6 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-lg">Start Building Your Foundation</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      You're in a great position to start learning. We'll send you helpful resources 
                      on multiplex investing fundamentals so you can decide when you're ready to take the next step.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  size="lg"
                  onClick={() => {
                    toast({
                      title: "You're on the list",
                      description: "We'll send you resources to help you get started.",
                    });
                  }}
                  data-testid="button-join-waitlist"
                >
                  Join the Waitlist <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  };

  const renderQuizStep = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderOptIn();
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="multiplex-fit-page">
      <SEO
        title="Multiplex Investor Fit Assessment | Realist.ca"
        description="Find out if multiplex investing is right for you. Take a 5-minute assessment based on your budget, market, timeline, and risk tolerance."
        keywords="multiplex investing, canadian real estate, duplex triplex fourplex, real estate investor assessment, multiplex masterclass"
        canonicalUrl="/multiplex-investor-fit"
      />
      <Navigation />

      {step === 0 && !showResult && (
        <>
          {renderHero()}
          {renderTrustStrip()}
          {renderProblem()}
          <div className="text-center pb-16">
            <Button
              size="lg"
              className="gap-2 text-base px-8"
              onClick={() => setStep(1)}
              data-testid="button-start-assessment-bottom"
            >
              Start the Assessment <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {step > 0 && !showResult && (
        <div className="max-w-xl mx-auto py-8 px-4">
          <ProgressBar current={step} total={6} />
          <Card className="mt-6">
            <CardContent className="pt-6">
              {renderQuizStep()}
              <div className="flex justify-between mt-8 pt-4 border-t">
                <Button
                  variant="ghost"
                  onClick={() => setStep(step - 1)}
                  className="gap-1"
                  data-testid="button-back"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                {step < 6 ? (
                  <Button
                    onClick={() => setStep(step + 1)}
                    disabled={!canAdvance()}
                    className="gap-1"
                    data-testid="button-next"
                  >
                    Next <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={!canAdvance() || submitting}
                    className="gap-1"
                    data-testid="button-see-results"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
                      </>
                    ) : (
                      <>
                        See My Results <Sparkles className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showResult && renderResult()}

      <footer className="border-t py-8 px-4 text-center">
        <p className="text-xs text-muted-foreground max-w-2xl mx-auto">
          This assessment provides general guidance based on your self-reported information. 
          It is not financial advice. Real estate investing involves risk. Always consult 
          qualified professionals before making investment decisions.
        </p>
      </footer>
    </div>
  );
}