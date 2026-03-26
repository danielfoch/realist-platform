import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calculator, DollarSign, Home, MapPin, HelpCircle, Lock, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MunicipalityMatch {
  name: string;
  region?: string;
  developmentCharge: number;
}

const formSchema = z.object({
  homeValue: z.string().min(1, "Home value is required"),
  isNewConstruction: z.boolean(),
  buyerType: z.string().min(1, "Buyer type is required"),
  homeType: z.string().min(1, "Home type is required"),
  squareFootage: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CostBreakdown {
  homeValue: number;
  landCost: number;
  constructionCost: number;
  developmentCharges: number;
  provincialLTT: number;
  municipalLTT: number;
  totalLTT: number;
  lttRebate: number;
  grossHST: number;
  hstRebate: number;
  netHST: number;
  federalGST: number;
  provincialPST: number;
  gstPaused: boolean;
  pstPaused: boolean;
  developerMargin: number;
  totalCosts: number;
  matchedMunicipality: string | null;
  breakdown: {
    category: string;
    amount: number;
    percentage: number;
  }[];
}

const CHART_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function TrueCost() {
  const [result, setResult] = useState<CostBreakdown | null>(null);
  const [showTeaser, setShowTeaser] = useState(false);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [cityInput, setCityInput] = useState("Toronto");
  const [suggestions, setSuggestions] = useState<MunicipalityMatch[]>([]);
  const [matchedMunicipality, setMatchedMunicipality] = useState<MunicipalityMatch | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const { data: options, isLoading: optionsLoading } = useQuery<{
    cities: string[];
    municipalities: MunicipalityMatch[];
    homeTypes: string[];
    buyerTypes: string[];
  }>({
    queryKey: ["/api/true-cost/options"],
  });

  // Set initial match on options load
  useEffect(() => {
    if (options?.municipalities) {
      const toronto = options.municipalities.find(m => m.name === "Toronto");
      if (toronto) setMatchedMunicipality(toronto);
    }
  }, [options]);

  const handleCityInputChange = useCallback((value: string) => {
    setCityInput(value);
    setMatchedMunicipality(null);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    if (value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    debounceRef.current = setTimeout(() => {
      if (!options?.municipalities) return;
      const normalized = value.toLowerCase().trim();
      const matches = options.municipalities.filter(m => 
        m.name.toLowerCase().includes(normalized)
      ).slice(0, 6);
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    }, 150);
  }, [options]);

  const selectMunicipality = useCallback((muni: MunicipalityMatch) => {
    setCityInput(muni.name);
    setMatchedMunicipality(muni);
    setShowSuggestions(false);
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const calculateMutation = useMutation({
    mutationFn: async (data: {
      homeValue: number;
      city: string;
      isNewConstruction: boolean;
      buyerType: string;
      homeType: string;
      squareFootage?: number;
    }) => {
      const response = await apiRequest("POST", "/api/true-cost/calculate", data);
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      if (!isAuthenticated) {
        setShowTeaser(true);
      }
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      homeValue: "850000",
      isNewConstruction: true,
      buyerType: "First-Time",
      homeType: "Detached",
      squareFootage: "1200",
    },
  });

  const onSubmit = (data: FormValues) => {
    const homeValue = parseFloat(data.homeValue.replace(/[^0-9.-]+/g, ""));
    const squareFootage = data.squareFootage
      ? parseFloat(data.squareFootage.replace(/[^0-9.-]+/g, ""))
      : undefined;

    calculateMutation.mutate({
      homeValue,
      city: cityInput,
      isNewConstruction: data.isNewConstruction,
      buyerType: data.buyerType,
      homeType: data.homeType,
      squareFootage,
    });
  };

  const isNewConstruction = form.watch("isNewConstruction");

  if (optionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-4">
            Ontario Calculator
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            True Cost of Homeownership
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Discover all the hidden costs when buying a home in Ontario — from development charges to land transfer taxes and HST rebates.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Calculate Your Costs
              </CardTitle>
              <CardDescription>
                Enter your home details to see the full cost breakdown
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="homeValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          Home Value
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="850,000"
                            className="h-12 font-mono"
                            data-testid="input-home-value"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <FormLabel className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      City or Address
                    </FormLabel>
                    <div className="relative" ref={suggestionsRef}>
                      <Input
                        placeholder="Type a city name or address..."
                        className="h-12"
                        data-testid="input-city"
                        value={cityInput}
                        onChange={(e) => handleCityInputChange(e.target.value)}
                        onFocus={() => {
                          if (suggestions.length > 0 && !matchedMunicipality) setShowSuggestions(true);
                        }}
                      />
                      {matchedMunicipality && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
                          <span className="text-xs text-green-600 dark:text-green-400">
                            Matched: <span className="font-medium">{matchedMunicipality.name}</span>
                            {matchedMunicipality.region && <span className="text-muted-foreground"> ({matchedMunicipality.region})</span>}
                          </span>
                        </div>
                      )}
                      {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute z-50 top-full mt-1 w-full border rounded-md bg-popover shadow-md">
                          {suggestions.map((muni) => (
                            <button
                              key={muni.name}
                              type="button"
                              className="w-full text-left px-3 py-2.5 text-sm hover-elevate flex items-center justify-between gap-2"
                              onClick={() => selectMunicipality(muni)}
                              data-testid={`suggestion-${muni.name.toLowerCase().replace(/\s/g, '-')}`}
                            >
                              <div>
                                <span className="font-medium">{muni.name}</span>
                                {muni.region && (
                                  <span className="text-muted-foreground text-xs ml-2">{muni.region}</span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="homeType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Home className="h-4 w-4" />
                          Home Type
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12" data-testid="select-home-type">
                              <SelectValue placeholder="Select home type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {options?.homeTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type === "PBR" ? "Purpose-Built Rental" : type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="buyerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Buyer Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12" data-testid="select-buyer-type">
                              <SelectValue placeholder="Select buyer type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {options?.buyerTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type} Buyer
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isNewConstruction"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">New Construction</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Is this a newly built home?
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-new-construction"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {isNewConstruction && (
                    <FormField
                      control={form.control}
                      name="squareFootage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            Square Footage
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Used to estimate construction costs</p>
                              </TooltipContent>
                            </UITooltip>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="1,200"
                              className="h-12 font-mono"
                              data-testid="input-square-footage"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12"
                    disabled={calculateMutation.isPending}
                    data-testid="button-calculate"
                  >
                    {calculateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Calculating...
                      </>
                    ) : (
                      <>
                        <Calculator className="mr-2 h-4 w-4" />
                        Calculate True Cost
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {result ? (
              <>
                <div className="relative">
                  {showTeaser && !isAuthenticated && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
                      <Card className="max-w-sm mx-4">
                        <CardContent className="pt-6 text-center">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                            <Lock className="h-6 w-6 text-primary" />
                          </div>
                          <h3 className="text-lg font-semibold mb-2">
                            Unlock Full Results
                          </h3>
                          <p className="text-muted-foreground mb-4 text-sm">
                            Create a free account to see your complete cost breakdown and save your calculations.
                          </p>
                          <div className="space-y-2">
                            <Button asChild className="w-full" data-testid="button-signup-teaser">
                              <Link href={`/create-account?returnUrl=${encodeURIComponent('/tools/true-cost')}`}>Create Free Account</Link>
                            </Button>
                            <Button variant="ghost" asChild className="w-full" data-testid="button-login-teaser">
                              <Link href={`/login?returnUrl=${encodeURIComponent('/tools/true-cost')}`}>Already have an account? Log in</Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                  <Card className={showTeaser && !isAuthenticated ? "blur-sm pointer-events-none" : ""}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Cost Breakdown</CardTitle>
                      <CardDescription>
                        How your home price breaks down
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={result.breakdown}
                              dataKey="amount"
                              nameKey="category"
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={2}
                            >
                              {result.breakdown.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number) => formatCurrency(value)}
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className={showTeaser && !isAuthenticated ? "blur-sm pointer-events-none" : ""}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Detailed Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Home Value</span>
                      <span className="font-mono font-semibold">
                        {formatCurrency(result.homeValue)}
                      </span>
                    </div>

                    {result.landCost > 0 && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Land Value (Est. 30%)</span>
                        <span className="font-mono">
                          {formatCurrency(result.landCost)}
                        </span>
                      </div>
                    )}

                    {result.constructionCost > 0 && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Construction Cost</span>
                        <span className="font-mono">
                          {formatCurrency(result.constructionCost)}
                        </span>
                      </div>
                    )}

                    {result.developmentCharges > 0 && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Development Charges</span>
                        <span className="font-mono">
                          {formatCurrency(result.developmentCharges)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Provincial LTT</span>
                      <span className="font-mono">
                        {formatCurrency(result.provincialLTT)}
                      </span>
                    </div>

                    {result.municipalLTT > 0 && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Toronto Municipal LTT</span>
                        <span className="font-mono">
                          {formatCurrency(result.municipalLTT)}
                        </span>
                      </div>
                    )}

                    {result.lttRebate > 0 && (
                      <div className="flex justify-between py-2 border-b text-green-600 dark:text-green-400">
                        <span>First-Time Buyer LTT Rebate</span>
                        <span className="font-mono">
                          -{formatCurrency(result.lttRebate)}
                        </span>
                      </div>
                    )}

                    {result.grossHST > 0 && (
                      <>
                        {result.gstPaused && (
                          <div className="flex items-center gap-2 py-2 px-3 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 mb-1" data-testid="hst-pause-banner">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                            <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                              1-Year HST/GST Pause on New Builds — Federal GST (5%) and Ontario PST (8%) temporarily suspended
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between py-2 border-b">
                          <span className={result.gstPaused ? "text-muted-foreground/50" : "text-muted-foreground"}>
                            Federal GST (5%)
                            {result.gstPaused && <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 border-green-500 text-green-600 dark:text-green-400">PAUSED</Badge>}
                          </span>
                          <span className={`font-mono ${result.gstPaused ? "line-through text-muted-foreground/50" : ""}`} data-testid="amount-federal-gst">
                            {formatCurrency(result.federalGST)}
                          </span>
                        </div>

                        <div className="flex justify-between py-2 border-b">
                          <span className={result.pstPaused ? "text-muted-foreground/50" : "text-muted-foreground"}>
                            Ontario PST (8%)
                            {result.pstPaused && <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 border-green-500 text-green-600 dark:text-green-400">PAUSED</Badge>}
                          </span>
                          <span className={`font-mono ${result.pstPaused ? "line-through text-muted-foreground/50" : ""}`} data-testid="amount-provincial-pst">
                            {formatCurrency(result.provincialPST)}
                          </span>
                        </div>

                        {result.hstRebate > 0 && !result.gstPaused && !result.pstPaused && (
                          <div className="flex justify-between py-2 border-b text-green-600 dark:text-green-400">
                            <span>New Home HST Rebate</span>
                            <span className="font-mono">
                              -{formatCurrency(result.hstRebate)}
                            </span>
                          </div>
                        )}

                        {(result.gstPaused || result.pstPaused) && (
                          <div className="flex justify-between py-2 border-b text-green-600 dark:text-green-400">
                            <span>HST Savings (Pause)</span>
                            <span className="font-mono font-semibold" data-testid="hst-savings">
                              -{formatCurrency(
                                (result.gstPaused ? result.federalGST : 0) +
                                (result.pstPaused ? result.provincialPST : 0)
                              )}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {result.developerMargin > 0 && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Developer Margin (10%)</span>
                        <span className="font-mono">
                          {formatCurrency(result.developerMargin)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between py-3 bg-muted/50 rounded-lg px-3 mt-4">
                      <span className="font-semibold">Additional Closing Costs</span>
                      <span className="font-mono font-bold text-lg">
                        {formatCurrency(result.totalCosts)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {result.matchedMunicipality && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    Calculated for <span className="font-medium">{result.matchedMunicipality}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-center">
                  Estimates based on 2024-2025 Ontario rates (BILD/Altus, CMHC, CRA). Reflects the 1-year federal/provincial HST pause on new construction. Actual costs may vary. 
                  This is for educational purposes only and not financial advice.
                </p>
              </>
            ) : (
              <Card className="h-full flex items-center justify-center min-h-[400px]">
                <CardContent className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Calculator className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    Enter Your Details
                  </h3>
                  <p className="text-muted-foreground max-w-sm">
                    Fill in the form and click "Calculate" to see the full cost breakdown of your home purchase.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
