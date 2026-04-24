import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Navigation } from "@/components/Navigation";
import { TrendingDown, TrendingUp, Building2, Landmark, Shield, Clock, ArrowRight } from "lucide-react";

interface MortgageRate {
  id: string;
  rateType: string;
  term: string;
  rate: number;
  provider: string;
  source: string;
  category: string;
  isInsured: boolean;
  lastUpdated: string;
}

function formatRate(rate: number): string {
  return rate.toFixed(2) + "%";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatSourceLabel(rate: MortgageRate): string {
  if (rate.source === "wowa.ca") return "Source: wowa.ca";
  if (rate.source === "bankofcanada.ca") return "Source: Bank of Canada";
  if (rate.source === "bank-posted") return "Source: major bank posted average";
  if (rate.source === "market-estimate") return "Source: fallback market estimate";
  return `Source: ${rate.source}`;
}

function termSortOrder(term: string): number {
  const order: Record<string, number> = {
    "overnight": 0, "bank-rate": 1, "prime": 2,
    "1-year": 3, "2-year": 4, "3-year": 5, "5-year": 6, "7-year": 7, "10-year": 8,
  };
  return order[term] ?? 99;
}

function RateCard({ rate, comparison }: { rate: MortgageRate; comparison?: MortgageRate }) {
  const diff = comparison ? rate.rate - comparison.rate : 0;
  const savings = comparison ? comparison.rate - rate.rate : 0;

  return (
    <div
      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
      data-testid={`rate-card-${rate.term}-${rate.rateType}-${rate.category}`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm capitalize" data-testid="rate-term">{rate.term}</span>
          <Badge variant="outline" className="text-xs capitalize" data-testid="rate-type">
            {rate.rateType}
          </Badge>
          {rate.isInsured && (
            <Badge variant="secondary" className="text-xs">
              <Shield className="h-3 w-3 mr-1" />
              Insured
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{rate.provider}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{formatSourceLabel(rate)}</p>
      </div>
      <div className="text-right">
        <span className="text-2xl font-bold text-primary" data-testid="rate-value">
          {formatRate(rate.rate)}
        </span>
        {savings > 0.1 && (
          <p className="text-xs text-green-600 flex items-center justify-end gap-1">
            <TrendingDown className="h-3 w-3" />
            Save {savings.toFixed(2)}% vs posted
          </p>
        )}
      </div>
    </div>
  );
}

function RateSection({
  title,
  icon: Icon,
  rates,
  description,
  postedRates,
}: {
  title: string;
  icon: any;
  rates: MortgageRate[];
  description: string;
  postedRates?: MortgageRate[];
}) {
  const fixedRates = rates.filter(r => r.rateType === "fixed").sort((a, b) => termSortOrder(a.term) - termSortOrder(b.term));
  const variableRates = rates.filter(r => r.rateType === "variable").sort((a, b) => termSortOrder(a.term) - termSortOrder(b.term));

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {fixedRates.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
              <Landmark className="h-4 w-4" /> Fixed Rates
            </h4>
            <div className="space-y-2">
              {fixedRates.map(r => (
                <RateCard
                  key={r.id}
                  rate={r}
                  comparison={postedRates?.find(p => p.term === r.term && p.rateType === "fixed")}
                />
              ))}
            </div>
          </div>
        )}
        {variableRates.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Variable Rates
            </h4>
            <div className="space-y-2">
              {variableRates.map(r => (
                <RateCard
                  key={r.id}
                  rate={r}
                  comparison={postedRates?.find(p => p.term === r.term && p.rateType === "variable")}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MortgageRates() {
  const { data: rates, isLoading } = useQuery<MortgageRate[]>({
    queryKey: ["/api/mortgage-rates"],
  });

  const bestRates = rates?.filter(r => r.category === "best") || [];
  const postedRates = rates?.filter(r => r.category === "posted") || [];
  const bigBankRates = rates?.filter(r => r.category === "big-bank") || [];
  const policyRates = rates?.filter(r => r.category === "policy") || [];

  const lastUpdated = rates?.length ? rates.reduce((latest, r) => {
    const t = new Date(r.lastUpdated).getTime();
    return t > latest ? t : latest;
  }, 0) : 0;

  const bestFixed5 = bestRates.find(r => r.rateType === "fixed" && r.term === "5-year");
  const bestVariable5 = bestRates.find(r => r.rateType === "variable" && r.term === "5-year");
  const primeRate = postedRates.find(r => r.term === "prime");
  const bankFixed5 = bigBankRates.find(r => r.rateType === "fixed" && r.term === "5-year");

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="relative py-16 bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-8">
            <Badge variant="outline" className="mb-4" data-testid="badge-updated">
              <Clock className="h-3 w-3 mr-1" />
              {lastUpdated > 0 ? `Updated ${formatDate(new Date(lastUpdated).toISOString())}` : "Loading..."}
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" data-testid="page-title">
              Canadian Mortgage Rates
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="page-description">
              Compare the best mortgage rates in Canada. Best-rate snapshots are pulled weekly from wowa.ca, while posted and policy context comes from the Bank of Canada.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Best rates: wowa.ca</Badge>
              <Badge variant="outline">Posted & policy: Bank of Canada</Badge>
              <Badge variant="outline">Refresh cadence: weekly</Badge>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20" data-testid="stat-best-fixed">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Best 5-Yr Fixed</p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                    {bestFixed5 ? formatRate(bestFixed5.rate) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Insured</p>
                  <p className="text-[11px] text-muted-foreground mt-1">wowa.ca</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20" data-testid="stat-best-variable">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Best 5-Yr Variable</p>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                    {bestVariable5 ? formatRate(bestVariable5.rate) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Insured</p>
                  <p className="text-[11px] text-muted-foreground mt-1">wowa.ca</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md" data-testid="stat-prime">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Prime Rate</p>
                  <p className="text-3xl font-bold">
                    {primeRate ? formatRate(primeRate.rate) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Bank of Canada</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md" data-testid="stat-posted">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Posted 5-Yr Fixed</p>
                  <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                    {bankFixed5 ? formatRate(bankFixed5.rate) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Major bank posted average</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="best" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
            <TabsTrigger value="best" data-testid="tab-best">Best Rates</TabsTrigger>
            <TabsTrigger value="banks" data-testid="tab-banks">Big Banks</TabsTrigger>
            <TabsTrigger value="policy" data-testid="tab-policy">Policy Rates</TabsTrigger>
          </TabsList>

          <TabsContent value="best">
            <div className="grid md:grid-cols-1 gap-6">
              {isLoading ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : (
                <RateSection
                  title="Best Available Rates"
                  icon={TrendingDown}
                  rates={bestRates}
                  description="Weekly best-rate snapshot sourced from wowa.ca. Treat these as market-leading borrower rates, not guaranteed offers."
                  postedRates={bigBankRates}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="banks">
            <div className="grid md:grid-cols-1 gap-6">
              {isLoading ? (
                <Skeleton className="h-64 rounded-xl" />
              ) : (
                <>
                  <RateSection
                    title="Big Bank Posted Rates"
                    icon={Building2}
                    rates={bigBankRates}
                    description="Posted-rate benchmark for major banks. These are reference rates, not the same thing as negotiated borrower offers."
                  />
                  {postedRates.filter(r => r.term !== "prime").length > 0 && (
                    <RateSection
                      title="Bank of Canada Posted Rates"
                      icon={Landmark}
                      rates={postedRates.filter(r => r.term !== "prime")}
                      description="Official posted mortgage context as published by the Bank of Canada."
                    />
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="policy">
            <div className="grid md:grid-cols-2 gap-6">
              {isLoading ? (
                <>
                  <Skeleton className="h-48 rounded-xl" />
                  <Skeleton className="h-48 rounded-xl" />
                </>
              ) : (
                <>
                  {primeRate && (
                    <Card className="border-0 shadow-lg">
                      <CardHeader>
                        <CardTitle>Prime Rate</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-4xl font-bold text-primary mb-2" data-testid="prime-rate-value">
                          {formatRate(primeRate.rate)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          The prime lending rate is the benchmark used by banks to set variable mortgage rates.
                          Variable rate mortgages are typically priced as Prime ± a discount/premium.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                  {policyRates.length > 0 && (
                    <Card className="border-0 shadow-lg">
                      <CardHeader>
                        <CardTitle>Bank of Canada Policy Rates</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {policyRates.map(r => (
                            <div key={r.id} className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                              <span className="text-sm font-medium capitalize">{r.term.replace("-", " ")}</span>
                              <span className="text-lg font-bold" data-testid={`policy-rate-${r.term}`}>
                                {formatRate(r.rate)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-4">
                          The overnight rate is the Bank of Canada's key policy rate. Changes to this rate
                          directly influence the prime rate and variable mortgage rates.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Card className="mt-12 border-primary/20 bg-primary/5" data-testid="card-fixed-vs-variable-promo">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1">
                <h3 className="font-bold text-xl mb-2">Compare Fixed vs Variable</h3>
                <p className="text-muted-foreground mb-4">
                  See the total interest cost difference over 5, 10, and 25 years with best/worst case scenarios.
                  Uses the live rates shown above as defaults.
                </p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-blue-600" />
                    <span><strong>Fixed:</strong> Constant rate for your term</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <span><strong>Variable:</strong> Moves with prime — stress-test scenarios</span>
                  </div>
                </div>
              </div>
              <a href="/tools/fixed-vs-variable" data-testid="link-open-calculator">
                <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8">
                  <ArrowRight className="h-4 w-4" />
                  Open Full Calculator
                </button>
              </a>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-3">How to Get the Best Rate</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <span>Use a mortgage broker — they have access to rates from 30+ lenders</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <span>Never accept the first rate your bank offers — posted rates are always negotiable</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <span>Insured mortgages (under $1M, 20%+ down) qualify for the best rates</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <span>Consider the total cost of borrowing, not just the rate — penalties, portability, and prepayment matter</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-3">Fixed vs Variable Basics</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Landmark className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <span><strong>Fixed rate:</strong> Your rate stays the same for the entire term. Best for budgeting certainty and when rates are expected to rise.</span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <span><strong>Variable rate:</strong> Your rate changes with prime. Historically cheaper over full mortgage life, but monthly payments can change.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <span>Use the <a href="/tools/fixed-vs-variable" className="text-primary underline">Fixed vs Variable Calculator</a> to compare scenarios on any deal.</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground max-w-2xl mx-auto" data-testid="disclaimer">
            Rates shown are for informational purposes only and may not reflect current offers.
            Best rates shown are typically for insured, high-ratio mortgages. Uninsured and rental property
            rates are typically 0.10% - 0.30% higher. Always confirm rates directly with lenders.
            Data sourced from Bank of Canada, mortgage brokers, and major bank websites.
            Updated weekly.
          </p>
        </div>
      </div>

    </div>
  );
}
