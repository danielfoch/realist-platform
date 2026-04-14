// True Cost of Homeownership - Ontario Data Constants
// Sources: BILD/Altus 2024, CMHC 2025, CRA, Ontario Government, Municipal DC Bylaws
// Last updated: February 2026

export interface MunicipalityData {
  name: string;
  region?: string;
  developmentCharge: number;
  hasMunicipalLTT: boolean;
  aliases: string[];
}

export const municipalities: Record<string, MunicipalityData> = {
  "Toronto": {
    name: "Toronto",
    region: "GTA",
    developmentCharge: 141139,
    hasMunicipalLTT: true,
    aliases: ["toronto", "north york", "scarborough", "etobicoke", "east york", "york", "downtown toronto"],
  },
  "Mississauga": {
    name: "Mississauga",
    region: "Peel Region",
    developmentCharge: 124025,
    hasMunicipalLTT: false,
    aliases: ["mississauga", "port credit", "streetsville", "meadowvale", "erin mills", "clarkson"],
  },
  "Brampton": {
    name: "Brampton",
    region: "Peel Region",
    developmentCharge: 130593,
    hasMunicipalLTT: false,
    aliases: ["brampton", "bramalea", "heart lake", "springdale"],
  },
  "Ottawa": {
    name: "Ottawa",
    region: "Eastern Ontario",
    developmentCharge: 58000,
    hasMunicipalLTT: false,
    aliases: ["ottawa", "kanata", "orleans", "barrhaven", "nepean", "gloucester", "vanier", "stittsville", "manotick", "riverside south"],
  },
  "Hamilton": {
    name: "Hamilton",
    region: "Golden Horseshoe",
    developmentCharge: 66964,
    hasMunicipalLTT: false,
    aliases: ["hamilton", "stoney creek", "dundas", "ancaster", "flamborough", "glanbrook", "waterdown"],
  },
  "London": {
    name: "London",
    region: "Southwestern Ontario",
    developmentCharge: 50000,
    hasMunicipalLTT: false,
    aliases: ["london", "byron", "westmount", "old south", "white oaks", "masonville"],
  },
  "Markham": {
    name: "Markham",
    region: "York Region",
    developmentCharge: 121500,
    hasMunicipalLTT: false,
    aliases: ["markham", "unionville", "thornhill", "markham village", "cornell"],
  },
  "Vaughan": {
    name: "Vaughan",
    region: "York Region",
    developmentCharge: 85000,
    hasMunicipalLTT: false,
    aliases: ["vaughan", "woodbridge", "maple", "kleinburg", "concord", "thornhill"],
  },
  "Richmond Hill": {
    name: "Richmond Hill",
    region: "York Region",
    developmentCharge: 115000,
    hasMunicipalLTT: false,
    aliases: ["richmond hill", "oak ridges"],
  },
  "Oakville": {
    name: "Oakville",
    region: "Halton Region",
    developmentCharge: 118000,
    hasMunicipalLTT: false,
    aliases: ["oakville", "bronte", "glen abbey"],
  },
  "Burlington": {
    name: "Burlington",
    region: "Halton Region",
    developmentCharge: 111629,
    hasMunicipalLTT: false,
    aliases: ["burlington", "aldershot"],
  },
  "Milton": {
    name: "Milton",
    region: "Halton Region",
    developmentCharge: 115000,
    hasMunicipalLTT: false,
    aliases: ["milton"],
  },
  "Kitchener": {
    name: "Kitchener",
    region: "Waterloo Region",
    developmentCharge: 48000,
    hasMunicipalLTT: false,
    aliases: ["kitchener", "doon", "forest heights"],
  },
  "Waterloo": {
    name: "Waterloo",
    region: "Waterloo Region",
    developmentCharge: 45000,
    hasMunicipalLTT: false,
    aliases: ["waterloo"],
  },
  "Cambridge": {
    name: "Cambridge",
    region: "Waterloo Region",
    developmentCharge: 42000,
    hasMunicipalLTT: false,
    aliases: ["cambridge", "galt", "preston", "hespeler"],
  },
  "Guelph": {
    name: "Guelph",
    region: "Southwestern Ontario",
    developmentCharge: 52000,
    hasMunicipalLTT: false,
    aliases: ["guelph"],
  },
  "Pickering": {
    name: "Pickering",
    region: "Durham Region",
    developmentCharge: 125000,
    hasMunicipalLTT: false,
    aliases: ["pickering", "ajax"],
  },
  "Oshawa": {
    name: "Oshawa",
    region: "Durham Region",
    developmentCharge: 75000,
    hasMunicipalLTT: false,
    aliases: ["oshawa", "courtice", "bowmanville"],
  },
  "Whitby": {
    name: "Whitby",
    region: "Durham Region",
    developmentCharge: 95000,
    hasMunicipalLTT: false,
    aliases: ["whitby", "brooklin"],
  },
  "Barrie": {
    name: "Barrie",
    region: "Simcoe County",
    developmentCharge: 60000,
    hasMunicipalLTT: false,
    aliases: ["barrie", "innisfil"],
  },
  "St. Catharines": {
    name: "St. Catharines",
    region: "Niagara Region",
    developmentCharge: 35000,
    hasMunicipalLTT: false,
    aliases: ["st. catharines", "st catharines", "saint catharines"],
  },
  "Niagara Falls": {
    name: "Niagara Falls",
    region: "Niagara Region",
    developmentCharge: 32000,
    hasMunicipalLTT: false,
    aliases: ["niagara falls"],
  },
  "Welland": {
    name: "Welland",
    region: "Niagara Region",
    developmentCharge: 28000,
    hasMunicipalLTT: false,
    aliases: ["welland", "port colborne", "fort erie"],
  },
  "Windsor": {
    name: "Windsor",
    region: "Southwestern Ontario",
    developmentCharge: 30000,
    hasMunicipalLTT: false,
    aliases: ["windsor", "lasalle", "tecumseh", "lakeshore", "amherstburg"],
  },
  "Kingston": {
    name: "Kingston",
    region: "Eastern Ontario",
    developmentCharge: 35000,
    hasMunicipalLTT: false,
    aliases: ["kingston"],
  },
  "Sudbury": {
    name: "Sudbury",
    region: "Northern Ontario",
    developmentCharge: 15000,
    hasMunicipalLTT: false,
    aliases: ["sudbury", "greater sudbury"],
  },
  "Thunder Bay": {
    name: "Thunder Bay",
    region: "Northern Ontario",
    developmentCharge: 12000,
    hasMunicipalLTT: false,
    aliases: ["thunder bay"],
  },
  "Peterborough": {
    name: "Peterborough",
    region: "Eastern Ontario",
    developmentCharge: 28000,
    hasMunicipalLTT: false,
    aliases: ["peterborough"],
  },
  "Brantford": {
    name: "Brantford",
    region: "Golden Horseshoe",
    developmentCharge: 38000,
    hasMunicipalLTT: false,
    aliases: ["brantford"],
  },
  "Newmarket": {
    name: "Newmarket",
    region: "York Region",
    developmentCharge: 110000,
    hasMunicipalLTT: false,
    aliases: ["newmarket", "aurora"],
  },
  "Caledon": {
    name: "Caledon",
    region: "Peel Region",
    developmentCharge: 120000,
    hasMunicipalLTT: false,
    aliases: ["caledon", "bolton"],
  },
};

