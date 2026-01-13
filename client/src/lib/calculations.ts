import type { BuyHoldInputs, AnalysisResults } from "@shared/schema";

export function calculateMonthlyMortgagePayment(
  principal: number,
  annualRate: number,
  years: number
): number {
  if (principal <= 0 || years <= 0) return 0;
  if (annualRate <= 0) return principal / (years * 12);
  
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = years * 12;
  
  const payment =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  return payment;
}

export function calculateLoanBalance(
  principal: number,
  annualRate: number,
  amortizationYears: number,
  monthsElapsed: number
): number {
  if (principal <= 0 || monthsElapsed <= 0) return principal;
  if (annualRate <= 0) {
    const monthlyPayment = principal / (amortizationYears * 12);
    return Math.max(0, principal - monthlyPayment * monthsElapsed);
  }
  
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = amortizationYears * 12;
  const monthlyPayment = calculateMonthlyMortgagePayment(principal, annualRate, amortizationYears);
  
  const balance =
    principal * Math.pow(1 + monthlyRate, monthsElapsed) -
    monthlyPayment * ((Math.pow(1 + monthlyRate, monthsElapsed) - 1) / monthlyRate);
  
  return Math.max(0, balance);
}

export function calculateIRR(cashFlows: number[], maxIterations = 100, tolerance = 0.0001): number | null {
  if (cashFlows.length < 2) return null;
  
  let low = -0.99;
  let high = 10;
  
  const npv = (rate: number): number => {
    return cashFlows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + rate, i), 0);
  };
  
  if (npv(low) * npv(high) > 0) return null;
  
  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const npvMid = npv(mid);
    
    if (Math.abs(npvMid) < tolerance) {
      return mid * 100;
    }
    
    if (npv(low) * npvMid < 0) {
      high = mid;
    } else {
      low = mid;
    }
  }
  
  return ((low + high) / 2) * 100;
}

