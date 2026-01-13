/**
 * CMHC MLI Select Configuration
 * Update this file annually when CMHC rates/terms change
 */

export const MLI_CONFIG = {
  // Minimum points to qualify for MLI Select
  minPointsToQualify: 50,

  // Tier definitions based on total points
  tiers: {
    none: { minPoints: 0, maxPoints: 49 },
    tier50: { minPoints: 50, maxPoints: 69 },
    tier70: { minPoints: 70, maxPoints: 99 },
    tier100: { minPoints: 100, maxPoints: 999 },
  },

  // Loan terms by tier
  loanTerms: {
    none: {
      maxAmortization: 25,
      maxLTV: 75,
      maxLTC: 75,
      insurancePremium: 0, // Not eligible
    },
    tier50: {
      maxAmortization: 40,
      maxLTV: 85,
      maxLTC: 85,
      insurancePremium: 2.25,
    },
    tier70: {
      maxAmortization: 45,
      maxLTV: 95,
      maxLTC: 95,
      insurancePremium: 1.75,
    },
    tier100: {
      maxAmortization: 50,
      maxLTV: 95,
      maxLTC: 95,
      insurancePremium: 1.25,
    },
  },

  // Affordability tier points
  affordabilityTiers: {
    newConstruction: {
      none: { points: 0, unitPercent: 0 },
      tier50: { points: 50, unitPercent: 10 },
      tier70: { points: 70, unitPercent: 15 },
      tier100: { points: 100, unitPercent: 25 },
    },
    existing: {
      none: { points: 0, unitPercent: 0 },
      tier50: { points: 50, unitPercent: 40 },
      tier70: { points: 70, unitPercent: 60 },
      tier100: { points: 100, unitPercent: 80 },
    },
  },

  // Extended commitment bonus (20+ years)
  extendedCommitmentBonus: 30,

  // Energy efficiency tiers
  energyTiers: {
    none: { points: 0, label: "No Energy Commitment" },
    level1: { points: 20, label: "Level 1 (20 pts)" },
    level2: { points: 35, label: "Level 2 (35 pts)" },
    level3: { points: 50, label: "Level 3 (50 pts)" },
  },

  // Accessibility tiers
  accessibilityTiers: {
    none: { points: 0, label: "No Accessibility Commitment" },
    level1: { points: 20, label: "Level 1 (20 pts)" },
    level2: { points: 30, label: "Level 2 (30 pts)" },
  },

  // Stress test adjustments
  stressTest: {
    bear: {
      rentChange: -0.05,      // -5% rent
      vacancyChange: 0.02,    // +2% vacancy
      expenseChange: 0.05,    // +5% expenses
      rateChange: 0.005,      // +50bps rate
    },
    bull: {
      rentChange: 0.05,       // +5% rent
      vacancyChange: -0.01,   // -1% vacancy
      expenseChange: -0.03,   // -3% expenses
      rateChange: -0.0025,    // -25bps rate
    },
  },

  // Default values
  defaults: {
    vacancyRate: 0.04,        // 4%
    expenseRatio: 0.35,       // 35%
    rentGrowth: 0,            // 0%
    interestRate: 0.055,      // 5.5%
    constructionRate: 0.07,   // 7%
    privateRate: 0.10,        // 10%
    constructionMonths: 18,
    cmhcDelayMonths: 9,       // Additional months for CMHC construction
    minDSCR: 1.10,
  },

  // Median renter incomes by city (update annually from CMHC/Census data)
  medianIncomes: {
    "Barrie": 58900,
    "Calgary": 72000,
    "Edmonton": 68000,
    "Halifax": 50000,
    "Hamilton": 56000,
    "Kitchener": 60000,
    "London": 52000,
    "Montreal": 52000,
    "Ottawa": 70000,
    "Quebec City": 54000,
    "Regina": 64000,
    "Saskatoon": 62000,
    "St. John's": 58000,
    "Toronto": 62000,
    "Vancouver": 58000,
    "Victoria": 55000,
    "Winnipeg": 55000,
    "Other": 55000,
  } as Record<string, number>,
};

export type MLITier = "none" | "tier50" | "tier70" | "tier100";
export type ProjectType = "new_construction" | "existing";
export type EnergyTier = keyof typeof MLI_CONFIG.energyTiers;
export type AccessibilityTier = keyof typeof MLI_CONFIG.accessibilityTiers;
export type AffordabilityTier = "none" | "tier50" | "tier70" | "tier100";
export type FinancingType = "cmhc" | "conventional" | "private";

export function getTierFromPoints(totalPoints: number): MLITier {
  if (totalPoints >= 100) return "tier100";
  if (totalPoints >= 70) return "tier70";
  if (totalPoints >= 50) return "tier50";
  return "none";
}

export function getAffordableRentThreshold(medianIncome: number): number {
  return Math.round((medianIncome * 0.30) / 12);
}

export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  amortizationYears: number
): number {
  if (principal <= 0 || annualRate <= 0 || amortizationYears <= 0) return 0;
  const monthlyRate = annualRate / 12;
  const numPayments = amortizationYears * 12;
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
         (Math.pow(1 + monthlyRate, numPayments) - 1);
}

export function calculateDSCR(noi: number, annualDebtService: number): number {
  if (annualDebtService <= 0) return 0;
  return noi / annualDebtService;
}

export function findMaxLTVForDSCR(
  noi: number,
  totalCost: number,
  annualRate: number,
  amortizationYears: number,
  maxLTV: number,
  insurancePremiumPercent: number = 0,
  targetDSCR: number = 1.10
): number {
  let low = 0.5;
  let high = maxLTV / 100;
  let result = low;

  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    const baseLoanAmount = totalCost * mid;
    // Include financed insurance premium in total loan
    const insurancePremium = baseLoanAmount * (insurancePremiumPercent / 100);
    const totalLoanAmount = baseLoanAmount + insurancePremium;
    const monthlyPayment = calculateMonthlyPayment(totalLoanAmount, annualRate, amortizationYears);
    const annualDebtService = monthlyPayment * 12;
    const dscr = calculateDSCR(noi, annualDebtService);

    if (dscr >= targetDSCR) {
      result = mid;
      low = mid;
    } else {
      high = mid;
    }
  }

  return Math.floor(result * 100);
}
