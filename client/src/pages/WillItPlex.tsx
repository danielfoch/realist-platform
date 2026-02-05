import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Home, Building2, ArrowLeft, ArrowRight, Check, FileDown, 
  Search, MapPin, DollarSign, Percent, Calculator, Layers,
  ChevronDown, ExternalLink, Loader2, Plus, RotateCcw, Code
} from "lucide-react";
import type { CapstoneProject, CapstoneProperty, CapstoneCostModel, CapstoneProforma } from "@shared/schema";

interface ProjectWithRelations extends CapstoneProject {
  property?: CapstoneProperty | null;
  costModel?: CapstoneCostModel | null;
  proforma?: CapstoneProforma | null;
}

const STRATEGY_STEPS = {
  buy_and_hold: [
    { id: 1, title: "Property Details", description: "Import from realtor.ca" },
    { id: 2, title: "Choose Strategy", description: "Select your investment approach" },
    { id: 3, title: "Rent Analysis", description: "Research rental comps" },
    { id: 4, title: "Financing", description: "Configure mortgage terms" },
    { id: 5, title: "Results", description: "View metrics & export" },
  ],
  multiplex: [
    { id: 1, title: "Property Details", description: "Import from realtor.ca" },
    { id: 2, title: "Choose Strategy", description: "Select your investment approach" },
    { id: 3, title: "Zoning Analysis", description: "Enter zoning parameters" },
    { id: 4, title: "Construction", description: "Set build costs" },
    { id: 5, title: "MLI Select", description: "Configure CMHC points" },
    { id: 6, title: "Results", description: "View metrics & export" },
  ],
};

