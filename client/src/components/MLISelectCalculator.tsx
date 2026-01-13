import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, Leaf, Accessibility, Award, DollarSign, Percent, 
  ArrowRight, CheckCircle2, Info, TrendingUp, TrendingDown,
  Calculator, Send, AlertCircle, Wallet, Home
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  MLI_CONFIG,
  getTierFromPoints,
  getAffordableRentThreshold,
  calculateMonthlyPayment,
  calculateDSCR,
  findMaxLTVForDSCR,
  type MLITier,
  type ProjectType,
  type EnergyTier,
  type AccessibilityTier,
  type AffordabilityTier,
  type FinancingType,
} from "@/lib/mliConfig";

interface MLIInputs {
  projectType: ProjectType;
  location: string;
  totalUnits: number;
  affordabilityTier: AffordabilityTier;
  extendedCommitment: boolean;
  energyTier: EnergyTier;
  accessibilityTier: AccessibilityTier;
  marketRent: number;
  rentGrowth: number;
  otherIncome: number;
  vacancyRate: number;
  expenseRatio: number;
  landCost: number;
  hardCosts: number;
  softCosts: number;
  contingencyPercent: number;
  financingFees: number;
  constructionFinancing: FinancingType;
  constructionRate: number;
  takeoutRate: number;
  ltv: number;
}

