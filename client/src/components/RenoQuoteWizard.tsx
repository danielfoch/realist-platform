import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Home, Building2, Users, Plus, Trash2, ArrowRight, ArrowLeft, 
  Calculator, AlertCircle, CheckCircle, Download
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { 
  RenoQuotePersona, 
  RenoQuotePropertyType, 
  RenoQuoteLineItem,
  RenoQuoteAssumptions,
  RenoQuotePricingResult,
  RenoQuoteQualityLevel,
  RenoQuoteComplexityLevel
} from "@shared/schema";

interface LineItemCatalogEntry {
  itemType: string;
  label: string;
  unit: "sqft" | "linear_ft" | "each" | "room";
  category: string;
}

const PROPERTY_TYPES: { value: RenoQuotePropertyType; label: string }[] = [
  { value: "condo", label: "Condo" },
  { value: "detached", label: "Detached House" },
  { value: "semi", label: "Semi-Detached" },
  { value: "townhouse", label: "Townhouse" },
  { value: "duplex", label: "Duplex" },
  { value: "triplex", label: "Triplex" },
  { value: "fourplex", label: "4-Plex" },
  { value: "multifamily", label: "5+ Multifamily" },
];

const PROJECT_INTENTS = [
  { id: "cosmetic", label: "Cosmetic refresh" },
  { id: "moderate", label: "Moderate renovation" },
  { id: "full_gut", label: "Full gut renovation" },
  { id: "add_unit", label: "Add a unit" },
  { id: "legalize_unit", label: "Legalize existing unit" },
  { id: "add_bathroom", label: "Add bathroom" },
  { id: "add_kitchen", label: "Add kitchen" },
  { id: "underpinning", label: "Underpinning/basement" },
  { id: "extension", label: "Extension/addition" },
];

const BASEMENT_TYPES = [
  { value: "none", label: "No basement" },
  { value: "unfinished", label: "Unfinished" },
  { value: "finished", label: "Finished" },
  { value: "walkout", label: "Walkout" },
];

const REGIONS = {
  canada: [
    "Ontario", "British Columbia", "Alberta", "Quebec", "Manitoba", 
    "Saskatchewan", "Nova Scotia", "New Brunswick", "Newfoundland and Labrador",
    "Prince Edward Island", "Northwest Territories", "Yukon", "Nunavut"
  ],
  usa: [
    "California", "New York", "Texas", "Florida", "Washington",
    "Colorado", "Massachusetts", "Illinois", "Pennsylvania", "Arizona"
  ]
};

interface WizardState {
  persona: RenoQuotePersona;
  address: string;
  city: string;
  region: string;
  country: "canada" | "usa";
  postalCode: string;
  propertyType: RenoQuotePropertyType | "";
  existingSqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  basementType: string;
  basementHeight: number | null;
  projectIntents: string[];
  lineItems: RenoQuoteLineItem[];
  assumptions: RenoQuoteAssumptions;
}

const defaultAssumptions: RenoQuoteAssumptions = {
  contingencyPercent: 15,
  overheadProfitPercent: 15,
  laborMaterialSplit: { labor: 55, material: 45 },
  isRushTimeline: false,
  regionalMultiplier: 1,
};