export default function WillItPlex() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [strategy, setStrategy] = useState<"buy_and_hold" | "multiplex" | null>(null);
  
  // Property import state
  const [listingUrl, setListingUrl] = useState("");
  const [htmlSource, setHtmlSource] = useState("");
  const [showHtmlInput, setShowHtmlInput] = useState(false);
  const [importedProperty, setImportedProperty] = useState<CapstoneProperty | null>(null);
  
  // Buy & Hold state
  const [monthlyRent, setMonthlyRent] = useState(2500);
  const [downPaymentPercent, setDownPaymentPercent] = useState(20);
  const [interestRate, setInterestRate] = useState(5.5);
  const [amortizationYears, setAmortizationYears] = useState(25);
  const [annualTaxes, setAnnualTaxes] = useState(5000);
  const [annualInsurance, setAnnualInsurance] = useState(1500);
  const [annualMaintenance, setAnnualMaintenance] = useState(2000);
  
  // Multiplex state
  const [zoningCode, setZoningCode] = useState("R");
  const [lotCoverageRatio, setLotCoverageRatio] = useState(50);
  const [maxStories, setMaxStories] = useState(3);
  const [maxUnits, setMaxUnits] = useState(4);
  const [hasGardenSuite, setHasGardenSuite] = useState(false);
  const [constructionCostPerSqft, setConstructionCostPerSqft] = useState(500);
  const [mliAccessibilityPoints, setMliAccessibilityPoints] = useState(0);
  const [mliAffordabilityPoints, setMliAffordabilityPoints] = useState(0);
  const [mliEnergyPoints, setMliEnergyPoints] = useState(0);
  
  // Calculated metrics
  const [metrics, setMetrics] = useState<{
    noi: number;
    dscr: number;
    capRate: number;
    cashOnCash: number;
    yieldOnCost?: number;
    buildableGfa?: number;
    totalConstructionCost?: number;
  } | null>(null);

  // Fetch user's projects
  const { data: projects, isLoading: projectsLoading } = useQuery<ProjectWithRelations[]>({
    queryKey: ["/api/capstone/projects"],
  });

  // Fetch current project details
  const { data: currentProject, refetch: refetchProject } = useQuery<ProjectWithRelations>({
    queryKey: ["/api/capstone/projects", currentProjectId],
    enabled: !!currentProjectId,
  });

  // Create new project mutation
  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/capstone/projects");
      return res.json();
    },
    onSuccess: (data) => {
      setCurrentProjectId(data.project.id);
      setStep(1);
      setStrategy(null);
      setImportedProperty(null);
      queryClient.invalidateQueries({ queryKey: ["/api/capstone/projects"] });
      toast({ title: "New project created", description: "Start by importing a property" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/capstone/projects/${currentProjectId}`, data);
      return res.json();
    },
    onSuccess: () => {
      refetchProject();
      queryClient.invalidateQueries({ queryKey: ["/api/capstone/projects"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    },
  });

  // Import property mutation
  const importPropertyMutation = useMutation({
    mutationFn: async (input: { url?: string; html?: string }) => {
      const res = await apiRequest("POST", "/api/listings/parse-realtor-ca", input);
      return res.json();
    },
    onSuccess: async (data) => {
      const listing = data.listing;
      setImportedProperty({
        id: "",
        projectId: currentProjectId || "",
        sourceUrl: listing.sourceUrl,
        listingId: listing.listingId,
        address: listing.address,
        city: listing.city,
        province: listing.province,
        postalCode: listing.postalCode,
        price: listing.price,
        annualTaxes: null,
        lotFrontage: null,
        lotDepth: null,
        lotArea: null,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        squareFootage: listing.squareFootage,
        propertyType: listing.propertyType,
        buildingType: listing.buildingType,
        imageUrl: listing.imageUrl,
        createdAt: new Date(),
      });
      toast({ title: "Property imported", description: `${listing.address}, ${listing.city}` });
    },
    onError: (error: Error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  // Save property to project
  const savePropertyMutation = useMutation({
    mutationFn: async (property: Partial<CapstoneProperty>) => {
      const res = await apiRequest("POST", `/api/capstone/projects/${currentProjectId}/property`, property);
      return res.json();
    },
    onSuccess: () => {
      refetchProject();
      toast({ title: "Property saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error saving property", description: error.message, variant: "destructive" });
    },
  });

  // Calculate metrics
  const calculateMetrics = () => {
    if (!importedProperty?.price) return;
    
    const price = importedProperty.price;
    const annualRent = monthlyRent * 12;
    const expenses = annualTaxes + annualInsurance + annualMaintenance;
    const noi = annualRent - expenses;
    
    // Mortgage calculation
    const loanAmount = price * (1 - downPaymentPercent / 100);
    const monthlyRate = interestRate / 100 / 12;
    const numPayments = amortizationYears * 12;
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                          (Math.pow(1 + monthlyRate, numPayments) - 1);
    const annualDebtService = monthlyPayment * 12;
    
    const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;
    const capRate = price > 0 ? (noi / price) * 100 : 0;
    const cashInvested = price * (downPaymentPercent / 100) + price * 0.03; // Down payment + closing costs
    const annualCashFlow = noi - annualDebtService;
    const cashOnCash = cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : 0;
    
    setMetrics({ noi, dscr, capRate, cashOnCash });
  };

  // Calculate multiplex metrics
  const calculateMultiplexMetrics = () => {
    if (!importedProperty?.price) return;
    
    const lotArea = (importedProperty.lotFrontage || 50) * (importedProperty.lotDepth || 120);
    const buildableGfa = lotArea * (lotCoverageRatio / 100) * maxStories;
    const totalConstructionCost = buildableGfa * constructionCostPerSqft;
    const landCost = importedProperty.price;
    const totalProjectCost = landCost + totalConstructionCost;
    
    // Estimate rent based on units
    const totalUnits = maxUnits + (hasGardenSuite ? 1 : 0);
    const avgRentPerUnit = 2000 - (mliAffordabilityPoints * 10); // Affordability reduces rent
    const annualRent = totalUnits * avgRentPerUnit * 12;
    const vacancy = annualRent * 0.03;
    const expenses = annualTaxes + (totalUnits * 500) + (totalConstructionCost * 0.01);
    const noi = annualRent - vacancy - expenses;
    
    const yieldOnCost = totalProjectCost > 0 ? (noi / totalProjectCost) * 100 : 0;
    const capRate = totalProjectCost > 0 ? (noi / totalProjectCost) * 100 : 0;
    
    // MLI financing
    const mliTotalPoints = mliAccessibilityPoints + mliAffordabilityPoints + mliEnergyPoints;
    const ltvBonus = mliTotalPoints >= 100 ? 10 : mliTotalPoints >= 70 ? 5 : 0;
    const baseLtv = 85;
    const ltv = Math.min(95, baseLtv + ltvBonus);
    
    const loanAmount = totalProjectCost * (ltv / 100);
    const mliRate = 4.5 - (mliTotalPoints >= 100 ? 0.5 : 0);
    const monthlyRate = mliRate / 100 / 12;
    const numPayments = 40 * 12; // MLI has 40-year amortization
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                          (Math.pow(1 + monthlyRate, numPayments) - 1);
    const annualDebtService = monthlyPayment * 12;
    
    const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;
    const cashInvested = totalProjectCost * (1 - ltv / 100);
    const annualCashFlow = noi - annualDebtService;
    const cashOnCash = cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : 0;
    
    setMetrics({ 
      noi, 
      dscr, 
      capRate, 
      cashOnCash, 
      yieldOnCost,
      buildableGfa,
      totalConstructionCost,
    });
  };

  useEffect(() => {
    if (strategy === "buy_and_hold" && step >= 4) {
      calculateMetrics();
    } else if (strategy === "multiplex" && step >= 5) {
      calculateMultiplexMetrics();
    }
  }, [strategy, step, monthlyRent, downPaymentPercent, interestRate, amortizationYears, 
      annualTaxes, annualInsurance, annualMaintenance, lotCoverageRatio, maxStories, 
      maxUnits, hasGardenSuite, constructionCostPerSqft, mliAccessibilityPoints,
      mliAffordabilityPoints, mliEnergyPoints]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const steps = strategy ? STRATEGY_STEPS[strategy] : STRATEGY_STEPS.buy_and_hold.slice(0, 2);
  const totalSteps = steps.length;
  const progress = ((step - 1) / (totalSteps - 1)) * 100;

  const handleNext = async () => {
    if (step === 1 && importedProperty) {
      await savePropertyMutation.mutateAsync(importedProperty);
    }
    if (step === 2 && strategy) {
      await updateProjectMutation.mutateAsync({ strategy, currentStep: 3 });
    }
    setStep(Math.min(step + 1, totalSteps));
  };

  const handleBack = () => {
    setStep(Math.max(step - 1, 1));
  };

  const handleExport = async () => {
    toast({ title: "Exporting...", description: "Generating your project summary" });
    // Export logic would go here
  };

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Import Property from Realtor.ca
              </CardTitle>
              <CardDescription>
                Paste a listing URL or HTML source to automatically extract property details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="https://www.realtor.ca/real-estate/..."
                  value={listingUrl}
                  onChange={(e) => setListingUrl(e.target.value)}
                  className="flex-1"
                  data-testid="input-plex-listing-url"
                />
                <Button
                  onClick={() => importPropertyMutation.mutate({ url: listingUrl })}
                  disabled={importPropertyMutation.isPending || !listingUrl.trim()}
                  data-testid="button-plex-import-url"
                >
                  {importPropertyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Import"}
                </Button>
              </div>
              
              <Collapsible open={showHtmlInput} onOpenChange={setShowHtmlInput}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                    <Code className="h-3 w-3 mr-1" />
                    {showHtmlInput ? "Hide" : "Show"} advanced import (paste HTML)
                    <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${showHtmlInput ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-3">
                  <div className="p-3 bg-muted/50 rounded-md text-xs text-muted-foreground">
                    <p className="font-medium mb-1">If URL import is blocked:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Open the listing in your browser</li>
                      <li>Right-click → "View Page Source" (Ctrl+U)</li>
                      <li>Select all (Ctrl+A) and copy (Ctrl+C)</li>
                      <li>Paste the HTML below</li>
                    </ol>
                  </div>
                  <Textarea
                    placeholder="Paste HTML source..."
                    value={htmlSource}
                    onChange={(e) => setHtmlSource(e.target.value)}
                    className="min-h-[100px] font-mono text-xs"
                    data-testid="input-plex-html-source"
                  />
                  <Button
                    onClick={() => importPropertyMutation.mutate({ html: htmlSource })}
                    disabled={importPropertyMutation.isPending || !htmlSource.trim()}
                    variant="secondary"
                    className="w-full"
                    data-testid="button-plex-import-html"
                  >
                    {importPropertyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Code className="h-4 w-4 mr-2" />}
                    Import from HTML
                  </Button>
                </CollapsibleContent>
              </Collapsible>

              {importedProperty && (
                <Card className="bg-accent/30 border-accent/50">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {importedProperty.imageUrl && (
                        <img 
                          src={importedProperty.imageUrl} 
                          alt="Property" 
                          className="w-24 h-24 object-cover rounded-md"
                        />
                      )}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{importedProperty.address}</h4>
                            <p className="text-sm text-muted-foreground">
                              {importedProperty.city}, {importedProperty.province}
                            </p>
                          </div>
                          <Badge variant="secondary">{formatCurrency(importedProperty.price || 0)}</Badge>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <span>{importedProperty.bedrooms} bed</span>
                          <span>{importedProperty.bathrooms} bath</span>
                          {importedProperty.squareFootage && (
                            <span>{importedProperty.squareFootage.toLocaleString()} sqft</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Lot Frontage (ft)</Label>
                        <Input
                          type="number"
                          value={importedProperty.lotFrontage || ""}
                          onChange={(e) => setImportedProperty({
                            ...importedProperty,
                            lotFrontage: parseFloat(e.target.value) || null,
                          })}
                          placeholder="e.g. 50"
                          data-testid="input-lot-frontage"
                        />
                      </div>
                      <div>
                        <Label>Lot Depth (ft)</Label>
                        <Input
                          type="number"
                          value={importedProperty.lotDepth || ""}
                          onChange={(e) => setImportedProperty({
                            ...importedProperty,
                            lotDepth: parseFloat(e.target.value) || null,
                          })}
                          placeholder="e.g. 120"
                          data-testid="input-lot-depth"
                        />
                      </div>
                      <div>
                        <Label>Annual Property Taxes</Label>
                        <Input
                          type="number"
                          value={importedProperty.annualTaxes || ""}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || null;
                            setImportedProperty({ ...importedProperty, annualTaxes: val });
                            if (val) setAnnualTaxes(val);
                          }}
                          placeholder="e.g. 5000"
                          data-testid="input-annual-taxes"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Choose Your Strategy
              </CardTitle>
              <CardDescription>
                Select the investment approach that matches your goals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={strategy || ""}
                onValueChange={(v) => setStrategy(v as "buy_and_hold" | "multiplex")}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <Label
                  htmlFor="buy_and_hold"
                  className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer hover:bg-accent/50 transition-colors ${strategy === "buy_and_hold" ? "border-primary bg-accent/30" : "border-muted"}`}
                >
                  <RadioGroupItem value="buy_and_hold" id="buy_and_hold" className="sr-only" />
                  <Home className="h-10 w-10 mb-3 text-primary" />
                  <div className="text-center">
                    <p className="font-semibold">Buy & Hold (101)</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Rental income analysis, DSCR, Cap Rate, Cash-on-Cash
                    </p>
                  </div>
                </Label>
                
                <Label
                  htmlFor="multiplex"
                  className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer hover:bg-accent/50 transition-colors ${strategy === "multiplex" ? "border-primary bg-accent/30" : "border-muted"}`}
                >
                  <RadioGroupItem value="multiplex" id="multiplex" className="sr-only" />
                  <Building2 className="h-10 w-10 mb-3 text-primary" />
                  <div className="text-center">
                    <p className="font-semibold">Multiplex Masterclass</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Zoning analysis, GFA, construction costs, MLI Select
                    </p>
                  </div>
                </Label>
              </RadioGroup>
            </CardContent>
          </Card>
        );

      case 3:
        if (strategy === "buy_and_hold") {
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Rental Income Analysis
                </CardTitle>
                <CardDescription>
                  Research comparable rents on Kijiji or realtor.ca and enter your estimate
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-muted/50 rounded-md">
                  <div className="flex items-center gap-2 text-sm mb-2">
                    <ExternalLink className="h-4 w-4" />
                    <span className="font-medium">Research Rent Comps</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href="https://www.kijiji.ca/b-for-rent/gta-greater-toronto-area/c30349001l1700272" target="_blank" rel="noopener noreferrer">
                        Kijiji Rentals
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href="https://www.realtor.ca/map#ZoomLevel=11&Center=43.653225%2C-79.383186&LatitudeMax=43.85&LongitudeMax=-79.05&LatitudeMin=43.45&LongitudeMin=-79.72&PropertyTypeGroupID=1&PropertySearchTypeId=1&TransactionTypeId=3" target="_blank" rel="noopener noreferrer">
                        Realtor.ca Rentals
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Estimated Monthly Rent</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[monthlyRent]}
                        onValueChange={([v]) => setMonthlyRent(v)}
                        min={500}
                        max={10000}
                        step={50}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={monthlyRent}
                        onChange={(e) => setMonthlyRent(parseInt(e.target.value) || 0)}
                        className="w-28"
                        data-testid="input-monthly-rent"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Annual Property Taxes</Label>
                      <Input
                        type="number"
                        value={annualTaxes}
                        onChange={(e) => setAnnualTaxes(parseInt(e.target.value) || 0)}
                        data-testid="input-bh-annual-taxes"
                      />
                    </div>
                    <div>
                      <Label>Annual Insurance</Label>
                      <Input
                        type="number"
                        value={annualInsurance}
                        onChange={(e) => setAnnualInsurance(parseInt(e.target.value) || 0)}
                        data-testid="input-annual-insurance"
                      />
                    </div>
                    <div>
                      <Label>Annual Maintenance</Label>
                      <Input
                        type="number"
                        value={annualMaintenance}
                        onChange={(e) => setAnnualMaintenance(parseInt(e.target.value) || 0)}
                        data-testid="input-annual-maintenance"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        } else {
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Zoning Analysis
                </CardTitle>
                <CardDescription>
                  Look up zoning details at Toronto's zoning map and enter the parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-muted/50 rounded-md">
                  <div className="flex items-center gap-2 text-sm mb-2">
                    <ExternalLink className="h-4 w-4" />
                    <span className="font-medium">Lookup Zoning</span>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href="https://map.toronto.ca/maps/zoning/" target="_blank" rel="noopener noreferrer">
                      City of Toronto Zoning Map
                    </a>
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Zoning Code</Label>
                    <Input
                      value={zoningCode}
                      onChange={(e) => setZoningCode(e.target.value)}
                      placeholder="e.g. R, RM, RD"
                      data-testid="input-zoning-code"
                    />
                  </div>
                  <div>
                    <Label>Lot Coverage Ratio (%)</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[lotCoverageRatio]}
                        onValueChange={([v]) => setLotCoverageRatio(v)}
                        min={20}
                        max={80}
                        step={5}
                        className="flex-1"
                      />
                      <span className="w-12 text-right font-mono">{lotCoverageRatio}%</span>
                    </div>
                  </div>
                  <div>
                    <Label>Max Stories</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[maxStories]}
                        onValueChange={([v]) => setMaxStories(v)}
                        min={1}
                        max={6}
                        step={1}
                        className="flex-1"
                      />
                      <span className="w-12 text-right font-mono">{maxStories}</span>
                    </div>
                  </div>
                  <div>
                    <Label>Max Units</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[maxUnits]}
                        onValueChange={([v]) => setMaxUnits(v)}
                        min={1}
                        max={12}
                        step={1}
                        className="flex-1"
                      />
                      <span className="w-12 text-right font-mono">{maxUnits}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="garden-suite"
                    checked={hasGardenSuite}
                    onCheckedChange={setHasGardenSuite}
                  />
                  <Label htmlFor="garden-suite">Include Garden Suite (+1 unit)</Label>
                </div>

                {importedProperty && (
                  <Card className="bg-accent/30">
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Buildable GFA Preview</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Lot Area</p>
                          <p className="font-mono">{((importedProperty.lotFrontage || 50) * (importedProperty.lotDepth || 120)).toLocaleString()} sqft</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Coverage</p>
                          <p className="font-mono">{lotCoverageRatio}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Est. GFA</p>
                          <p className="font-mono font-semibold">
                            {((importedProperty.lotFrontage || 50) * (importedProperty.lotDepth || 120) * (lotCoverageRatio / 100) * maxStories).toLocaleString()} sqft
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          );
        }

      case 4:
        if (strategy === "buy_and_hold") {
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Mortgage & Financing
                </CardTitle>
                <CardDescription>
                  Configure your mortgage terms to calculate debt service
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Down Payment (%)</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[downPaymentPercent]}
                        onValueChange={([v]) => setDownPaymentPercent(v)}
                        min={5}
                        max={50}
                        step={5}
                        className="flex-1"
                      />
                      <span className="w-12 text-right font-mono">{downPaymentPercent}%</span>
                    </div>
                    {importedProperty?.price && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatCurrency(importedProperty.price * (downPaymentPercent / 100))}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Interest Rate (%)</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[interestRate]}
                        onValueChange={([v]) => setInterestRate(v)}
                        min={2}
                        max={10}
                        step={0.25}
                        className="flex-1"
                      />
                      <span className="w-16 text-right font-mono">{interestRate.toFixed(2)}%</span>
                    </div>
                  </div>
                  <div>
                    <Label>Amortization (years)</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <Slider
                        value={[amortizationYears]}
                        onValueChange={([v]) => setAmortizationYears(v)}
                        min={15}
                        max={30}
                        step={5}
                        className="flex-1"
                      />
                      <span className="w-12 text-right font-mono">{amortizationYears}</span>
                    </div>
                  </div>
                </div>

                {metrics && (
                  <Card className="bg-accent/30">
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-3">Preliminary Metrics</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">NOI</p>
                          <p className="font-mono font-semibold">{formatCurrency(metrics.noi)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">DSCR</p>
                          <p className={`font-mono font-semibold ${metrics.dscr >= 1.2 ? "text-green-600" : metrics.dscr >= 1.0 ? "text-yellow-600" : "text-red-600"}`}>
                            {metrics.dscr.toFixed(2)}x
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Cap Rate</p>
                          <p className="font-mono font-semibold">{formatPercent(metrics.capRate)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Cash-on-Cash</p>
                          <p className={`font-mono font-semibold ${metrics.cashOnCash >= 8 ? "text-green-600" : metrics.cashOnCash >= 5 ? "text-yellow-600" : "text-red-600"}`}>
                            {formatPercent(metrics.cashOnCash)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          );
        } else {
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Construction Costs
                </CardTitle>
                <CardDescription>
                  Estimate your build costs per square foot
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Construction Cost per SF</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <Slider
                      value={[constructionCostPerSqft]}
                      onValueChange={([v]) => setConstructionCostPerSqft(v)}
                      min={300}
                      max={800}
                      step={25}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={constructionCostPerSqft}
                      onChange={(e) => setConstructionCostPerSqft(parseInt(e.target.value) || 0)}
                      className="w-28"
                      data-testid="input-construction-cost"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Typical range: $400-600/SF for mid-rise wood frame
                  </p>
                </div>

                {importedProperty && (
                  <Card className="bg-accent/30">
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-3">Cost Summary</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Buildable GFA</p>
                          <p className="font-mono font-semibold">
                            {((importedProperty.lotFrontage || 50) * (importedProperty.lotDepth || 120) * (lotCoverageRatio / 100) * maxStories).toLocaleString()} SF
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Construction</p>
                          <p className="font-mono font-semibold">
                            {formatCurrency((importedProperty.lotFrontage || 50) * (importedProperty.lotDepth || 120) * (lotCoverageRatio / 100) * maxStories * constructionCostPerSqft)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Land Cost</p>
                          <p className="font-mono font-semibold">{formatCurrency(importedProperty.price || 0)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Project</p>
                          <p className="font-mono font-semibold text-primary">
                            {formatCurrency(
                              (importedProperty.price || 0) + 
                              (importedProperty.lotFrontage || 50) * (importedProperty.lotDepth || 120) * (lotCoverageRatio / 100) * maxStories * constructionCostPerSqft
                            )}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          );
        }

      case 5:
        if (strategy === "buy_and_hold") {
          // Results step for Buy & Hold
          return renderResults();
        } else {
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  MLI Select Points
                </CardTitle>
                <CardDescription>
                  Configure CMHC MLI Select incentives (100+ points for maximum benefits)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <Label>Accessibility (0-30 pts)</Label>
                      <span className="text-sm text-muted-foreground">Increases construction cost</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[mliAccessibilityPoints]}
                        onValueChange={([v]) => setMliAccessibilityPoints(v)}
                        min={0}
                        max={30}
                        step={5}
                        className="flex-1"
                      />
                      <span className="w-12 text-right font-mono">{mliAccessibilityPoints}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <Label>Affordability (0-50 pts)</Label>
                      <span className="text-sm text-muted-foreground">Reduces rental income</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[mliAffordabilityPoints]}
                        onValueChange={([v]) => setMliAffordabilityPoints(v)}
                        min={0}
                        max={50}
                        step={5}
                        className="flex-1"
                      />
                      <span className="w-12 text-right font-mono">{mliAffordabilityPoints}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <Label>Energy Efficiency (0-20 pts)</Label>
                      <span className="text-sm text-muted-foreground">Increases construction cost</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[mliEnergyPoints]}
                        onValueChange={([v]) => setMliEnergyPoints(v)}
                        min={0}
                        max={20}
                        step={5}
                        className="flex-1"
                      />
                      <span className="w-12 text-right font-mono">{mliEnergyPoints}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Total MLI Points</p>
                    <p className="text-sm text-muted-foreground">100+ points unlocks maximum LTV & rate discounts</p>
                  </div>
                  <Badge variant={mliAccessibilityPoints + mliAffordabilityPoints + mliEnergyPoints >= 100 ? "default" : "secondary"} className="text-lg px-4 py-1">
                    {mliAccessibilityPoints + mliAffordabilityPoints + mliEnergyPoints} pts
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        }

      case 6:
        return renderResults();

      default:
        return null;
    }
  };

  const renderResults = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Check className="h-5 w-5 text-green-600" />
          Investment Analysis Results
        </CardTitle>
        <CardDescription>
          Your capstone analysis is complete
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {importedProperty && (
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex gap-4">
                {importedProperty.imageUrl && (
                  <img src={importedProperty.imageUrl} alt="Property" className="w-20 h-20 object-cover rounded-md" />
                )}
                <div>
                  <h4 className="font-semibold">{importedProperty.address}</h4>
                  <p className="text-sm text-muted-foreground">{importedProperty.city}, {importedProperty.province}</p>
                  <p className="font-mono font-semibold mt-1">{formatCurrency(importedProperty.price || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">NOI</p>
                <p className="text-2xl font-mono font-bold">{formatCurrency(metrics.noi)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">DSCR</p>
                <p className={`text-2xl font-mono font-bold ${metrics.dscr >= 1.2 ? "text-green-600" : metrics.dscr >= 1.0 ? "text-yellow-600" : "text-red-600"}`}>
                  {metrics.dscr.toFixed(2)}x
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Cap Rate</p>
                <p className="text-2xl font-mono font-bold">{formatPercent(metrics.capRate)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Cash-on-Cash</p>
                <p className={`text-2xl font-mono font-bold ${metrics.cashOnCash >= 8 ? "text-green-600" : metrics.cashOnCash >= 5 ? "text-yellow-600" : "text-red-600"}`}>
                  {formatPercent(metrics.cashOnCash)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {strategy === "multiplex" && metrics?.yieldOnCost && (
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Yield on Cost</p>
                <p className="text-2xl font-mono font-bold text-primary">{formatPercent(metrics.yieldOnCost)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Total Construction</p>
                <p className="text-2xl font-mono font-bold">{formatCurrency(metrics.totalConstructionCost || 0)}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex gap-2 justify-center pt-4">
          <Button onClick={handleExport} data-testid="button-export-results">
            <FileDown className="h-4 w-4 mr-2" />
            Export to Google Sheets
          </Button>
          <Button variant="outline" onClick={() => {
            const data = {
              property: importedProperty,
              strategy,
              metrics,
              inputs: strategy === "buy_and_hold" 
                ? { monthlyRent, downPaymentPercent, interestRate, amortizationYears, annualTaxes, annualInsurance, annualMaintenance }
                : { zoningCode, lotCoverageRatio, maxStories, maxUnits, hasGardenSuite, constructionCostPerSqft, mliAccessibilityPoints, mliAffordabilityPoints, mliEnergyPoints },
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `will-it-plex-${importedProperty?.address?.replace(/\s+/g, "-") || "analysis"}.json`;
            a.click();
          }} data-testid="button-export-json">
            <FileDown className="h-4 w-4 mr-2" />
            Download JSON
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              Will It Plex?
            </h1>
            <p className="text-muted-foreground mt-1">
              Interactive real estate capstone analysis tool
            </p>
          </div>
          <div className="flex gap-2">
            {currentProjectId && (
              <Button variant="outline" size="sm" onClick={() => {
                setCurrentProjectId(null);
                setStep(1);
                setStrategy(null);
                setImportedProperty(null);
              }}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Start Over
              </Button>
            )}
            <Button 
              onClick={() => createProjectMutation.mutate()} 
              disabled={createProjectMutation.isPending}
              data-testid="button-new-project"
            >
              {createProjectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              New Project
            </Button>
          </div>
        </div>

        {!currentProjectId ? (
          <Card>
            <CardHeader>
              <CardTitle>Your Capstone Projects</CardTitle>
              <CardDescription>
                Continue a previous project or start a new one
              </CardDescription>
            </CardHeader>
            <CardContent>
              {projectsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : projects && projects.length > 0 ? (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <Card key={project.id} className="cursor-pointer hover-elevate" onClick={() => {
                      setCurrentProjectId(project.id);
                      setStep(project.currentStep || 1);
                      setStrategy(project.strategy as "buy_and_hold" | "multiplex" | null);
                      if (project.property) setImportedProperty(project.property);
                    }}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{project.property?.address || "Untitled Project"}</p>
                          <p className="text-sm text-muted-foreground">
                            {project.strategy === "buy_and_hold" ? "Buy & Hold" : project.strategy === "multiplex" ? "Multiplex" : "Not started"} 
                            {" • "}Step {project.currentStep || 1}
                          </p>
                        </div>
                        <Badge variant={project.status === "completed" ? "default" : "secondary"}>
                          {project.status}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No projects yet. Click "New Project" to begin!</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Progress stepper */}
            <div className="mb-8">
              <Progress value={progress} className="h-2 mb-4" />
              <div className="flex justify-between">
                {steps.map((s, idx) => (
                  <div 
                    key={s.id} 
                    className={`flex flex-col items-center ${idx < steps.length - 1 ? "flex-1" : ""}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step > s.id ? "bg-primary text-primary-foreground" : 
                      step === s.id ? "bg-primary/20 text-primary border-2 border-primary" : 
                      "bg-muted text-muted-foreground"
                    }`}>
                      {step > s.id ? <Check className="h-4 w-4" /> : s.id}
                    </div>
                    <p className="text-xs mt-1 text-center hidden md:block">{s.title}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Step content */}
            {renderStepContent()}

            {/* Navigation */}
            <div className="flex justify-between mt-6">
              <Button 
                variant="outline" 
                onClick={handleBack} 
                disabled={step === 1}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              
              {step < totalSteps ? (
                <Button 
                  onClick={handleNext}
                  disabled={
                    (step === 1 && !importedProperty) ||
                    (step === 2 && !strategy) ||
                    updateProjectMutation.isPending ||
                    savePropertyMutation.isPending
                  }
                  data-testid="button-next"
                >
                  {(updateProjectMutation.isPending || savePropertyMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={() => {
                  updateProjectMutation.mutate({ status: "completed", completedAt: new Date().toISOString() });
                  toast({ title: "Project completed!", description: "Your analysis has been saved." });
                }} data-testid="button-complete">
                  <Check className="h-4 w-4 mr-2" />
                  Complete Project
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