export const hstGstRules = {
  taxRates: {
    GST: 0.05,
    PST: 0.08,
    HST: 0.13,
  },
  oldRebates: {
    federalNewHome: {
      maxRebate: 6300,
      rebatePercent: 0.36,
      phaseOutStart: 350000,
      phaseOutEnd: 450000,
    },
    ontarioNewHome: {
      maxRebate: 24000,
      rebatePercent: 0.75,
    },
  },
  enhancedRebates: {
    federal: {
      maxRebate: 50000,
      fullUpTo: 1500000,
      phaseOutEnd: 1850000,
    },
    ontarioBase: {
      maxRebate: 24000,
      rebatePercent: 0.75,
    },
    ontarioEnhanced: {
      maxAdditional: 56000,
      fullUpTo: 1500000,
      phaseOutEnd: 1850000,
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

// Updated construction costs per sqft (2024-2025 data)
// Sources: Altus Group 2025 Canadian Cost Guide, CHBA, builder surveys
export const constructionCosts: Record<string, { min: number; max: number }> = {
  "Detached": { min: 280, max: 450 },
  "Townhouse": { min: 250, max: 400 },
  "Condo": { min: 300, max: 500 },
  "PBR": { min: 300, max: 500 },
};

export const cities = Object.keys(municipalities);

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

export type City = string;
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
  developmentCharges: number;
  provincialLTT: number;
  municipalLTT: number;
  totalLTT: number;
  lttRebate: number;
  grossHST: number;
  hstRebate: number;
  netHST: number;
  federalGST: number;
  provincialPST: number;
  federalRebate: number;
  ontarioBaseRebate: number;
  ontarioEnhancedRebate: number;
  totalOntarioRebate: number;
  oldRebateComparison: number;
  enhancedSavings: number;
  taxOnTax: number;
  totalCosts: number;
  fmvWithHST: number;
  matchedMunicipality: string | null;
}

// Fuzzy match a user-entered city/address to a known municipality
export function matchMunicipality(input: string): MunicipalityData | null {
  const normalized = input.toLowerCase().trim();
  
  // Direct name match
  for (const [, muni] of Object.entries(municipalities)) {
    if (muni.name.toLowerCase() === normalized) return muni;
  }
  
  // Alias match
  for (const [, muni] of Object.entries(municipalities)) {
    for (const alias of muni.aliases) {
      if (normalized === alias || normalized.includes(alias) || alias.includes(normalized)) {
        return muni;
      }
    }
  }
  
  // Try matching last word (city from an address like "123 Main St, Toronto")
  const parts = normalized.split(/[,]/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    for (const [, muni] of Object.entries(municipalities)) {
      if (muni.name.toLowerCase() === trimmed) return muni;
      for (const alias of muni.aliases) {
        if (trimmed === alias || trimmed.includes(alias)) {
          return muni;
        }
      }
    }
  }
  
  return null;
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

interface HSTResult {
  grossHST: number;
  rebate: number;
  netHST: number;
  federalGST: number;
  provincialPST: number;
  federalRebate: number;
  ontarioBaseRebate: number;
  ontarioEnhancedRebate: number;
  totalOntarioRebate: number;
  oldRebateComparison: number;
  enhancedSavings: number;
}

function calculateOldRebate(homeValue: number): number {
  const gstPaid = homeValue * hstGstRules.taxRates.GST;
  const pstPaid = homeValue * hstGstRules.taxRates.PST;
  const old = hstGstRules.oldRebates;

  let oldFederal = 0;
  if (homeValue <= old.federalNewHome.phaseOutStart) {
    oldFederal = Math.min(gstPaid * old.federalNewHome.rebatePercent, old.federalNewHome.maxRebate);
  } else if (homeValue < old.federalNewHome.phaseOutEnd) {
    const factor = (old.federalNewHome.phaseOutEnd - homeValue) / (old.federalNewHome.phaseOutEnd - old.federalNewHome.phaseOutStart);
    oldFederal = Math.min(gstPaid * old.federalNewHome.rebatePercent * factor, old.federalNewHome.maxRebate * factor);
  }

  const oldOntario = Math.min(pstPaid * old.ontarioNewHome.rebatePercent, old.ontarioNewHome.maxRebate);

  return Math.round(oldFederal + oldOntario);
}

function calculateHSTRebate(
  homeValue: number,
  isNewConstruction: boolean,
  buyerType: BuyerType,
  homeType: HomeType
): HSTResult {
  const zero: HSTResult = { grossHST: 0, rebate: 0, netHST: 0, federalGST: 0, provincialPST: 0, federalRebate: 0, ontarioBaseRebate: 0, ontarioEnhancedRebate: 0, totalOntarioRebate: 0, oldRebateComparison: 0, enhancedSavings: 0 };
  if (!isNewConstruction) return zero;

  const federalGST = Math.round(homeValue * hstGstRules.taxRates.GST);
  const provincialPST = Math.round(homeValue * hstGstRules.taxRates.PST);
  const grossHST = federalGST + provincialPST;

  if (homeType === "PBR") {
    return { ...zero, grossHST, rebate: grossHST, netHST: 0, federalGST, provincialPST, federalRebate: federalGST, ontarioBaseRebate: provincialPST, totalOntarioRebate: provincialPST, oldRebateComparison: grossHST, enhancedSavings: 0 };
  }

  const enh = hstGstRules.enhancedRebates;

  let federalRebate = 0;
  if (homeValue <= enh.federal.fullUpTo) {
    federalRebate = enh.federal.maxRebate;
  } else if (homeValue < enh.federal.phaseOutEnd) {
    federalRebate = Math.round(enh.federal.maxRebate * (enh.federal.phaseOutEnd - homeValue) / (enh.federal.phaseOutEnd - enh.federal.fullUpTo));
  }
  federalRebate = Math.min(federalRebate, federalGST);

  const ontarioBaseRebate = Math.min(provincialPST * enh.ontarioBase.rebatePercent, enh.ontarioBase.maxRebate);

  let ontarioEnhancedRebate = 0;
  if (homeValue <= enh.ontarioEnhanced.fullUpTo) {
    ontarioEnhancedRebate = enh.ontarioEnhanced.maxAdditional;
  } else if (homeValue < enh.ontarioEnhanced.phaseOutEnd) {
    ontarioEnhancedRebate = Math.round(enh.ontarioEnhanced.maxAdditional * (enh.ontarioEnhanced.phaseOutEnd - homeValue) / (enh.ontarioEnhanced.phaseOutEnd - enh.ontarioEnhanced.fullUpTo));
  }

  let totalOntarioRebate = ontarioBaseRebate + ontarioEnhancedRebate;
  let finalOntarioBase = ontarioBaseRebate;
  let finalOntarioEnhanced = ontarioEnhancedRebate;
  if (totalOntarioRebate > provincialPST) {
    const scale = provincialPST / totalOntarioRebate;
    finalOntarioBase = Math.round(ontarioBaseRebate * scale);
    finalOntarioEnhanced = Math.round(provincialPST - finalOntarioBase);
    totalOntarioRebate = provincialPST;
  }

  const totalRebate = federalRebate + Math.round(totalOntarioRebate);
  const netHST = Math.max(0, grossHST - totalRebate);

  const oldRebateComparison = calculateOldRebate(homeValue);
  const enhancedSavings = Math.max(0, totalRebate - oldRebateComparison);

  return {
    grossHST,
    rebate: totalRebate,
    netHST,
    federalGST,
    provincialPST,
    federalRebate,
    ontarioBaseRebate: Math.round(finalOntarioBase),
    ontarioEnhancedRebate: Math.round(finalOntarioEnhanced),
    totalOntarioRebate: Math.round(totalOntarioRebate),
    oldRebateComparison,
    enhancedSavings,
  };
}

export function calculateTrueCost(input: TrueCostInput): CostBreakdown {
  const { homeValue, city, isNewConstruction, buyerType, homeType } = input;

  const matchedMuni = matchMunicipality(city);

  const devCharges = isNewConstruction ? (matchedMuni?.developmentCharge || 0) : 0;

  const provincialLTT = calculateLTT(homeValue, landTransferTax.ontarioBrackets);
  
  let municipalLTT = 0;
  if (matchedMuni?.hasMunicipalLTT) {
    municipalLTT = calculateLTT(homeValue, landTransferTax.torontoBrackets);
  }
  
  const totalLTT = provincialLTT + municipalLTT;

  let lttRebate = 0;
  if (buyerType === "First-Time") {
    lttRebate = Math.min(provincialLTT, landTransferTax.firstTimeRebate.ontario);
    if (matchedMuni?.hasMunicipalLTT) {
      lttRebate += Math.min(municipalLTT, landTransferTax.firstTimeRebate.toronto);
    }
  }

  const hstResult = calculateHSTRebate(homeValue, isNewConstruction, buyerType, homeType);

  const taxOnTax = isNewConstruction ? Math.round(devCharges * hstGstRules.taxRates.HST) : 0;

  const totalCosts = 
    (totalLTT - lttRebate) + 
    hstResult.netHST + 
    (isNewConstruction ? devCharges : 0);

  const fmvWithHST = homeValue + hstResult.netHST;

  return {
    homeValue,
    developmentCharges: devCharges,
    provincialLTT,
    municipalLTT,
    totalLTT,
    lttRebate,
    grossHST: hstResult.grossHST,
    hstRebate: hstResult.rebate,
    netHST: hstResult.netHST,
    federalGST: hstResult.federalGST,
    provincialPST: hstResult.provincialPST,
    federalRebate: hstResult.federalRebate,
    ontarioBaseRebate: hstResult.ontarioBaseRebate,
    ontarioEnhancedRebate: hstResult.ontarioEnhancedRebate,
    totalOntarioRebate: hstResult.totalOntarioRebate,
    oldRebateComparison: hstResult.oldRebateComparison,
    enhancedSavings: hstResult.enhancedSavings,
    taxOnTax,
    totalCosts,
    fmvWithHST,
    matchedMunicipality: matchedMuni?.name || null,
  };
}
