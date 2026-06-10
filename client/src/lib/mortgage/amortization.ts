export interface AmortizationInput {
  principal: number;
  annualRate: number;
  amortizationYears: number;
  paymentsPerYear?: number;
}

export interface YearlyRow {
  year: number;
  startingBalance: number;
  payment: number;
  interestPaid: number;
  principalPaid: number;
  endingBalance: number;
  avgRate: number;
}

export interface AmortizationResult {
  monthlyPayment: number;
  totalPaid: number;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  endingBalance: number;
  yearlyRows: YearlyRow[];
}

export interface VariableAmortizationInput {
  principal: number;
  monthlyRates: number[];
  amortizationYears: number;
}

export interface ScenarioConfig {
  baseVariableRate: number;
  severityBps: number;
  direction: "rising" | "falling";
  speed: "front-loaded" | "even" | "back-loaded";
  horizonMonths?: number;
}

export function computeMonthlyPayment(
  principal: number,
  annualRate: number,
  totalPayments: number
): number {
  if (annualRate <= 0) return principal / totalPayments;
  const monthlyRate = annualRate / 100 / 12;
  return (
    (principal * monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) /
    (Math.pow(1 + monthlyRate, totalPayments) - 1)
  );
}

export function computeFixedAmortization(
  input: AmortizationInput,
  horizonYears: number
): AmortizationResult {
  const { principal, annualRate, amortizationYears } = input;
  const totalPayments = amortizationYears * 12;
  const monthlyPayment = computeMonthlyPayment(principal, annualRate, totalPayments);
  const monthlyRate = annualRate / 100 / 12;

  let balance = principal;
  let totalInterest = 0;
  let totalPrincipal = 0;
  const yearlyRows: YearlyRow[] = [];

  const months = Math.min(horizonYears * 12, totalPayments);

  for (let year = 1; year <= Math.min(horizonYears, amortizationYears); year++) {
    const startBalance = balance;
    let yearInterest = 0;
    let yearPrincipal = 0;
    let yearPayment = 0;

    for (let m = 0; m < 12; m++) {
      const monthIndex = (year - 1) * 12 + m;
      if (monthIndex >= months) break;
      if (balance <= 0) break;

      const interest = balance * monthlyRate;
      const principalPart = Math.min(monthlyPayment - interest, balance);
      balance = Math.max(0, balance - principalPart);

      yearInterest += interest;
      yearPrincipal += principalPart;
      yearPayment += monthlyPayment;
    }

    totalInterest += yearInterest;
    totalPrincipal += yearPrincipal;

    yearlyRows.push({
      year,
      startingBalance: Math.round(startBalance * 100) / 100,
      payment: Math.round(yearPayment * 100) / 100,
      interestPaid: Math.round(yearInterest * 100) / 100,
      principalPaid: Math.round(yearPrincipal * 100) / 100,
      endingBalance: Math.round(balance * 100) / 100,
      avgRate: annualRate,
    });
  }

  return {
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    totalPaid: Math.round((totalInterest + totalPrincipal) * 100) / 100,
    totalInterestPaid: Math.round(totalInterest * 100) / 100,
    totalPrincipalPaid: Math.round(totalPrincipal * 100) / 100,
    endingBalance: Math.round(balance * 100) / 100,
    yearlyRows,
  };
}

export function computeVariableAmortization(
  input: VariableAmortizationInput,
  horizonYears: number
): AmortizationResult {
  const { principal, monthlyRates, amortizationYears } = input;
  const totalPayments = amortizationYears * 12;
  const months = Math.min(horizonYears * 12, totalPayments);

  let balance = principal;
  let totalInterest = 0;
  let totalPrincipal = 0;
  const yearlyRows: YearlyRow[] = [];

  for (let year = 1; year <= Math.min(horizonYears, amortizationYears); year++) {
    const startBalance = balance;
    let yearInterest = 0;
    let yearPrincipal = 0;
    let yearPayment = 0;
    let rateSum = 0;
    let rateCount = 0;

    for (let m = 0; m < 12; m++) {
      const monthIndex = (year - 1) * 12 + m;
      if (monthIndex >= months) break;
      if (balance <= 0) break;

      const annualRate = monthlyRates[Math.min(monthIndex, monthlyRates.length - 1)];
      const monthlyRate = annualRate / 100 / 12;
      const remainingPayments = totalPayments - monthIndex;
      const payment = computeMonthlyPayment(balance, annualRate, remainingPayments);

      const interest = balance * monthlyRate;
      const principalPart = Math.min(payment - interest, balance);
      balance = Math.max(0, balance - principalPart);

      yearInterest += interest;
      yearPrincipal += principalPart;
      yearPayment += payment;
      rateSum += annualRate;
      rateCount++;
    }

    totalInterest += yearInterest;
    totalPrincipal += yearPrincipal;

    yearlyRows.push({
      year,
      startingBalance: Math.round(startBalance * 100) / 100,
      payment: Math.round(yearPayment * 100) / 100,
      interestPaid: Math.round(yearInterest * 100) / 100,
      principalPaid: Math.round(yearPrincipal * 100) / 100,
      endingBalance: Math.round(balance * 100) / 100,
      avgRate: rateCount > 0 ? Math.round((rateSum / rateCount) * 100) / 100 : 0,
    });
  }

  const initialPayment = computeMonthlyPayment(
    principal,
    monthlyRates[0] || 0,
    totalPayments
  );

  return {
    monthlyPayment: Math.round(initialPayment * 100) / 100,
    totalPaid: Math.round((totalInterest + totalPrincipal) * 100) / 100,
    totalInterestPaid: Math.round(totalInterest * 100) / 100,
    totalPrincipalPaid: Math.round(totalPrincipal * 100) / 100,
    endingBalance: Math.round(balance * 100) / 100,
    yearlyRows,
  };
}

