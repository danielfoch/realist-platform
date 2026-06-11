/**
 * Shared route meta map — single source of truth for titles/descriptions on
 * the homepage and /tools routes.
 *
 * Imported by BOTH server/seoMeta.ts (prerendered head tags) and the client
 * pages that mount an <SEO> Helmet block, so the two rendered documents can
 * never disagree on these routes again.
 *
 * Suffix convention: do not hand-append "| Realist" here — both layers add
 * the " | Realist" suffix automatically when the title does not already
 * contain "Realist".
 */

export interface SharedRouteMeta {
  title: string;
  description: string;
}

export const SHARED_ROUTE_META: Record<string, SharedRouteMeta> = {
  "/": {
    title: "Realist - Canadian Real Estate Investing Platform | Deal Analyzer & Cap Rate Map",
    description: "Use Realist to find, analyze, and compare Canadian real estate deals with AI-powered underwriting, a free deal analyzer, a cap rate map, market reports, and investor tools.",
  },
  "/tools": {
    title: "Free Canadian Real Estate Tools - Realist.ca",
    description: "Free tools for Canadian real estate investors: deal analyzer, cap rate calculator, rent vs buy, true cost calculator, fixed vs variable mortgage, and more.",
  },
  "/tools/analyzer": {
    title: "Real Estate Deal Analyzer (Canada) - Cap Rate, IRR & Cash Flow Calculator",
    description: "Analyze any Canadian rental property in seconds. Calculate cap rate, cash-on-cash, IRR, BRRR returns, multiplex viability and more. Free, no signup.",
  },
  "/tools/cap-rates": {
    title: "Cap Rate Map of Canada - Browse Listings by Cap Rate & Rental Yield",
    description: "Live cap rates and rental yields by Canadian city and neighbourhood. Toronto, Vancouver, Calgary, Edmonton, Halifax, Montreal and more.",
  },
  "/tools/buybox": {
    title: "Build Your Real Estate Buy Box - Realist.ca",
    description: "Define your investment criteria and get matched with on-market and off-market Canadian properties that fit.",
  },
  "/tools/coinvest": {
    title: "Real Estate Co-Investing Hub - Realist.ca",
    description: "Find partners, structure deals, and pool capital with vetted Canadian real estate co-investors.",
  },
  "/tools/true-cost": {
    title: "True Cost of Buying a Home in Canada Calculator - Realist.ca",
    description: "Calculate the real all-in cost of buying a home in Canada — land transfer tax, legal fees, CMHC insurance, closing costs, monthly carrying costs.",
  },
  "/tools/rent-vs-buy": {
    title: "Rent vs Buy Calculator (Canada) - Realist.ca",
    description: "Compare the true financial outcome of renting versus buying in any Canadian city. Includes mortgage, maintenance, taxes, opportunity cost.",
  },
  "/tools/will-it-plex": {
    title: "Will It Plex? Multiplex Conversion Analyzer - Realist.ca",
    description: "Find out if a single-family home is a strong multiplex conversion candidate. Free Canadian multiplex screening tool.",
  },
  "/tools/fixed-vs-variable": {
    title: "Fixed vs Variable Mortgage Calculator (Canada) - Realist.ca",
    description: "Compare fixed and variable mortgage outcomes across realistic rate paths in the Canadian market.",
  },
  "/tools/land-claim-screener": {
    title: "Indigenous Land Claim Screener - Canadian Real Estate Due Diligence",
    description: "Free screening tool to check whether a property in Canada falls within or near an Indigenous land claim, treaty, or reserve.",
  },
  "/tools/motivated-deals": {
    title: "Canadian Motivated Deals - Motivated Sellers, Power of Sale & VTB Tracker",
    description: "Live tracker of motivated Canadian listings: motivated sellers, power of sale, foreclosure, court order sale, and VTB opportunities. Updated daily.",
  },
  "/tools/hst-rebate": {
    title: "Ontario New Home HST Rebate Calculator | Realist",
    description: "Estimate Ontario new home HST rebate savings under the proposed 2026 relief policy and register for final-rule updates.",
  },
  "/tools/hst-calculator": {
    title: "Canadian HST Calculator for Real Estate - Realist.ca",
    description: "Calculate HST on Canadian real estate transactions: new construction, assignments, commercial, and investment property.",
  },
};
