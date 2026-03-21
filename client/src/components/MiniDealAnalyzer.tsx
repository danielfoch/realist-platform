import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, Line, Legend
} from "recharts";
import { TrendingUp, DollarSign, Percent, BarChart3 } from "lucide-react";

interface MiniDealAnalyzerProps {
  price: number;
  monthlyRent: number;
  annualPropertyTax?: number;
  unitCount?: number;
  isEstimated?: boolean;
  className?: string;
}

const ASSUMPTIONS = {
  downPaymentPercent: 20,
  mortgageRate: 5.5,
  amortizationYears: 25,
  vacancyPercent: 5,
  maintenancePercent: 5,
  managementPercent: 8,
  insurancePerUnit: 100,
  propertyTaxPercent: 1.0,
  appreciationRate: 3,
  rentGrowthRate: 2,
};

function formatK(val: number): string {
  if (Math.abs(val) >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(0)}k`;
  return `$${Math.round(val)}`;
}

function computeMonthlyMortgage(principal: number, annualRate: number, years: number): number {
  const monthlyRate = annualRate / 100 / 12;
  const n = years * 12;
  if (monthlyRate === 0) return principal / n;
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
}

function computeLoanBalance(principal: number, annualRate: number, years: number, monthsPaid: number): number {
  const monthlyRate = annualRate / 100 / 12;
  const n = years * 12;
  if (monthlyRate === 0) return principal - (principal / n) * monthsPaid;
  const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
  return principal * Math.pow(1 + monthlyRate, monthsPaid) - monthlyPayment * ((Math.pow(1 + monthlyRate, monthsPaid) - 1) / monthlyRate);
}

export function MiniDealAnalyzer({ price, monthlyRent, annualPropertyTax, unitCount = 1, isEstimated = false, className = "" }: MiniDealAnalyzerProps) {
  const [activeTab, setActiveTab] = useState("kpi");

  const analysis = useMemo(() => {
    if (!price || price <= 0 || !monthlyRent || monthlyRent <= 0) return null;

    const downPayment = price * (ASSUMPTIONS.downPaymentPercent / 100);
    const loanAmount = price - downPayment;
    const monthlyMortgage = computeMonthlyMortgage(loanAmount, ASSUMPTIONS.mortgageRate, ASSUMPTIONS.amortizationYears);
    const annualMortgage = monthlyMortgage * 12;

    const grossAnnualRent = monthlyRent * 12;
    const vacancy = grossAnnualRent * (ASSUMPTIONS.vacancyPercent / 100);
    const effectiveRent = grossAnnualRent - vacancy;

    const maintenance = grossAnnualRent * (ASSUMPTIONS.maintenancePercent / 100);
    const management = grossAnnualRent * (ASSUMPTIONS.managementPercent / 100);
    const insurance = ASSUMPTIONS.insurancePerUnit * 12 * unitCount;
    const propertyTax = annualPropertyTax || price * (ASSUMPTIONS.propertyTaxPercent / 100);

    const totalExpenses = maintenance + management + insurance + propertyTax;
    const noi = effectiveRent - totalExpenses;
    const annualCashFlow = noi - annualMortgage;
    const capRate = Math.max(0, (noi / price) * 100);
    const cashOnCash = downPayment > 0 ? (annualCashFlow / downPayment) * 100 : 0;

    const expenseBreakdown = [
      { name: "Property Tax", value: Math.round(propertyTax), color: "#ef4444" },
      { name: "Insurance", value: Math.round(insurance), color: "#3b82f6" },
      { name: "Maintenance", value: Math.round(maintenance), color: "#f59e0b" },
      { name: "Management", value: Math.round(management), color: "#8b5cf6" },
      { name: "Vacancy", value: Math.round(vacancy), color: "#06b6d4" },
    ];
    const totalExpensesPie = expenseBreakdown.reduce((s, e) => s + e.value, 0);

    const cashFlowByYear: { year: string; cashFlow: number }[] = [];
    const equityGrowth: { year: string; equity: number; propertyValue: number; loanBalance: number }[] = [];

    for (let y = 1; y <= 10; y++) {
      const rentMultiplier = Math.pow(1 + ASSUMPTIONS.rentGrowthRate / 100, y - 1);
      const yearRent = grossAnnualRent * rentMultiplier;
      const yearVacancy = yearRent * (ASSUMPTIONS.vacancyPercent / 100);
      const yearEffective = yearRent - yearVacancy;
      const yearMaint = yearRent * (ASSUMPTIONS.maintenancePercent / 100);
      const yearMgmt = yearRent * (ASSUMPTIONS.managementPercent / 100);
      const yearTax = propertyTax * Math.pow(1.02, y - 1);
      const yearInsurance = insurance * Math.pow(1.03, y - 1);
      const yearNOI = yearEffective - yearMaint - yearMgmt - yearTax - yearInsurance;
      const yearCF = yearNOI - annualMortgage;
      cashFlowByYear.push({ year: `Year ${y}`, cashFlow: Math.round(yearCF) });

      const pv = price * Math.pow(1 + ASSUMPTIONS.appreciationRate / 100, y);
      const lb = Math.max(0, computeLoanBalance(loanAmount, ASSUMPTIONS.mortgageRate, ASSUMPTIONS.amortizationYears, y * 12));
      const eq = pv - lb;
      equityGrowth.push({
        year: `Year ${y}`,
        equity: Math.round(eq),
        propertyValue: Math.round(pv),
        loanBalance: Math.round(lb),
      });
    }

    const totalInvested = downPayment;
    const year10Value = equityGrowth[9].propertyValue;
    const year10Equity = equityGrowth[9].equity;
    const totalCashFlow = cashFlowByYear.reduce((s, cf) => s + cf.cashFlow, 0);
    const totalReturn = year10Equity - downPayment + totalCashFlow;
    const avgAnnualReturn = totalInvested > 0 ? (totalReturn / totalInvested / 10) * 100 : 0;

    return {
      downPayment,
      monthlyMortgage,
      annualCashFlow,
      capRate,
      cashOnCash,
      noi,
      expenseBreakdown,
      totalExpensesPie,
      cashFlowByYear,
      equityGrowth,
      year10Value,
      year10Equity,
      totalCashFlow,
      avgAnnualReturn,
    };
  }, [price, monthlyRent, annualPropertyTax, unitCount]);

  if (!analysis) return null;

  const kpiItems = [
    { label: "Cap Rate", value: `${analysis.capRate.toFixed(1)}%`, positive: analysis.capRate > 5 },
    { label: "Cash-on-Cash", value: `${analysis.cashOnCash.toFixed(1)}%`, positive: analysis.cashOnCash > 0 },
    { label: "Monthly CF", value: formatK(analysis.annualCashFlow / 12), positive: analysis.annualCashFlow > 0 },
    { label: "NOI", value: formatK(analysis.noi), positive: analysis.noi > 0 },
    { label: "Down Payment", value: formatK(analysis.downPayment), positive: true },
    { label: "Mortgage/mo", value: formatK(analysis.monthlyMortgage), positive: true },
  ];

  return (
    <div className={`space-y-2 ${className}`} data-testid="mini-deal-analyzer">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <BarChart3 className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Quick Deal Analysis</span>
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
          {ASSUMPTIONS.downPaymentPercent}% down · {ASSUMPTIONS.mortgageRate}% rate
        </Badge>
        {isEstimated && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-amber-600 border-amber-300">
            Rough estimate
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full h-7 p-0.5 bg-muted/50">
          <TabsTrigger value="kpi" className="flex-1 text-[10px] h-6 px-1" data-testid="tab-mini-kpi">
            KPIs
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex-1 text-[10px] h-6 px-1" data-testid="tab-mini-expenses">
            Expenses
          </TabsTrigger>
          <TabsTrigger value="cashflow" className="flex-1 text-[10px] h-6 px-1" data-testid="tab-mini-cashflow">
            Cash Flow
          </TabsTrigger>
          <TabsTrigger value="equity" className="flex-1 text-[10px] h-6 px-1" data-testid="tab-mini-equity">
            Equity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kpi" className="mt-2 space-y-0">
          <div className="grid grid-cols-3 gap-1.5">
            {kpiItems.map((kpi) => (
              <div
                key={kpi.label}
                className="bg-muted/30 rounded-md p-1.5 text-center border border-border/40"
                data-testid={`kpi-${kpi.label.replace(/\s+/g, "-").toLowerCase()}`}
              >
                <p className="text-[9px] text-muted-foreground leading-tight">{kpi.label}</p>
                <p className={`text-xs font-bold ${kpi.positive ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5 mt-1.5">
            <div className="bg-muted/30 rounded-md p-1.5 text-center border border-border/40">
              <p className="text-[9px] text-muted-foreground">10-Year Equity</p>
              <p className="text-xs font-bold text-primary">{formatK(analysis.year10Equity)}</p>
            </div>
            <div className="bg-muted/30 rounded-md p-1.5 text-center border border-border/40">
              <p className="text-[9px] text-muted-foreground">Avg Annual Return</p>
              <p className={`text-xs font-bold ${analysis.avgAnnualReturn > 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                {analysis.avgAnnualReturn.toFixed(1)}%
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="mt-2">
          <Card className="border-border/40">
            <CardContent className="p-2">
              <p className="text-[10px] font-semibold mb-1 text-center">Monthly Expense Breakdown</p>
              <div className="h-[130px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analysis.expenseBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={28}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {analysis.expenseBreakdown.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [`$${Math.round(value / 12).toLocaleString()}/mo`, name]}
                      contentStyle={{ fontSize: "10px", padding: "4px 8px", borderRadius: "6px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 justify-center">
                {analysis.expenseBreakdown.map((e) => (
                  <div key={e.name} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
                    <span className="text-[9px] text-muted-foreground">
                      {e.name} ({Math.round((e.value / analysis.totalExpensesPie) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cashflow" className="mt-2">
          <Card className="border-border/40">
            <CardContent className="p-2">
              <p className="text-[10px] font-semibold mb-1 text-center">Annual Cash Flow (10-Year)</p>
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.cashFlowByYear} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 9 }}
                      tickFormatter={(v) => v.replace("Year ", "Y")}
                    />
                    <YAxis
                      tick={{ fontSize: 9 }}
                      tickFormatter={(v) => formatK(v)}
                      width={40}
                    />
                    <Tooltip
                      formatter={(value: number) => [`$${value.toLocaleString()}`, "Cash Flow"]}
                      contentStyle={{ fontSize: "10px", padding: "4px 8px", borderRadius: "6px" }}
                    />
                    <Bar
                      dataKey="cashFlow"
                      fill="#f59e0b"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[9px] text-center text-muted-foreground mt-1">
                10-yr total: <span className={`font-semibold ${analysis.totalCashFlow >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {formatK(analysis.totalCashFlow)}
                </span>
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equity" className="mt-2">
          <Card className="border-border/40">
            <CardContent className="p-2">
              <p className="text-[10px] font-semibold mb-1 text-center">Equity & Property Value Growth</p>
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analysis.equityGrowth} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 9 }}
                      tickFormatter={(v) => v.replace("Year ", "Y")}
                    />
                    <YAxis
                      tick={{ fontSize: 9 }}
                      tickFormatter={(v) => formatK(v)}
                      width={42}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name === "propertyValue" ? "Property Value" : name === "equity" ? "Equity" : "Loan Balance"]}
                      contentStyle={{ fontSize: "10px", padding: "4px 8px", borderRadius: "6px" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      stroke="#ef4444"
                      fill="#ef444420"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="propertyValue"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="loanBalance"
                      stroke="#ef4444"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                    <Legend
                      iconSize={8}
                      wrapperStyle={{ fontSize: "9px", paddingTop: "4px" }}
                      formatter={(value: string) => {
                        if (value === "propertyValue") return "Property Value";
                        if (value === "loanBalance") return "Loan Balance";
                        return "Equity";
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
