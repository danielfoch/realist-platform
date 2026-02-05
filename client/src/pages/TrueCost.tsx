import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Loader2, Calculator, DollarSign, Home, MapPin, HelpCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const formSchema = z.object({
  homeValue: z.string().min(1, "Home value is required"),
  city: z.string().min(1, "City is required"),
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
  developerMargin: number;
  totalCosts: number;
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

  const { data: options, isLoading: optionsLoading } = useQuery<{
    cities: string[];
    homeTypes: string[];
    buyerTypes: string[];
  }>({
    queryKey: ["/api/true-cost/options"],
  });

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
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      homeValue: "850000",
      city: "Toronto",
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
      city: data.city,
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

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          City
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12" data-testid="select-city">
                              <SelectValue placeholder="Select city" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {options?.cities.map((city) => (
                              <SelectItem key={city} value={city}>
                                {city}
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
                <Card>
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

                <Card>
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
                        <div className="flex justify-between py-2 border-b">
                          <span className="text-muted-foreground">HST (13%)</span>
                          <span className="font-mono">
                            {formatCurrency(result.grossHST)}
                          </span>
                        </div>

                        {result.hstRebate > 0 && (
                          <div className="flex justify-between py-2 border-b text-green-600 dark:text-green-400">
                            <span>New Home HST Rebate</span>
                            <span className="font-mono">
                              -{formatCurrency(result.hstRebate)}
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

                <p className="text-xs text-muted-foreground text-center">
                  Estimates based on 2023 Ontario rates. Actual costs may vary. 
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
