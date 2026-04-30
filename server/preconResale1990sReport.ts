export interface PreconResale1990sRow {
  year: number;
  preconLow: number;
  preconPoint: number;
  preconHigh: number;
  resaleLow: number;
  resalePoint: number;
  resaleHigh: number;
  preconPremiumPct: number;
}

export interface PreconResale1990sReport {
  title: string;
  subtitle: string;
  generatedAt: string;
  executiveSummary: string;
  keyTakeaways: string[];
  rows: PreconResale1990sRow[];
  methodology: string[];
  whatThisSuggests: string[];
  sources: Array<{ title: string; url: string }>;
  caveats: string[];
  preparedFor: string;
  footerNote: string;
}

const ROWS: PreconResale1990sRow[] = [
  { year: 1985, preconLow: 89,  preconPoint: 105, preconHigh: 121, resaleLow: 79,  resalePoint: 89,  resaleHigh: 100, preconPremiumPct: 17.6 },
  { year: 1986, preconLow: 114, preconPoint: 134, preconHigh: 154, resaleLow: 101, resalePoint: 114, resaleHigh: 127, preconPremiumPct: 17.6 },
  { year: 1987, preconLow: 155, preconPoint: 182, preconHigh: 210, resaleLow: 137, resalePoint: 155, resaleHigh: 173, preconPremiumPct: 17.6 },
  { year: 1988, preconLow: 188, preconPoint: 221, preconHigh: 255, resaleLow: 166, resalePoint: 188, resaleHigh: 210, preconPremiumPct: 17.6 },
  { year: 1989, preconLow: 256, preconPoint: 264, preconHigh: 272, resaleLow: 198, resalePoint: 224, resaleHigh: 251, preconPremiumPct: 17.6 },
  { year: 1990, preconLow: 209, preconPoint: 237, preconHigh: 265, resaleLow: 184, resalePoint: 209, resaleHigh: 234, preconPremiumPct: 13.4 },
  { year: 1991, preconLow: 185, preconPoint: 210, preconHigh: 235, resaleLow: 170, resalePoint: 192, resaleHigh: 215, preconPremiumPct: 9.3 },
  { year: 1992, preconLow: 161, preconPoint: 183, preconHigh: 205, resaleLow: 156, resalePoint: 176, resaleHigh: 197, preconPremiumPct: 3.8 },
  { year: 1993, preconLow: 151, preconPoint: 156, preconHigh: 161, resaleLow: 149, resalePoint: 169, resaleHigh: 189, preconPremiumPct: -7.9 },
  { year: 1994, preconLow: 146, preconPoint: 172, preconHigh: 198, resaleLow: 151, resalePoint: 171, resaleHigh: 191, preconPremiumPct: 0.4 },
  { year: 1995, preconLow: 160, preconPoint: 188, preconHigh: 216, resaleLow: 147, resalePoint: 166, resaleHigh: 186, preconPremiumPct: 12.9 },
  { year: 1996, preconLow: 173, preconPoint: 204, preconHigh: 235, resaleLow: 143, resalePoint: 162, resaleHigh: 182, preconPremiumPct: 25.6 },
  { year: 1997, preconLow: 187, preconPoint: 220, preconHigh: 253, resaleLow: 153, resalePoint: 173, resaleHigh: 194, preconPremiumPct: 27.0 },
  { year: 1998, preconLow: 201, preconPoint: 236, preconHigh: 271, resaleLow: 157, resalePoint: 178, resaleHigh: 199, preconPremiumPct: 32.8 },
  { year: 1999, preconLow: 214, preconPoint: 252, preconHigh: 290, resaleLow: 165, resalePoint: 187, resaleHigh: 209, preconPremiumPct: 34.6 },
  { year: 2000, preconLow: 228, preconPoint: 268, preconHigh: 308, resaleLow: 176, resalePoint: 199, resaleHigh: 223, preconPremiumPct: 34.4 },
];

