// True Cost of Homeownership - Ontario Data Constants
// Sources: BILD/Altus 2023, CRA, Ontario Government, City of Toronto

export const developmentCharges: Record<string, number> = {
  "Toronto": 97041,
  "Mississauga": 124025,
  "Brampton": 130593,
  "Ottawa": 46993,
  "Hamilton": 66964,
  "London": 44067,
};

export const hstGstRules = {
  taxRates: {
    GST: 0.05,
    PST: 0.08,
    HST: 0.13,
  },
  rebates: {
    federalNewHome: {
      maxRebate: 6300,
      rebatePercent: 0.36,
      phaseOutStart: 350000,
      phaseOutEnd: 450000,
    },
    ontarioNewHome: {
      maxRebate: 24000,
      rebatePercent: 0.75,
      maxValueForFullRebate: 450000,
    },
  },
  firstTimeProposed: {
    federal: {
      fullUpTo: 1000000,
      phaseOutEnd: 1500000,
      maxRebate: 50000,
    },
    ontario: {
      fullUpTo: 1000000,
      phaseOutEnd: 1500000,
      maxRebate: 80000,
    },
  },
  rentalRebates: {
    NRRP: {
      federalPercent: 0.36,
      provincialPercent: 0.75,
      maxFederalRebate: 6300,
      maxProvincialRebate: 24000,
    },
    PBRH: {
      federalPercent: 1.0,
      provincialPercent: 1.0,
      noValueCap: true,
    },
  },
};

export const landTransferTax = {
  ontarioBrackets: [
    { upTo: 55000, rate: 0.005 },
    { upTo: 250000, rate: 0.01 },
    { upTo: 400000, rate: 0.015 },
    { upTo: 2000000, rate: 0.02 },
    { above: 2000000, rate: 0.025 },
  ],
  torontoBrackets: [
    { upTo: 55000, rate: 0.005 },
    { upTo: 250000, rate: 0.01 },
    { upTo: 400000, rate: 0.015 },
    { upTo: 2000000, rate: 0.02 },
    { upTo: 3000000, rate: 0.025 },
    { upTo: 4000000, rate: 0.035 },
    { upTo: 5000000, rate: 0.045 },
    { upTo: 10000000, rate: 0.055 },
    { upTo: 20000000, rate: 0.065 },
    { above: 20000000, rate: 0.075 },
  ],
  firstTimeRebate: {
    ontario: 4000,
    ontarioCoverage: 368000,
    toronto: 4475,
    torontoCoverage: 400000,
  },
};

export const constructionCosts: Record<string, { min: number; max: number }> = {
  "Detached": { min: 172, max: 215 },
  "Townhouse": { min: 182, max: 226 },
  "Condo": { min: 215, max: 290 },
  "PBR": { min: 215, max: 290 },
};

export const cities = [
  "Toronto",
  "Mississauga", 
  "Brampton",
  "Ottawa",
  "Hamilton",
  "London",
] as const;

export const homeTypes = [
  "Detached",
  "Townhouse",
  "Condo",
  "PBR",
] as const;

export const buyerTypes = [
  "First-Time",
  "Repeat",
  "Investor",
] as const;

export type City = typeof cities[number];
export type HomeType = typeof homeTypes[number];
export type BuyerType = typeof buyerTypes[number];

export interface TrueCostInput {
  homeValue: number;
  city: City;
  isNewConstruction: boolean;
  buyerType: BuyerType;
  homeType: HomeType;
  squareFootage?: number;
}

export interface CostBreakdown {
  homeValue: number;
  landCost: number;
  constructionCost: number;
  developmentCharges: number;
  provincialLTT: number;
  municipalLTT: number;
  totalLTT: number;
  lttRebate: number;
  grossHST: number;
  hstRebate: number;
  netHST: number;
  developerMargin: number;
  totalCosts: number;
  breakdown: {
    category: string;
    amount: number;
    percentage: number;
  }[];
}

function calculateLTT(
  value: number,
  brackets: Array<{ upTo?: number; above?: number; rate: number }>
): number {
  let tax = 0;
  let remaining = value;
  let prevThreshold = 0;

  for (const bracket of brackets) {
    if (bracket.above !== undefined) {
      if (value > bracket.above) {
        tax += (value - bracket.above) * bracket.rate;
      }
      break;
    }

    const threshold = bracket.upTo!;
    const taxableInBracket = Math.min(remaining, threshold - prevThreshold);
    
    if (taxableInBracket > 0) {
      tax += taxableInBracket * bracket.rate;
      remaining -= taxableInBracket;
    }
    
    prevThreshold = threshold;
    if (remaining <= 0) break;
  }

  return Math.round(tax);
}

