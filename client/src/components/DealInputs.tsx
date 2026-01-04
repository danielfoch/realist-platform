import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, DollarSign, Percent, Home, Wallet, Settings } from "lucide-react";
import { useState } from "react";
import type { BuyHoldInputs } from "@shared/schema";

interface DealInputsProps {
  inputs: BuyHoldInputs;
  onChange: (inputs: BuyHoldInputs) => void;
  country: "canada" | "usa";
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

export function DealInputs({ inputs, onChange, country }: DealInputsProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const updateInput = <K extends keyof BuyHoldInputs>(
    key: K,
    value: BuyHoldInputs[K]
  ) => {
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
          <CurrencyInput
            id="purchasePrice"
            label="Purchase Price"
            value={inputs.purchasePrice}
            onChange={(v) => updateInput("purchasePrice", v)}
            testId="input-purchase-price"
          />
          <CurrencyInput
            id="closingCosts"
            label="Closing Costs"
            value={inputs.closingCosts}
            onChange={(v) => updateInput("closingCosts", v)}
            testId="input-closing-costs"
          />
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
          <PercentInput
            id="downPayment"
            label="Down Payment"
            value={inputs.downPaymentPercent}
            onChange={(v) => updateInput("downPaymentPercent", v)}
            testId="slider-down-payment"
            min={5}
            max={100}
            step={1}
          />
          <PercentInput
            id="interestRate"
            label="Interest Rate"
            value={inputs.interestRate}
            onChange={(v) => updateInput("interestRate", v)}
            testId="slider-interest-rate"
            min={0}
            max={15}
            step={0.1}
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amortization">Amortization (Years)</Label>
              <Input
                id="amortization"
                type="number"
                value={inputs.amortizationYears}
                onChange={(e) => updateInput("amortizationYears", parseInt(e.target.value) || 25)}
                className="h-12 font-mono"
                data-testid="input-amortization"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="term">Term (Years)</Label>
              <Input
                id="term"
                type="number"
                value={inputs.loanTermYears}
                onChange={(e) => updateInput("loanTermYears", parseInt(e.target.value) || 5)}
                className="h-12 font-mono"
                data-testid="input-term"
              />
            </div>
          </div>

          {country === "canada" && (
            <div className="pt-4 border-t border-border space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="cmhc">CMHC MLI Select</Label>
                  <p className="text-sm text-muted-foreground">Enable for 5+ unit properties</p>
                </div>
                <Switch
                  id="cmhc"
                  checked={inputs.isCmhcMliSelect}
                  onCheckedChange={(v) => updateInput("isCmhcMliSelect", v)}
                  data-testid="switch-cmhc"
                />
              </div>
              {inputs.isCmhcMliSelect && (
                <PercentInput
                  id="cmhcPoints"
                  label="MLI Select Points"
                  value={inputs.cmhcMliPoints}
                  onChange={(v) => updateInput("cmhcMliPoints", v)}
                  testId="slider-cmhc-points"
                  min={0}
                  max={100}
                  step={5}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Income
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CurrencyInput
            id="monthlyRent"
            label="Monthly Rent"
            value={inputs.monthlyRent}
            onChange={(v) => updateInput("monthlyRent", v)}
            testId="input-monthly-rent"
          />
          <PercentInput
            id="vacancy"
            label="Vacancy Rate"
            value={inputs.vacancyPercent}
            onChange={(v) => updateInput("vacancyPercent", v)}
            testId="slider-vacancy"
            min={0}
            max={20}
            step={0.5}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Operating Expenses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CurrencyInput
            id="propertyTax"
            label="Annual Property Tax"
            value={inputs.propertyTax}
            onChange={(v) => updateInput("propertyTax", v)}
            testId="input-property-tax"
          />
          <CurrencyInput
            id="insurance"
            label="Annual Insurance"
            value={inputs.insurance}
            onChange={(v) => updateInput("insurance", v)}
            testId="input-insurance"
          />
          <CurrencyInput
            id="utilities"
            label="Monthly Utilities"
            value={inputs.utilities}
            onChange={(v) => updateInput("utilities", v)}
            testId="input-utilities"
          />
          <PercentInput
            id="maintenance"
            label="Maintenance (% of Rent)"
            value={inputs.maintenancePercent}
            onChange={(v) => updateInput("maintenancePercent", v)}
            testId="slider-maintenance"
            min={0}
            max={15}
            step={0.5}
          />
          <PercentInput
            id="management"
            label="Property Management (% of Rent)"
            value={inputs.managementPercent}
            onChange={(v) => updateInput("managementPercent", v)}
            testId="slider-management"
            min={0}
            max={15}
            step={0.5}
          />
          <PercentInput
            id="capex"
            label="CapEx Reserve (% of Rent)"
            value={inputs.capexReservePercent}
            onChange={(v) => updateInput("capexReservePercent", v)}
            testId="slider-capex"
            min={0}
            max={15}
            step={0.5}
          />
        </CardContent>
      </Card>

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
              <PercentInput
                id="rentGrowth"
                label="Annual Rent Growth"
                value={inputs.rentGrowthPercent}
                onChange={(v) => updateInput("rentGrowthPercent", v)}
                testId="slider-rent-growth"
                min={-5}
                max={10}
                step={0.5}
              />
              <PercentInput
                id="expenseInflation"
                label="Expense Inflation"
                value={inputs.expenseInflationPercent}
                onChange={(v) => updateInput("expenseInflationPercent", v)}
                testId="slider-expense-inflation"
                min={0}
                max={10}
                step={0.5}
              />
              <PercentInput
                id="appreciation"
                label="Property Appreciation"
                value={inputs.appreciationPercent}
                onChange={(v) => updateInput("appreciationPercent", v)}
                testId="slider-appreciation"
                min={-5}
                max={15}
                step={0.5}
              />
              <div className="space-y-2">
                <Label htmlFor="holdingPeriod">Holding Period (Years)</Label>
                <Input
                  id="holdingPeriod"
                  type="number"
                  value={inputs.holdingPeriodYears}
                  onChange={(e) => updateInput("holdingPeriodYears", parseInt(e.target.value) || 10)}
                  className="h-12 font-mono"
                  data-testid="input-holding-period"
                />
              </div>
              <PercentInput
                id="sellingCosts"
                label="Selling Costs"
                value={inputs.sellingCostsPercent}
                onChange={(v) => updateInput("sellingCostsPercent", v)}
                testId="slider-selling-costs"
                min={0}
                max={10}
                step={0.5}
              />
              <CurrencyInput
                id="otherExpenses"
                label="Other Monthly Expenses"
                value={inputs.otherExpenses}
                onChange={(v) => updateInput("otherExpenses", v)}
                testId="input-other-expenses"
              />
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
