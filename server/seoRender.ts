import { storage } from "./storage";
import { getAnalysesCountStats } from "./socialStats";
import { encyclopediaGuides, getEncyclopediaGuide } from "@shared/encyclopedia";
import { getProgrammaticMarket, getProgrammaticStrategy, PROGRAMMATIC_MARKETS, PROGRAMMATIC_STRATEGIES } from "@shared/programmaticSeo";
import { PODCAST_APPLE_URL, PODCAST_SPOTIFY_URL, PODCAST_YOUTUBE_URL } from "@shared/brand";
import {
  buildListingSeoDescription,
  formatListingAddress,
  formatListingPrice,
  getListingSeoByMls,
  listingCanonicalPath,
} from "./listingSeo";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function renderShell(content: string): string {
  return `
    <section style="padding:48px 16px 24px;max-width:1120px;margin:0 auto;font-family:Inter,system-ui,sans-serif;color:#111827;">
      ${content}
    </section>
  `;
}

function renderLinkList(links: Array<{ href: string; label: string }>) {
  return `
    <ul style="padding-left:18px;line-height:1.8;margin:12px 0;">
      ${links.map((link) => `<li><a href="${escapeHtml(link.href)}" style="color:#0f766e;text-decoration:none;">${escapeHtml(link.label)}</a></li>`).join("")}
    </ul>
  `;
}

function renderFooterLinks() {
  return `
    <footer style="border-top:1px solid #e5e7eb;margin-top:48px;padding-top:24px;">
      <nav aria-label="Footer links">
        ${renderLinkList([
          { href: "/markets", label: "Markets" },
          { href: "/reports", label: "Reports" },
          { href: "/investing", label: "Investing" },
          { href: "/about", label: "About" },
          { href: "/about/contact", label: "Contact" },
          { href: "/insights/podcast", label: "Podcast" },
          { href: "/insights/encyclopedia", label: "Investor Encyclopedia" },
          { href: "https://thecanadianrealestateinvestor.substack.com/feed", label: "RSS" },
        ])}
      </nav>
    </footer>
  `;
}

function renderBreadcrumbs(links: Array<{ href: string; label: string }>) {
  return `
    <nav aria-label="Breadcrumb" style="font-size:14px;margin-bottom:20px;color:#4b5563;">
      ${links.map((link, index) => {
        const prefix = index === 0 ? "" : " / ";
        return `${prefix}<a href="${escapeHtml(link.href)}" style="color:#0f766e;text-decoration:none;">${escapeHtml(link.label)}</a>`;
      }).join("")}
    </nav>
  `;
}