function calculateHSTRebate(
  homeValue: number,
  isNewConstruction: boolean,
  buyerType: BuyerType,
  homeType: HomeType
): { grossHST: number; rebate: number; netHST: number } {
  if (!isNewConstruction) {
    return { grossHST: 0, rebate: 0, netHST: 0 };
  }

  const grossHST = Math.round(homeValue * hstGstRules.taxRates.HST);

  if (homeType === "PBR") {
    return { grossHST, rebate: grossHST, netHST: 0 };
  }

  let federalRebate = 0;
  let provincialRebate = 0;

  const federal = hstGstRules.rebates.federalNewHome;
  const provincial = hstGstRules.rebates.ontarioNewHome;

  const gstPaid = homeValue * hstGstRules.taxRates.GST;
  const pstPaid = homeValue * hstGstRules.taxRates.PST;

  if (homeValue <= federal.phaseOutStart) {
    federalRebate = Math.min(gstPaid * federal.rebatePercent, federal.maxRebate);
  } else if (homeValue < federal.phaseOutEnd) {
    const factor = (federal.phaseOutEnd - homeValue) / (federal.phaseOutEnd - federal.phaseOutStart);
    federalRebate = Math.min(gstPaid * federal.rebatePercent * factor, federal.maxRebate * factor);
  }

  if (homeValue <= provincial.maxValueForFullRebate) {
    provincialRebate = Math.min(pstPaid * provincial.rebatePercent, provincial.maxRebate);
  }

  const totalRebate = Math.round(federalRebate + provincialRebate);

  return {
    grossHST,
    rebate: totalRebate,
    netHST: grossHST - totalRebate,
  };
}

export function calculateTrueCost(input: TrueCostInput): CostBreakdown {
  const { homeValue, city, isNewConstruction, buyerType, homeType, squareFootage = 1200 } = input;

  const landCost = Math.round(homeValue * 0.30);

  const costRange = constructionCosts[homeType] || constructionCosts["Detached"];
  const avgCostPerSqFt = (costRange.min + costRange.max) / 2;
  const constructionCost = isNewConstruction ? Math.round(avgCostPerSqFt * squareFootage) : 0;

  const devCharges = isNewConstruction ? (developmentCharges[city] || 0) : 0;

  const provincialLTT = calculateLTT(homeValue, landTransferTax.ontarioBrackets);
  
  let municipalLTT = 0;
  if (city === "Toronto") {
    municipalLTT = calculateLTT(homeValue, landTransferTax.torontoBrackets);
  }
  
  const totalLTT = provincialLTT + municipalLTT;

  let lttRebate = 0;
  if (buyerType === "First-Time") {
    lttRebate = Math.min(provincialLTT, landTransferTax.firstTimeRebate.ontario);
    if (city === "Toronto") {
      lttRebate += Math.min(municipalLTT, landTransferTax.firstTimeRebate.toronto);
    }
  }

  const hstResult = calculateHSTRebate(homeValue, isNewConstruction, buyerType, homeType);

  const developerMargin = isNewConstruction 
    ? Math.round((landCost + constructionCost + devCharges) * 0.10)
    : 0;

  const totalCosts = 
    (totalLTT - lttRebate) + 
    hstResult.netHST + 
    (isNewConstruction ? devCharges : 0);

  const breakdown = [
    { category: "Land Value", amount: landCost, percentage: 0 },
    { category: "Construction", amount: constructionCost, percentage: 0 },
    { category: "Development Charges", amount: devCharges, percentage: 0 },
    { category: "Land Transfer Tax", amount: totalLTT - lttRebate, percentage: 0 },
    { category: "HST (Net)", amount: hstResult.netHST, percentage: 0 },
    { category: "Developer Margin", amount: developerMargin, percentage: 0 },
  ].filter(item => item.amount > 0);

  const total = breakdown.reduce((sum, item) => sum + item.amount, 0);
  breakdown.forEach(item => {
    item.percentage = total > 0 ? Math.round((item.amount / total) * 100) : 0;
  });

  return {
    homeValue,
    landCost,
    constructionCost,
    developmentCharges: devCharges,
    provincialLTT,
    municipalLTT,
    totalLTT,
    lttRebate,
    grossHST: hstResult.grossHST,
    hstRebate: hstResult.rebate,
    netHST: hstResult.netHST,
    developerMargin,
    totalCosts,
    breakdown,
  };
}
