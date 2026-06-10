export interface RentVsBuyInputs {
  timeHorizonYears: number;
  inflationRate: number;
  currentMonthlyRent: number;
  annualRentIncrease: number;
  rentersInsuranceMonthly: number;
  upfrontRenterCosts: number;
  homePurchasePrice: number;
  downPayment: number;
  mortgageInterestRate: number;
  amortizationYears: number;
  mortgageTermYears: number;
  propertyTaxPercent: number;
  homeInsuranceMonthly: number;
  maintenancePercent: number;
  condoFeesMonthly: number;
  capexReservePercent: number;
  closingCostsPercent: number;
  sellingCostsPercent: number;
  homePriceGrowthPercent: number;
  investmentReturnPercent: number;
  investMonthlyDifference: boolean;
  country: "canada" | "usa";
}

export interface MonthlyData {
  month: number;
  rentNetWorth: number;
  buyNetWorth: number;
  rentMonthlyOutflow: number;
  buyMonthlyOutflow: number;
  homeValue: number;
  mortgageBalance: number;
  homeEquity: number;
  investmentBalance: number;
  rentPaid: number;
  principalPaid: number;
  interestPaid: number;
}

export interface RentVsBuyResults {
  rentNetWorthFinal: number;
  buyNetWorthFinal: number;
  netWorthDifference: number;
  breakEvenMonth: number | null;
  totalRentPaid: number;
  totalUnrecoverableCosts: number;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  endingHomeValue: number;
  endingMortgageBalance: number;
  monthlyData: MonthlyData[];
  recommendation: "rent" | "buy" | "neutral";
}

export const defaultRentVsBuyInputs: RentVsBuyInputs = {
  timeHorizonYears: 7,
  inflationRate: 2,
  currentMonthlyRent: 2800,
  annualRentIncrease: 3,
  rentersInsuranceMonthly: 30,
  upfrontRenterCosts: 0,
  homePurchasePrice: 750000,
  downPayment: 150000,
  mortgageInterestRate: 4.75,
  amortizationYears: 25,
  mortgageTermYears: 5,
  propertyTaxPercent: 0.8,
  homeInsuranceMonthly: 120,
  maintenancePercent: 1.0,
  condoFeesMonthly: 0,
  capexReservePercent: 0.5,
  closingCostsPercent: 1.5,
  sellingCostsPercent: 5.0,
  homePriceGrowthPercent: 3.0,
  investmentReturnPercent: 7.0,
  investMonthlyDifference: true,
  country: "canada",
};