interface ScenarioResults {
  egi: number;
  vacancyLoss: number;
  egiAfterVacancy: number;
  opex: number;
  noi: number;
  loanAmount: number;
  annualDebtService: number;
  dscr: number;
  cashFlow: number;
  equityRequired: number;
  ltv: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function MLISelectCalculator() {
  const { toast } = useToast();
  const [inputs, setInputs] = useState<MLIInputs>({
    projectType: "new_construction",
    location: "Toronto",
    totalUnits: 50,
    affordabilityTier: "tier50",
    extendedCommitment: false,
    energyTier: "none",
    accessibilityTier: "none",
    marketRent: 2000,
    rentGrowth: 0,
    otherIncome: 0,
    vacancyRate: MLI_CONFIG.defaults.vacancyRate,
    expenseRatio: MLI_CONFIG.defaults.expenseRatio,
    landCost: 2000000,
    hardCosts: 15000000,
    softCosts: 2000000,
    contingencyPercent: 5,
    financingFees: 100000,
    constructionFinancing: "conventional",
    constructionRate: MLI_CONFIG.defaults.constructionRate,
    takeoutRate: MLI_CONFIG.defaults.interestRate,
    ltv: 85,
  });

  const [leadForm, setLeadForm] = useState({ name: "", email: "", phone: "" });
  const [showLeadForm, setShowLeadForm] = useState(false);

  const updateInput = <K extends keyof MLIInputs>(key: K, value: MLIInputs[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const results = useMemo(() => {
    const medianIncome = MLI_CONFIG.medianIncomes[inputs.location] || MLI_CONFIG.medianIncomes["Other"];
    const affordableRentThreshold = getAffordableRentThreshold(medianIncome);

    // Calculate points
    let affordabilityPoints = 0;
    const affordConfig = inputs.projectType === "new_construction" 
      ? MLI_CONFIG.affordabilityTiers.newConstruction 
      : MLI_CONFIG.affordabilityTiers.existing;
    
    if (inputs.affordabilityTier !== "none") {
      affordabilityPoints = affordConfig[inputs.affordabilityTier].points;
    }
    
    const extendedBonus = inputs.extendedCommitment ? MLI_CONFIG.extendedCommitmentBonus : 0;
    const energyPoints = MLI_CONFIG.energyTiers[inputs.energyTier].points;
    const accessibilityPoints = MLI_CONFIG.accessibilityTiers[inputs.accessibilityTier].points;
    const totalPoints = affordabilityPoints + extendedBonus + energyPoints + accessibilityPoints;
    const tier = getTierFromPoints(totalPoints);
    const loanTerms = MLI_CONFIG.loanTerms[tier];

    // Calculate affordable units
    const affordableUnitPercent = inputs.affordabilityTier !== "none" 
      ? affordConfig[inputs.affordabilityTier].unitPercent / 100 
      : 0;
    const affordableUnits = Math.round(inputs.totalUnits * affordableUnitPercent);
    const marketUnits = inputs.totalUnits - affordableUnits;
    const effectiveAffordableRent = Math.min(inputs.marketRent, affordableRentThreshold);

    // Total project cost
    const contingency = (inputs.hardCosts + inputs.softCosts) * (inputs.contingencyPercent / 100);
    const totalProjectCost = inputs.landCost + inputs.hardCosts + inputs.softCosts + contingency + inputs.financingFees;

    // Calculate scenarios
    const calculateScenario = (
      rentMod: number = 0,
      vacancyMod: number = 0,
      expenseMod: number = 0,
      rateMod: number = 0,
      ltvOverride?: number
    ): ScenarioResults => {
      const effectiveMarketRent = inputs.marketRent * (1 + rentMod);
      const effectiveAffordRent = Math.min(effectiveMarketRent, affordableRentThreshold);
      const grossRent = (marketUnits * effectiveMarketRent + affordableUnits * effectiveAffordRent) * 12;
      const effectiveVacancy = Math.max(0, Math.min(1, inputs.vacancyRate + vacancyMod));
      const vacancyLoss = grossRent * effectiveVacancy;
      const egi = grossRent - vacancyLoss + (inputs.otherIncome * 12);
      const effectiveExpenseRatio = Math.max(0, Math.min(1, inputs.expenseRatio + expenseMod));
      const opex = egi * effectiveExpenseRatio;
      const noi = egi - opex;

      const currentLtv = ltvOverride ?? inputs.ltv;
      const baseLoanAmount = totalProjectCost * (currentLtv / 100);
      // CMHC premium is financed into the loan (added to principal)
      const insurancePremium = baseLoanAmount * (loanTerms.insurancePremium / 100);
      const loanAmount = baseLoanAmount + insurancePremium; // Total financed amount
      const effectiveRate = inputs.takeoutRate + rateMod;
      const monthlyPayment = calculateMonthlyPayment(loanAmount, effectiveRate, loanTerms.maxAmortization);
      const annualDebtService = monthlyPayment * 12;
      const dscr = calculateDSCR(noi, annualDebtService);
      const equityRequired = totalProjectCost - baseLoanAmount; // Equity is project cost minus base loan
      const cashFlow = noi - annualDebtService;

      return {
        egi,
        vacancyLoss,
        egiAfterVacancy: egi,
        opex,
        noi,
        loanAmount,
        annualDebtService,
        dscr,
        cashFlow,
        equityRequired,
        ltv: currentLtv,
      };
    };

    const base = calculateScenario();
    const bear = calculateScenario(
      MLI_CONFIG.stressTest.bear.rentChange,
      MLI_CONFIG.stressTest.bear.vacancyChange,
      MLI_CONFIG.stressTest.bear.expenseChange,
      MLI_CONFIG.stressTest.bear.rateChange
    );
    const bull = calculateScenario(
      MLI_CONFIG.stressTest.bull.rentChange,
      MLI_CONFIG.stressTest.bull.vacancyChange,
      MLI_CONFIG.stressTest.bull.expenseChange,
      MLI_CONFIG.stressTest.bull.rateChange
    );

    // Find max LTV for DSCR >= 1.10 (includes financed insurance premium)
    const maxLTVForDSCR = findMaxLTVForDSCR(
      base.noi,
      totalProjectCost,
      inputs.takeoutRate,
      loanTerms.maxAmortization,
      loanTerms.maxLTV,
      loanTerms.insurancePremium,
      MLI_CONFIG.defaults.minDSCR
    );

    return {
      medianIncome,
      affordableRentThreshold,
      affordabilityPoints,
      extendedBonus,
      energyPoints,
      accessibilityPoints,
      totalPoints,
      tier,
      loanTerms,
      affordableUnits,
      marketUnits,
      effectiveAffordableRent,
      totalProjectCost,
      base,
      bear,
      bull,
      maxLTVForDSCR,
      isEligible: tier !== "none",
    };
  }, [inputs]);

  const handleFindMaxLTV = () => {
    updateInput("ltv", results.maxLTVForDSCR);
  };

  const leadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/leads", {
        lead: {
          name: leadForm.name,
          email: leadForm.email,
          phone: leadForm.phone,
          consent: true,
          leadSource: "MLI Select Calculator",
        },
        analysis: {
          address: inputs.location,
          strategy: "mli_select",
          inputs,
          results: {
            totalPoints: results.totalPoints,
            tier: results.tier,
            dscr: results.base.dscr,
            equityRequired: results.base.equityRequired,
            noi: results.base.noi,
          },
        },
        webhookType: "MLISelect",
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Quote Request Sent!", description: "Our team will contact you shortly." });
      setShowLeadForm(false);
      setLeadForm({ name: "", email: "", phone: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send request. Please try again.", variant: "destructive" });
    },
  });

  const tierLabel = results.tier === "none" ? "Not Eligible" : results.tier.replace("tier", "");
  const dscrStatus = results.base.dscr >= 1.10 ? "good" : results.base.dscr >= 1.0 ? "warning" : "bad";

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">CMHC MLI Select Underwriter</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Calculate your MLI Select points and underwrite your deal with DSCR-first analysis.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Left Column - Inputs */}
        <div className="xl:col-span-2 space-y-6">
          {/* Project Setup */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Project Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Project Type</Label>
                <Select value={inputs.projectType} onValueChange={(v) => updateInput("projectType", v as ProjectType)}>
                  <SelectTrigger data-testid="select-project-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new_construction">New Construction</SelectItem>
                    <SelectItem value="existing">Retrofit / Existing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <Select value={inputs.location} onValueChange={(v) => updateInput("location", v)}>
                  <SelectTrigger data-testid="select-location">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(MLI_CONFIG.medianIncomes)
                      .filter(city => city !== "Other")
                      .sort((a, b) => a.localeCompare(b))
                      .concat(["Other"])
                      .map(city => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalUnits">Total Units</Label>
                <Input
                  id="totalUnits"
                  type="number"
                  value={inputs.totalUnits}
                  onChange={(e) => updateInput("totalUnits", parseInt(e.target.value) || 0)}
                  className="h-10 font-mono"
                  data-testid="input-total-units"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="marketRent">Market Rent (per unit/mo)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="marketRent"
                    type="number"
                    value={inputs.marketRent}
                    onChange={(e) => updateInput("marketRent", parseInt(e.target.value) || 0)}
                    className="h-10 pl-9 font-mono"
                    data-testid="input-market-rent"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* MLI Select Tiers */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5" />
                MLI Select Points
              </CardTitle>
              <CardDescription>
                Select your commitment levels to calculate total points
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Affordability
                  </Label>
                  <Select value={inputs.affordabilityTier} onValueChange={(v) => updateInput("affordabilityTier", v as AffordabilityTier)}>
                    <SelectTrigger data-testid="select-affordability-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (0 pts)</SelectItem>
                      <SelectItem value="tier50">Level 1 (50 pts)</SelectItem>
                      <SelectItem value="tier70">Level 2 (70 pts)</SelectItem>
                      <SelectItem value="tier100">Level 3 (100 pts)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Leaf className="h-4 w-4" />
                    Energy
                  </Label>
                  <Select value={inputs.energyTier} onValueChange={(v) => updateInput("energyTier", v as EnergyTier)}>
                    <SelectTrigger data-testid="select-energy-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MLI_CONFIG.energyTiers).map(([key, tier]) => (
                        <SelectItem key={key} value={key}>{tier.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Accessibility className="h-4 w-4" />
                    Accessibility
                  </Label>
                  <Select value={inputs.accessibilityTier} onValueChange={(v) => updateInput("accessibilityTier", v as AccessibilityTier)}>
                    <SelectTrigger data-testid="select-accessibility-tier">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MLI_CONFIG.accessibilityTiers).map(([key, tier]) => (
                        <SelectItem key={key} value={key}>{tier.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <Label>Extended Commitment (20+ years)</Label>
                  <p className="text-xs text-muted-foreground">+{MLI_CONFIG.extendedCommitmentBonus} bonus points</p>
                </div>
                <Switch
                  checked={inputs.extendedCommitment}
                  onCheckedChange={(v) => updateInput("extendedCommitment", v)}
                  data-testid="switch-extended-commitment"
                />
              </div>

              <div className="p-3 bg-primary/10 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Points</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold font-mono">{results.totalPoints}</span>
                    <Badge variant={results.isEligible ? "default" : "secondary"}>
                      {tierLabel}
                    </Badge>
                  </div>
                </div>
                <Progress value={Math.min(results.totalPoints, 100)} className="h-2 mt-2" />
              </div>
            </CardContent>
          </Card>

          {/* Operating Assumptions */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Operating Assumptions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Vacancy Rate</Label>
                  <span className="text-sm font-mono">{formatPercent(inputs.vacancyRate)}</span>
                </div>
                <Slider
                  value={[inputs.vacancyRate * 100]}
                  onValueChange={([v]) => updateInput("vacancyRate", v / 100)}
                  max={10}
                  min={0}
                  step={0.5}
                  className="py-2"
                  data-testid="slider-vacancy"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Expense Ratio (% of EGI)</Label>
                  <span className="text-sm font-mono">{formatPercent(inputs.expenseRatio)}</span>
                </div>
                <Slider
                  value={[inputs.expenseRatio * 100]}
                  onValueChange={([v]) => updateInput("expenseRatio", v / 100)}
                  max={60}
                  min={20}
                  step={1}
                  className="py-2"
                  data-testid="slider-expense-ratio"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Rent Growth (Annual)</Label>
                  <span className="text-sm font-mono">{inputs.rentGrowth > 0 ? "+" : ""}{formatPercent(inputs.rentGrowth)}</span>
                </div>
                <Slider
                  value={[inputs.rentGrowth * 100]}
                  onValueChange={([v]) => updateInput("rentGrowth", v / 100)}
                  max={5}
                  min={-5}
                  step={0.5}
                  className="py-2"
                  data-testid="slider-rent-growth"
                />
              </div>
            </CardContent>
          </Card>

          {/* Development Costs */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Home className="h-5 w-5" />
                Development Costs
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="landCost">Land Cost</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="landCost"
                    type="number"
                    value={inputs.landCost}
                    onChange={(e) => updateInput("landCost", parseInt(e.target.value) || 0)}
                    className="h-10 pl-9 font-mono"
                    data-testid="input-land-cost"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hardCosts">Hard Construction Costs</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="hardCosts"
                    type="number"
                    value={inputs.hardCosts}
                    onChange={(e) => updateInput("hardCosts", parseInt(e.target.value) || 0)}
                    className="h-10 pl-9 font-mono"
                    data-testid="input-hard-costs"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="softCosts">Soft Costs</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="softCosts"
                    type="number"
                    value={inputs.softCosts}
                    onChange={(e) => updateInput("softCosts", parseInt(e.target.value) || 0)}
                    className="h-10 pl-9 font-mono"
                    data-testid="input-soft-costs"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contingency">Contingency (%)</Label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="contingency"
                    type="number"
                    value={inputs.contingencyPercent}
                    onChange={(e) => updateInput("contingencyPercent", parseInt(e.target.value) || 0)}
                    className="h-10 pl-9 font-mono"
                    data-testid="input-contingency"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 p-3 bg-muted/50 rounded-lg">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Project Cost</span>
                  <span className="font-mono font-semibold">{formatCurrency(results.totalProjectCost)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financing */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Takeout Financing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="takeoutRate">Interest Rate</Label>
                  <div className="relative">
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="takeoutRate"
                      type="number"
                      step="0.1"
                      value={(inputs.takeoutRate * 100).toFixed(1)}
                      onChange={(e) => updateInput("takeoutRate", parseFloat(e.target.value) / 100 || 0)}
                      className="h-10 pl-9 font-mono"
                      data-testid="input-takeout-rate"
                    />
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg flex flex-col justify-center">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amortization</span>
                    <span className="font-mono font-semibold">{results.loanTerms.maxAmortization} years</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Loan-to-Cost (LTC)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-mono font-bold">{inputs.ltv}%</span>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Max LTC for {tierLabel}: {results.loanTerms.maxLTV}%</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <Slider
                  value={[inputs.ltv]}
                  onValueChange={([v]) => updateInput("ltv", v)}
                  max={results.loanTerms.maxLTV}
                  min={50}
                  step={1}
                  className="py-2"
                  data-testid="slider-ltv"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>50%</span>
                  <span>Max: {results.loanTerms.maxLTV}%</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleFindMaxLTV}
                data-testid="button-find-max-ltv"
              >
                <Calculator className="h-4 w-4 mr-2" />
                Find Max LTC for DSCR ≥ 1.10
              </Button>

              {results.maxLTVForDSCR !== inputs.ltv && (
                <p className="text-sm text-muted-foreground text-center">
                  Optimal LTC for 1.10 DSCR: <span className="font-mono font-semibold">{results.maxLTVForDSCR}%</span>
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          {/* Primary KPIs */}
          <Card className="sticky top-4">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Deal Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* DSCR Card */}
              <div className={`p-4 rounded-lg ${
                dscrStatus === "good" ? "bg-green-500/10 border border-green-500/30" :
                dscrStatus === "warning" ? "bg-yellow-500/10 border border-yellow-500/30" :
                "bg-red-500/10 border border-red-500/30"
              }`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm text-muted-foreground">DSCR</div>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="text-3xl font-bold font-mono">{results.base.dscr.toFixed(2)}x</div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>DSCR = NOI / Annual Debt Service</p>
                        <p>CMHC often accepts 1.10-1.20</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {dscrStatus === "good" ? (
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  ) : (
                    <AlertCircle className={`h-8 w-8 ${dscrStatus === "warning" ? "text-yellow-500" : "text-red-500"}`} />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {dscrStatus === "good" ? "Meets CMHC minimum" : 
                   dscrStatus === "warning" ? "Borderline - consider reducing LTC" : 
                   "Below minimum - reduce leverage"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Loan Amount</div>
                  <div className="text-lg font-bold font-mono">{formatCurrency(results.base.loanAmount)}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Equity Required</div>
                  <div className="text-lg font-bold font-mono">{formatCurrency(results.base.equityRequired)}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Stabilized NOI</div>
                  <div className="text-lg font-bold font-mono">{formatCurrency(results.base.noi)}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Annual Cash Flow</div>
                  <div className={`text-lg font-bold font-mono ${results.base.cashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(results.base.cashFlow)}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Affordable Rent Summary */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                <div className="text-sm font-medium">Affordability Summary</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Median Income: <span className="font-mono">{formatCurrency(results.medianIncome)}</span></div>
                  <div>Affordable Rent: <span className="font-mono">{formatCurrency(results.affordableRentThreshold)}/mo</span></div>
                  <div>Affordable Units: <span className="font-mono">{results.affordableUnits}</span></div>
                  <div>Market Units: <span className="font-mono">{results.marketUnits}</span></div>
                </div>
              </div>

              <Separator />

              {/* Stress Test Table */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Stress Test</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1 font-medium"></th>
                        <th className="text-right py-1 font-medium">Base</th>
                        <th className="text-right py-1 font-medium text-red-600">
                          <TrendingDown className="h-3 w-3 inline mr-1" />Bear
                        </th>
                        <th className="text-right py-1 font-medium text-green-600">
                          <TrendingUp className="h-3 w-3 inline mr-1" />Bull
                        </th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      <tr className="border-b">
                        <td className="py-1">NOI</td>
                        <td className="text-right">{formatCurrency(results.base.noi)}</td>
                        <td className="text-right text-red-600">{formatCurrency(results.bear.noi)}</td>
                        <td className="text-right text-green-600">{formatCurrency(results.bull.noi)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-1">DSCR</td>
                        <td className="text-right">{results.base.dscr.toFixed(2)}x</td>
                        <td className="text-right text-red-600">{results.bear.dscr.toFixed(2)}x</td>
                        <td className="text-right text-green-600">{results.bull.dscr.toFixed(2)}x</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-1">Cash Flow</td>
                        <td className="text-right">{formatCurrency(results.base.cashFlow)}</td>
                        <td className="text-right text-red-600">{formatCurrency(results.bear.cashFlow)}</td>
                        <td className="text-right text-green-600">{formatCurrency(results.bull.cashFlow)}</td>
                      </tr>
                      <tr>
                        <td className="py-1">Equity</td>
                        <td className="text-right">{formatCurrency(results.base.equityRequired)}</td>
                        <td className="text-right">{formatCurrency(results.bear.equityRequired)}</td>
                        <td className="text-right">{formatCurrency(results.bull.equityRequired)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <Separator />

              {/* CTA */}
              {!showLeadForm ? (
                <Button className="w-full" onClick={() => setShowLeadForm(true)} data-testid="button-get-quote">
                  Get MLI Select Quote
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <div className="space-y-3">
                  <Input
                    placeholder="Your Name"
                    value={leadForm.name}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, name: e.target.value }))}
                    data-testid="input-lead-name"
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={leadForm.email}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, email: e.target.value }))}
                    data-testid="input-lead-email"
                  />
                  <Input
                    placeholder="Phone"
                    type="tel"
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm(prev => ({ ...prev, phone: e.target.value }))}
                    data-testid="input-lead-phone"
                  />
                  <Button
                    className="w-full"
                    onClick={() => leadMutation.mutate()}
                    disabled={!leadForm.name || !leadForm.email || !leadForm.phone || leadMutation.isPending}
                    data-testid="button-submit-lead"
                  >
                    {leadMutation.isPending ? "Sending..." : "Send Quote Request"}
                    <Send className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
