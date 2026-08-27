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
    title: "Realist.ca | Institutional-Grade Tools for Canadian Real Estate Investors",
    description: "Browse underwritten Canadian listings, screen distressed deals, analyze Toronto multiplex sites, and use research from Canada's #1 real estate podcast.",
  },
  "/tools": {
    title: "Free Canadian Real Estate Tools - Realist.ca",
    description: "Free tools for Canadian real estate investors: deal analyzer, cap rate calculator, rent vs buy, true cost calculator, fixed vs variable mortgage, and more.",
  },
  "/tools/analyzer": {
    title: "Real Estate Deal Analyzer (Canada) - Cap Rate, IRR & Cash Flow Calculator",
    description: "Analyze any Canadian rental property in seconds. Calculate cap rate, cash-on-cash, IRR, BRRR returns, multiplex viability and more. Free to use; talk to Daniel and Nick when you want a second opinion or help closing.",
  },
  "/tools/cap-rates": {
    title: "Canadian Listing Map - Cap Rates, Yield & Motivated Deals",
    description: "One Canadian listing map for cap rates, rental yields, power of sale, motivated sellers, vendor take-back deals, and investor underwriting signals.",
  },
  "/deals": {
    title: "Underwritten Canadian Investment Properties | Realist.ca",
    description: "Browse live CREA DDF listings with estimated rent, cap rate, cash flow, financing strength, power-of-sale, motivated-seller, and VTB signals already attached.",
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
  "/tools/rent-to-own": {
    title: "Buy vs Rent-to-Own Calculator (Canada) - Realist.ca",
    description: "Compare a traditional CMHC-insured purchase against a rent-to-own pathway. See upfront cash, monthly cost, equity, and total 5-year cost side by side.",
  },
  // ─── Conversion pages ──────────────────────────────────────────────────────
  // These were serving the generic fallback title (or a hard 404) despite being
  // the destinations of the nav's primary CTAs.
  "/book-a-call": {
    title: "Book a Call with Daniel Foch & Nick Hill | Realist.ca",
    description: "Talk through a live deal, a financing structure, or a multiplex site with an investor-focused broker and a mortgage broker. No cost, no pitch — bring the numbers you already have.",
  },
  "/work-with-realist": {
    title: "Work With Realist — Buy, Finance & Underwrite With Us | Realist.ca",
    description: "Representation for Canadian real estate investors: deal sourcing, underwriting, financing, and closing with Daniel Foch and Nick Hill.",
  },
  "/tools/financing-readiness": {
    title: "Financing Readiness — Your Stress-Tested Max Price | Realist.ca",
    description: "Find the maximum purchase price you can actually finance in 30 seconds. Stress-tested against current Canadian qualifying rates, not wishful math.",
  },
  "/join/mortgage-brokers": {
    title: "For Mortgage Brokers — Join the Realist Referral Network",
    description: "Get matched with Canadian investors who have already underwritten a deal and asked for financing help. Claim your market on the Realist partner network.",
  },
  "/join/experts": {
    title: "For Real Estate Professionals — Join Realist as an Expert",
    description: "Realtors, lenders, planners, and trades: reach Canadian investors at the moment they are underwriting a deal in your market.",
  },
  "/experts": {
    title: "Find a Real Estate Expert in Your Market | Realist.ca",
    description: "Vetted Canadian realtors, mortgage brokers, planners, and trades — matched to the market and strategy you are actually investing in.",
  },
  "/deal-room": {
    title: "The Realist Deal Room — Live Canadian Deal Flow",
    description: "On-market and off-market Canadian investment properties, underwritten and discussed with the Realist community.",
  },
  "/meetups": {
    title: "Canadian Real Estate Investor Meetups | Realist.ca",
    description: "Find a Realist meetup near you — local investor events hosted across Canada by the Canadian Real Estate Investor community.",
  },

  // ─── Multiplex ─────────────────────────────────────────────────────────────
  // The underwriter is the flagship; the other two feed it. Titles lead with the
  // question the searcher is actually typing ("can I build a fourplex on this
  // lot", "how many units can I build") rather than the product name.
  "/multiplex": {
    title: "Toronto Multiplex Underwriter & CMHC Pro Forma | Realist.ca",
    description: "Pull a Toronto CREA DDF listing or enter an address to screen lot dimensions, zoning, MTSA and major-street context, buildable envelope, concept massing, rents, costs, CMHC small-rental financing, and MLI Select.",
  },
  "/tools/multiplex-underwriter": {
    title: "Multiplex Underwriter — How Many Units Can I Build? | Realist.ca",
    description: "Enter a Toronto address and get an instant multiplex underwrite: as-of-right unit count, sixplex eligibility, buildable envelope, construction costs, rent roll, and MLI Select hold vs condo exit — with the zoning source behind every number.",
  },
  "/tools/multiplex-feasibility": {
    title: "Multiplex Feasibility Check — Can This Lot Be Plexed? | Realist.ca",
    description: "Screen any Canadian property for multiplex development potential in seconds: lot size, frontage, zoning permissions, and the constraints that usually kill a plex before you spend a dollar.",
  },
  "/tools/will-it-plex": {
    title: "Will It Plex? Multiplex Conversion Analyzer - Realist.ca",
    description: "Find out if a single-family home is a strong multiplex conversion candidate. Free Canadian multiplex screening tool.",
  },
  "/multiplex-investor-fit": {
    title: "Is a Multiplex Right for You? Investor Fit Check | Realist.ca",
    description: "Answer a few questions about your capital, timeline, and risk tolerance to see whether a multiplex build, a conversion, or a turnkey rental actually fits your position.",
  },
  "/masterclass": {
    title: "Canadian Multiplex Masterclass — Build, Finance & Exit | Realist.ca",
    description: "The full multiplex playbook from Daniel Foch and Nick Hill: zoning and as-of-right permissions, construction budgeting, MLI Select financing, and choosing between a rental hold and a condo exit.",
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
    description: "Motivated-deal quick filters inside the unified Realist listing map: power of sale, foreclosure, court order sale, motivated seller, and VTB opportunities.",
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