function calculateMonthlyMortgagePayment(
  principal: number,
  annualRate: number,
  amortizationYears: number
): number {
  if (principal <= 0) return 0;
  if (annualRate <= 0) return principal / (amortizationYears * 12);
  
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = amortizationYears * 12;
  
  return (
    (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  );
}

export function calculateRentVsBuy(inputs: RentVsBuyInputs): RentVsBuyResults {
  const totalMonths = inputs.timeHorizonYears * 12;
  const monthlyData: MonthlyData[] = [];
  
  const mortgagePrincipal = inputs.homePurchasePrice - inputs.downPayment;
  const monthlyMortgagePayment = calculateMonthlyMortgagePayment(
    mortgagePrincipal,
    inputs.mortgageInterestRate,
    inputs.amortizationYears
  );
  
  const closingCosts = inputs.homePurchasePrice * (inputs.closingCostsPercent / 100);
  const monthlyPropertyTax = (inputs.homePurchasePrice * (inputs.propertyTaxPercent / 100)) / 12;
  const monthlyMaintenance = (inputs.homePurchasePrice * (inputs.maintenancePercent / 100)) / 12;
  const monthlyCapex = (inputs.homePurchasePrice * (inputs.capexReservePercent / 100)) / 12;
  
  let mortgageBalance = mortgagePrincipal;
  let homeValue = inputs.homePurchasePrice;
  // Renter invests the down payment + closing costs (what they would have spent), minus any upfront renter costs
  let investmentBalance = inputs.downPayment + closingCosts - inputs.upfrontRenterCosts;
  let currentRent = inputs.currentMonthlyRent;
  
  let totalRentPaid = inputs.upfrontRenterCosts;
  let totalInterestPaid = 0;
  let totalPrincipalPaid = 0;
  let totalUnrecoverableCosts = closingCosts;
  
  const monthlyInvestmentReturn = Math.pow(1 + inputs.investmentReturnPercent / 100, 1/12) - 1;
  const monthlyHomeGrowth = Math.pow(1 + inputs.homePriceGrowthPercent / 100, 1/12) - 1;
  const monthlyRentGrowth = Math.pow(1 + inputs.annualRentIncrease / 100, 1/12) - 1;
  
  let breakEvenMonth: number | null = null;
  
  for (let month = 1; month <= totalMonths; month++) {
    if (month > 1) {
      currentRent *= (1 + monthlyRentGrowth);
      homeValue *= (1 + monthlyHomeGrowth);
    }
    
    const rentMonthlyOutflow = currentRent + inputs.rentersInsuranceMonthly;
    totalRentPaid += rentMonthlyOutflow;
    
    const monthlyInterest = mortgageBalance * (inputs.mortgageInterestRate / 100 / 12);
    const monthlyPrincipal = Math.min(monthlyMortgagePayment - monthlyInterest, mortgageBalance);
    mortgageBalance = Math.max(0, mortgageBalance - monthlyPrincipal);
    
    totalInterestPaid += monthlyInterest;
    totalPrincipalPaid += monthlyPrincipal;
    
    const ownershipMonthlyCosts = monthlyPropertyTax + inputs.homeInsuranceMonthly + 
                                   monthlyMaintenance + inputs.condoFeesMonthly + monthlyCapex;
    totalUnrecoverableCosts += ownershipMonthlyCosts + monthlyInterest;
    
    const buyMonthlyOutflow = monthlyMortgagePayment + ownershipMonthlyCosts;
    
    investmentBalance *= (1 + monthlyInvestmentReturn);
    
    if (inputs.investMonthlyDifference) {
      const difference = buyMonthlyOutflow - rentMonthlyOutflow;
      if (difference > 0) {
        investmentBalance += difference;
      } else if (difference < 0) {
        investmentBalance = Math.max(0, investmentBalance + difference);
      }
    }
    
    const homeEquity = homeValue - mortgageBalance;
    
    // Buy net worth = home equity minus selling costs minus closing costs paid upfront
    // The buyer spent closingCosts at month 0 which reduces their final net worth
    let buyNetWorth: number;
    if (month === totalMonths) {
      const sellingCosts = homeValue * (inputs.sellingCostsPercent / 100);
      totalUnrecoverableCosts += sellingCosts;
      buyNetWorth = homeEquity - sellingCosts - closingCosts;
    } else {
      // For intermediate months, estimate net worth as if selling now
      buyNetWorth = homeEquity - (homeValue * (inputs.sellingCostsPercent / 100)) - closingCosts;
    }
    
    const rentNetWorth = investmentBalance;
    
    if (breakEvenMonth === null && buyNetWorth >= rentNetWorth) {
      breakEvenMonth = month;
    }
    
    monthlyData.push({
      month,
      rentNetWorth,
      buyNetWorth,
      rentMonthlyOutflow,
      buyMonthlyOutflow,
      homeValue,
      mortgageBalance,
      homeEquity,
      investmentBalance,
      rentPaid: totalRentPaid,
      principalPaid: totalPrincipalPaid,
      interestPaid: totalInterestPaid,
    });
  }
  
  const finalData = monthlyData[monthlyData.length - 1];
  const netWorthDifference = finalData.buyNetWorth - finalData.rentNetWorth;
  
  let recommendation: "rent" | "buy" | "neutral";
  if (Math.abs(netWorthDifference) < 10000) {
    recommendation = "neutral";
  } else if (netWorthDifference > 0) {
    recommendation = "buy";
  } else {
    recommendation = "rent";
  }
  
  return {
    rentNetWorthFinal: finalData.rentNetWorth,
    buyNetWorthFinal: finalData.buyNetWorth,
    netWorthDifference,
    breakEvenMonth,
    totalRentPaid,
    totalUnrecoverableCosts,
    totalInterestPaid,
    totalPrincipalPaid,
    endingHomeValue: finalData.homeValue,
    endingMortgageBalance: finalData.mortgageBalance,
    monthlyData,
    recommendation,
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

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
