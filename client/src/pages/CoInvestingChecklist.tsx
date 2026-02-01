import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { AlertTriangle, Info, CheckCircle, AlertCircle, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { calculateComplexityScore, tierLabels, propertyTypeLabels } from "@/lib/coinvesting";
import type { CoInvestChecklistInput } from "@shared/schema";

function InfoTooltip({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-sm">{content}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function CoInvestingChecklist() {
  const [inputs, setInputs] = useState<CoInvestChecklistInput>({
    numberOfProperties: 1,
    propertyType: "single_family",
    unitsCount: 1,
    groupSize: 2,
    marketingToPublic: false,
    passiveInvestors: false,
    profitSharingPromised: false,
    managerCentralized: false,
    multiplePropertiesOrPortfolioPlan: false,
    relianceOnSponsorEfforts: false,
    sophisticatedStructure: false,
    renovationDevelopmentIntensity: "light",
  });

  const [acknowledged, setAcknowledged] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const result = calculateComplexityScore(inputs);
  const tierInfo = tierLabels[result.tier];

  const handleInputChange = (key: keyof CoInvestChecklistInput, value: any) => {
    setInputs(prev => ({ ...prev, [key]: value }));
    setShowResults(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Deal Complexity Checklist</h1>
          <p className="text-muted-foreground">
            Understand the complexity of your co-investing arrangement
          </p>
        </div>

        <Card className="mb-6 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">Important Disclaimer</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  This checklist provides general educational information only. It does not provide legal, 
                  tax, or securities advice. The results should not be relied upon to determine whether 
                  your specific arrangement constitutes a security or requires regulatory compliance. 
                  Always consult with qualified professionals.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Deal Characteristics</CardTitle>
            <CardDescription>
              Answer these questions about your proposed co-investing arrangement
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="groupSize">Number of Participants</Label>
                  <InfoTooltip content="The total number of people who will be investing together in this deal." />
                </div>
                <Input
                  id="groupSize"
                  type="number"
                  min={2}
                  value={inputs.groupSize}
                  onChange={(e) => handleInputChange("groupSize", parseInt(e.target.value) || 2)}
                  data-testid="input-group-size"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="propertyType">Property Type</Label>
                  <InfoTooltip content="The type of property you plan to invest in." />
                </div>
                <Select value={inputs.propertyType} onValueChange={(v) => handleInputChange("propertyType", v)}>
                  <SelectTrigger data-testid="select-property-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(propertyTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="unitsCount">Number of Units</Label>
                  <InfoTooltip content="The total number of rental units in the property." />
                </div>
                <Input
                  id="unitsCount"
                  type="number"
                  min={0}
                  value={inputs.unitsCount}
                  onChange={(e) => handleInputChange("unitsCount", parseInt(e.target.value) || 0)}
                  data-testid="input-units-count"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="renovationIntensity">Renovation/Development Intensity</Label>
                  <InfoTooltip content="How much work is planned for the property." />
                </div>
                <Select 
                  value={inputs.renovationDevelopmentIntensity} 
                  onValueChange={(v: "light" | "moderate" | "heavy") => handleInputChange("renovationDevelopmentIntensity", v)}
                >
                  <SelectTrigger data-testid="select-renovation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light (cosmetic)</SelectItem>
                    <SelectItem value="moderate">Moderate (significant reno)</SelectItem>
                    <SelectItem value="heavy">Heavy (development/construction)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-6 space-y-4">
              <h4 className="font-medium">Arrangement Characteristics</h4>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="multipleProperties">Multiple properties or portfolio plan?</Label>
                  <InfoTooltip content="Will this group invest in more than one property, or is there a plan to build a portfolio?" />
                </div>
                <Switch
                  id="multipleProperties"
                  checked={inputs.multiplePropertiesOrPortfolioPlan}
                  onCheckedChange={(v) => handleInputChange("multiplePropertiesOrPortfolioPlan", v)}
                  data-testid="switch-multiple-properties"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="marketingToPublic">Marketing to the general public?</Label>
                  <InfoTooltip content="Will you be advertising or soliciting investment from people you don't know?" />
                </div>
                <Switch
                  id="marketingToPublic"
                  checked={inputs.marketingToPublic}
                  onCheckedChange={(v) => handleInputChange("marketingToPublic", v)}
                  data-testid="switch-marketing"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="passiveInvestors">Passive investors who don't participate in decisions?</Label>
                  <InfoTooltip content="Will some investors be completely passive, not involved in property management or decisions?" />
                </div>
                <Switch
                  id="passiveInvestors"
                  checked={inputs.passiveInvestors}
                  onCheckedChange={(v) => handleInputChange("passiveInvestors", v)}
                  data-testid="switch-passive"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="profitSharing">Promised profit distributions or returns?</Label>
                  <InfoTooltip content="Are specific returns or profit sharing promised to investors?" />
                </div>
                <Switch
                  id="profitSharing"
                  checked={inputs.profitSharingPromised}
                  onCheckedChange={(v) => handleInputChange("profitSharingPromised", v)}
                  data-testid="switch-profit"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="centralManager">Centralized manager or sponsor?</Label>
                  <InfoTooltip content="Is there one person or entity making all the decisions and managing the investment?" />
                </div>
                <Switch
                  id="centralManager"
                  checked={inputs.managerCentralized}
                  onCheckedChange={(v) => handleInputChange("managerCentralized", v)}
                  data-testid="switch-manager"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="sponsorReliance">Reliance on sponsor's efforts for success?</Label>
                  <InfoTooltip content="Do investors rely primarily on the sponsor/manager's efforts to generate returns?" />
                </div>
                <Switch
                  id="sponsorReliance"
                  checked={inputs.relianceOnSponsorEfforts}
                  onCheckedChange={(v) => handleInputChange("relianceOnSponsorEfforts", v)}
                  data-testid="switch-reliance"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="sophisticatedStructure">Using LP/GP, trust, or corporate structure?</Label>
                  <InfoTooltip content="Will the investment use a limited partnership, trust, or corporation instead of direct co-ownership?" />
                </div>
                <Switch
                  id="sophisticatedStructure"
                  checked={inputs.sophisticatedStructure}
                  onCheckedChange={(v) => handleInputChange("sophisticatedStructure", v)}
                  data-testid="switch-structure"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Checkbox
                id="acknowledge"
                checked={acknowledged}
                onCheckedChange={(v) => setAcknowledged(v as boolean)}
                data-testid="checkbox-acknowledge"
              />
              <Label htmlFor="acknowledge" className="text-sm leading-relaxed cursor-pointer">
                I understand that this checklist is for educational purposes only and does not constitute 
                legal, tax, or securities advice. I acknowledge that the results may not apply to my 
                specific situation and I should consult with qualified professionals before proceeding.
              </Label>
            </div>
          </CardContent>
        </Card>

        <Button 
          className="w-full mb-8" 
          size="lg"
          disabled={!acknowledged}
          onClick={() => setShowResults(true)}
          data-testid="button-calculate"
        >
          Calculate Complexity Score
        </Button>

        {showResults && (
          <Card className="mb-8" data-testid="card-results">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Results</CardTitle>
                <Badge className={tierInfo.color}>{tierInfo.label}</Badge>
              </div>
              <CardDescription>
                Complexity Score: {result.score}/100
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm">{tierInfo.description}</p>
              </div>

              {result.flags.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Complexity Factors Identified
                  </h4>
                  <ul className="space-y-2">
                    {result.flags.map((flag, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-amber-500 mt-1">•</span>
                        {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  Recommendations
                </h4>
                <ul className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <strong>Remember:</strong> This assessment is educational only. The factors identified 
                  are commonly associated with increased complexity but may not apply to your specific 
                  situation. Professional advice is recommended for any real estate investment arrangement.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
