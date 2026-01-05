import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  ComposedChart,
  Line,
} from "recharts";
import { formatCurrency } from "@/lib/calculations";
import type { AnalysisResults } from "@shared/schema";

interface AnalysisChartsProps {
  results: AnalysisResults;
}

const COLORS = [
  "#E53935",
  "#1E88E5",
  "#43A047",
  "#FB8C00",
  "#8E24AA",
  "#00ACC1",
  "#FDD835",
];

export function AnalysisCharts({ results }: AnalysisChartsProps) {
  const expenseData = [
    { name: "Property Tax", value: results.expenseBreakdown.propertyTax, color: COLORS[0] },
    { name: "Insurance", value: results.expenseBreakdown.insurance, color: COLORS[1] },
    { name: "Utilities", value: results.expenseBreakdown.utilities, color: COLORS[2] },
    { name: "Maintenance", value: results.expenseBreakdown.maintenance, color: COLORS[3] },
    { name: "Management", value: results.expenseBreakdown.management, color: COLORS[4] },
    { name: "CapEx Reserve", value: results.expenseBreakdown.capexReserve, color: COLORS[5] },
    { name: "Other", value: results.expenseBreakdown.other, color: COLORS[6] },
  ].filter(item => item.value > 0);

  const equityData = results.yearlyProjections.map((year) => ({
    year: `Year ${year.year}`,
    equity: year.equity,
    cashFlow: year.cumulativeCashFlow,
    propertyValue: year.propertyValue,
    loanBalance: year.loanBalance,
    totalReturn: year.totalReturn,
    cumulativePrincipalPaid: year.cumulativePrincipalPaid,
  }));

  const cashFlowData = results.yearlyProjections.map((year) => ({
    year: `Year ${year.year}`,
    cashFlow: year.cashFlow,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(payload[0].value)}/mo
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid gap-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card data-testid="chart-expense-breakdown">
          <CardHeader>
            <CardTitle className="text-lg">Monthly Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => 
                      percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ""
                    }
                    labelLine={false}
                  >
                    {expenseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend 
                    layout="vertical" 
                    align="right" 
                    verticalAlign="middle"
                    formatter={(value) => <span className="text-sm">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="chart-annual-cash-flow">
          <CardHeader>
            <CardTitle className="text-lg">Annual Cash Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="year" 
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <YAxis 
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="cashFlow" 
                    name="Cash Flow"
                    fill="hsl(var(--chart-2))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="chart-equity-growth">
        <CardHeader>
          <CardTitle className="text-lg">Equity & Property Value Growth</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={equityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="year" 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis 
                  yAxisId="left"
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="equity"
                  name="Equity"
                  fill="hsl(var(--chart-1) / 0.3)"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="propertyValue"
                  name="Property Value"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="loanBalance"
                  name="Loan Balance"
                  stroke="hsl(var(--chart-5))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="chart-return-on-investment">
        <CardHeader>
          <CardTitle className="text-lg">Return on Investment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={equityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="year" 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis 
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="totalReturn"
                  name="Total ROI"
                  fill="hsl(var(--chart-1) / 0.3)"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="cashFlow"
                  name="Cash Flow"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativePrincipalPaid"
                  name="Principal Paid"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
