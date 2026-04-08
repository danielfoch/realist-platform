import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  DollarSign, 
  Percent, 
  Home, 
  Wallet, 
  Settings, 
  Hammer,
  Plus,
  Minus,
  Calendar,
  Clock,
  Building2,
  Bed
} from "lucide-react";
import { useState } from "react";
import type { BuyHoldInputs } from "@shared/schema";
import { CashbackDisplay } from "@/components/CashbackDisplay";
import { MortgageConsultationButton } from "@/components/MortgageConsultationButton";
import { FinancingExpertPanel } from "@/components/FinancingExpertPanel";

interface DealInputsProps {
  inputs: BuyHoldInputs;
  onChange: (inputs: BuyHoldInputs) => void;
  country: "canada" | "usa";
  strategy: string;
  region?: string;
  city?: string;
  address?: string;
  defaultLeadInfo?: { name?: string; email?: string; phone?: string };
}

function CurrencyInput({
  id,
  label,
  value,
  onChange,
  testId,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  testId: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          type="number"
          value={value || ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="h-12 pl-9 font-mono"
          data-testid={testId}
        />
      </div>
    </div>
  );
}

function PercentInput({
  id,
  label,
  value,
  onChange,
  testId,
  min = 0,
  max = 100,
  step = 0.1,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  testId: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-sm font-mono text-muted-foreground">{value.toFixed(1)}%</span>
      </div>
      <Slider
        id={id}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={min}
        max={max}
        step={step}
        className="py-2"
        data-testid={testId}
      />
    </div>
  );
}

function NumberInput({
  id,
  label,
  value,
  onChange,
  testId,
  suffix,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  testId: string;
  suffix?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          value={value || ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="h-12 font-mono"
          data-testid={testId}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

interface ConstructionLineItem {
  id: string;
  name: string;
  cost: number;
}

interface GanttTask {
  id: string;
  name: string;
  startWeek: number;
  duration: number;
}

const defaultFlipTasks: GanttTask[] = [
  { id: "1", name: "Closing", startWeek: 0, duration: 1 },
  { id: "2", name: "Demo", startWeek: 1, duration: 2 },
  { id: "3", name: "Electrical/Plumbing", startWeek: 2, duration: 3 },
  { id: "4", name: "Flooring", startWeek: 5, duration: 2 },
  { id: "5", name: "Kitchen", startWeek: 4, duration: 3 },
  { id: "6", name: "Bathrooms", startWeek: 5, duration: 2 },
  { id: "7", name: "Paint", startWeek: 7, duration: 2 },
  { id: "8", name: "Cleaning", startWeek: 9, duration: 1 },
  { id: "9", name: "Staging", startWeek: 10, duration: 1 },
  { id: "10", name: "Listing", startWeek: 11, duration: 1 },
];

function SimpleGanttChart({ tasks, onTasksChange }: { tasks: GanttTask[]; onTasksChange: (tasks: GanttTask[]) => void }) {
  const maxWeeks = Math.max(...tasks.map(t => t.startWeek + t.duration), 12);
  const weeks = Array.from({ length: maxWeeks + 2 }, (_, i) => i);

  const updateTask = (taskId: string, updates: Partial<GanttTask>) => {
    onTasksChange(tasks.map(t => t.id === taskId ? { ...t, ...updates } : t));
  };

  return (
    <div className="space-y-2 overflow-x-auto">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 min-w-[600px]">
        <div className="w-32 shrink-0">Task</div>
        {weeks.map(w => (
          <div key={w} className="w-8 text-center shrink-0">W{w + 1}</div>
        ))}
      </div>
      {tasks.map(task => (
        <div key={task.id} className="flex items-center gap-2 min-w-[600px]">
          <div className="w-32 text-sm truncate shrink-0">{task.name}</div>
          <div className="flex-1 flex gap-0.5">
            {weeks.map(w => {
              const isActive = w >= task.startWeek && w < task.startWeek + task.duration;
              return (
                <button
                  key={w}
                  className={`w-8 h-6 rounded-sm shrink-0 transition-colors ${
                    isActive 
                      ? "bg-primary" 
                      : "bg-muted/50 hover:bg-muted"
                  }`}
                  onClick={() => {
                    if (isActive) {
                      if (w === task.startWeek && task.duration > 1) {
                        updateTask(task.id, { startWeek: task.startWeek + 1, duration: task.duration - 1 });
                      } else if (w === task.startWeek + task.duration - 1 && task.duration > 1) {
                        updateTask(task.id, { duration: task.duration - 1 });
                      }
                    } else if (w === task.startWeek - 1) {
                      updateTask(task.id, { startWeek: w, duration: task.duration + 1 });
                    } else if (w === task.startWeek + task.duration) {
                      updateTask(task.id, { duration: task.duration + 1 });
                    } else {
                      updateTask(task.id, { startWeek: w, duration: 1 });
                    }
                  }}
                  data-testid={`gantt-${task.id}-week-${w}`}
                />
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground mt-2">
        Click cells to adjust timeline. Click adjacent cells to extend duration.
      </p>
    </div>
  );
}

function ConstructionBudget({ 
  items, 
  onItemsChange 
}: { 
  items: ConstructionLineItem[]; 
  onItemsChange: (items: ConstructionLineItem[]) => void 
}) {
  const addItem = () => {
    onItemsChange([...items, { id: Date.now().toString(), name: "", cost: 0 }]);
  };

  const removeItem = (id: string) => {
    onItemsChange(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, updates: Partial<ConstructionLineItem>) => {
    onItemsChange(items.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const total = items.reduce((sum, item) => sum + item.cost, 0);

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.id} className="flex items-center gap-2">
          <Input
            placeholder="Item name"
            value={item.name}
            onChange={(e) => updateItem(item.id, { name: e.target.value })}
            className="flex-1"
            data-testid={`input-construction-name-${index}`}
          />
          <div className="relative w-32">
            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="number"
              value={item.cost || ""}
              onChange={(e) => updateItem(item.id, { cost: parseFloat(e.target.value) || 0 })}
              className="pl-7 font-mono"
              data-testid={`input-construction-cost-${index}`}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeItem(item.id)}
            data-testid={`button-remove-item-${index}`}
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button variant="outline" size="sm" onClick={addItem} className="gap-1" data-testid="button-add-construction-item">
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
        <div className="font-mono font-semibold">
          Total: ${total.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

interface CashbackProps {
  region?: string;
  city?: string;
  address?: string;
  defaultLeadInfo?: { name?: string; email?: string; phone?: string };
  country: "canada" | "usa";
}

function BuyHoldInputs({ inputs, onChange, country, region, city, address, defaultLeadInfo }: { inputs: BuyHoldInputs; onChange: (inputs: BuyHoldInputs) => void; country: string } & CashbackProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const updateInput = <K extends keyof BuyHoldInputs>(key: K, value: BuyHoldInputs[K]) => {
    onChange({ ...inputs, [key]: value });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Home className="h-5 w-5" />
            Purchase Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CurrencyInput id="purchasePrice" label="Purchase Price" value={inputs.purchasePrice} onChange={(v) => updateInput("purchasePrice", v)} testId="input-purchase-price" />
          <CurrencyInput id="closingCosts" label="Closing Costs" value={inputs.closingCosts} onChange={(v) => updateInput("closingCosts", v)} testId="input-closing-costs" />
          {country === "canada" && inputs.purchasePrice > 0 && (
            <CashbackDisplay
              purchasePrice={inputs.purchasePrice}
              region={region || ""}
              city={city || ""}
              country="canada"
              dealInfo={{
                address: address || "",
                monthlyRent: inputs.monthlyRent,
                cashFlow: 0,
                capRate: 0,
              }}
              defaultValues={defaultLeadInfo}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Financing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PercentInput id="downPayment" label="Down Payment" value={inputs.downPaymentPercent} onChange={(v) => updateInput("downPaymentPercent", v)} testId="slider-down-payment" min={5} max={100} step={1} />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label htmlFor="interestRate">Interest Rate</Label>
              <MortgageConsultationButton
                purchasePrice={inputs.purchasePrice}
                downPaymentPercent={inputs.downPaymentPercent}
                interestRate={inputs.interestRate}
                region={region}
                city={city}
                address={address}
                defaultValues={defaultLeadInfo}
              />
            </div>
            <PercentInput id="interestRate" label="" value={inputs.interestRate} onChange={(v) => updateInput("interestRate", v)} testId="slider-interest-rate" min={0} max={15} step={0.1} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amortization">Amortization (Years)</Label>
              <Input id="amortization" type="number" value={inputs.amortizationYears} onChange={(e) => updateInput("amortizationYears", parseInt(e.target.value) || 25)} className="h-12 font-mono" data-testid="input-amortization" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="term">Term (Years)</Label>
              <Input id="term" type="number" value={inputs.loanTermYears} onChange={(e) => updateInput("loanTermYears", parseInt(e.target.value) || 5)} className="h-12 font-mono" data-testid="input-term" />
            </div>
          </div>
          {country === "canada" && (
            <div className="pt-4 border-t border-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>CMHC MLI Select</Label>
                  <p className="text-sm text-muted-foreground">Calculate points for 5+ unit properties</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const mliButton = document.querySelector('[data-testid="button-calculator-mli_select"]') as HTMLButtonElement;
                    if (mliButton) mliButton.click();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  data-testid="button-open-mli-calculator"
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  MLI Calculator
                </Button>
              </div>
            </div>
          )}
          <div className="pt-4 border-t border-border">
            <FinancingExpertPanel
              purchasePrice={inputs.purchasePrice}
              downPaymentPercent={inputs.downPaymentPercent}
              interestRate={inputs.interestRate}
              region={region}
              city={city}
              address={address}
              defaultValues={defaultLeadInfo}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="h-fit">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Income
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CurrencyInput id="monthlyRent" label="Monthly Rent" value={inputs.monthlyRent} onChange={(v) => updateInput("monthlyRent", v)} testId="input-monthly-rent" />
            <PercentInput id="vacancy" label="Vacancy Rate" value={inputs.vacancyPercent} onChange={(v) => updateInput("vacancyPercent", v)} testId="slider-vacancy" min={0} max={20} step={0.5} />
            <PercentInput id="rentGrowthIncome" label="Annual Rent Growth" value={inputs.rentGrowthPercent} onChange={(v) => updateInput("rentGrowthPercent", v)} testId="slider-rent-growth-income" min={-5} max={10} step={0.5} />
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Operating Expenses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CurrencyInput id="propertyTax" label="Annual Property Tax" value={inputs.propertyTax} onChange={(v) => updateInput("propertyTax", v)} testId="input-property-tax" />
            <CurrencyInput id="insurance" label="Annual Insurance" value={inputs.insurance} onChange={(v) => updateInput("insurance", v)} testId="input-insurance" />
            <CurrencyInput id="utilities" label="Monthly Utilities" value={inputs.utilities} onChange={(v) => updateInput("utilities", v)} testId="input-utilities" />
            <PercentInput id="maintenance" label="Maintenance (% of Rent)" value={inputs.maintenancePercent} onChange={(v) => updateInput("maintenancePercent", v)} testId="slider-maintenance" min={0} max={15} step={0.5} />
            <PercentInput id="capex" label="CapEx Reserve (% of Rent)" value={inputs.capexReservePercent} onChange={(v) => updateInput("capexReservePercent", v)} testId="slider-capex" min={0} max={15} step={0.5} />
            <PercentInput id="management" label="Property Management (% of Rent)" value={inputs.managementPercent} onChange={(v) => updateInput("managementPercent", v)} testId="slider-management" min={0} max={15} step={0.5} />
          </CardContent>
        </Card>
      </div>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full gap-2" data-testid="button-advanced">
            <Settings className="h-4 w-4" />
            Advanced Options
            <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <PercentInput id="expenseInflation" label="Expense Inflation" value={inputs.expenseInflationPercent} onChange={(v) => updateInput("expenseInflationPercent", v)} testId="slider-expense-inflation" min={0} max={10} step={0.5} />
              <PercentInput id="appreciation" label="Property Appreciation" value={inputs.appreciationPercent} onChange={(v) => updateInput("appreciationPercent", v)} testId="slider-appreciation" min={-5} max={15} step={0.5} />
              <div className="space-y-2">
                <Label htmlFor="holdingPeriod">Holding Period (Years)</Label>
                <Input id="holdingPeriod" type="number" value={inputs.holdingPeriodYears} onChange={(e) => updateInput("holdingPeriodYears", parseInt(e.target.value) || 10)} className="h-12 font-mono" data-testid="input-holding-period" />
              </div>
              <PercentInput id="sellingCosts" label="Selling Costs" value={inputs.sellingCostsPercent} onChange={(v) => updateInput("sellingCostsPercent", v)} testId="slider-selling-costs" min={0} max={10} step={0.5} />
              <CurrencyInput id="otherExpenses" label="Other Monthly Expenses" value={inputs.otherExpenses} onChange={(v) => updateInput("otherExpenses", v)} testId="input-other-expenses" />
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function FlipInputs({ inputs, onChange, region, city, address, defaultLeadInfo, country }: { inputs: BuyHoldInputs; onChange: (inputs: BuyHoldInputs) => void } & CashbackProps) {
  const [constructionItems, setConstructionItems] = useState<ConstructionLineItem[]>([
    { id: "1", name: "Demo", cost: 5000 },
    { id: "2", name: "Kitchen", cost: 25000 },
    { id: "3", name: "Bathrooms", cost: 15000 },
    { id: "4", name: "Flooring", cost: 8000 },
    { id: "5", name: "Paint", cost: 5000 },
    { id: "6", name: "Fixtures", cost: 3000 },
  ]);
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>(defaultFlipTasks);
  const [showGantt, setShowGantt] = useState(false);

  const updateInput = <K extends keyof BuyHoldInputs>(key: K, value: BuyHoldInputs[K]) => {
    onChange({ ...inputs, [key]: value });
  };

  const totalConstruction = constructionItems.reduce((sum, item) => sum + item.cost, 0);
  const totalWeeks = Math.max(...ganttTasks.map(t => t.startWeek + t.duration));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Home className="h-5 w-5" />
            Purchase Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CurrencyInput id="purchasePrice" label="Purchase Price" value={inputs.purchasePrice} onChange={(v) => updateInput("purchasePrice", v)} testId="input-purchase-price" />
          <CurrencyInput id="closingCosts" label="Closing Costs" value={inputs.closingCosts} onChange={(v) => updateInput("closingCosts", v)} testId="input-closing-costs" />
          <CurrencyInput id="arvPrice" label="After Repair Value (ARV)" value={inputs.monthlyRent * 100 || 650000} onChange={(v) => updateInput("monthlyRent", v / 100)} testId="input-arv" />
          {country === "canada" && inputs.purchasePrice > 0 && (
            <CashbackDisplay
              purchasePrice={inputs.purchasePrice}
              region={region || ""}
              city={city || ""}
              country="canada"
              dealInfo={{ address: address || "", monthlyRent: 0, cashFlow: 0, capRate: 0 }}
              defaultValues={defaultLeadInfo}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Hammer className="h-5 w-5" />
            Construction Budget
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ConstructionBudget items={constructionItems} onItemsChange={setConstructionItems} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Capital Costs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PercentInput id="interestRate" label="Financing Interest Rate" value={inputs.interestRate} onChange={(v) => updateInput("interestRate", v)} testId="slider-interest-rate" min={0} max={20} step={0.25} />
          <NumberInput id="projectTimeline" label="Project Timeline" value={totalWeeks} onChange={() => {}} testId="input-timeline" suffix="weeks" />
          <PercentInput id="sellingCosts" label="Selling Costs" value={inputs.sellingCostsPercent} onChange={(v) => updateInput("sellingCostsPercent", v)} testId="slider-selling-costs" min={0} max={10} step={0.5} />
        </CardContent>
      </Card>

      <div className="hidden sm:block">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Project Timeline (Gantt Chart)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleGanttChart tasks={ganttTasks} onTasksChange={setGanttTasks} />
          </CardContent>
        </Card>
      </div>

      <div className="sm:hidden">
        {showGantt ? (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Project Timeline (Gantt Chart)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleGanttChart tasks={ganttTasks} onTasksChange={setGanttTasks} />
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-4"
                onClick={() => setShowGantt(false)}
                data-testid="button-hide-gantt"
              >
                Hide Timeline
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Button 
            variant="outline" 
            className="w-full gap-2"
            onClick={() => setShowGantt(true)}
            data-testid="button-show-gantt"
          >
            <Calendar className="h-4 w-4" />
            Show Project Timeline
          </Button>
        )}
      </div>
    </div>
  );
}

function BRRRInputs({ inputs, onChange, country, region, city, address, defaultLeadInfo }: { inputs: BuyHoldInputs; onChange: (inputs: BuyHoldInputs) => void; country: string } & Omit<CashbackProps, 'country'>) {
  const [constructionItems, setConstructionItems] = useState<ConstructionLineItem[]>([
    { id: "1", name: "Demo", cost: 3000 },
    { id: "2", name: "Kitchen", cost: 15000 },
    { id: "3", name: "Bathroom", cost: 8000 },
    { id: "4", name: "Flooring", cost: 5000 },
    { id: "5", name: "Paint", cost: 3000 },
  ]);
  const [useConstructionLoan, setUseConstructionLoan] = useState(false);
  const [constructionLoanRate, setConstructionLoanRate] = useState(12);
  const [constructionLoanMonths, setConstructionLoanMonths] = useState(6);
  const [lenderFee, setLenderFee] = useState(2);
  const [brokerFee, setBrokerFee] = useState(1);

  const updateInput = <K extends keyof BuyHoldInputs>(key: K, value: BuyHoldInputs[K]) => {
    onChange({ ...inputs, [key]: value });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Home className="h-5 w-5" />
            Purchase Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CurrencyInput id="purchasePrice" label="Purchase Price" value={inputs.purchasePrice} onChange={(v) => updateInput("purchasePrice", v)} testId="input-purchase-price" />
          <CurrencyInput id="closingCosts" label="Closing Costs" value={inputs.closingCosts} onChange={(v) => updateInput("closingCosts", v)} testId="input-closing-costs" />
          <CurrencyInput id="arvPrice" label="After Repair Value (ARV)" value={inputs.monthlyRent * 100 || 550000} onChange={(v) => updateInput("monthlyRent", v / 100)} testId="input-arv" />
          {country === "canada" && inputs.purchasePrice > 0 && (
            <CashbackDisplay
              purchasePrice={inputs.purchasePrice}
              region={region || ""}
              city={city || ""}
              country="canada"
              dealInfo={{ address: address || "", monthlyRent: inputs.monthlyRent, cashFlow: 0, capRate: 0 }}
              defaultValues={defaultLeadInfo}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Hammer className="h-5 w-5" />
            Rehab Budget
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ConstructionBudget items={constructionItems} onItemsChange={setConstructionItems} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Rehab Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <NumberInput id="rehabMonths" label="Rehab Duration" value={constructionLoanMonths} onChange={setConstructionLoanMonths} testId="input-rehab-months" suffix="months" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Construction Financing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="constructionLoan">Use Construction Loan</Label>
              <p className="text-sm text-muted-foreground">For rehab costs financing</p>
            </div>
            <Switch id="constructionLoan" checked={useConstructionLoan} onCheckedChange={setUseConstructionLoan} data-testid="switch-construction-loan" />
          </div>
          {useConstructionLoan && (
            <div className="space-y-4 pt-4 border-t">
              <PercentInput id="constructionRate" label="Interest Rate" value={constructionLoanRate} onChange={setConstructionLoanRate} testId="slider-construction-rate" min={6} max={20} step={0.25} />
              <PercentInput id="lenderFee" label="Lender Fee" value={lenderFee} onChange={setLenderFee} testId="slider-lender-fee" min={0} max={5} step={0.25} />
              <PercentInput id="brokerFee" label="Broker Fee" value={brokerFee} onChange={setBrokerFee} testId="slider-broker-fee" min={0} max={3} step={0.25} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Refinance & Hold Financing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PercentInput id="downPayment" label="Down Payment (at refinance)" value={inputs.downPaymentPercent} onChange={(v) => updateInput("downPaymentPercent", v)} testId="slider-down-payment" min={5} max={100} step={1} />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label htmlFor="interestRate">Interest Rate</Label>
              <MortgageConsultationButton
                purchasePrice={inputs.purchasePrice}
                downPaymentPercent={inputs.downPaymentPercent}
                interestRate={inputs.interestRate}
                region={region}
                city={city}
                address={address}
                defaultValues={defaultLeadInfo}
              />
            </div>
            <PercentInput id="interestRate" label="" value={inputs.interestRate} onChange={(v) => updateInput("interestRate", v)} testId="slider-interest-rate" min={0} max={15} step={0.1} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amortization">Amortization (Years)</Label>
              <Input id="amortization" type="number" value={inputs.amortizationYears} onChange={(e) => updateInput("amortizationYears", parseInt(e.target.value) || 25)} className="h-12 font-mono" data-testid="input-amortization" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="term">Term (Years)</Label>
              <Input id="term" type="number" value={inputs.loanTermYears} onChange={(e) => updateInput("loanTermYears", parseInt(e.target.value) || 5)} className="h-12 font-mono" data-testid="input-term" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Rental Income (Post-Refinance)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CurrencyInput id="monthlyRentActual" label="Monthly Rent" value={inputs.propertyTax || 2500} onChange={(v) => updateInput("propertyTax", v)} testId="input-monthly-rent" />
          <PercentInput id="vacancy" label="Vacancy Rate" value={inputs.vacancyPercent} onChange={(v) => updateInput("vacancyPercent", v)} testId="slider-vacancy" min={0} max={20} step={0.5} />
        </CardContent>
      </Card>
    </div>
  );
}

function AirbnbInputs({ inputs, onChange, region, city, address, defaultLeadInfo, country }: { inputs: BuyHoldInputs; onChange: (inputs: BuyHoldInputs) => void } & CashbackProps) {
  const [adr, setAdr] = useState(250);
  const [occupancyRate, setOccupancyRate] = useState(65);

  const updateInput = <K extends keyof BuyHoldInputs>(key: K, value: BuyHoldInputs[K]) => {
    onChange({ ...inputs, [key]: value });
  };

  const estimatedMonthlyRevenue = (adr * 30 * occupancyRate) / 100;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Home className="h-5 w-5" />
            Purchase Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CurrencyInput id="purchasePrice" label="Purchase Price" value={inputs.purchasePrice} onChange={(v) => updateInput("purchasePrice", v)} testId="input-purchase-price" />
          <CurrencyInput id="closingCosts" label="Closing Costs" value={inputs.closingCosts} onChange={(v) => updateInput("closingCosts", v)} testId="input-closing-costs" />
          {country === "canada" && inputs.purchasePrice > 0 && (
            <CashbackDisplay
              purchasePrice={inputs.purchasePrice}
              region={region || ""}
              city={city || ""}
              country="canada"
              dealInfo={{ address: address || "", monthlyRent: estimatedMonthlyRevenue, cashFlow: 0, capRate: 0 }}
              defaultValues={defaultLeadInfo}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Financing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PercentInput id="downPayment" label="Down Payment" value={inputs.downPaymentPercent} onChange={(v) => updateInput("downPaymentPercent", v)} testId="slider-down-payment" min={5} max={100} step={1} />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label htmlFor="interestRate">Interest Rate</Label>
              <MortgageConsultationButton
                purchasePrice={inputs.purchasePrice}
                downPaymentPercent={inputs.downPaymentPercent}
                interestRate={inputs.interestRate}
                region={region}
                city={city}
                address={address}
                defaultValues={defaultLeadInfo}
              />
            </div>
            <PercentInput id="interestRate" label="" value={inputs.interestRate} onChange={(v) => updateInput("interestRate", v)} testId="slider-interest-rate" min={0} max={15} step={0.1} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amortization">Amortization (Years)</Label>
              <Input id="amortization" type="number" value={inputs.amortizationYears} onChange={(e) => updateInput("amortizationYears", parseInt(e.target.value) || 25)} className="h-12 font-mono" data-testid="input-amortization" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="term">Term (Years)</Label>
              <Input id="term" type="number" value={inputs.loanTermYears} onChange={(e) => updateInput("loanTermYears", parseInt(e.target.value) || 5)} className="h-12 font-mono" data-testid="input-term" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="h-fit">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bed className="h-5 w-5" />
              Short-Term Rental Income
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CurrencyInput id="adr" label="Average Daily Rate (ADR)" value={adr} onChange={setAdr} testId="input-adr" />
            <PercentInput id="occupancy" label="Occupancy Rate" value={occupancyRate} onChange={setOccupancyRate} testId="slider-occupancy" min={20} max={100} step={1} />
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estimated Monthly Revenue</span>
                <span className="font-mono font-semibold text-lg">${estimatedMonthlyRevenue.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Operating Expenses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CurrencyInput id="propertyTax" label="Annual Property Tax" value={inputs.propertyTax} onChange={(v) => updateInput("propertyTax", v)} testId="input-property-tax" />
            <CurrencyInput id="insurance" label="Annual Insurance" value={inputs.insurance} onChange={(v) => updateInput("insurance", v)} testId="input-insurance" />
            <CurrencyInput id="utilities" label="Monthly Utilities" value={inputs.utilities} onChange={(v) => updateInput("utilities", v)} testId="input-utilities" />
            <PercentInput id="management" label="Property Management (% of Revenue)" value={inputs.managementPercent} onChange={(v) => updateInput("managementPercent", v)} testId="slider-management" min={0} max={30} step={1} />
            <PercentInput id="cleaning" label="Cleaning & Turnover (% of Revenue)" value={inputs.maintenancePercent} onChange={(v) => updateInput("maintenancePercent", v)} testId="slider-cleaning" min={0} max={20} step={1} />
            <PercentInput id="platformFees" label="Platform Fees (Airbnb/VRBO)" value={inputs.capexReservePercent} onChange={(v) => updateInput("capexReservePercent", v)} testId="slider-platform-fees" min={0} max={20} step={0.5} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MultiplexInputs({ inputs, onChange, country, region, city, address, defaultLeadInfo }: { inputs: BuyHoldInputs; onChange: (inputs: BuyHoldInputs) => void; country: string } & Omit<CashbackProps, 'country'>) {
  const [numUnits, setNumUnits] = useState(4);
  const [useConstructionFinancing, setUseConstructionFinancing] = useState(false);
  const [constructionMonths, setConstructionMonths] = useState(12);
  const [drawSchedule, setDrawSchedule] = useState([25, 25, 25, 25]);

  const updateInput = <K extends keyof BuyHoldInputs>(key: K, value: BuyHoldInputs[K]) => {
    onChange({ ...inputs, [key]: value });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Property Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CurrencyInput id="purchasePrice" label="Purchase Price / Build Cost" value={inputs.purchasePrice} onChange={(v) => updateInput("purchasePrice", v)} testId="input-purchase-price" />
          <CurrencyInput id="closingCosts" label="Closing Costs" value={inputs.closingCosts} onChange={(v) => updateInput("closingCosts", v)} testId="input-closing-costs" />
          <NumberInput id="numUnits" label="Number of Units" value={numUnits} onChange={setNumUnits} testId="input-num-units" suffix="units" />
          {country === "canada" && inputs.purchasePrice > 0 && (
            <CashbackDisplay
              purchasePrice={inputs.purchasePrice}
              region={region || ""}
              city={city || ""}
              country="canada"
              dealInfo={{ address: address || "", monthlyRent: inputs.monthlyRent, cashFlow: 0, capRate: 0 }}
              defaultValues={defaultLeadInfo}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Hammer className="h-5 w-5" />
            Construction Financing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="constructionFinancing">Construction Financing</Label>
              <p className="text-sm text-muted-foreground">For new builds or major renovations</p>
            </div>
            <Switch id="constructionFinancing" checked={useConstructionFinancing} onCheckedChange={setUseConstructionFinancing} data-testid="switch-construction-financing" />
          </div>
          {useConstructionFinancing && (
            <div className="space-y-4 pt-4 border-t">
              <NumberInput id="constructionMonths" label="Construction Timeline" value={constructionMonths} onChange={setConstructionMonths} testId="input-construction-months" suffix="months" />
              <PercentInput id="constructionRate" label="Construction Loan Rate" value={inputs.interestRate + 2} onChange={() => {}} testId="slider-construction-rate" min={6} max={20} step={0.25} />
              <div className="space-y-2">
                <Label>Draw Schedule (%)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {drawSchedule.map((draw, i) => (
                    <div key={i} className="space-y-1">
                      <span className="text-xs text-muted-foreground">Draw {i + 1}</span>
                      <Input
                        type="number"
                        value={draw}
                        onChange={(e) => {
                          const newSchedule = [...drawSchedule];
                          newSchedule[i] = parseInt(e.target.value) || 0;
                          setDrawSchedule(newSchedule);
                        }}
                        className="h-10 font-mono text-center"
                        data-testid={`input-draw-${i}`}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Total: {drawSchedule.reduce((a, b) => a + b, 0)}%</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Permanent Financing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <PercentInput id="downPayment" label="Down Payment" value={inputs.downPaymentPercent} onChange={(v) => updateInput("downPaymentPercent", v)} testId="slider-down-payment" min={5} max={100} step={1} />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label htmlFor="interestRate">Interest Rate</Label>
              <MortgageConsultationButton
                purchasePrice={inputs.purchasePrice}
                downPaymentPercent={inputs.downPaymentPercent}
                interestRate={inputs.interestRate}
                region={region}
                city={city}
                address={address}
                defaultValues={defaultLeadInfo}
              />
            </div>
            <PercentInput id="interestRate" label="" value={inputs.interestRate} onChange={(v) => updateInput("interestRate", v)} testId="slider-interest-rate" min={0} max={15} step={0.1} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amortization">Amortization (Years)</Label>
              <Input id="amortization" type="number" value={inputs.amortizationYears} onChange={(e) => updateInput("amortizationYears", parseInt(e.target.value) || 25)} className="h-12 font-mono" data-testid="input-amortization" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="term">Term (Years)</Label>
              <Input id="term" type="number" value={inputs.loanTermYears} onChange={(e) => updateInput("loanTermYears", parseInt(e.target.value) || 5)} className="h-12 font-mono" data-testid="input-term" />
            </div>
          </div>
          {country === "canada" && numUnits >= 5 && (
            <div className="pt-4 border-t border-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>CMHC MLI Select</Label>
                  <p className="text-sm text-muted-foreground">Calculate points for 5+ unit properties</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const mliButton = document.querySelector('[data-testid="button-calculator-mli_select"]') as HTMLButtonElement;
                    if (mliButton) mliButton.click();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  data-testid="button-open-mli-calculator-multiplex"
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  MLI Calculator
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="h-fit">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Income
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CurrencyInput id="monthlyRent" label={`Total Monthly Rent (${numUnits} units)`} value={inputs.monthlyRent} onChange={(v) => updateInput("monthlyRent", v)} testId="input-monthly-rent" />
            <div className="p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">Average rent per unit: ${Math.round(inputs.monthlyRent / numUnits).toLocaleString()}/mo</span>
            </div>
            <PercentInput id="vacancy" label="Vacancy Rate" value={inputs.vacancyPercent} onChange={(v) => updateInput("vacancyPercent", v)} testId="slider-vacancy" min={0} max={20} step={0.5} />
            <PercentInput id="rentGrowthIncome" label="Annual Rent Growth" value={inputs.rentGrowthPercent} onChange={(v) => updateInput("rentGrowthPercent", v)} testId="slider-rent-growth-income" min={-5} max={10} step={0.5} />
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Operating Expenses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CurrencyInput id="propertyTax" label="Annual Property Tax" value={inputs.propertyTax} onChange={(v) => updateInput("propertyTax", v)} testId="input-property-tax" />
            <CurrencyInput id="insurance" label="Annual Insurance" value={inputs.insurance} onChange={(v) => updateInput("insurance", v)} testId="input-insurance" />
            <CurrencyInput id="utilities" label="Monthly Utilities (common areas)" value={inputs.utilities} onChange={(v) => updateInput("utilities", v)} testId="input-utilities" />
            <PercentInput id="maintenance" label="Maintenance (% of Rent)" value={inputs.maintenancePercent} onChange={(v) => updateInput("maintenancePercent", v)} testId="slider-maintenance" min={0} max={15} step={0.5} />
            <PercentInput id="capex" label="CapEx Reserve (% of Rent)" value={inputs.capexReservePercent} onChange={(v) => updateInput("capexReservePercent", v)} testId="slider-capex" min={0} max={15} step={0.5} />
            <PercentInput id="management" label="Property Management (% of Rent)" value={inputs.managementPercent} onChange={(v) => updateInput("managementPercent", v)} testId="slider-management" min={0} max={15} step={0.5} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function DealInputs({ inputs, onChange, country, strategy, region, city, address, defaultLeadInfo }: DealInputsProps) {
  const cashbackProps = { region, city, address, defaultLeadInfo, country };
  
  switch (strategy) {
    case "flip":
      return <FlipInputs inputs={inputs} onChange={onChange} {...cashbackProps} />;
    case "brrr":
      return <BRRRInputs inputs={inputs} onChange={onChange} {...cashbackProps} />;
    case "airbnb":
      return <AirbnbInputs inputs={inputs} onChange={onChange} {...cashbackProps} />;
    case "multiplex":
      return <MultiplexInputs inputs={inputs} onChange={onChange} {...cashbackProps} />;
    case "buy_hold":
    default:
      return <BuyHoldInputs inputs={inputs} onChange={onChange} {...cashbackProps} />;
  }
}
