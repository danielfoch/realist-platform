import { useState, useMemo } from "react";
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
import { Building2, Leaf, Accessibility, Award, DollarSign, Percent, Calendar, ArrowRight, CheckCircle2, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MLISelectInputs {
  projectType: "new_construction" | "existing";
  location: string;
  totalUnits: number;
  affordableUnits: number;
  affordabilityCommitmentYears: number;
  energyTier: "none" | "level1" | "level2" | "level3";
  accessibilityTier: "none" | "level1" | "level2";
}

interface MLIResults {
  affordabilityPoints: number;
  extendedCommitmentBonus: number;
  energyPoints: number;
  accessibilityPoints: number;
  totalPoints: number;
  tier: "none" | "50" | "70" | "100";
  maxLTV: number;
  maxAmortization: number;
  affordableRentThreshold: number;
}

const MEDIAN_INCOMES: Record<string, number> = {
  "Toronto": 62000,
  "Vancouver": 58000,
  "Calgary": 72000,
  "Edmonton": 68000,
  "Ottawa": 70000,
  "Montreal": 52000,
  "Winnipeg": 55000,
  "Halifax": 50000,
  "Barrie": 58900,
  "Hamilton": 56000,
  "London": 52000,
  "Kitchener": 60000,
  "Victoria": 55000,
  "Quebec City": 54000,
  "Saskatoon": 62000,
  "Regina": 64000,
  "St. John's": 58000,
  "Other": 55000,
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function MLISelectCalculator() {
  const [inputs, setInputs] = useState<MLISelectInputs>({
    projectType: "new_construction",
    location: "Toronto",
    totalUnits: 50,
    affordableUnits: 10,
    affordabilityCommitmentYears: 10,
    energyTier: "none",
    accessibilityTier: "none",
  });

  const updateInput = <K extends keyof MLISelectInputs>(key: K, value: MLISelectInputs[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const results = useMemo<MLIResults>(() => {
    const medianIncome = MEDIAN_INCOMES[inputs.location] || MEDIAN_INCOMES["Other"];
    const affordableRentThreshold = Math.round((medianIncome * 0.30) / 12);
    const affordablePercent = inputs.totalUnits > 0 ? (inputs.affordableUnits / inputs.totalUnits) * 100 : 0;

    let affordabilityPoints = 0;
    if (inputs.projectType === "new_construction") {
      if (affordablePercent >= 25) affordabilityPoints = 100;
      else if (affordablePercent >= 15) affordabilityPoints = 70;
      else if (affordablePercent >= 10) affordabilityPoints = 50;
    } else {
      if (affordablePercent >= 80) affordabilityPoints = 100;
      else if (affordablePercent >= 60) affordabilityPoints = 70;
      else if (affordablePercent >= 40) affordabilityPoints = 50;
    }

    const extendedCommitmentBonus = inputs.affordabilityCommitmentYears >= 20 ? 30 : 0;

    let energyPoints = 0;
    if (inputs.energyTier === "level3") energyPoints = 50;
    else if (inputs.energyTier === "level2") energyPoints = 35;
    else if (inputs.energyTier === "level1") energyPoints = 20;

    let accessibilityPoints = 0;
    if (inputs.accessibilityTier === "level2") accessibilityPoints = 30;
    else if (inputs.accessibilityTier === "level1") accessibilityPoints = 20;

    const totalPoints = affordabilityPoints + extendedCommitmentBonus + energyPoints + accessibilityPoints;

    let tier: "none" | "50" | "70" | "100" = "none";
    let maxLTV = 75;
    let maxAmortization = 25;

    if (totalPoints >= 100) {
      tier = "100";
      maxLTV = 95;
      maxAmortization = 50;
    } else if (totalPoints >= 70) {
      tier = "70";
      maxLTV = 95;
      maxAmortization = 45;
    } else if (totalPoints >= 50) {
      tier = "50";
      maxLTV = 85;
      maxAmortization = 40;
    }

    return {
      affordabilityPoints,
      extendedCommitmentBonus,
      energyPoints,
      accessibilityPoints,
      totalPoints,
      tier,
      maxLTV,
      maxAmortization,
      affordableRentThreshold,
    };
  }, [inputs]);

  const affordablePercent = inputs.totalUnits > 0 ? (inputs.affordableUnits / inputs.totalUnits) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">CMHC MLI Select Points Calculator</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Calculate your MLI Select points to unlock better financing terms. Projects need a minimum of 50 points to qualify.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Project Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Project Type</Label>
                <Select value={inputs.projectType} onValueChange={(v) => updateInput("projectType", v as "new_construction" | "existing")}>
                  <SelectTrigger data-testid="select-project-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new_construction">New Construction</SelectItem>
                    <SelectItem value="existing">Existing Property</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Location (for median income lookup)</Label>
                <Select value={inputs.location} onValueChange={(v) => updateInput("location", v)}>
                  <SelectTrigger data-testid="select-location">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(MEDIAN_INCOMES).map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Median renter income: {formatCurrency(MEDIAN_INCOMES[inputs.location] || MEDIAN_INCOMES["Other"])}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalUnits">Total Units</Label>
                <Input
                  id="totalUnits"
                  type="number"
                  value={inputs.totalUnits}
                  onChange={(e) => updateInput("totalUnits", parseInt(e.target.value) || 0)}
                  className="h-12 font-mono"
                  data-testid="input-total-units"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Affordability
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Units with rent at or below 30% of local median renter income ({formatCurrency(results.affordableRentThreshold)}/month) qualify as affordable.</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription>
                Affordable rent threshold: <span className="font-mono font-semibold text-foreground">{formatCurrency(results.affordableRentThreshold)}/month</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Affordable Units</Label>
                  <span className="text-sm font-mono">{inputs.affordableUnits} units ({affordablePercent.toFixed(1)}%)</span>
                </div>
                <Slider
                  value={[inputs.affordableUnits]}
                  onValueChange={([v]) => updateInput("affordableUnits", v)}
                  max={inputs.totalUnits}
                  min={0}
                  step={1}
                  className="py-2"
                  data-testid="slider-affordable-units"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0 units</span>
                  <span>{inputs.totalUnits} units</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Extended Commitment (20+ years)</Label>
                    <p className="text-xs text-muted-foreground">+30 bonus points</p>
                  </div>
                  <Switch
                    checked={inputs.affordabilityCommitmentYears >= 20}
                    onCheckedChange={(v) => updateInput("affordabilityCommitmentYears", v ? 20 : 10)}
                    data-testid="switch-extended-commitment"
                  />
                </div>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Affordability Points</span>
                  <Badge variant={results.affordabilityPoints > 0 ? "default" : "secondary"}>
                    {results.affordabilityPoints} {results.extendedCommitmentBonus > 0 && `+ ${results.extendedCommitmentBonus}`}
                  </Badge>
                </div>
                {inputs.projectType === "new_construction" ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    New construction: 10% = 50pts, 15% = 70pts, 25% = 100pts
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    Existing: 40% = 50pts, 60% = 70pts, 80% = 100pts
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Leaf className="h-5 w-5" />
                Energy Efficiency
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Energy Performance Level</Label>
                <Select value={inputs.energyTier} onValueChange={(v) => updateInput("energyTier", v as typeof inputs.energyTier)}>
                  <SelectTrigger data-testid="select-energy-tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Energy Commitment</SelectItem>
                    <SelectItem value="level1">Level 1 (20 points)</SelectItem>
                    <SelectItem value="level2">Level 2 (35 points)</SelectItem>
                    <SelectItem value="level3">Level 3 (50 points)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                {inputs.projectType === "new_construction" ? (
                  <>
                    <p><strong>Level 1:</strong> 25% better than NECB 2020</p>
                    <p><strong>Level 2:</strong> 50% better than NECB 2020</p>
                    <p><strong>Level 3:</strong> 60% better than NECB 2020</p>
                  </>
                ) : (
                  <>
                    <p><strong>Level 1:</strong> 15% energy reduction</p>
                    <p><strong>Level 2:</strong> 25% energy reduction</p>
                    <p><strong>Level 3:</strong> 40% energy reduction</p>
                  </>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">Energy Points</span>
                <Badge variant={results.energyPoints > 0 ? "default" : "secondary"}>
                  {results.energyPoints}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Accessibility className="h-5 w-5" />
                Accessibility
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Accessibility Level</Label>
                <Select value={inputs.accessibilityTier} onValueChange={(v) => updateInput("accessibilityTier", v as typeof inputs.accessibilityTier)}>
                  <SelectTrigger data-testid="select-accessibility-tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Accessibility Commitment</SelectItem>
                    <SelectItem value="level1">Level 1 (20 points)</SelectItem>
                    <SelectItem value="level2">Level 2 (30 points)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                <p><strong>Level 1:</strong> 15% units accessible + barrier-free common areas</p>
                <p><strong>Level 2:</strong> 15% units fully accessible + 85% universal design</p>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">Accessibility Points</span>
                <Badge variant={results.accessibilityPoints > 0 ? "default" : "secondary"}>
                  {results.accessibilityPoints}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-4">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5" />
                MLI Select Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Points</span>
                  <span className="text-3xl font-bold font-mono">{results.totalPoints}</span>
                </div>
                <Progress value={Math.min(results.totalPoints, 100)} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span className="font-medium">50 min</span>
                  <span>70</span>
                  <span>100</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Affordability</div>
                  <div className="text-lg font-bold font-mono">{results.affordabilityPoints + results.extendedCommitmentBonus}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Energy</div>
                  <div className="text-lg font-bold font-mono">{results.energyPoints}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Accessibility</div>
                  <div className="text-lg font-bold font-mono">{results.accessibilityPoints}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Tier</div>
                  <div className="text-lg font-bold font-mono">{results.tier === "none" ? "N/A" : results.tier}</div>
                </div>
              </div>

              <Separator />

              {results.tier !== "none" ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Qualifies for MLI Select!</span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                      <div>
                        <div className="text-sm font-medium">Maximum LTV</div>
                        <div className="text-xs text-muted-foreground">Loan-to-Value ratio</div>
                      </div>
                      <div className="text-2xl font-bold font-mono text-primary">{results.maxLTV}%</div>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                      <div>
                        <div className="text-sm font-medium">Maximum Amortization</div>
                        <div className="text-xs text-muted-foreground">Extended repayment period</div>
                      </div>
                      <div className="text-2xl font-bold font-mono text-primary">{results.maxAmortization} yrs</div>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <h4 className="font-medium text-sm">Tier Benefits</h4>
                    {results.tier === "50" && (
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> Up to 85% LTV</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> 40-year amortization</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> Lower insurance premiums</li>
                      </ul>
                    )}
                    {results.tier === "70" && (
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> Up to 95% LTV</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> 45-year amortization</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> Reduced premiums</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> Priority processing</li>
                      </ul>
                    )}
                    {results.tier === "100" && (
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> Up to 95% LTV</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> 50-year amortization</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> Lowest premiums</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> Limited recourse option</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> Priority processing</li>
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-dashed rounded-lg text-center space-y-2">
                  <p className="text-muted-foreground">
                    Add more commitments to reach the minimum 50 points required for MLI Select.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Current: {results.totalPoints} / 50 points needed
                  </p>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <h4 className="font-medium text-sm">Next Steps</h4>
                <p className="text-sm text-muted-foreground">
                  Contact a CMHC-approved lender to discuss your MLI Select application and get a financing quote.
                </p>
                <Button className="w-full" data-testid="button-contact-lender">
                  Get MLI Select Quote
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