const STATIC_DATA_PAGE_CONTENT: Record<string, { h1: string; intro: string; sections: Array<{ title: string; body: string }>; links: Array<{ href: string; label: string }> }> = {
  // ---------------------------------------------------------------------
  // /tools and /tools/* fallbacks (audit item 1): the flagship commercial
  // routes previously shipped an empty #seo-static-fallback. Each entry
  // gives crawlers an H1 matching the meta title, an intro, H2 sections,
  // and sibling-tool links.
  // ---------------------------------------------------------------------
  "/tools": {
    h1: "Free Canadian Real Estate Investment Tools",
    intro: "Realist's toolkit covers the full underwriting workflow for Canadian real estate investors: a deal analyzer, a cap rate map, rent vs buy and true-cost calculators, multiplex screening, mortgage comparisons, and motivated-seller deal sourcing. Every tool is free to use.",
    sections: [
      {
        title: "What's in the toolkit",
        body: "Start with the Deal Analyzer for cap rate, cash flow, IRR, and cash-on-cash on any Canadian property. Use the Cap Rate Map to browse listings by yield, the True Cost and Rent vs Buy calculators for ownership decisions, Will It Plex and Multiplex Feasibility for conversion screening, and the Motivated Deals browser for power of sale and motivated-seller sourcing.",
      },
      {
        title: "Who these tools are for",
        body: "Buy-and-hold investors, BRRR investors, multiplex converters, house hackers, and first-time Canadian buyers who want institutional-grade math without a spreadsheet. Each tool links into Realist's market reports and investor encyclopedia so the numbers come with context.",
      },
    ],
    links: [
      { href: "/tools/analyzer", label: "Real Estate Deal Analyzer" },
      { href: "/tools/cap-rates", label: "Cap Rate Map of Canada" },
      { href: "/tools/true-cost", label: "True Cost of Buying Calculator" },
      { href: "/tools/rent-vs-buy", label: "Rent vs Buy Calculator" },
      { href: "/tools/will-it-plex", label: "Will It Plex? Multiplex Analyzer" },
      { href: "/tools/fixed-vs-variable", label: "Fixed vs Variable Mortgage Calculator" },
      { href: "/tools/hst-rebate", label: "Ontario New Home HST Rebate Calculator" },
      { href: "/tools/hst-calculator", label: "Canadian HST Calculator" },
      { href: "/tools/land-claim-screener", label: "Indigenous Land Claim Screener" },
      { href: "/tools/motivated-deals", label: "Motivated Deals Browser" },
      { href: "/tools/buybox", label: "BuyBox Builder" },
      { href: "/tools/coinvest", label: "Co-Investing Hub" },
      { href: "/insights/encyclopedia", label: "Real Estate Investor Encyclopedia" },
    ],
  },
  "/tools/analyzer": {
    h1: "Real Estate Deal Analyzer for Canadian Investors",
    intro: "Analyze any Canadian rental property in seconds. Paste an address, listing, or MLS number and the analyzer returns cap rate, monthly cash flow, cash-on-cash return, IRR, DSCR, and multi-year projections — free, with no signup required to run the numbers.",
    sections: [
      {
        title: "What it calculates",
        body: "Cap rate, net operating income, monthly and annual cash flow, cash-on-cash return, internal rate of return, debt service coverage ratio, expense ratio, and equity growth over the hold period. Strategy modes cover buy and hold, BRRR, multiplex, flip, and short-term rental underwriting.",
      },
      {
        title: "Inputs and assumptions",
        body: "Purchase price, down payment, mortgage rate and amortization, market rent (with CMHC rent benchmarks as a starting point), vacancy, property tax, insurance, utilities, maintenance, management, and renovation budget. Every assumption is editable so you can stress-test the deal instead of trusting a headline yield.",
      },
      {
        title: "How the methodology works",
        body: "The analyzer applies standard Canadian underwriting math: NOI is income minus operating expenses before debt service; cap rate is NOI over price; cash-on-cash is annual pre-tax cash flow over cash invested; IRR includes the modelled exit. Results are estimates based on your assumptions, not guaranteed returns.",
      },
    ],
    links: [
      { href: "/tools/cap-rates", label: "Browse the Cap Rate Map of Canada" },
      { href: "/tools/will-it-plex", label: "Screen a multiplex conversion" },
      { href: "/tools/rent-vs-buy", label: "Compare rent vs buy" },
      { href: "/tools/motivated-deals", label: "Find motivated-seller deals" },
      { href: "/insights/encyclopedia/cap-rate", label: "What is a cap rate?" },
    ],
  },
  "/tools/cap-rates": {
    h1: "Cap Rate Map of Canada",
    intro: "Browse live Canadian listings by cap rate and rental yield. The map estimates gross yield and cap rate on active MLS listings using market rent data, so investors can screen Toronto, Vancouver, Calgary, Edmonton, Halifax, Montreal, and dozens of other markets before underwriting a single property.",
    sections: [
      {
        title: "What the map shows",
        body: "Active listings plotted with estimated cap rate, gross rental yield, price, property type, and motivated-seller signals. Filter by city, neighbourhood, price band, bedrooms, and property type, then shortlist the highest-yielding candidates for full underwriting.",
      },
      {
        title: "How cap rates are estimated",
        body: "Estimated market rent (anchored to CMHC benchmarks and comparable rental data) is combined with typical operating expense ratios to produce an estimated NOI, divided by list price. Estimates are screening signals — verify rent, taxes, insurance, and condition before making an offer.",
      },
      {
        title: "From map to underwriting",
        body: "Every listing links into the Realist Deal Analyzer so a promising cap rate becomes a full pro forma: cash flow, cash-on-cash, DSCR, IRR, and financing sensitivity in one workflow.",
      },
    ],
    links: [
      { href: "/tools/analyzer", label: "Open the Deal Analyzer" },
      { href: "/tools/motivated-deals", label: "Motivated Deals Browser" },
      { href: "/insights/market-report", label: "Canadian housing market report" },
      { href: "/insights/encyclopedia/cap-rate", label: "What is a cap rate?" },
    ],
  },
  "/tools/true-cost": {
    h1: "True Cost of Buying a Home in Canada Calculator",
    intro: "The sticker price is not the price. This calculator adds land transfer tax, legal fees, CMHC insurance, inspection, title insurance, adjustments, and monthly carrying costs to show the real all-in cost of buying a home in Canada.",
    sections: [
      {
        title: "Closing costs it includes",
        body: "Provincial and municipal land transfer taxes (including Toronto's), CMHC mortgage default insurance premiums by down-payment tier, legal fees and disbursements, title insurance, home inspection, appraisal, and pre-paid adjustments for taxes and utilities.",
      },
      {
        title: "Carrying costs it projects",
        body: "Mortgage payment at your rate and amortization, property tax, condo fees where applicable, insurance, utilities, and maintenance reserves — the monthly number that actually determines affordability.",
      },
    ],
    links: [
      { href: "/tools/rent-vs-buy", label: "Rent vs Buy Calculator" },
      { href: "/tools/hst-rebate", label: "Ontario New Home HST Rebate Calculator" },
      { href: "/tools/analyzer", label: "Analyze a rental property" },
    ],
  },
  "/tools/rent-vs-buy": {
    h1: "Rent vs Buy Calculator for Canada",
    intro: "Compare the true financial outcome of renting versus buying in any Canadian city. The calculator models mortgage paydown, appreciation, maintenance, taxes, rent inflation, and the opportunity cost of your down payment invested elsewhere.",
    sections: [
      {
        title: "How the comparison works",
        body: "The buy side accumulates equity through principal paydown and appreciation, net of closing costs, property tax, insurance, condo fees, and maintenance. The rent side invests the down payment and any monthly savings at your expected return. The calculator shows the breakeven horizon for your city and assumptions.",
      },
      {
        title: "Why Canadian inputs matter",
        body: "Land transfer taxes, CMHC insurance, the mortgage stress test, and city-level rent levels move the breakeven materially between markets like Toronto, Calgary, and Halifax. Adjust the assumptions to your market instead of relying on US rules of thumb.",
      },
    ],
    links: [
      { href: "/tools/true-cost", label: "True Cost of Buying Calculator" },
      { href: "/tools/analyzer", label: "Real Estate Deal Analyzer" },
      { href: "/insights/mortgage-rates", label: "Canadian mortgage rates today" },
    ],
  },
  "/tools/will-it-plex": {
    h1: "Will It Plex? Multiplex Conversion Analyzer",
    intro: "Find out if a single-family home is a strong multiplex conversion candidate. Will It Plex builds a full financial pro forma for duplex, triplex, and fourplex conversions: renovation budget, unit-by-unit rents, financing, MLI Select points, and stabilized returns.",
    sections: [
      {
        title: "What it screens",
        body: "Lot and building suitability, conversion cost by scope, achievable rent per unit, stabilized NOI and cap rate, refinance proceeds, and whether the conversion meets CMHC MLI Select thresholds for preferred multi-family financing.",
      },
      {
        title: "Policy context",
        body: "Ontario's Bill 23 and municipal multiplex by-laws (including Toronto's) have opened up as-of-right multiplex permissions in many neighbourhoods. The tool pairs the financial screen with that zoning context so you know which properties are worth a feasibility deep-dive.",
      },
    ],
    links: [
      { href: "/tools/multiplex-feasibility", label: "Multiplex Feasibility Screener" },
      { href: "/tools/analyzer", label: "Real Estate Deal Analyzer" },
      { href: "/investing/multiplex", label: "Multiplex investing in Canada" },
    ],
  },
  "/tools/fixed-vs-variable": {
    h1: "Fixed vs Variable Mortgage Calculator for Canada",
    intro: "Compare fixed and variable mortgage outcomes across realistic Canadian rate paths. The calculator models total interest cost, payment changes, and stress scenarios over 5, 10, and 25 years so the fixed-versus-variable decision is based on math, not headlines.",
    sections: [
      {
        title: "What it compares",
        body: "Total interest paid, payment volatility, and remaining balance under multiple rate-path scenarios: rates falling, flat, and rising. It also shows the penalty exposure difference between fixed and variable products on early exit.",
      },
      {
        title: "Why it matters for investors",
        body: "Debt service is the largest line item in most Canadian rental pro formas. A one-point rate difference changes cash flow, DSCR, and refinance timing — run the comparison before locking a term.",
      },
    ],
    links: [
      { href: "/insights/mortgage-rates", label: "Canadian mortgage rates today" },
      { href: "/tools/analyzer", label: "Real Estate Deal Analyzer" },
      { href: "/tools/true-cost", label: "True Cost of Buying Calculator" },
    ],
  },
  "/tools/land-claim-screener": {
    h1: "Indigenous Land Claim Screener for Canadian Real Estate",
    intro: "Free due-diligence screening to check whether a property in Canada falls within or near a historic treaty area, modern treaty, or Indigenous agreement area, using official federal geospatial data.",
    sections: [
      {
        title: "What it checks",
        body: "The screener maps a property against federal treaty and agreement boundary datasets and flags overlaps or proximity. It is a research starting point for title and development due diligence, not a legal opinion.",
      },
      {
        title: "Why investors use it",
        body: "Treaty context can affect development timelines, consultation requirements, and risk pricing on land deals. Screening early keeps surprises out of the closing process.",
      },
    ],
    links: [
      { href: "/tools/analyzer", label: "Real Estate Deal Analyzer" },
      { href: "/tools/motivated-deals", label: "Motivated Deals Browser" },
      { href: "/tools", label: "All Realist tools" },
    ],
  },
  "/tools/motivated-deals": {
    h1: "Canadian Motivated Deals Browser",
    intro: "A live tracker of motivated Canadian listings: motivated sellers, power of sale, foreclosure, court ordered sale, estate sales, and vendor take-back (VTB) opportunities, updated daily from MLS listing language.",
    sections: [
      {
        title: "What counts as a motivated deal",
        body: "Listings whose remarks signal seller urgency or distress: power of sale and foreclosure language, court ordered sales, estate sales, 'motivated seller' phrasing, price reductions, and seller-financing offers. Each signal is scored so the strongest opportunities surface first.",
      },
      {
        title: "How to work the list",
        body: "Filter by province, city, property type, and signal strength, then push candidates into the Deal Analyzer to confirm the numbers survive conservative assumptions. Motivated language is a sourcing signal, not a discount guarantee — always verify condition and title.",
      },
    ],
    links: [
      { href: "/insights/motivated-report", label: "Canadian Motivated Sellers Report" },
      { href: "/tools/analyzer", label: "Real Estate Deal Analyzer" },
      { href: "/tools/cap-rates", label: "Cap Rate Map of Canada" },
    ],
  },
  "/tools/hst-calculator": {
    h1: "Canadian HST Calculator for Real Estate",
    intro: "Calculate HST on Canadian real estate transactions: new construction purchases, assignment sales, commercial property, and investment property — including when HST applies, who remits it, and what rebates may offset it.",
    sections: [
      {
        title: "When HST applies to real estate",
        body: "Resale residential homes are generally exempt, while new construction, substantially renovated homes, assignments, and most commercial transactions attract HST. The calculator walks through the common Ontario scenarios and shows the gross tax and available rebates.",
      },
      {
        title: "Rebates and recovery",
        body: "The federal and Ontario new housing rebates, the new residential rental property rebate for investors, and input tax credits on commercial deals can recover a large share of the HST — but eligibility rules differ by use case and closing structure.",
      },
    ],
    links: [
      { href: "/tools/hst-rebate", label: "Ontario New Home HST Rebate Calculator" },
      { href: "/tools/true-cost", label: "True Cost of Buying Calculator" },
      { href: "/tools/analyzer", label: "Real Estate Deal Analyzer" },
    ],
  },
  "/tools/buybox": {
    h1: "Build Your Real Estate Buy Box",
    intro: "Define your investment criteria — markets, property types, price band, yield targets, and strategy — and get matched with on-market and off-market Canadian properties that fit, plus realtors who specialize in investor deals.",
    sections: [
      {
        title: "How the BuyBox works",
        body: "You set the criteria once: target cities, property types, budget, minimum cap rate or cash flow, and strategy (buy and hold, BRRR, multiplex). Realist and partner agents surface matching opportunities instead of you re-running the same searches.",
      },
      {
        title: "Why a written buy box matters",
        body: "Investors with explicit criteria evaluate deals faster, negotiate with more confidence, and avoid strategy drift. A buy box also makes you a better client for agents, lenders, and partners.",
      },
    ],
    links: [
      { href: "/tools/cap-rates", label: "Cap Rate Map of Canada" },
      { href: "/tools/analyzer", label: "Real Estate Deal Analyzer" },
      { href: "/join/realtors", label: "Realtor partner program" },
    ],
  },
  "/tools/coinvest": {
    h1: "Real Estate Co-Investing Hub",
    intro: "Find partners, structure deals, and pool capital with vetted Canadian real estate co-investors. The hub connects capital partners with operators and provides checklists for structuring joint ventures responsibly.",
    sections: [
      {
        title: "What you can do here",
        body: "Browse co-investment opportunities, create or join investor groups, and work through Realist's co-investing checklist covering roles, capital structure, decision rights, exit terms, and documentation.",
      },
      {
        title: "Partnership diligence",
        body: "Most JV failures are partnership failures, not property failures. Align on strategy, hold period, reserves, and exit triggers in writing before pooling capital — and get independent legal advice on the agreement.",
      },
    ],
    links: [
      { href: "/tools/coinvest/opportunities", label: "Co-investing opportunities" },
      { href: "/community/network", label: "Grow your investor network" },
      { href: "/tools/analyzer", label: "Real Estate Deal Analyzer" },
    ],
  },
  "/insights/market-report": {
    h1: "Canadian Housing Market Report",
    intro: "Realist tracks pricing, inventory, yields, rents, and investor-facing housing signals across major Canadian markets. This page is designed as an indexable content surface first, with the interactive dashboard layered on top for product users.",
    sections: [
      {
        title: "What this page covers",
        body: "National housing context, market-level yield direction, rent signals, and investor-relevant comparisons across Canadian cities.",
      },
      {
        title: "How to use it",
        body: "Use this page to identify which markets deserve deeper underwriting, then move into the analyzer, cap-rate tools, or city-specific reports.",
      },
    ],
    links: [
      { href: "/reports", label: "Browse reports" },
      { href: "/markets/toronto", label: "Toronto market page" },
      { href: "/tools/analyzer", label: "Open deal analyzer" },
    ],
  },
  "/insights/gta-precon-pricing": {
    h1: "GTA Pre-Construction Pricing Report",
    intro: "This report tracks floorplan-level pricing moves in the GTA pre-construction market, with an emphasis on cuts versus raises, project-level movement, and what those changes may imply for investors and end users.",
    sections: [
      {
        title: "Why it matters",
        body: "Pre-construction repricing often leads resale weakness or stabilization, especially in investor-heavy product segments.",
      },
      {
        title: "What to watch",
        body: "Price-cut concentration, project-specific discounting, and which municipalities or product types are repricing fastest.",
      },
    ],
    links: [
      { href: "/canada-housing-market", label: "Canada housing market overview" },
      { href: "/toronto-housing-market", label: "Toronto housing market page" },
      { href: "/reports", label: "All reports" },
    ],
  },
  "/insights/new-construction-canada": {
    h1: "Canada New Construction Report",
    intro: "Realist's new construction report is an indexable national snapshot of active development inventory, pricing, and investor-relevant supply signals across Canada.",
    sections: [
      { title: "Coverage", body: "National and province-level inventory context, pricing direction, and new-build concentration by market." },
      { title: "Investor use case", body: "Use this page to understand where supply pressure may affect resale, rents, and underwriting assumptions." },
    ],
    links: [
      { href: "/reports", label: "All reports" },
      { href: "/markets/toronto", label: "Toronto market page" },
      { href: "/investing/buy-and-hold", label: "Buy and hold strategy page" },
    ],
  },
  "/insights/motivated-report": {
    h1: "Canadian Motivated Sellers Report",
    intro: "This report summarizes motivated-seller listing signals across Canada, including power of sale, foreclosure, motivated-seller language, and related opportunity patterns.",
    sections: [
      { title: "Why it exists", body: "Motivated-seller language is one of the clearest sourcing signals for investors, but it needs context and careful verification." },
      { title: "How to use it", body: "Use this page to identify markets or patterns worth following, then inspect live listings in the Motivated Deals Browser." },
    ],
    links: [
      { href: "/tools/motivated-deals", label: "Open Motivated Deals Browser" },
      { href: "/reports", label: "All reports" },
      { href: "/investing/distress", label: "Motivated-seller investing strategy page" },
    ],
  },
  "/insights/mortgage-rates": {
    h1: "Canadian Mortgage Rates",
    intro: "This page tracks current mortgage rate context for investors and owner-occupiers, with a focus on how financing conditions affect acquisition and refinancing decisions.",
    sections: [
      { title: "Why investors care", body: "Mortgage rate changes affect debt service, cash flow, refinancing economics, and the relative attractiveness of different markets and strategies." },
      { title: "What to do next", body: "Use rates as an underwriting input, not as a standalone decision driver. Pair rate context with property-level analysis." },
    ],
    links: [
      { href: "/tools/analyzer", label: "Open deal analyzer" },
      { href: "/investing/brrr", label: "BRRR strategy page" },
      { href: "/reports", label: "Browse reports" },
    ],
  },
  "/tools/hst-rebate": {
    h1: "Ontario New Home HST Rebate Calculator",
    intro: "Estimate how much a buyer could save under the proposed Ontario HST relief policy for new homes. This public calculator is a prototype based on the March 30, 2026 federal/Ontario announcement and current CRA rebate mechanics.",
    sections: [
      {
        title: "Policy assumptions",
        body: "The calculator assumes full 13% HST relief up to $1,000,000, a $130,000 maximum rebate up to $1,500,000, a linear taper to $24,000 at $1,850,000, and a $24,000 floor above that level until final guidance says otherwise.",
      },
      {
        title: "Implementation status",
        body: "Final eligibility, buyer application process, builder-credit mechanics, and closing-document requirements may change pending royal assent and formal implementation guidance.",
      },
    ],
    links: [
      { href: "https://www.pm.gc.ca/en/news/news-releases/2026/03/30/prime-minister-carney-secures-new-partnership-ontario-cut-taxes", label: "Read the policy announcement" },
      { href: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/gst-hst-rebates/first-time-home-buyers-gst-hst-rebate.html", label: "Review current CRA GST/HST rebate guidance" },
      { href: "/tools/true-cost", label: "Open the True Cost calculator" },
    ],
  },
};

export async function renderSeoFallback(reqPath: string): Promise<string | null> {
  const listingMatch = reqPath.match(/^\/listings\/([^/]+)$/);
  if (listingMatch) {
    const listing = await getListingSeoByMls(decodeURIComponent(listingMatch[1]));
    if (!listing) return null;

    const address = formatListingAddress(listing) || `MLS ${listing.mlsNumber}`;
    const price = formatListingPrice(listing);
    const facts = [
      price,
      listing.bedrooms ? `${listing.bedrooms}${listing.bedroomsPlus ? `+${listing.bedroomsPlus}` : ""} bedrooms` : null,
      listing.bathroomsFull ? `${listing.bathroomsFull}${listing.bathroomsHalf ? `.${listing.bathroomsHalf}` : ""} bathrooms` : null,
      listing.squareFootage ? `${listing.squareFootage.toLocaleString()} sq. ft.` : null,
      listing.structureType || listing.propertyType,
    ].filter(Boolean);
    const metrics = [
      listing.estimatedMonthlyRent ? { label: "Estimated monthly rent", value: formatListingPrice({ listPrice: listing.estimatedMonthlyRent }) || String(listing.estimatedMonthlyRent) } : null,
      listing.capRate ? { label: "Cap rate", value: `${Number(listing.capRate).toFixed(1)}%` } : null,
      listing.grossYield ? { label: "Gross yield", value: `${Number(listing.grossYield).toFixed(1)}%` } : null,
      listing.cashFlowMonthly ? { label: "Monthly cash flow", value: formatListingPrice({ listPrice: listing.cashFlowMonthly }) || String(listing.cashFlowMonthly) } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;

    return renderShell(`
      ${renderBreadcrumbs([
        { href: "/", label: "Home" },
        { href: "/tools/listing-intelligence", label: "Listings" },
        { href: listingCanonicalPath(listing), label: address },
      ])}
      <article>
        <header style="margin-bottom:28px;">
          <p style="font-size:14px;color:#4b5563;margin:0 0 8px;">MLS ${escapeHtml(listing.mlsNumber)}${listing.status ? ` - ${escapeHtml(listing.status)}` : ""}</p>
          <h1 style="font-size:clamp(2rem,4vw,3.5rem);line-height:1.08;margin:0 0 12px;">${escapeHtml(address)}</h1>
          <p style="font-size:18px;line-height:1.7;max-width:780px;color:#4b5563;">${escapeHtml(buildListingSeoDescription(listing))}</p>
        </header>
        ${listing.photoUrl ? `<img src="${escapeHtml(listing.photoUrl)}" alt="${escapeHtml(address)}" style="width:100%;max-height:460px;object-fit:cover;border-radius:12px;margin-bottom:28px;" />` : ""}
        <section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:24px 0;">
          ${facts.map((fact) => `
            <div style="border:1px solid #e5e7eb;border-radius:12px;padding:14px;background:#fff;">
              <strong style="font-size:18px;">${escapeHtml(String(fact))}</strong>
            </div>
          `).join("")}
        </section>
        ${metrics.length ? `
          <section style="margin:32px 0;">
            <h2 style="font-size:28px;margin:0 0 12px;">Realist investment analysis</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
              ${metrics.map((metric) => `
                <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;">
                  <div style="font-size:13px;color:#6b7280;">${escapeHtml(metric.label)}</div>
                  <div style="font-size:22px;font-weight:700;">${escapeHtml(metric.value)}</div>
                </div>
              `).join("")}
            </div>
          </section>
        ` : ""}
        ${listing.publicRemarks ? `
          <section style="font-size:16px;line-height:1.8;max-width:860px;margin:32px 0;">
            <h2 style="font-size:28px;margin:0 0 12px;">Listing remarks</h2>
            <p>${escapeHtml(stripHtml(listing.publicRemarks))}</p>
          </section>
        ` : ""}
        <section style="font-size:16px;line-height:1.8;max-width:860px;margin:32px 0;">
          <h2 style="font-size:28px;margin:0 0 12px;">About this Realist page</h2>
          <p>Realist.ca gives investors a property-level analysis surface for this listing, including address, MLS number, price, property details, rental assumptions when available, yield metrics, and investor due-diligence context.</p>
        </section>
      </article>
      ${renderFooterLinks()}
    `);
  }

  if (reqPath === "/") {
    const latestReports = await storage.getBlogPosts({ status: "published", category: "market-analysis", limit: 6 });
    // Crawlable social proof: live analyzer-run counts (cached 60s). Never
    // block homepage rendering on the counter.
    const analysesStats = await getAnalysesCountStats().catch(() => null);
    const analysesProofLine = analysesStats && analysesStats.total > 0
      ? `
        <p style="font-size:16px;font-weight:600;margin:14px 0 0;color:#0f766e;">
          ${analysesStats.total.toLocaleString("en-CA")} deals analyzed by Canadian investors${analysesStats.thisWeek > 0 ? ` — ${analysesStats.thisWeek.toLocaleString("en-CA")} this week` : ""}.
        </p>`
      : "";
    return renderShell(`
      <header style="margin-bottom:32px;">
        <p style="display:inline-block;border:1px solid #d1d5db;border-radius:999px;padding:6px 10px;font-size:12px;margin-bottom:14px;">AI real estate deal finder for Canada</p>
        <h1 style="font-size:clamp(2.5rem,5vw,4.5rem);line-height:1.05;margin:0 0 14px;">Canadian real estate investing, underwritten by AI.</h1>
        <p style="font-size:18px;line-height:1.7;max-width:760px;color:#4b5563;">
          Realist combines property-level underwriting, market reports, Canadian housing data, and investor workflows into one research surface. Use it to compare rental properties, screen cap rates, understand market risk, and move from a broad search to a defensible investment decision.
        </p>${analysesProofLine}
      </header>
      <section style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;">
        <p>
          The platform is built for Canadian real estate investors who need more than a listing search. A good acquisition decision depends on rent quality, financing assumptions, local supply, resale liquidity, renovation scope, and the investor's own strategy. Realist organizes those inputs into deal analysis tools, market pages, research reports, and repeatable workflows so buyers can move faster without skipping diligence.
        </p>
        <p>
          The homepage links to the core indexable surfaces Google should understand: reports for market research, markets for city-level context, investing pages for strategy education, and tools for underwriting. Those links are plain HTML anchors in the initial response so crawlers can discover the rest of the site without waiting for client-side JavaScript.
        </p>
        <p>
          Realist's research focus is Canadian housing. Topics include the CREA MLS Home Price Index, sales-to-new-listings ratios, CMHC rental benchmarks, new construction supply, pre-construction price movement, mortgage rates, motivated-seller signals, multiplex policy, BRRR execution, and buy-and-hold underwriting. The goal is not generic real estate content; it is practical Canadian deal analysis that connects market data to investment decisions.
        </p>
        <p>
          Start with a report when you need market context, start with a market page when you are comparing cities, and start with the analyzer when a specific property is ready for diligence. Realist keeps those paths connected so a search for an AI real estate deal finder, a CREA housing indicator, or a local investment market can lead to the same practical workflow.
        </p>
      </section>
      <section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:32px 0;">
        ${[
          { title: "Analyze a Deal", body: "Turn an address, listing, or MLS number into cash flow, cap rate, cash-on-cash return, risk signals, financing sensitivity, and next steps.", href: "/tools/analyzer" },
          { title: "Explore the Map", body: "Search Canadian listings through an investor lens with yield, market fit, price movement, property type, and risk context.", href: "/tools/cap-rates" },
          { title: "Motivated Deals", body: "Browse motivated seller, power of sale, foreclosure, court ordered sale, and related opportunity language before it becomes obvious to everyone else.", href: "/tools/motivated-deals" },
          { title: "Market Intelligence", body: "Follow market reports, city pages, strategy pages, and housing data that shape underwriting assumptions for Canadian investors.", href: "/insights" },
        ].map((item) => `
          <article style="border:1px solid #e5e7eb;border-radius:16px;padding:18px;">
            <h2 style="font-size:20px;margin:0 0 10px;">${escapeHtml(item.title)}</h2>
            <p style="margin:0 0 12px;color:#4b5563;line-height:1.6;">${escapeHtml(item.body)}</p>
            <a href="${item.href}" style="color:#0f766e;text-decoration:none;">Explore ${escapeHtml(item.title.toLowerCase())}</a>
          </article>
        `).join("")}
      </section>
      <section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px;margin:40px 0;font-size:16px;line-height:1.75;">
        <article>
          <h2 style="font-size:28px;margin:0 0 10px;">For deal analysis</h2>
          <p>Use Realist when a property needs disciplined underwriting. The analyzer helps investors compare income, expenses, debt service, vacancy, repairs, reserves, and exit assumptions instead of relying on a headline cap rate. It is especially useful for Canadian rental property, multiplex conversion, BRRR, and buy-and-hold decisions where financing and local rules can change the outcome.</p>
        </article>
        <article>
          <h2 style="font-size:28px;margin:0 0 10px;">For market research</h2>
          <p>Market pages and reports connect search intent to underlying data. A Toronto housing market page should point to condo weakness, pre-construction repricing, multiplex rules, and related reports. A Calgary or Hamilton page should explain yield, affordability, rent depth, and the specific investor use cases that make the market different.</p>
        </article>
        <article>
          <h2 style="font-size:28px;margin:0 0 10px;">For investor workflows</h2>
          <p>Realist is designed around repeatable workflows: define a buy box, screen a market, analyze a property, compare scenarios, read the supporting market report, and decide whether to pursue diligence. That structure gives users clearer decisions and gives search engines a crawlable map of the site's expertise.</p>
        </article>
      </section>
      <section style="margin-top:40px;">
        <h2 style="font-size:28px;margin-bottom:12px;">Featured Canadian Real Estate Reports</h2>
        ${renderLinkList(latestReports.map((report) => ({ href: `/reports/${report.slug}`, label: report.title })))}
      </section>
      <section style="margin-top:40px;">
        <h2 style="font-size:28px;margin-bottom:12px;">Start with a market or strategy</h2>
        ${renderLinkList([
          { href: "/markets/toronto", label: "Toronto real estate investment market" },
          { href: "/markets/hamilton", label: "Hamilton real estate investment market" },
          { href: "/markets/calgary", label: "Calgary real estate investment market" },
          { href: "/investing/multiplex", label: "Multiplex investing in Canada" },
          { href: "/investing/brrr", label: "BRRR real estate investing in Canada" },
          { href: "/investing/distress", label: "Motivated-seller investing in Canada" },
        ])}
      </section>
      <section style="margin-top:40px;">
        <h2 style="font-size:28px;margin-bottom:12px;">Learn the language of underwriting</h2>
        <p style="font-size:16px;line-height:1.8;color:#111827;max-width:900px;">The Realist Investor Encyclopedia explains 150+ Canadian real estate investing terms in plain English — definitions, formulas, worked examples, and how each metric is used inside the deal analyzer.</p>
        ${renderLinkList([
          { href: "/insights/encyclopedia", label: "Browse the Real Estate Investor Encyclopedia" },
          { href: "/insights/encyclopedia/cap-rate", label: "What is a cap rate?" },
          { href: "/insights/guides", label: "Canadian real estate guides" },
        ])}
      </section>
      <section style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;margin-top:40px;">
        <h2 style="font-size:28px;margin:0 0 10px;">Why Realist exists</h2>
        <p>
          Canadian investors often have to stitch together listings, mortgage assumptions, spreadsheet models, CMHC rent data, local policy notes, realtor commentary, and macro research. That creates friction and makes it easy to miss important details. Realist brings those surfaces closer together so the research path is more consistent from first search to final offer.
        </p>
        <p>
          The content on Realist is updated around the questions investors actually ask: where prices are softening, where rents support leverage, where new supply may pressure resale, how the sales-to-new-listings ratio is changing, what the CREA MLS Home Price Index says about momentum, and whether a specific property can survive conservative assumptions. Each page should answer a specific question and link to the next useful step.
        </p>
      </section>
      ${renderFooterLinks()}
    `);
  }

  if (reqPath === "/insights") {
    const latestReports = await storage.getBlogPosts({ status: "published", category: "market-analysis", limit: 6 });
    return renderShell(`
      <header>
        <h1 style="font-size:40px;margin:0 0 12px;">Canadian Real Estate Insights & Reports</h1>
        <p style="font-size:18px;color:#4b5563;max-width:760px;line-height:1.7;">Original research, market reports, mortgage commentary, and macro analysis for Canadian real estate investors.</p>
      </header>
      <section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:28px 0;">
        ${[
          { title: "Reports", body: "Crawlable Canadian housing reports and market intelligence.", href: "/reports" },
          { title: "CMHC Land Use Regulations Report", body: "Analysis of CMHC's 2026 research on zoning, approvals, affordability, and housing supply.", href: "/reports/cmhc-land-use-regulations-housing-canada-2026" },
          { title: "Mortgage Rates", body: "Current Canadian mortgage rate context for investors.", href: "/insights/mortgage-rates" },
          { title: "Motivated Report", body: "Monthly power of sale, foreclosure, and motivated-seller signals.", href: "/insights/motivated-report" },
          { title: "Investor Encyclopedia", body: "150+ plain-English Canadian real estate investing definitions, formulas, and worked examples.", href: "/insights/encyclopedia" },
        ].map((item) => `
          <article style="border:1px solid #e5e7eb;border-radius:16px;padding:18px;">
            <h2 style="font-size:20px;margin:0 0 10px;">${escapeHtml(item.title)}</h2>
            <p style="margin:0 0 12px;color:#4b5563;line-height:1.6;">${escapeHtml(item.body)}</p>
            <a href="${item.href}" style="color:#0f766e;text-decoration:none;">Open</a>
          </article>
        `).join("")}
      </section>
      <section style="margin-top:36px;">
        <h2 style="font-size:28px;margin-bottom:12px;">Latest Reports</h2>
        ${renderLinkList(latestReports.map((report) => ({ href: `/reports/${report.slug}`, label: report.title })))}
      </section>
    `);
  }

  if (reqPath === "/reports") {
    const reports = await storage.getBlogPosts({ status: "published", category: "market-analysis", limit: 24 });
    return renderShell(`
      <header>
        <h1 style="font-size:40px;margin:0 0 12px;">Canadian Real Estate Reports</h1>
        <p style="font-size:18px;color:#4b5563;max-width:760px;line-height:1.7;">This report index is designed to be crawlable and useful without JavaScript. Each report page includes stable URLs, article metadata, and internal links into relevant markets and strategies.</p>
      </header>
      ${renderLinkList(reports.map((report) => ({ href: `/reports/${report.slug}`, label: report.title })))}
    `);
  }

  if (reqPath === "/insights/blog") {
    const posts = await storage.getBlogPosts({ status: "published", limit: 16 });
    return renderShell(`
      <header>
        <h1 style="font-size:40px;margin:0 0 12px;">Realist Blog & Research</h1>
        <p style="font-size:18px;color:#4b5563;max-width:760px;line-height:1.7;">Original Canadian real estate analysis, investor research, and market commentary from Realist.</p>
      </header>
      ${renderLinkList(posts.map((post) => ({ href: post.category === "market-analysis" ? `/reports/${post.slug}` : `/insights/blog/${post.slug}`, label: post.title })))}
    `);
  }

  const reportMatch = reqPath.match(/^\/reports\/([^/]+)$/);
  if (reportMatch) {
    const post = await storage.getBlogPostBySlug(reportMatch[1]);
    if (!post) return null;
    const related = await storage.getBlogPosts({ status: "published", category: post.category, limit: 4 });
    const latest = await storage.getBlogPosts({ status: "published", category: "market-analysis", limit: 6 });
    return renderShell(`
      ${renderBreadcrumbs([{ href: "/", label: "Home" }, { href: "/reports", label: "Reports" }, { href: `/reports/${post.slug}`, label: post.title }])}
      <article>
        <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">Report</p>
        <h1 style="font-size:42px;line-height:1.1;margin:8px 0 14px;">${escapeHtml(post.title)}</h1>
        <p style="font-size:18px;color:#4b5563;line-height:1.7;max-width:760px;">${escapeHtml(post.excerpt)}</p>
        <div style="margin:18px 0 28px;font-size:14px;color:#6b7280;">
          ${escapeHtml(post.authorName)}${post.publishedAt ? ` · ${new Date(post.publishedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}` : ""}
        </div>
        <section style="font-size:16px;line-height:1.8;color:#111827;">
          ${post.content}
        </section>
      </article>
      <section style="margin-top:40px;">
        <h2 style="font-size:28px;margin-bottom:12px;">Related Reports</h2>
        ${renderLinkList(related.filter((item) => item.slug !== post.slug).map((item) => ({ href: `/reports/${item.slug}`, label: item.title })))}
      </section>
      <section style="margin-top:32px;">
        <h2 style="font-size:28px;margin-bottom:12px;">Latest Reports</h2>
        ${renderLinkList(latest.filter((item) => item.slug !== post.slug).slice(0, 6).map((item) => ({ href: `/reports/${item.slug}`, label: item.title })))}
      </section>
      ${renderFooterLinks()}
    `);
  }

  const guideMatch = reqPath.match(/^\/insights\/guides\/([^/]+)$/);
  if (guideMatch) {
    const guide = await storage.getGuideBySlug(guideMatch[1]);
    if (!guide) return null;
    return renderShell(`
      <article>
        <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">Guide</p>
        <h1 style="font-size:42px;line-height:1.1;margin:8px 0 14px;">${escapeHtml(guide.title)}</h1>
        <p style="font-size:18px;color:#4b5563;line-height:1.7;max-width:760px;">${escapeHtml(guide.excerpt)}</p>
        <section style="font-size:16px;line-height:1.8;color:#111827;">${guide.content}</section>
      </article>
    `);
  }

  if (reqPath === "/insights/guides") {
    const guides = await storage.getGuides({ status: "published" });
    return renderShell(`
      <header>
        <h1 style="font-size:40px;margin:0 0 12px;">Canadian Real Estate Guides</h1>
        <p style="font-size:18px;color:#4b5563;max-width:760px;line-height:1.7;">Guides built to answer recurring investor questions around financing, taxes, strategy, and execution in Canada.</p>
      </header>
      ${renderLinkList(guides.map((guide) => ({ href: `/insights/guides/${guide.slug}`, label: guide.title })))}
    `);
  }

  if (reqPath === "/insights/encyclopedia") {
    return renderShell(`
      <header>
        <h1 style="font-size:40px;margin:0 0 12px;">Real Estate Investor Encyclopedia</h1>
        <p style="font-size:18px;color:#4b5563;max-width:760px;line-height:1.7;">Plain-English Canadian real estate investing definitions, formulas, examples, caveats, and calculator specs.</p>
      </header>
      ${renderLinkList(encyclopediaGuides.map((guide) => ({ href: guide.canonicalPath, label: guide.title })))}
    `);
  }

  const encyclopediaMatch = reqPath.match(/^\/insights\/encyclopedia\/([^/]+)$/);
  if (encyclopediaMatch) {
    const guide = getEncyclopediaGuide(encyclopediaMatch[1]);
    if (!guide) return null;
    return renderShell(`
      <article>
        <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">Investor Encyclopedia</p>
        <h1 style="font-size:42px;line-height:1.1;margin:8px 0 14px;">${escapeHtml(guide.title)}</h1>
        <p style="font-size:18px;color:#4b5563;line-height:1.7;max-width:760px;">${escapeHtml(guide.summary)}</p>
        <h2>Definition</h2>
        <p>${escapeHtml(guide.definition)}</p>
        ${guide.formula ? `<h2>Formula</h2><p>${escapeHtml(guide.formula)}</p>` : ""}
        ${guide.example ? `<h2>Example</h2><p>${escapeHtml(guide.example)}</p>` : ""}
        <h2>Why It Matters</h2>
        <p>${escapeHtml(guide.whyItMatters)}</p>
        ${guide.investorInterpretation ? `<h2>Investor Interpretation</h2><p>${escapeHtml(guide.investorInterpretation)}</p>` : ""}
        ${guide.realistTieIn ? `<h2>Realist Tie-In</h2><p>${escapeHtml(guide.realistTieIn)}</p>` : ""}
      </article>
    `);
  }

  if (reqPath === "/markets") {
    return renderShell(`
      <header>
        <h1 style="font-size:40px;margin:0 0 12px;">Canadian Real Estate Markets</h1>
        <p style="font-size:18px;color:#4b5563;max-width:760px;line-height:1.7;">These market pages form the programmatic SEO foundation for Realist. Each page links market context to tools, reports, and strategy pages.</p>
      </header>
      <section style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;margin:24px 0;">
        <p>Realist's Canadian real estate market pages are built for investors comparing cities through an underwriting lens. A market page should explain what kind of investor the city fits, what data deserves attention, and which reports or tools should be used before making an offer.</p>
        <p>The pages below cover pricing context, rent support, policy exposure, supply pressure, and related strategies. They are intentionally linked from one crawlable index so search engines can discover every market without relying on infinite scroll, filters, or client-side routing.</p>
        <p>Use this index as the starting point for city research, then move into the deal analyzer, cap-rate tools, market reports, and investing strategy pages for the next layer of diligence.</p>
      </section>
      ${renderLinkList(PROGRAMMATIC_MARKETS.map((market) => ({ href: `/markets/${market.slug}`, label: `${market.city}, ${market.province}` })))}
      ${renderFooterLinks()}
    `);
  }

  const marketMatch = reqPath.match(/^\/markets\/([^/]+)$/);
  if (marketMatch) {
    const market = getProgrammaticMarket(marketMatch[1]);
    if (!market) return null;
    const updated = new Date().toISOString().slice(0, 10);
    return renderShell(`
      ${renderBreadcrumbs([{ href: "/", label: "Home" }, { href: "/markets", label: "Markets" }, { href: `/markets/${market.slug}`, label: market.city }])}
      <article>
        <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">Market Page</p>
        <h1 style="font-size:42px;line-height:1.1;margin:8px 0 14px;">${escapeHtml(market.title)}</h1>
        <p style="font-size:14px;color:#6b7280;margin:0 0 12px;">Updated ${updated}</p>
        <p style="font-size:18px;color:#4b5563;line-height:1.7;max-width:760px;">${escapeHtml(market.intro)}</p>
        <section style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;margin-top:28px;">
          <p>${escapeHtml(market.city)} is tracked as a distinct Canadian real estate investment market because pricing, rent depth, financing risk, policy exposure, and investor competition do not move in the same way across cities. Realist's market pages are designed to help investors move from a broad housing-market question to a concrete underwriting workflow.</p>
          <p>For ${escapeHtml(market.city)}, the starting point is not simply whether the market is going up or down. Investors need to understand which property types fit the local rent base, where affordability creates or destroys leverage, how quickly listings trade, and whether the strategy depends on current income, renovation execution, density upside, or long-term land value.</p>
          <p>The page should be read alongside current reports, property-level analysis, and local professional advice. It is intentionally structured with methodology, related reports, related strategies, and crawlable internal links so both users and search engines can understand how this market connects to the rest of Realist's Canadian housing research.</p>
          <p>A useful ${escapeHtml(market.city)} underwriting process starts with the investor's actual buy box. A multiplex buyer cares about lot dimensions, zoning, conversion cost, refinance risk, and rent by unit type. A buy-and-hold investor cares about stabilized income, vacancy, operating costs, debt service, and resale liquidity. A BRRR investor cares about purchase discount, renovation scope, after-repair value, lender treatment, and the probability that capital can be recycled without forcing optimistic rent assumptions.</p>
          <p>Realist uses this page as a research doorway rather than a final answer. The local market may contain strong and weak submarkets at the same time. A city can show soft headline prices while specific rental pockets remain competitive; it can also show strong demand while individual properties fail because the debt, taxes, insurance, repairs, and management assumptions do not leave enough margin of safety.</p>
        </section>
        <h2 style="font-size:28px;margin:32px 0 10px;">Key Takeaways</h2>
        <ul style="padding-left:18px;line-height:1.8;">${market.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <h2 style="font-size:28px;margin:32px 0 10px;">What Investors Should Watch</h2>
        <p style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;">Watch the relationship between listing price, achievable rent, carrying cost, and the strategy's required execution risk. In ${escapeHtml(market.city)}, a deal that looks attractive on gross yield can still fail after repairs, vacancy, financing, property tax, insurance, utilities, and management are included. The better screen is whether the investment remains reasonable after stress-testing rent, exit value, and interest-rate assumptions.</p>
        <p style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;">Investors should also monitor supply. New construction, condo completions, rental vacancy, and resale inventory can change negotiating power quickly. Where supply is rising, conservative rent growth and a larger contingency are usually more useful than a simple assumption that recent appreciation will continue.</p>
        <h2 style="font-size:28px;margin:32px 0 10px;">Charts and Accessibility</h2>
        <p style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;">When charts are available in the hydrated Realist app, they should describe the metric, time period, and source in adjacent text or image alt text. For search and accessibility, a chart about yields should explain whether it uses gross yield or net yield; a chart about price momentum should explain whether it is based on MLS benchmark prices, listing prices, or project-level pricing data.</p>
        <h2 style="font-size:28px;margin:32px 0 10px;">Historical Trend Context</h2>
        <p style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;">Realist evaluates historical trend through a practical investor lens: changes in price momentum, rent support, supply pressure, and financing conditions. A market with falling prices can still be attractive if rents hold and basis improves; a market with strong demand can still be risky if income does not support debt service. For ${escapeHtml(market.city)}, compare current deal assumptions against recent Canadian housing reports and conservative financing scenarios before treating any trend as investable.</p>
        <h2 style="font-size:28px;margin:32px 0 10px;">Methodology and Sources</h2>
        <p style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;">This market page combines Realist's internal investment framing with public and platform-adjacent housing signals such as CREA market data, CMHC rent benchmarks, municipal policy context, listing inventory, and Realist report archives. The methodology is deliberately conservative: market-level signals identify where diligence should start, while property-level underwriting decides whether a specific acquisition is investable.</p>
        <p style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;">Source citations should be preserved in reports and supporting modules. CREA data is useful for sales, listings, benchmark prices, and market balance. CMHC data is useful for rent and vacancy context. Municipal sources are useful for zoning, approvals, and density permissions. Realist reports connect those inputs to investor decisions, but they do not replace legal, tax, lending, or building-code advice.</p>
        <h2 style="font-size:28px;margin:32px 0 10px;">Related Strategy Pages</h2>
        ${renderLinkList(market.relatedStrategies.map((strategy) => ({ href: `/investing/${strategy}`, label: strategy.replace(/-/g, " ") })))}
        <h2 style="font-size:28px;margin:32px 0 10px;">Related Reports</h2>
        ${renderLinkList((market.relatedReportSlugs.length ? market.relatedReportSlugs : ["new-construction-canada", "gta-precon-pricing"]).map((slug) => ({ href: `/reports/${slug}`, label: slug.replace(/-/g, " ") })))}
        <h2 style="font-size:28px;margin:32px 0 10px;">Investor Workflows</h2>
        ${renderLinkList([
          { href: "/tools/analyzer", label: "Analyze a property" },
          { href: "/reports", label: "Browse reports" },
          { href: "/tools/cap-rates", label: "Explore cap rates" },
        ])}
      </article>
      ${renderFooterLinks()}
    `);
  }

  if (reqPath === "/investing") {
    return renderShell(`
      <header>
        <h1 style="font-size:40px;margin:0 0 12px;">Canadian Real Estate Investing Strategies</h1>
        <p style="font-size:18px;color:#4b5563;max-width:760px;line-height:1.7;">These strategy pages are designed to connect search intent to Realist tools, markets, and reports in a stable indexable structure.</p>
      </header>
      <section style="font-size:16px;line-height:1.85;color:#111827;max-width:900px;margin:24px 0;">
        <p>Realist strategy pages explain how Canadian investors evaluate buy-and-hold, BRRR, multiplex, and motivated-seller opportunities. Each strategy has different risk layers: financing, renovation scope, rent quality, zoning, holding period, exit value, and market liquidity.</p>
        <p>This index also supports Realist's AI real estate deal finder positioning. The search problem is not just finding more listings; it is finding listings that fit a strategy and then testing whether the numbers survive conservative assumptions.</p>
        <p>Start with a strategy below, compare the related markets, then use the analyzer and reports to decide whether a property is worth deeper diligence.</p>
      </section>
      ${renderLinkList(PROGRAMMATIC_STRATEGIES.map((strategy) => ({ href: `/investing/${strategy.slug}`, label: strategy.title })))}
      ${renderFooterLinks()}
    `);
  }

  const strategyMatch = reqPath.match(/^\/investing\/([^/]+)$/);
  if (strategyMatch) {
    const strategy = getProgrammaticStrategy(strategyMatch[1]);
    if (!strategy) return null;
    return renderShell(`
      <article>
        <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">Strategy Page</p>
        <h1 style="font-size:42px;line-height:1.1;margin:8px 0 14px;">${escapeHtml(strategy.title)}</h1>
        <p style="font-size:18px;color:#4b5563;line-height:1.7;max-width:760px;">${escapeHtml(strategy.intro)}</p>
        <h2 style="font-size:28px;margin:32px 0 10px;">Key Ideas</h2>
        <ul style="padding-left:18px;line-height:1.8;">${strategy.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <h2 style="font-size:28px;margin:32px 0 10px;">Relevant Markets</h2>
        ${renderLinkList(strategy.relatedMarkets.map((market) => ({ href: `/markets/${market}`, label: market.replace(/-/g, " ") })))}
      </article>
    `);
  }

  // Event pages (audit item 12): real crawlable content for /events/:slug —
  // h1 event name, date, venue, and ticket link.
  const eventMatch = reqPath.match(/^\/events\/([^/]+)$/);
  if (eventMatch) {
    const { getPublishedEventForSeo, formatEventDate } = await import("./seoMeta");
    const event = await getPublishedEventForSeo(decodeURIComponent(eventMatch[1])).catch(() => null);
    if (!event) return null;
    const dateLabel = formatEventDate(event.startsAt);
    const venueLabel = event.eventType === "ONLINE"
      ? "Online event"
      : [event.venueName, event.venueAddress, event.city].filter(Boolean).join(", ") || "Venue to be announced";
    const priceLabel = event.minPriceCents != null
      ? (event.minPriceCents === 0 ? "Free" : `Tickets from $${(event.minPriceCents / 100).toFixed(2)} ${event.currency}`)
      : null;
    const description = event.seoDescription || event.shortDescription || "";
    return renderShell(`
      ${renderBreadcrumbs([
        { href: "/", label: "Home" },
        { href: "/community/events", label: "Events" },
        { href: `/events/${event.slug}`, label: event.title },
      ])}
      <article>
        <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">Realist Event</p>
        <h1 style="font-size:clamp(2rem,4vw,3.25rem);line-height:1.1;margin:8px 0 14px;">${escapeHtml(event.title)}</h1>
        <p style="font-size:16px;color:#111827;margin:0 0 6px;"><strong>Date:</strong> ${escapeHtml(dateLabel)}</p>
        <p style="font-size:16px;color:#111827;margin:0 0 14px;"><strong>Location:</strong> ${escapeHtml(venueLabel)}</p>
        ${priceLabel ? `<p style="font-size:16px;color:#111827;margin:0 0 14px;"><strong>Price:</strong> ${escapeHtml(priceLabel)}</p>` : ""}
        ${description ? `<p style="font-size:18px;color:#4b5563;line-height:1.7;max-width:760px;">${escapeHtml(description)}</p>` : ""}
        ${event.longDescription ? `
          <section style="font-size:16px;line-height:1.8;max-width:860px;margin:24px 0;">
            <h2 style="font-size:28px;margin:0 0 12px;">About this event</h2>
            <p>${escapeHtml(stripHtml(event.longDescription))}</p>
          </section>
        ` : ""}
        <p style="margin:24px 0;">
          <a href="/events/${escapeHtml(event.slug)}" style="display:inline-block;background:#0f766e;color:#fff;border-radius:8px;padding:12px 22px;text-decoration:none;font-weight:600;">Get tickets</a>
        </p>
        <section style="font-size:16px;line-height:1.8;max-width:860px;margin:24px 0;">
          <h2 style="font-size:28px;margin:0 0 12px;">More from Realist</h2>
          ${renderLinkList([
            { href: "/community/events", label: "All Canadian real estate investor events" },
            { href: "/community", label: "Join the Realist investor community" },
            { href: "/insights/podcast", label: "The Canadian Real Estate Investor Podcast" },
          ])}
        </section>
      </article>
      ${renderFooterLinks()}
    `);
  }

  // Podcast hub: crawlable episode index so every /insights/podcast/:slug
  // page is discoverable from plain HTML anchors.
  if (reqPath === "/insights/podcast") {
    const { getPodcastEpisodes } = await import("./podcastFeed");
    const episodes = await getPodcastEpisodes().catch(() => []);
    return renderShell(`
      <header>
        <h1 style="font-size:40px;margin:0 0 12px;">The Canadian Real Estate Investor Podcast</h1>
        <p style="font-size:18px;color:#4b5563;max-width:760px;line-height:1.7;">Canada's #1 real estate podcast, hosted by Daniel Foch and Nick Hill. Weekly episodes on the Canadian housing market, mortgages, investing strategy, and policy — every episode below has its own page with full show notes and an in-browser player.</p>
      </header>
      <section style="margin:24px 0;">
        <h2 style="font-size:28px;margin-bottom:12px;">Listen on your favourite platform</h2>
        ${renderLinkList([
          { href: PODCAST_APPLE_URL, label: "Apple Podcasts" },
          { href: PODCAST_SPOTIFY_URL, label: "Spotify" },
          { href: PODCAST_YOUTUBE_URL, label: "YouTube" },
        ])}
      </section>
      <section style="margin-top:32px;">
        <h2 style="font-size:28px;margin-bottom:12px;">All Episodes</h2>
        ${renderLinkList(episodes.map((episode) => ({
          href: `/insights/podcast/${episode.slug}`,
          label: episode.title,
        })))}
      </section>
      ${renderFooterLinks()}
    `);
  }

  // Per-episode podcast pages: full show notes, audio, topics, related
  // episodes, and the contextual tool CTA — all in the pre-hydration HTML.
  const podcastEpisodeMatch = reqPath.match(/^\/insights\/podcast\/([^/]+)$/);
  if (podcastEpisodeMatch) {
    const { getEpisodePayload } = await import("./podcastFeed");
    const payload = await getEpisodePayload(decodeURIComponent(podcastEpisodeMatch[1])).catch(() => null);
    if (!payload) return null;
    const publishedDate = payload.pubDate ? new Date(payload.pubDate) : null;
    const dateLabel = publishedDate && !isNaN(publishedDate.getTime())
      ? publishedDate.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })
      : null;
    return renderShell(`
      ${renderBreadcrumbs([
        { href: "/", label: "Home" },
        { href: "/insights/podcast", label: "Podcast" },
        { href: `/insights/podcast/${payload.slug}`, label: payload.title },
      ])}
      <article>
        <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">The Canadian Real Estate Investor Podcast</p>
        <h1 style="font-size:clamp(2rem,4vw,3.25rem);line-height:1.1;margin:8px 0 14px;">${escapeHtml(payload.title)}</h1>
        <p style="font-size:14px;color:#6b7280;margin:0 0 14px;">
          ${dateLabel ? `Published ${escapeHtml(dateLabel)}` : ""}${payload.duration ? ` · ${escapeHtml(payload.duration)}` : ""}
        </p>
        ${payload.topics.length ? `<p style="font-size:14px;color:#4b5563;margin:0 0 18px;"><strong>Topics:</strong> ${payload.topics.map(escapeHtml).join(", ")}</p>` : ""}
        ${payload.audioUrl ? `
          <audio controls preload="none" src="${escapeHtml(payload.audioUrl)}" style="width:100%;max-width:760px;margin:8px 0 20px;">
            <a href="${escapeHtml(payload.audioUrl)}">Listen to ${escapeHtml(payload.title)}</a>
          </audio>
        ` : ""}
        <section style="font-size:16px;line-height:1.8;max-width:860px;margin:20px 0;">
          <h2 style="font-size:28px;margin:0 0 12px;">Show Notes</h2>
          ${payload.showNotesHtml}
        </section>
        <section style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;max-width:760px;margin:28px 0;">
          <h2 style="font-size:22px;margin:0 0 8px;">Put this episode to work</h2>
          <p style="font-size:16px;color:#4b5563;margin:0 0 12px;">${escapeHtml(payload.cta.copy)}</p>
          <p style="margin:0;">
            <a href="${escapeHtml(payload.cta.primary.href)}" style="display:inline-block;background:#0f766e;color:#fff;border-radius:8px;padding:10px 20px;text-decoration:none;font-weight:600;">${escapeHtml(payload.cta.primary.label)}</a>
            ${payload.cta.secondary ? `&nbsp; <a href="${escapeHtml(payload.cta.secondary.href)}" style="color:#0f766e;text-decoration:none;font-weight:600;">${escapeHtml(payload.cta.secondary.label)}</a>` : ""}
          </p>
        </section>
        <section style="margin:28px 0;">
          <h2 style="font-size:22px;margin:0 0 8px;">Listen on</h2>
          ${renderLinkList([
            { href: PODCAST_APPLE_URL, label: "Apple Podcasts" },
            { href: PODCAST_SPOTIFY_URL, label: "Spotify" },
            { href: PODCAST_YOUTUBE_URL, label: "YouTube" },
          ])}
        </section>
        ${payload.related.length ? `
          <section style="margin:28px 0;">
            <h2 style="font-size:22px;margin:0 0 8px;">Related Episodes</h2>
            ${renderLinkList(payload.related.map((related) => ({
              href: `/insights/podcast/${related.slug}`,
              label: related.title,
            })))}
          </section>
        ` : ""}
      </article>
      ${renderFooterLinks()}
    `);
  }

  const staticPage = STATIC_DATA_PAGE_CONTENT[reqPath];
  if (staticPage) {
    return renderShell(`
      <article>
        <h1 style="font-size:42px;line-height:1.1;margin:8px 0 14px;">${escapeHtml(staticPage.h1)}</h1>
        <p style="font-size:18px;color:#4b5563;line-height:1.7;max-width:760px;">${escapeHtml(staticPage.intro)}</p>
        ${staticPage.sections.map((section) => `
          <section style="margin-top:28px;">
            <h2 style="font-size:28px;margin:0 0 8px;">${escapeHtml(section.title)}</h2>
            <p style="font-size:16px;line-height:1.8;color:#111827;">${escapeHtml(section.body)}</p>
          </section>
        `).join("")}
        <section style="margin-top:32px;">
          <h2 style="font-size:28px;margin-bottom:10px;">Related Pages</h2>
          ${renderLinkList(staticPage.links)}
        </section>
      </article>
    `);
  }

  return null;
}
