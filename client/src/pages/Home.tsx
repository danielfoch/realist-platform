import { useState, useMemo, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { HeroSection } from "@/components/HeroSection";
import { AddressInput } from "@/components/AddressInput";
import { StrategySelector } from "@/components/StrategySelector";
import { DealInputs } from "@/components/DealInputs";
import { MetricCards } from "@/components/MetricCards";
import { AnalysisCharts } from "@/components/AnalysisCharts";
import { ResultsSummary } from "@/components/ResultsSummary";
import { LeadCaptureModal } from "@/components/LeadCaptureModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { calculateBuyHoldAnalysis, formatCurrency } from "@/lib/calculations";
import { apiRequest } from "@/lib/queryClient";
import type { BuyHoldInputs, AnalysisResults } from "@shared/schema";
import { Calculator, FileDown, Share2, BarChart3 } from "lucide-react";

const defaultInputs: BuyHoldInputs = {
  purchasePrice: 500000,
  closingCosts: 15000,
  downPaymentPercent: 20,
  interestRate: 5.5,
  amortizationYears: 25,
  loanTermYears: 5,
  monthlyRent: 3000,
  vacancyPercent: 5,
  propertyTax: 4000,
  insurance: 2000,
  utilities: 0,
  maintenancePercent: 5,
  managementPercent: 0,
  capexReservePercent: 5,
  otherExpenses: 0,
  rentGrowthPercent: 0,
  expenseInflationPercent: 2,
  appreciationPercent: 2,
  holdingPeriodYears: 10,
  sellingCostsPercent: 5,
  isCmhcMliSelect: false,
  cmhcMliPoints: 0,
};

export default function Home() {
  const { toast } = useToast();
  const analyzerRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState<"canada" | "usa">("canada");
  const [postalCode, setPostalCode] = useState("");
  const [strategy, setStrategy] = useState("buy_hold");
  const [inputs, setInputs] = useState<BuyHoldInputs>(defaultInputs);
  const [showResults, setShowResults] = useState(false);
  const [leadCaptureOpen, setLeadCaptureOpen] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);

  const results = useMemo<AnalysisResults>(() => {
    return calculateBuyHoldAnalysis(inputs);
  }, [inputs]);

  const leadMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; phone: string; consent: boolean }) => {
      const formattedAddress = [address, city, region, country === "canada" ? "Canada" : "USA", postalCode]
        .filter(Boolean)
        .join(", ");

      const response = await apiRequest("POST", "/api/leads", {
        lead: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          consent: data.consent,
          leadSource: "Deal Analyzer",
        },
        property: {
          formattedAddress,
          streetAddress: address,
          city,
          region,
          country: country === "canada" ? "Canada" : "USA",
          postalCode,
        },
        analysis: {
          countryMode: country,
          strategyType: strategy,
          inputsJson: inputs,
          resultsJson: results,
        },
      });
      return response;
    },
    onSuccess: () => {
      setLeadCaptured(true);
      setLeadCaptureOpen(false);
      setShowResults(true);
      toast({
        title: "Analysis Ready!",
        description: "Your complete deal analysis is now available.",
      });
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save your information. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAnalyzeClick = () => {
    analyzerRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleCalculate = () => {
    if (!leadCaptured) {
      setLeadCaptureOpen(true);
    } else {
      setShowResults(true);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  const handleLeadSubmit = async (data: { name: string; email: string; phone: string; consent: boolean }) => {
    await leadMutation.mutateAsync(data);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main>
        <HeroSection onAnalyzeClick={handleAnalyzeClick} />

        <section 
          ref={analyzerRef}
          className="py-16 md:py-24 border-t border-border/50"
          id="analyzer"
        >
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Deal Analyzer
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Enter your property details below to get a comprehensive investment analysis.
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Property & Strategy
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <AddressInput
                      address={address}
                      city={city}
                      region={region}
                      country={country}
                      postalCode={postalCode}
                      onAddressChange={setAddress}
                      onCityChange={setCity}
                      onRegionChange={setRegion}
                      onCountryChange={setCountry}
                      onPostalCodeChange={setPostalCode}
                    />
                    <StrategySelector
                      country={country}
                      selectedStrategy={strategy}
                      onStrategyChange={setStrategy}
                    />
                  </CardContent>
                </Card>

                <DealInputs
                  inputs={inputs}
                  onChange={setInputs}
                  country={country}
                />

                <Button
                  size="lg"
                  className="w-full h-14 text-lg gap-2"
                  onClick={handleCalculate}
                  data-testid="button-calculate"
                >
                  <Calculator className="h-5 w-5" />
                  {leadCaptured ? "Update Analysis" : "Calculate & View Results"}
                </Button>
              </div>

              <div className="lg:col-span-1">
                <div className="sticky top-24 space-y-4">
                  <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
                    <CardHeader>
                      <CardTitle className="text-lg">Quick Preview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Purchase Price</span>
                          <span className="font-mono">{formatCurrency(inputs.purchasePrice)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Down Payment</span>
                          <span className="font-mono">{formatCurrency(inputs.purchasePrice * inputs.downPaymentPercent / 100)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Monthly Rent</span>
                          <span className="font-mono">{formatCurrency(inputs.monthlyRent)}</span>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-border/50 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Est. Cash Flow</span>
                          <span className={`font-mono font-bold ${results.monthlyCashFlow >= 0 ? "text-accent" : "text-destructive"}`}>
                            {formatCurrency(results.monthlyCashFlow)}/mo
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Cap Rate</span>
                          <span className="font-mono font-bold">{results.capRate.toFixed(1)}%</span>
                        </div>
                      </div>
                      {!leadCaptured && (
                        <p className="text-xs text-muted-foreground text-center pt-2">
                          Full analysis available after sign up
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </section>

        {showResults && leadCaptured && (
          <section 
            ref={resultsRef}
            className="py-16 md:py-24 border-t border-border/50 bg-muted/30"
          >
            <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl md:text-4xl font-bold">Analysis Results</h2>
                  <p className="text-muted-foreground mt-1">
                    {[address, city, region].filter(Boolean).join(", ") || "Your Property"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2" data-testid="button-export">
                    <FileDown className="h-4 w-4" />
                    Export PDF
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" data-testid="button-share">
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                </div>
              </div>

              <MetricCards
                capRate={results.capRate}
                cashOnCash={results.cashOnCash}
                dscr={results.dscr}
                irr={results.irr}
                monthlyCashFlow={results.monthlyCashFlow}
              />

              <AnalysisCharts results={results} />

              <ResultsSummary
                inputs={inputs}
                results={results}
                address={[address, city, region].filter(Boolean).join(", ")}
              />
            </div>
          </section>
        )}
      </main>

      <footer className="py-8 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">R</span>
              </div>
              <span>Realist.ca</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="/about" className="hover:text-foreground transition-colors">About</a>
              <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>

      <LeadCaptureModal
        open={leadCaptureOpen}
        onOpenChange={setLeadCaptureOpen}
        onSubmit={handleLeadSubmit}
        isSubmitting={leadMutation.isPending}
      />
    </div>
  );
}
