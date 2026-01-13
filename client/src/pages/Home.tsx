import { useState, useMemo, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { SEO, organizationSchema, websiteSchema, softwareSchema } from "@/components/SEO";
import { Navigation } from "@/components/Navigation";
import { HeroSection } from "@/components/HeroSection";
import { AddressInput } from "@/components/AddressInput";
import { StrategySelector } from "@/components/StrategySelector";
import { CalculatorSelector, type CalculatorType } from "@/components/CalculatorSelector";
import { MarketExpertPanel } from "@/components/MarketExpertPanel";
import { DealInputs } from "@/components/DealInputs";
import { MetricCards } from "@/components/MetricCards";
import { AnalysisCharts } from "@/components/AnalysisCharts";
import { ResultsSummary } from "@/components/ResultsSummary";
import { SourcesUsesWaterfall } from "@/components/SourcesUsesWaterfall";
import { ProformaTable } from "@/components/ProformaTable";
import { DealTimeline } from "@/components/DealTimeline";
import { LeadCaptureModal } from "@/components/LeadCaptureModal";
import { RentVsBuyCalculator } from "@/components/RentVsBuyCalculator";
import { RenoQuoteWizard } from "@/components/RenoQuoteWizard";
import { MLISelectCalculator } from "@/components/MLISelectCalculator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { calculateBuyHoldAnalysis, calculateStressTest, formatCurrency } from "@/lib/calculations";
import { apiRequest } from "@/lib/queryClient";
import type { BuyHoldInputs, AnalysisResults } from "@shared/schema";
import { Calculator, FileDown, Share2, BarChart3, Save, GitCompare, Loader2, FileSpreadsheet, Table } from "lucide-react";
import { exportToPDF } from "@/lib/pdfExport";
import { MortgageConsultationButton } from "@/components/DealPromotions";

function getSessionId(): string {
  let sessionId = localStorage.getItem("realist_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("realist_session_id", sessionId);
  }
  return sessionId;
}

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
  managementPercent: 5,
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
  const { isAuthenticated, user } = useAuth();
  const analyzerRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState<"canada" | "usa">("canada");
  const [postalCode, setPostalCode] = useState("");
  const [strategy, setStrategy] = useState("buy_hold");
  const [calculatorType, setCalculatorType] = useState<CalculatorType>("deal_analyzer");
  const [inputs, setInputs] = useState<BuyHoldInputs>(defaultInputs);
  const [showResults, setShowResults] = useState(false);
  const [leadCaptureOpen, setLeadCaptureOpen] = useState(false);
  const [leadCapturedLocal, setLeadCapturedLocal] = useState(() => {
    const savedLead = localStorage.getItem("realist_lead_info");
    return !!savedLead;
  });
  
  // User is considered "captured" if they're logged in OR have submitted lead info
  const leadCaptured = isAuthenticated || leadCapturedLocal;
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [dealName, setDealName] = useState("");
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const [showProforma, setShowProforma] = useState(false);
  
  const getSavedLeadInfo = () => {
    const saved = localStorage.getItem("realist_lead_info");
    if (saved) {
      try {
        return JSON.parse(saved) as { name: string; email: string; phone: string };
      } catch {
        return null;
      }
    }
    return null;
  };

  const results = useMemo<AnalysisResults>(() => {
    return calculateBuyHoldAnalysis(inputs);
  }, [inputs]);

  const stressTestResults = useMemo(() => {
    return calculateStressTest(inputs);
  }, [inputs]);

  const leadMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; email: string; phone: string; consent: boolean }) => {
      const formattedAddress = [address, city, region, country === "canada" ? "Canada" : "USA", postalCode]
        .filter(Boolean)
        .join(", ");

      const fullName = `${data.firstName} ${data.lastName}`;

      const response = await apiRequest("POST", "/api/leads", {
        lead: {
          name: fullName,
          email: data.email,
          phone: data.phone,
          consent: data.consent,
          leadSource: "Deal Analyzer",
          firstName: data.firstName,
          lastName: data.lastName,
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
      
      // Auto-enroll user account from lead data
      try {
        const enrollResponse = await apiRequest("POST", "/api/auth/lead-enroll", {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
        });
        const enrollData = await enrollResponse.json();
        
        // Store enrollment status (setup token is sent via email for security)
        localStorage.setItem("realist_lead_info", JSON.stringify({
          name: fullName,
          email: data.email,
          phone: data.phone,
          isNewUser: enrollData.isNewUser,
          needsPassword: enrollData.needsPassword,
        }));
      } catch {
        // Enrollment failed, still save lead info
        localStorage.setItem("realist_lead_info", JSON.stringify({
          name: fullName,
          email: data.email,
          phone: data.phone,
        }));
      }
      
      return response;
    },
    onSuccess: () => {
      setLeadCapturedLocal(true);
      setLeadCaptureOpen(false);
      setShowResults(true);
      
      // Check if user needs to set password
      const leadInfo = getSavedLeadInfo();
      if (leadInfo && (leadInfo as any).needsPassword) {
        toast({
          title: "Analysis Ready!",
          description: "Create a password to save your analysis and track your deals.",
        });
      } else {
        toast({
          title: "Analysis Ready!",
          description: "Your complete deal analysis is now available.",
        });
      }
      
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

  const handleLeadSubmit = async (data: { firstName: string; lastName: string; email: string; phone: string; consent: boolean }) => {
    await leadMutation.mutateAsync(data);
  };

  const saveDealMutation = useMutation({
    mutationFn: async (name: string) => {
      const formattedAddress = [address, city, region].filter(Boolean).join(", ") || "Unnamed Property";
      const response = await apiRequest("POST", "/api/saved-deals", {
        name,
        address: formattedAddress,
        countryMode: country,
        strategyType: strategy,
        inputsJson: inputs,
        resultsJson: results,
        sessionId: getSessionId(),
      });
      return response;
    },
    onSuccess: () => {
      setSaveDialogOpen(false);
      setDealName("");
      toast({
        title: "Deal Saved!",
        description: "You can now compare this deal with others.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save deal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveDeal = () => {
    const defaultName = [address, city].filter(Boolean).join(", ") || `Deal ${new Date().toLocaleDateString()}`;
    setDealName(defaultName);
    setSaveDialogOpen(true);
  };

  const handleConfirmSave = () => {
    if (dealName.trim()) {
      saveDealMutation.mutate(dealName.trim());
    }
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const propertyAddress = [address, city, region].filter(Boolean).join(", ") || "Property Analysis";
      await exportToPDF({
        address: propertyAddress,
        inputs,
        results,
        strategy,
        stressTest: stressTestResults,
      });
      toast({
        title: "PDF Exported!",
        description: "Your analysis has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportSheets = async () => {
    setIsExportingSheets(true);
    try {
      const propertyAddress = [address, city, region].filter(Boolean).join(", ") || "Property Analysis";
      const response = await apiRequest("POST", "/api/export/google-sheets", {
        address: propertyAddress,
        strategy,
        inputs,
        results,
      });
      
      const data = await response.json();
      
      if (data.success && data.url) {
        window.open(data.url, "_blank");
        toast({
          title: "Spreadsheet Created!",
          description: "Your financial model has been exported to Google Sheets.",
        });
      } else {
        throw new Error(data.message || "Export failed");
      }
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Could not export to Google Sheets. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExportingSheets(false);
    }
  };

  const combinedSchema = {
    "@context": "https://schema.org",
    "@graph": [organizationSchema, websiteSchema, softwareSchema]
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SEO
        title="Canadian Real Estate Deal Analyzer - Toronto Property Calculator"
        description="Free real estate analyzer for Canadian investors. Calculate cap rates, IRR, cash-on-cash for Toronto, Vancouver, Calgary. Home of Daniel Foch's podcast."
        keywords="canadian real estate, toronto real estate, real estate investing in canada, daniel foch, cap rate calculator canada, BRRR strategy, multiplex investing"
        canonicalUrl="/"
        structuredData={combinedSchema}
      />
      <Navigation />
      
      <main>
        <HeroSection onAnalyzeClick={handleAnalyzeClick} />

        <section 
          ref={analyzerRef}
          className="py-16 md:py-24 border-t border-border/50"
          id="analyzer"
        >
          <div className="max-w-7xl mx-auto px-4 md:px-6 overflow-x-hidden">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Select a Calculator
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Choose the right tool for your real estate analysis.
              </p>
            </div>

            <div className="flex justify-center mb-8">
              <CalculatorSelector
                selected={calculatorType}
                onSelect={setCalculatorType}
              />
            </div>

            {calculatorType === "rent_vs_buy" ? (
              <RentVsBuyCalculator country={country} />
            ) : calculatorType === "mli_select" ? (
              <MLISelectCalculator />
            ) : calculatorType === "reno_quote" ? (
              <RenoQuoteWizard />
            ) : (
              <>
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

                    {country === "canada" && (
                      <MarketExpertPanel
                        region={region || "Ontario"}
                        city={city}
                        country="canada"
                        dealInfo={{
                          address: address,
                          purchasePrice: 0,
                          monthlyRent: 0,
                          cashFlow: 0,
                          capRate: 0,
                        }}
                        defaultValues={getSavedLeadInfo() || undefined}
                      />
                    )}
                  </CardContent>
                </Card>

                <DealInputs
                  inputs={inputs}
                  onChange={setInputs}
                  country={country}
                  strategy={strategy}
                  region={region}
                  city={city}
                  address={[address, city, region].filter(Boolean).join(", ")}
                  defaultLeadInfo={getSavedLeadInfo() || undefined}
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
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Mortgage Rate</span>
                          <span className="font-mono">{inputs.interestRate.toFixed(2)}%</span>
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


                  {!leadCaptured && (
                    <Card className="mt-4 overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Full Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent className="relative">
                        <div className="blur-[6px] pointer-events-none select-none space-y-3">
                          <div className="h-28 bg-muted/30 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground mb-2">Equity Growth</div>
                            <div className="flex items-end gap-0.5 h-16">
                              {[20, 28, 35, 42, 50, 58, 68, 78, 88, 100].map((h, i) => (
                                <div 
                                  key={i} 
                                  className="flex-1 bg-gradient-to-t from-primary/80 to-primary/40 rounded-t"
                                  style={{ height: `${h}%` }}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="h-24 bg-muted/30 rounded-lg p-3 flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/60 via-accent/40 to-primary/20" />
                            <div className="flex-1 space-y-2">
                              <div className="h-2 w-3/4 bg-muted rounded" />
                              <div className="h-2 w-1/2 bg-muted rounded" />
                              <div className="h-2 w-2/3 bg-muted rounded" />
                            </div>
                          </div>
                          <div className="h-20 bg-muted/30 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground mb-2">Cash Flow</div>
                            <div className="h-10 flex items-center">
                              <svg className="w-full h-full" viewBox="0 0 100 30">
                                <path 
                                  d="M0,25 Q10,20 20,22 T40,18 T60,15 T80,10 T100,5" 
                                  fill="none" 
                                  stroke="hsl(var(--accent))" 
                                  strokeWidth="2"
                                  opacity="0.6"
                                />
                              </svg>
                            </div>
                          </div>
                        </div>
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-[1px]">
                          <p className="text-sm font-medium text-center mb-3 px-4">
                            Sign up for the full breakdown
                          </p>
                          <Button 
                            size="sm" 
                            onClick={() => setLeadCaptureOpen(true)}
                            data-testid="button-preview-signup"
                          >
                            Get Full Analysis
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
            </>
            )}
          </div>
        </section>

        {showResults && leadCaptured && calculatorType === "deal_analyzer" && (
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
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={handleSaveDeal} data-testid="button-save-deal">
                    <Save className="h-4 w-4" />
                    Save Deal
                  </Button>
                  <Link href="/compare">
                    <Button variant="outline" size="sm" className="gap-2" data-testid="button-compare">
                      <GitCompare className="h-4 w-4" />
                      Compare Deals
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2" 
                    onClick={handleExportPDF}
                    disabled={isExportingPDF}
                    data-testid="button-export"
                  >
                    {isExportingPDF ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4" />
                    )}
                    {isExportingPDF ? "Exporting..." : "Export PDF"}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2" 
                    onClick={handleExportSheets}
                    disabled={isExportingSheets}
                    data-testid="button-export-sheets"
                  >
                    {isExportingSheets ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                    {isExportingSheets ? "Exporting..." : "Google Sheets"}
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

              <SourcesUsesWaterfall
                inputs={inputs}
                results={results}
                strategy={strategy}
              />

              <AnalysisCharts results={results} />

              <ResultsSummary
                inputs={inputs}
                results={results}
                address={[address, city, region].filter(Boolean).join(", ")}
                stressTest={stressTestResults}
              />

              <div className="hidden sm:block">
                <ProformaTable results={results} inputs={inputs} />
              </div>

              <div className="sm:hidden">
                {showProforma ? (
                  <div>
                    <ProformaTable results={results} inputs={inputs} />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-4"
                      onClick={() => setShowProforma(false)}
                      data-testid="button-hide-proforma"
                    >
                      Hide Proforma Table
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    className="w-full gap-2"
                    onClick={() => setShowProforma(true)}
                    data-testid="button-show-proforma"
                  >
                    <Table className="h-4 w-4" />
                    Show 10-Year Proforma Table
                  </Button>
                )}
              </div>

              <DealTimeline />
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
        defaultValues={getSavedLeadInfo() || undefined}
      />

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Deal for Comparison</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Deal Name</label>
            <Input
              value={dealName}
              onChange={(e) => setDealName(e.target.value)}
              placeholder="Enter a name for this deal"
              data-testid="input-deal-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmSave} 
              disabled={!dealName.trim() || saveDealMutation.isPending}
              data-testid="button-confirm-save"
            >
              {saveDealMutation.isPending ? "Saving..." : "Save Deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
