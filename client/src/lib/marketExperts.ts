export interface MarketExpert {
  name: string;
  title: string;
  province: string;
  provinceCode: string;
  city?: string;
  bio: string;
  photoUrl?: string;
  linkedIn?: string;
  instagram?: string;
  email?: string;
}

export const marketExperts: Record<string, MarketExpert> = {
  ON: {
    name: "Daniel Foch",
    title: "Host & Lead Market Expert",
    province: "Ontario",
    provinceCode: "ON",
    city: "Toronto",
    bio: "Host of The Canadian Real Estate Investor Podcast with 11,000+ community members. Specializing in Ontario investment properties with deep expertise in Toronto, Hamilton, and surrounding markets.",
    linkedIn: "https://www.linkedin.com/in/danielfoch/",
    instagram: "https://www.instagram.com/thecreipodcast/",
  },
  BC: {
    name: "James Anderson",
    title: "BC Market Expert",
    province: "British Columbia",
    provinceCode: "BC",
    city: "Vancouver",
    bio: "Experienced real estate investor and advisor covering Greater Vancouver, Victoria, and BC interior markets. Expert in multi-family and development opportunities.",
  },
  AB: {
    name: "Sylvia Castonguay",
    title: "Alberta Market Expert",
    province: "Alberta",
    provinceCode: "AB",
    city: "Calgary",
    bio: "Calgary-based real estate specialist with expertise in Alberta's diverse investment landscape. Focused on cash-flowing properties in Calgary, Edmonton, and emerging Alberta markets.",
  },
  QC: {
    name: "LJ Aguinaga",
    title: "Quebec Market Expert",
    province: "Quebec",
    provinceCode: "QC",
    city: "Montreal",
    bio: "Quebec investment property expert with deep knowledge of Montreal, Quebec City, and surrounding regions. Bilingual service for Quebec's unique real estate market.",
  },
  NB: {
    name: "Cameron Biroux",
    title: "New Brunswick Market Expert",
    province: "New Brunswick",
    provinceCode: "NB",
    city: "Moncton",
    bio: "Atlantic Canada real estate specialist covering New Brunswick's growing investment markets. Expert in Moncton, Saint John, and Fredericton properties.",
  },
};

export const provincesWithoutExperts = ["SK", "NS", "MB", "PE", "NL", "YT", "NT", "NU"];

export function getMarketExpert(provinceCode: string): MarketExpert | null {
  return marketExperts[provinceCode] || null;
}

export function hasMarketExpert(provinceCode: string): boolean {
  return provinceCode in marketExperts;
}

export const partnerApplicationUrl = "https://forms.gle/your-partner-application-form";
