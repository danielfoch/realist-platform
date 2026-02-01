import type { CoInvestChecklistInput } from "@shared/schema";

export interface ChecklistResult {
  score: number;
  tier: "simple_coownership" | "borderline" | "likely_complex";
  flags: string[];
  recommendations: string[];
}

export function calculateComplexityScore(inputs: CoInvestChecklistInput): ChecklistResult {
  let score = 0;
  const flags: string[] = [];
  const recommendations: string[] = [];

  if (inputs.multiplePropertiesOrPortfolioPlan || inputs.numberOfProperties > 1) {
    score += 25;
    flags.push("Multiple properties or portfolio plan often triggers additional regulatory scrutiny");
  }

  if (inputs.marketingToPublic) {
    score += 15;
    flags.push("Marketing to the general public may be considered solicitation under securities laws");
  }

  if (inputs.passiveInvestors) {
    score += 20;
    flags.push("Passive investors who rely on others for returns commonly face securities considerations");
  }

  if (inputs.managerCentralized) {
    score += 15;
    flags.push("A centralized manager or sponsor may indicate a managed investment arrangement");
  }

  if (inputs.profitSharingPromised) {
    score += 15;
    flags.push("Promised profit distributions or returns may resemble investment contract characteristics");
  }

  if (inputs.unitsCount >= 20 || inputs.propertyType === "20_plus" || inputs.propertyType === "land_development") {
    score += 20;
    flags.push("Large unit counts or development projects often face heightened complexity");
  }

  if (inputs.groupSize > 10) {
    score += 20;
    flags.push("Groups larger than 10 participants may attract additional regulatory attention");
  } else if (inputs.groupSize > 4) {
    score += 10;
    flags.push("Groups of 5-10 participants have moderate complexity considerations");
  }

  if (inputs.sophisticatedStructure) {
    score += 20;
    flags.push("Using LP/GP, trusts, or corporate structures often indicates more complex arrangements");
  }

  if (inputs.relianceOnSponsorEfforts) {
    score += 15;
    flags.push("Reliance on a sponsor's efforts for success is a key factor in securities analysis");
  }

  if (inputs.renovationDevelopmentIntensity === "heavy") {
    score += 10;
    flags.push("Heavy renovation or development work may increase deal complexity");
  } else if (inputs.renovationDevelopmentIntensity === "moderate") {
    score += 5;
    flags.push("Moderate renovation work has some complexity considerations");
  }

  score = Math.min(100, score);

  let tier: ChecklistResult["tier"];
  if (score < 30) {
    tier = "simple_coownership";
    recommendations.push(
      "This arrangement appears to have characteristics commonly associated with simple co-ownership.",
      "Consider having a co-ownership agreement drafted by a real estate lawyer.",
      "Ensure all parties understand their rights and responsibilities under Tenants-in-Common or Joint Tenancy.",
      "Document how decisions will be made and how expenses will be shared."
    );
  } else if (score < 60) {
    tier = "borderline";
    recommendations.push(
      "This arrangement has some characteristics that may warrant additional consideration.",
      "Consider consulting with a securities lawyer to understand your specific situation.",
      "Ensure passive participants understand the arrangement fully.",
      "Document all agreements in writing with legal review.",
      "Consider whether an accredited investor exemption might apply to your situation."
    );
  } else {
    tier = "likely_complex";
    recommendations.push(
      "This arrangement has characteristics commonly associated with securities or complex investment structures.",
      "Strongly consider speaking with a securities lawyer before proceeding.",
      "Explore exempt market dealer (EMD) routes if applicable.",
      "Consider regulated crowdfunding platforms designed for real estate investment.",
      "Ensure compliance with applicable securities regulations in your jurisdiction.",
      "Do not proceed with public marketing without proper legal guidance."
    );
  }

  return { score, tier, flags, recommendations };
}

export const skillLabels: Record<string, string> = {
  contractor: "Contractor",
  property_manager: "Property Manager",
  realtor: "Realtor / Agent",
  mortgage_broker: "Mortgage Broker",
  accountant: "Accountant / Bookkeeper",
  designer: "Designer / Architect",
  project_manager: "Project Manager",
  analyst: "Data / Underwriting Analyst",
  legal: "Legal Professional",
  insurance: "Insurance Specialist",
  handyman: "Handyman / DIY",
  marketing: "Marketing",
  other: "Other",
};

export const propertyTypeLabels: Record<string, string> = {
  single_family: "Single Family Home",
  condo: "Condo / Apartment",
  duplex: "Duplex",
  triplex: "Triplex",
  fourplex: "Fourplex",
  small_multifamily_5_19: "Small Multifamily (5-19 units)",
  "20_plus": "Large Multifamily (20+ units)",
  land_development: "Land / Development",
  mixed_use: "Mixed Use",
  other: "Other",
};

export const strategyLabels: Record<string, string> = {
  buy_hold: "Buy & Hold",
  brrr: "BRRR",
  flip: "Flip",
  airbnb: "Airbnb / Short-Term Rental",
  student: "Student Housing",
  other: "Other",
};

export const jurisdictionLabels: Record<string, string> = {
  ON: "Ontario",
  BC: "British Columbia",
  AB: "Alberta",
  QC: "Quebec",
  NS: "Nova Scotia",
  NB: "New Brunswick",
  MB: "Manitoba",
  SK: "Saskatchewan",
  PE: "Prince Edward Island",
  NL: "Newfoundland & Labrador",
  YT: "Yukon",
  NT: "Northwest Territories",
  NU: "Nunavut",
  US: "United States",
  other: "Other",
};

export const ownershipStructureLabels: Record<string, string> = {
  tic: "Tenants-in-Common (TIC)",
  joint_tenancy: "Joint Tenancy",
};

export const tierLabels: Record<string, { label: string; color: string; description: string }> = {
  simple_coownership: {
    label: "Simple Co-Ownership",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    description: "This arrangement appears consistent with traditional co-ownership structures.",
  },
  borderline: {
    label: "Borderline",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    description: "This arrangement has some characteristics that may warrant additional review.",
  },
  likely_complex: {
    label: "Likely Complex",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    description: "This arrangement has characteristics commonly associated with securities or complex structures.",
  },
};