export function RenoQuoteWizard() {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [leadInfo, setLeadInfo] = useState({ name: "", email: "", phone: "", consent: false });
  const [pricingResult, setPricingResult] = useState<RenoQuotePricingResult | null>(null);
  
  const [state, setState] = useState<WizardState>({
    persona: "homeowner",
    address: "",
    city: "",
    region: "",
    country: "canada",
    postalCode: "",
    propertyType: "",
    existingSqft: null,
    bedrooms: null,
    bathrooms: null,
    basementType: "",
    basementHeight: null,
    projectIntents: [],
    lineItems: [],
    assumptions: defaultAssumptions,
  });

  const { data: catalog } = useQuery<LineItemCatalogEntry[]>({
    queryKey: ["/api/reno-quotes/catalog", state.persona],
    queryFn: async () => {
      const res = await fetch(`/api/reno-quotes/catalog?persona=${state.persona}`);
      return res.json();
    },
  });

  const calculateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/reno-quotes/calculate", {
        ...state,
        existingSqft: state.existingSqft,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setPricingResult(data);
      setStep(4);
    },
    onError: () => {
      toast({ title: "Failed to calculate estimate", variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/reno-quotes", {
        ...state,
        leadName: leadInfo.name,
        leadEmail: leadInfo.email,
        leadPhone: leadInfo.phone,
        leadConsent: leadInfo.consent,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setLeadCaptured(true);
      if (data.pricingResult) {
        setPricingResult(data.pricingResult);
      }
      toast({ title: "Quote saved successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to save quote", variant: "destructive" });
    },
  });

  const addLineItem = (catalogItem: LineItemCatalogEntry) => {
    const newItem: RenoQuoteLineItem = {
      id: crypto.randomUUID(),
      itemType: catalogItem.itemType,
      label: catalogItem.label,
      quantity: catalogItem.unit === "each" ? 1 : 100,
      unit: catalogItem.unit,
      qualityLevel: "mid",
      complexity: "standard",
      isDiy: false,
    };
    setState(s => ({ ...s, lineItems: [...s.lineItems, newItem] }));
  };

  const updateLineItem = (id: string, updates: Partial<RenoQuoteLineItem>) => {
    setState(s => ({
      ...s,
      lineItems: s.lineItems.map(item => item.id === id ? { ...item, ...updates } : item),
    }));
  };

  const removeLineItem = (id: string) => {
    setState(s => ({ ...s, lineItems: s.lineItems.filter(item => item.id !== id) }));
  };

  const steps = ["Persona", "Property", "Scope", "Assumptions", "Results"];
  const progress = ((step + 1) / steps.length) * 100;

  const canProceed = useMemo(() => {
    if (step === 0) return true;
    if (step === 1) return state.city && state.region;
    if (step === 2) return state.lineItems.length > 0;
    if (step === 3) return true;
    return true;
  }, [step, state]);

  const handleNext = () => {
    if (step === 3) {
      calculateMutation.mutate();
    } else {
      setStep(s => Math.min(s + 1, steps.length - 1));
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Step {step + 1} of {steps.length}: {steps[step]}</span>
          <span className="text-muted-foreground">{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Who are you?</CardTitle>
            <CardDescription>Select your profile to get the most relevant renovation items</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { id: "homeowner" as const, icon: Home, title: "Homeowner", desc: "Renovating my own home" },
                { id: "investor" as const, icon: Building2, title: "Investor", desc: "Value-add or rental upgrade" },
                { id: "multiplex" as const, icon: Users, title: "Multiplex", desc: "Adding units or converting" },
              ].map(persona => (
                <button
                  key={persona.id}
                  onClick={() => setState(s => ({ ...s, persona: persona.id, lineItems: [] }))}
                  className={`p-6 rounded-lg border-2 text-left transition-all hover-elevate ${
                    state.persona === persona.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  data-testid={`button-persona-${persona.id}`}
                >
                  <persona.icon className="h-8 w-8 mb-3 text-primary" />
                  <h3 className="font-semibold">{persona.title}</h3>
                  <p className="text-sm text-muted-foreground">{persona.desc}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Property Details</CardTitle>
            <CardDescription>Tell us about the property you want to renovate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={state.country} onValueChange={(v) => setState(s => ({ ...s, country: v as "canada" | "usa", region: "" }))}>
                  <SelectTrigger data-testid="select-country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="canada">Canada</SelectItem>
                    <SelectItem value="usa">United States</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Province/State *</Label>
                <Select value={state.region} onValueChange={(v) => setState(s => ({ ...s, region: v }))}>
                  <SelectTrigger data-testid="select-region">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS[state.country].map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>City *</Label>
                <Input 
                  value={state.city} 
                  onChange={(e) => setState(s => ({ ...s, city: e.target.value }))}
                  placeholder="e.g., Toronto"
                  data-testid="input-city"
                />
              </div>
              <div className="space-y-2">
                <Label>Address (optional)</Label>
                <Input 
                  value={state.address} 
                  onChange={(e) => setState(s => ({ ...s, address: e.target.value }))}
                  placeholder="123 Main St"
                  data-testid="input-address"
                />
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Property Type</Label>
                <Select value={state.propertyType} onValueChange={(v) => setState(s => ({ ...s, propertyType: v as RenoQuotePropertyType }))}>
                  <SelectTrigger data-testid="select-property-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Total Square Footage</Label>
                <Input 
                  type="number"
                  value={state.existingSqft || ""} 
                  onChange={(e) => setState(s => ({ ...s, existingSqft: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="e.g., 1500"
                  data-testid="input-sqft"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Bedrooms</Label>
                <Input 
                  type="number"
                  value={state.bedrooms || ""} 
                  onChange={(e) => setState(s => ({ ...s, bedrooms: e.target.value ? Number(e.target.value) : null }))}
                  data-testid="input-bedrooms"
                />
              </div>
              <div className="space-y-2">
                <Label>Bathrooms</Label>
                <Input 
                  type="number"
                  step="0.5"
                  value={state.bathrooms || ""} 
                  onChange={(e) => setState(s => ({ ...s, bathrooms: e.target.value ? Number(e.target.value) : null }))}
                  data-testid="input-bathrooms"
                />
              </div>
              <div className="space-y-2">
                <Label>Basement</Label>
                <Select value={state.basementType} onValueChange={(v) => setState(s => ({ ...s, basementType: v }))}>
                  <SelectTrigger data-testid="select-basement">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {BASEMENT_TYPES.map(b => (
                      <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Project Intent (select all that apply)</Label>
              <div className="flex flex-wrap gap-2">
                {PROJECT_INTENTS.map(intent => (
                  <Badge
                    key={intent.id}
                    variant={state.projectIntents.includes(intent.id) ? "default" : "outline"}
                    className="cursor-pointer toggle-elevate"
                    onClick={() => {
                      setState(s => ({
                        ...s,
                        projectIntents: s.projectIntents.includes(intent.id)
                          ? s.projectIntents.filter(i => i !== intent.id)
                          : [...s.projectIntents, intent.id]
                      }));
                    }}
                    data-testid={`badge-intent-${intent.id}`}
                  >
                    {intent.label}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Renovation Scope Builder</CardTitle>
            <CardDescription>Add line items for your renovation. Adjust quantity and quality for each.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Add Items</Label>
              <div className="flex flex-wrap gap-2">
                {catalog?.map(item => (
                  <Button
                    key={item.itemType}
                    variant="outline"
                    size="sm"
                    onClick={() => addLineItem(item)}
                    className="gap-1"
                    data-testid={`button-add-${item.itemType}`}
                  >
                    <Plus className="h-3 w-3" />
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {state.lineItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No items added yet. Click items above to add them to your estimate.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {state.lineItems.map((item) => (
                  <div key={item.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{item.label}</h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(item.id)}
                        data-testid={`button-remove-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Quantity ({item.unit})</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, { quantity: Number(e.target.value) || 0 })}
                          data-testid={`input-quantity-${item.id}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Quality</Label>
                        <Select 
                          value={item.qualityLevel} 
                          onValueChange={(v) => updateLineItem(item.id, { qualityLevel: v as RenoQuoteQualityLevel })}
                        >
                          <SelectTrigger data-testid={`select-quality-${item.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="basic">Basic</SelectItem>
                            <SelectItem value="mid">Mid-Range</SelectItem>
                            <SelectItem value="high">High-End</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Complexity</Label>
                        <Select 
                          value={item.complexity} 
                          onValueChange={(v) => updateLineItem(item.id, { complexity: v as RenoQuoteComplexityLevel })}
                        >
                          <SelectTrigger data-testid={`select-complexity-${item.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="complex">Complex</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">DIY?</Label>
                        <div className="flex items-center h-9">
                          <Checkbox
                            checked={item.isDiy}
                            onCheckedChange={(checked) => updateLineItem(item.id, { isDiy: !!checked })}
                            data-testid={`checkbox-diy-${item.id}`}
                          />
                          <span className="ml-2 text-sm">Do it myself</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Assumptions & Adjustments</CardTitle>
            <CardDescription>Fine-tune your estimate with these settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Contingency: {state.assumptions.contingencyPercent}%</Label>
                  <span className="text-sm text-muted-foreground">Buffer for unexpected costs</span>
                </div>
                <Slider
                  value={[state.assumptions.contingencyPercent]}
                  onValueChange={([v]) => setState(s => ({ 
                    ...s, 
                    assumptions: { ...s.assumptions, contingencyPercent: v } 
                  }))}
                  min={5}
                  max={30}
                  step={1}
                  data-testid="slider-contingency"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Contractor Overhead & Profit: {state.assumptions.overheadProfitPercent}%</Label>
                  <span className="text-sm text-muted-foreground">GC markup</span>
                </div>
                <Slider
                  value={[state.assumptions.overheadProfitPercent]}
                  onValueChange={([v]) => setState(s => ({ 
                    ...s, 
                    assumptions: { ...s.assumptions, overheadProfitPercent: v } 
                  }))}
                  min={0}
                  max={30}
                  step={1}
                  data-testid="slider-overhead"
                />
              </div>

              <Separator />

              <div className="flex items-center space-x-3">
                <Checkbox
                  checked={state.assumptions.isRushTimeline}
                  onCheckedChange={(checked) => setState(s => ({ 
                    ...s, 
                    assumptions: { ...s.assumptions, isRushTimeline: !!checked } 
                  }))}
                  data-testid="checkbox-rush"
                />
                <div>
                  <Label>Rush Timeline</Label>
                  <p className="text-sm text-muted-foreground">Adds ~25% to labor costs for expedited work</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && pricingResult && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-500" />
                Your Renovation Estimate
              </CardTitle>
              <CardDescription>
                Based on your inputs for {state.city}, {state.region}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-1">Low Estimate</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(pricingResult.totalLow)}</p>
                </div>
                <div className="p-4 bg-primary/10 rounded-lg text-center border-2 border-primary">
                  <p className="text-sm text-muted-foreground mb-1">Base Estimate</p>
                  <p className="text-3xl font-bold">{formatCurrency(pricingResult.totalBase)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-1">High Estimate</p>
                  <p className="text-2xl font-bold text-amber-600">{formatCurrency(pricingResult.totalHigh)}</p>
                </div>
              </div>

              {state.existingSqft && pricingResult.costPerSqft.base && (
                <div className="text-center text-muted-foreground">
                  Cost per sqft: {formatCurrency(pricingResult.costPerSqft.base)}/sqft
                </div>
              )}

              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium mb-2">Estimated Timeline</h4>
                <p className="text-lg">
                  {pricingResult.timelineWeeks.low} - {pricingResult.timelineWeeks.high} weeks
                  <span className="text-muted-foreground ml-2">(Base: {pricingResult.timelineWeeks.base} weeks)</span>
                </p>
              </div>

              {!leadCaptured && (
                <Card className="border-primary">
                  <CardHeader>
                    <CardTitle className="text-lg">Get Your Detailed Breakdown</CardTitle>
                    <CardDescription>Enter your info to see line-by-line costs and download a PDF</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Name *</Label>
                        <Input
                          value={leadInfo.name}
                          onChange={(e) => setLeadInfo(l => ({ ...l, name: e.target.value }))}
                          placeholder="Your name"
                          data-testid="input-lead-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          value={leadInfo.email}
                          onChange={(e) => setLeadInfo(l => ({ ...l, email: e.target.value }))}
                          placeholder="your@email.com"
                          data-testid="input-lead-email"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={leadInfo.phone}
                        onChange={(e) => setLeadInfo(l => ({ ...l, phone: e.target.value }))}
                        placeholder="(555) 123-4567"
                        data-testid="input-lead-phone"
                      />
                    </div>
                    <div className="flex items-start space-x-2">
                      <Checkbox
                        checked={leadInfo.consent}
                        onCheckedChange={(checked) => setLeadInfo(l => ({ ...l, consent: !!checked }))}
                        data-testid="checkbox-consent"
                      />
                      <p className="text-sm text-muted-foreground">
                        I consent to receive communications about my renovation estimate
                      </p>
                    </div>
                    <Button
                      onClick={() => saveMutation.mutate()}
                      disabled={!leadInfo.name || !leadInfo.email || saveMutation.isPending}
                      className="w-full"
                      data-testid="button-unlock-details"
                    >
                      {saveMutation.isPending ? "Saving..." : "Unlock Full Details"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {leadCaptured && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-4">Line-by-Line Breakdown</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Item</th>
                            <th className="text-right py-2">Qty</th>
                            <th className="text-right py-2">Low</th>
                            <th className="text-right py-2">Base</th>
                            <th className="text-right py-2">High</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pricingResult.lineItemBreakdown.map((item) => (
                            <tr key={item.id} className="border-b">
                              <td className="py-2">{item.label}</td>
                              <td className="text-right py-2">{item.quantity} {item.unit}</td>
                              <td className="text-right py-2 text-green-600">{formatCurrency(item.subtotalLow)}</td>
                              <td className="text-right py-2 font-medium">{formatCurrency(item.subtotalBase)}</td>
                              <td className="text-right py-2 text-amber-600">{formatCurrency(item.subtotalHigh)}</td>
                            </tr>
                          ))}
                          <tr className="border-b bg-muted/30">
                            <td className="py-2 font-medium" colSpan={2}>Contingency ({state.assumptions.contingencyPercent}%)</td>
                            <td className="text-right py-2">{formatCurrency(pricingResult.contingencyAmount.low)}</td>
                            <td className="text-right py-2">{formatCurrency(pricingResult.contingencyAmount.base)}</td>
                            <td className="text-right py-2">{formatCurrency(pricingResult.contingencyAmount.high)}</td>
                          </tr>
                          <tr className="border-b bg-muted/30">
                            <td className="py-2 font-medium" colSpan={2}>Overhead & Profit ({state.assumptions.overheadProfitPercent}%)</td>
                            <td className="text-right py-2">{formatCurrency(pricingResult.overheadAmount.low)}</td>
                            <td className="text-right py-2">{formatCurrency(pricingResult.overheadAmount.base)}</td>
                            <td className="text-right py-2">{formatCurrency(pricingResult.overheadAmount.high)}</td>
                          </tr>
                          <tr className="font-bold">
                            <td className="py-2" colSpan={2}>TOTAL</td>
                            <td className="text-right py-2 text-green-600">{formatCurrency(pricingResult.totalLow)}</td>
                            <td className="text-right py-2">{formatCurrency(pricingResult.totalBase)}</td>
                            <td className="text-right py-2 text-amber-600">{formatCurrency(pricingResult.totalHigh)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Top Cost Drivers</h4>
                    <div className="space-y-2">
                      {pricingResult.topCostDrivers.map((driver, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <span>{driver.label}</span>
                          <span className="font-medium">{driver.percentage}% ({formatCurrency(driver.amount)})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>Disclaimer:</strong> These are estimates only, not contractor bids. 
                      Actual costs may vary based on site conditions, contractor pricing, and material selections. 
                      Always verify locally with licensed contractors.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" className="gap-2" data-testid="button-download-pdf">
                      <Download className="h-4 w-4" />
                      Download PDF
                    </Button>
                    <Button 
                      variant="default"
                      className="gap-2"
                      onClick={() => {
                        localStorage.setItem("renoQuoteCapex", String(pricingResult.totalBase));
                        toast({ title: "CapEx value saved! Switch to Deal Analyzer to use it." });
                      }}
                      data-testid="button-use-in-deal-analyzer"
                    >
                      <Calculator className="h-4 w-4" />
                      Use in Deal Analyzer
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        {step < 4 && (
          <Button
            onClick={handleNext}
            disabled={!canProceed || calculateMutation.isPending}
            data-testid="button-next"
          >
            {step === 3 ? (
              calculateMutation.isPending ? "Calculating..." : "Calculate Estimate"
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