export function calculateBuyHoldAnalysis(inputs: BuyHoldInputs): AnalysisResults {
  const {
    purchasePrice,
    closingCosts,
    downPaymentPercent,
    interestRate,
    amortizationYears,
    monthlyRent,
    vacancyPercent,
    propertyTax,
    insurance,
    utilities,
    maintenancePercent,
    managementPercent,
    capexReservePercent,
    otherExpenses,
    rentGrowthPercent,
    expenseInflationPercent,
    appreciationPercent,
    holdingPeriodYears,
    sellingCostsPercent,
  } = inputs;

  const downPayment = (purchasePrice * downPaymentPercent) / 100;
  const loanAmount = purchasePrice - downPayment;
  const totalCashInvested = downPayment + closingCosts;

  const monthlyMortgagePayment = calculateMonthlyMortgagePayment(
    loanAmount,
    interestRate,
    amortizationYears
  );

  const grossMonthlyIncome = monthlyRent;
  const vacancyLoss = (monthlyRent * vacancyPercent) / 100;
  const effectiveMonthlyIncome = grossMonthlyIncome - vacancyLoss;

  const maintenanceExpense = (monthlyRent * maintenancePercent) / 100;
  const managementExpense = (monthlyRent * managementPercent) / 100;
  const capexExpense = (monthlyRent * capexReservePercent) / 100;

  const monthlyExpenses =
    propertyTax / 12 +
    insurance / 12 +
    utilities +
    maintenanceExpense +
    managementExpense +
    capexExpense +
    otherExpenses;

  const monthlyNoi = effectiveMonthlyIncome - monthlyExpenses;
  const annualNoi = monthlyNoi * 12;

  const monthlyCashFlow = monthlyNoi - monthlyMortgagePayment;
  const annualCashFlow = monthlyCashFlow * 12;

  const capRate = purchasePrice > 0 ? (annualNoi / purchasePrice) * 100 : 0;
  const cashOnCash = totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;
  const annualDebtService = monthlyMortgagePayment * 12;
  const dscr = annualDebtService > 0 ? annualNoi / annualDebtService : annualNoi > 0 ? Infinity : 0;

  const yearlyProjections: AnalysisResults["yearlyProjections"] = [];
  const cashFlows: number[] = [-totalCashInvested];
  let cumulativeCashFlow = 0;

  let previousLoanBalance = loanAmount;
  let cumulativePrincipalPaid = 0;

  const projectionYears = Math.max(holdingPeriodYears, 10);
  
  for (let year = 1; year <= projectionYears; year++) {
    const rentMultiplier = Math.pow(1 + rentGrowthPercent / 100, year - 1);
    const expenseMultiplier = Math.pow(1 + expenseInflationPercent / 100, year - 1);
    const propertyMultiplier = Math.pow(1 + appreciationPercent / 100, year);

    const yearlyRent = monthlyRent * 12 * rentMultiplier;
    const yearlyVacancy = (yearlyRent * vacancyPercent) / 100;
    const yearlyEffectiveIncome = yearlyRent - yearlyVacancy;

    const yearPropertyTax = propertyTax * expenseMultiplier;
    const yearInsurance = insurance * expenseMultiplier;
    const yearUtilities = utilities * 12 * expenseMultiplier;
    const yearMaintenance = (yearlyRent * maintenancePercent) / 100;
    const yearManagement = (yearlyRent * managementPercent) / 100;
    const yearCapex = (yearlyRent * capexReservePercent) / 100;
    const yearOther = otherExpenses * 12 * expenseMultiplier;
    const yearlyExpenses = yearPropertyTax + yearInsurance + yearUtilities + yearMaintenance + yearManagement + yearCapex + yearOther;

    const yearlyNoi = yearlyEffectiveIncome - yearlyExpenses;
    const yearlyCashFlow = yearlyNoi - annualDebtService;
    cumulativeCashFlow += yearlyCashFlow;

    const monthsElapsed = year * 12;
    const loanBalance = calculateLoanBalance(loanAmount, interestRate, amortizationYears, monthsElapsed);
    const principalPaidThisYear = previousLoanBalance - loanBalance;
    cumulativePrincipalPaid += principalPaidThisYear;
    previousLoanBalance = loanBalance;

    const propertyValue = purchasePrice * propertyMultiplier;
    const capitalAppreciation = propertyValue - purchasePrice;
    const equity = propertyValue - loanBalance;

    yearlyProjections.push({
      year,
      grossRent: yearlyRent,
      vacancyLoss: yearlyVacancy,
      effectiveIncome: yearlyEffectiveIncome,
      expenses: {
        propertyTax: yearPropertyTax,
        insurance: yearInsurance,
        utilities: yearUtilities,
        maintenance: yearMaintenance,
        management: yearManagement,
        capexReserve: yearCapex,
        other: yearOther,
        total: yearlyExpenses,
      },
      noi: yearlyNoi,
      debtService: annualDebtService,
      cashFlow: yearlyCashFlow,
      propertyValue,
      loanBalance,
      equity,
      cumulativeCashFlow,
      principalPaidThisYear,
      cumulativePrincipalPaid,
      capitalAppreciation,
      totalReturn: cumulativeCashFlow + cumulativePrincipalPaid + capitalAppreciation,
    });

    if (year <= holdingPeriodYears) {
      if (year === holdingPeriodYears) {
        const sellingCosts = (propertyValue * sellingCostsPercent) / 100;
        const saleProceeds = propertyValue - loanBalance - sellingCosts;
        cashFlows.push(yearlyCashFlow + saleProceeds);
      } else {
        cashFlows.push(yearlyCashFlow);
      }
    }
  }

  const irr = calculateIRR(cashFlows);

  return {
    capRate,
    cashOnCash,
    dscr,
    irr,
    monthlyNoi,
    monthlyCashFlow,
    annualNoi,
    annualCashFlow,
    totalCashInvested,
    loanAmount,
    monthlyMortgagePayment,
    grossMonthlyIncome,
    effectiveMonthlyIncome,
    monthlyExpenses,
    yearlyProjections,
    expenseBreakdown: {
      propertyTax: propertyTax / 12,
      insurance: insurance / 12,
      utilities,
      maintenance: maintenanceExpense,
      management: managementExpense,
      capexReserve: capexExpense,
      other: otherExpenses,
    },
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number, decimals = 2): string {
  return value.toFixed(decimals);
}

// Stress Test Configuration
export const STRESS_TEST_CONFIG = {
  bear: {
    label: "Bear Case",
    description: "Conservative scenario with higher vacancy, lower rents, higher expenses",
    rentChange: -0.05,      // -5% rent
    vacancyChange: 0.03,    // +3% vacancy
    expenseChange: 0.05,    // +5% expenses
    rateChange: 0.01,       // +100bps rate
  },
  bull: {
    label: "Bull Case",
    description: "Optimistic scenario with lower vacancy, higher rents, lower expenses",
    rentChange: 0.03,       // +3% rent
    vacancyChange: -0.01,   // -1% vacancy
    expenseChange: -0.02,   // -2% expenses
    rateChange: -0.005,     // -50bps rate
  },
};

export interface StressTestScenario {
  label: string;
  description: string;
  capRate: number;
  cashOnCash: number;
  dscr: number;
  annualCashFlow: number;
  annualNoi: number;
  monthlyRent: number;
  vacancyPercent: number;
  expenseRatio: number;
  interestRate: number;
}

export interface StressTestResults {
  base: StressTestScenario;
  bear: StressTestScenario;
  bull: StressTestScenario;
}

export function calculateStressTest(inputs: BuyHoldInputs): StressTestResults {
  const calculateScenario = (
    rentMod: number = 0,
    vacancyMod: number = 0,
    expenseMod: number = 0,
    rateMod: number = 0,
    label: string = "Base Case",
    description: string = "Current assumptions"
  ): StressTestScenario => {
    const adjustedRent = inputs.monthlyRent * (1 + rentMod);
    const adjustedVacancy = Math.max(0, Math.min(50, inputs.vacancyPercent + (vacancyMod * 100)));
    const adjustedRate = Math.max(0.1, inputs.interestRate + (rateMod * 100));
    
    // Calculate expense ratio from base inputs for adjustment
    const baseAnnualRent = inputs.monthlyRent * 12;
    const baseAnnualExpenses = inputs.propertyTax + inputs.insurance + (inputs.utilities * 12) +
      (baseAnnualRent * inputs.maintenancePercent / 100) +
      (baseAnnualRent * inputs.managementPercent / 100) +
      (baseAnnualRent * inputs.capexReservePercent / 100) +
      (inputs.otherExpenses * 12);
    const baseExpenseRatio = baseAnnualRent > 0 ? baseAnnualExpenses / baseAnnualRent : 0;
    const adjustedExpenseRatio = baseExpenseRatio * (1 + expenseMod);
    
    // Create adjusted inputs - scale ALL expense components
    const adjustedInputs: BuyHoldInputs = {
      ...inputs,
      monthlyRent: adjustedRent,
      vacancyPercent: adjustedVacancy,
      interestRate: adjustedRate,
      // Adjust fixed dollar expenses
      propertyTax: inputs.propertyTax * (1 + expenseMod),
      insurance: inputs.insurance * (1 + expenseMod),
      utilities: inputs.utilities * (1 + expenseMod),
      otherExpenses: inputs.otherExpenses * (1 + expenseMod),
      // Adjust percentage-based expenses
      maintenancePercent: inputs.maintenancePercent * (1 + expenseMod),
      managementPercent: inputs.managementPercent * (1 + expenseMod),
      capexReservePercent: inputs.capexReservePercent * (1 + expenseMod),
    };
    
    const result = calculateBuyHoldAnalysis(adjustedInputs);
    
    return {
      label,
      description,
      capRate: result.capRate,
      cashOnCash: result.cashOnCash,
      dscr: result.dscr,
      annualCashFlow: result.annualCashFlow,
      annualNoi: result.annualNoi,
      monthlyRent: adjustedRent,
      vacancyPercent: adjustedVacancy,
      expenseRatio: adjustedExpenseRatio * 100,
      interestRate: adjustedRate,
    };
  };
  
  return {
    base: calculateScenario(0, 0, 0, 0, "Base Case", "Current assumptions"),
    bear: calculateScenario(
      STRESS_TEST_CONFIG.bear.rentChange,
      STRESS_TEST_CONFIG.bear.vacancyChange,
      STRESS_TEST_CONFIG.bear.expenseChange,
      STRESS_TEST_CONFIG.bear.rateChange,
      STRESS_TEST_CONFIG.bear.label,
      STRESS_TEST_CONFIG.bear.description
    ),
    bull: calculateScenario(
      STRESS_TEST_CONFIG.bull.rentChange,
      STRESS_TEST_CONFIG.bull.vacancyChange,
      STRESS_TEST_CONFIG.bull.expenseChange,
      STRESS_TEST_CONFIG.bull.rateChange,
      STRESS_TEST_CONFIG.bull.label,
      STRESS_TEST_CONFIG.bull.description
    ),
  };
}
