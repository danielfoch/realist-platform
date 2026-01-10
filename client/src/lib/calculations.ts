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