export function getPreconResale1990sReport(): PreconResale1990sReport {
  return {
    title: "GTA Pre-Construction vs Resale Condo Pricing After the 1990s Correction",
    subtitle:
      "A rough reconstructed dataset for 1985-2000 showing how new/pre-con condo pricing may have moved relative to resale pricing.",
    generatedAt: new Date().toISOString(),
    preparedFor: "The Realist",
    footerNote:
      "Prepared for The Realist. Rough reconstruction for discussion purposes only. Not appraisal-grade valuation data.",
    executiveSummary:
      "Based on a rough reconstruction of available public anchor points, GTA pre-con/new condo pricing likely moved from a normal premium to resale in the late 1980s, toward parity or a small discount around 1992-1994, then gradually rebuilt a premium as the new-condo market recovered into the late 1990s and early 2000s. The clearest hard anchor is the new-condo price reset: Urbanation reports that GTA new-condo pricing peaked at approximately $264/psf in 1989 and fell to roughly $156/psf by 1993 — a drop on the order of 40% in the new-build PSF — before recovering to around $300/psf by 2002. The resale path is less directly observable as a condo-only PSF series, so this report indexes resale movement off broad GTA all-home resale price history and reports it as a confidence range. The directional signal is the spread: when the new-build premium compresses to zero or inverts, pre-con absorption typically requires either lower new pricing, stronger resale, or improved buyer sentiment to restart.",
    keyTakeaways: [
      "New/pre-con condo pricing appears to have reset earlier and more sharply after the late-1980s peak.",
      "The 1993 trough implies a roughly 40% decline in new-condo PSF from the 1989 high.",
      "Resale pricing also corrected, but the resale condo PSF data is less direct and should be treated as a range.",
      "The reconstructed model suggests the pre-con premium compressed to near zero, or even a discount, around the early-1990s trough.",
      "The premium rebuilt gradually as confidence returned and the new-condo market recovered through the late 1990s.",
      "This pattern is directionally useful for thinking about today's market, but financing, pre-sale, rental, investor, and supply conditions are not identical.",
    ],
    rows: ROWS,
    methodology: [
      "Pre-con/new-condo point estimates are anchored to known Urbanation historical anchors: ~$264/psf in 1989, ~$156/psf in 1993, ~$300/psf by 2002.",
      "1985-1988 estimated by working backward from the 1989 anchor using the broad GTA resale market trajectory.",
      "Resale condo PSF in 1989 is assumed at 85% of new/pre-con PSF as a central estimate.",
      "Resale confidence band assumes 1989 resale PSF in a 75%-95% range relative to new/pre-con PSF.",
      "Annual resale path is indexed using broad TRREB all-home average resale price history rather than a condo-only series.",
      "Direct condo-only resale PSF history from 1985-2000 is not readily available in public form; the resale line should be read as an approximate range, not a precise series.",
    ],
    whatThisSuggests: [
      "When confidence breaks, the pre-con premium can compress materially — sometimes to zero or below.",
      "A stalled pre-con market typically needs at least one of: lower new pricing, higher resale pricing, lower rates, better rents, or improved buyer sentiment to restart.",
      "The most important comparison is not just the absolute price decline, but the spread between new/pre-con and comparable resale.",
      "If new product remains materially above resale, absorption can stay difficult for an extended period.",
      "If the spread narrows enough — through new-build cuts, resale gains, or both — buyer interest tends to return.",
    ],
    sources: [
      {
        title: "Urbanation — historical GTA new-condo pricing notes",
        url: "https://www.urbanation.ca/news",
      },
      {
        title: "CMHC — Toronto condo downturns and the 1990s correction",
        url: "https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-research",
      },
      {
        title: "TRREB — historical average resale price data",
        url: "https://trreb.ca/index.php/market-news/market-watch",
      },
    ],
    caveats: [
      "The pre-con/new-condo series has stronger anchor points; the resale condo PSF series is estimated.",
      "The resale estimate uses broad GTA resale price movement as a proxy, not direct condo-only 1990s PSF data.",
      "This is for directional research only — not appraisal-grade valuation.",
    ],
  };
}
