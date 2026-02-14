export interface InvestmentMetricInput {
  listPrice: number;
  monthlyRent: number;
  maintenanceFee?: number;
  /**
   * NOI ratio - percentage of rent that becomes net operating income
   * Default: 0.6 (60%) = 40% operating expenses
   * This accounts for: property management, maintenance, vacancy, insurance, taxes, utilities
   */
  noiRatio?: number;
  downPaymentRatio?: number;
  annualInterestRate?: number;
  amortizationYears?: number;
}

export interface InvestmentMetricOutput {
  estimated_monthly_rent: number;
  cap_rate: number;
  gross_yield: number;
  cash_flow_monthly: number;
}

function round2(value: number): number {
  return Number.parseFloat(value.toFixed(2));
}

export function calculateInvestmentMetrics(input: InvestmentMetricInput): InvestmentMetricOutput {
  const {
    listPrice,
    monthlyRent,
    maintenanceFee = 0,
    // NOI ratio - default 0.6 means 60% of rent = NOI, 40% = expenses
    noiRatio = 0.6,
    downPaymentRatio = 0.2,
    annualInterestRate = 0.05,
    amortizationYears = 25,
  } = input;

  if (listPrice <= 0 || monthlyRent <= 0) {
    throw new Error('listPrice and monthlyRent must be greater than 0');
  }

  const annualRent = monthlyRent * 12;
  // NOI = Annual Rent × NOI Ratio
  const noi = annualRent * noiRatio;
  // Operating expenses = Annual Rent - NOI
  const annualExpenses = annualRent - noi;
  const annualMaintenanceFee = maintenanceFee * 12;
  const totalExpenses = annualExpenses + annualMaintenanceFee;

  const capRate = (noi / listPrice) * 100;
  const grossYield = (annualRent / listPrice) * 100;

  const downPayment = listPrice * downPaymentRatio;
  const loanAmount = listPrice - downPayment;
  const monthlyInterestRate = annualInterestRate / 12;
  const paymentCount = amortizationYears * 12;

  const monthlyMortgage =
    (loanAmount * (monthlyInterestRate * (1 + monthlyInterestRate) ** paymentCount)) /
    ((1 + monthlyInterestRate) ** paymentCount - 1);

  const monthlyExpenses = totalExpenses / 12 + monthlyMortgage;
  const cashFlow = monthlyRent - monthlyExpenses;

  return {
    estimated_monthly_rent: round2(monthlyRent),
    cap_rate: round2(capRate),
    gross_yield: round2(grossYield),
    cash_flow_monthly: round2(cashFlow),
  };
}