export function generateRatePath(config: ScenarioConfig): number[] {
  const { baseVariableRate, severityBps, direction, speed, horizonMonths = 300 } = config;
  const deltaPercent = severityBps / 100;
  const signedDelta = direction === "rising" ? deltaPercent : -deltaPercent;
  const rampMonths = 60;
  const path: number[] = [];

  for (let m = 0; m < horizonMonths; m++) {
    let fraction: number;
    if (m >= rampMonths) {
      fraction = 1.0;
    } else {
      const t = m / rampMonths;
      if (speed === "front-loaded") {
        fraction = 1 - Math.pow(1 - t, 2);
      } else if (speed === "back-loaded") {
        fraction = Math.pow(t, 2);
      } else {
        fraction = t;
      }
    }
    const rate = Math.max(0.25, baseVariableRate + signedDelta * fraction);
    path.push(Math.round(rate * 100) / 100);
  }

  return path;
}

export function generateConstantPath(rate: number, months: number = 300): number[] {
  return new Array(months).fill(rate);
}

export interface ScenarioResults {
  fixed: { y5: AmortizationResult; y10: AmortizationResult; y25: AmortizationResult };
  variableBase: { y5: AmortizationResult; y10: AmortizationResult; y25: AmortizationResult };
  variableBest: { y5: AmortizationResult; y10: AmortizationResult; y25: AmortizationResult };
  variableWorst: { y5: AmortizationResult; y10: AmortizationResult; y25: AmortizationResult };
}

export function computeAllScenarios(
  principal: number,
  amortizationYears: number,
  fixedRate: number,
  variableRate: number,
  severityBps: number,
  speed: "front-loaded" | "even" | "back-loaded",
  basePath?: number[],
  direction: "rising" | "falling" = "rising"
): ScenarioResults {
  const fixedInput: AmortizationInput = { principal, annualRate: fixedRate, amortizationYears };

  const baseMonthlyRates = basePath || generateConstantPath(variableRate);

  const worstDirection = direction;
  const bestDirection = direction === "rising" ? "falling" : "rising";

  const bestPath = generateRatePath({
    baseVariableRate: variableRate,
    severityBps,
    direction: bestDirection,
    speed,
  });

  const worstPath = generateRatePath({
    baseVariableRate: variableRate,
    severityBps,
    direction: worstDirection,
    speed,
  });

  const varBase: VariableAmortizationInput = { principal, monthlyRates: baseMonthlyRates, amortizationYears };
  const varBest: VariableAmortizationInput = { principal, monthlyRates: bestPath, amortizationYears };
  const varWorst: VariableAmortizationInput = { principal, monthlyRates: worstPath, amortizationYears };

  return {
    fixed: {
      y5: computeFixedAmortization(fixedInput, 5),
      y10: computeFixedAmortization(fixedInput, 10),
      y25: computeFixedAmortization(fixedInput, 25),
    },
    variableBase: {
      y5: computeVariableAmortization(varBase, 5),
      y10: computeVariableAmortization(varBase, 10),
      y25: computeVariableAmortization(varBase, 25),
    },
    variableBest: {
      y5: computeVariableAmortization(varBest, 5),
      y10: computeVariableAmortization(varBest, 10),
      y25: computeVariableAmortization(varBest, 25),
    },
    variableWorst: {
      y5: computeVariableAmortization(varWorst, 5),
      y10: computeVariableAmortization(varWorst, 10),
      y25: computeVariableAmortization(varWorst, 25),
    },
  };
}

export function computeBreakevenSpread(
  principal: number,
  fixedRate: number,
  amortizationYears: number,
  horizonYears: number
): number {
  const fixedResult = computeFixedAmortization(
    { principal, annualRate: fixedRate, amortizationYears },
    horizonYears
  );
  const targetInterest = fixedResult.totalInterestPaid;

  let lo = 0;
  let hi = fixedRate;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const result = computeVariableAmortization(
      { principal, monthlyRates: generateConstantPath(mid), amortizationYears },
      horizonYears
    );
    if (result.totalInterestPaid < targetInterest) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return Math.round((lo + hi) / 2 * 100) / 100;
}
