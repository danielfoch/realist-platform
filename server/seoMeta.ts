import { storage } from "./storage";
import { getProgrammaticMarket, getProgrammaticStrategy } from "@shared/programmaticSeo";

export interface PageMeta {
  title: string;
  description: string;
  ogImage?: string;
  ogType?: "website" | "article" | "product";
  keywords?: string;
  canonicalPath?: string;
  structuredData?: object | object[];
}

const DEFAULT: PageMeta = {
  title: "Realist.ca - Canadian Real Estate Deal Analyzer | Toronto Real Estate Investing",
  description: "Canada's #1 real estate deal analyzer. Analyze properties in Toronto, Vancouver, Calgary & across Canada. Calculate cap rates, IRR, cash-on-cash returns. Home of the Canadian Real Estate Investor Podcast with Daniel Foch.",
};

const STATIC_META: Record<string, PageMeta> = {
  "/": DEFAULT,
  "/about": {
    title: "About Realist.ca - Canadian Real Estate Investing Community",
    description: "Realist.ca is Canada's biggest real estate investor community, home of the Canadian Real Estate Investor Podcast with Daniel Foch, Nick Hill, and Jonathan Woo.",
  },
  "/about/contact": {
    title: "Contact Realist.ca",
    description: "Get in touch with the Realist.ca team — partnerships, press, podcast bookings, and product feedback.",
  },
  "/about/shop": {
    title: "Realist.ca Shop - Real Estate Investor Merch",
    description: "Books, merch, and resources from the Canadian Real Estate Investor Podcast and Realist.ca community.",
  },
  // Tools
  "/tools": {
    title: "Free Canadian Real Estate Tools - Realist.ca",
    description: "Free tools for Canadian real estate investors: deal analyzer, cap rate calculator, rent vs buy, true cost calculator, fixed vs variable mortgage, and more.",
  },
  "/tools/analyzer": {
    title: "Free Canadian Real Estate Deal Analyzer - Cap Rate, IRR, BRRR | Realist.ca",
    description: "Analyze any Canadian rental property in seconds. Calculate cap rate, cash-on-cash, IRR, BRRR returns, multiplex viability and more. Free, no signup.",
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
  "/tools/cap-rates": {
    title: "Canadian Cap Rates by City - Realist.ca",
    description: "Live cap rates and rental yields by Canadian city and neighbourhood. Toronto, Vancouver, Calgary, Edmonton, Halifax, Montreal and more.",
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
  "/tools/distress-deals": {
    title: "Canadian Distress Deals - Power of Sale & Foreclosure Tracker",
    description: "Live tracker of distressed Canadian listings: power of sale, foreclosure, court order sale, motivated sellers. Updated daily.",
  },
  "/tools/hst-rebate": {
    title: "Ontario HST Rebate Calculator (New Construction & Investment)",
    description: "Calculate your Ontario new home HST rebate — owner-occupied or rental (NRRP). Free, instant, no signup.",
  },
  "/tools/hst-calculator": {
    title: "Canadian HST Calculator for Real Estate - Realist.ca",
    description: "Calculate HST on Canadian real estate transactions: new construction, assignments, commercial, and investment property.",
  },
  // Course / Community
  "/course": {
    title: "Multiplex Masterclass - Canadian Real Estate Course | Realist.ca",
    description: "Daniel Foch's complete Canadian multiplex investing course. Acquisition, financing, conversion, refinance, and operations — taught from real deals.",
  },
  "/community": {
    title: "Canadian Real Estate Investor Community - Realist.ca",
    description: "Join 11,000+ Canadian real estate investors. Network, deal flow, accountability groups, and live events.",
  },
  "/community/leaderboard": {
    title: "Realist Investor Leaderboard - Top Canadian Real Estate Investors",
    description: "See who's running the most deal analyses, building the biggest portfolios, and contributing the most to the Canadian real estate investor community.",
  },
  "/community/events": {
    title: "Canadian Real Estate Investor Events - Realist.ca",
    description: "Meetups, masterminds, podcast tapings, and live events for Canadian real estate investors.",
  },
  "/community/network": {
    title: "Realist Network - Connect with Canadian Real Estate Investors",
    description: "Find investors, partners, mentors, lenders, agents, and contractors across the Canadian real estate market.",
  },
  // Insights / Reports
  "/insights": {
    title: "Canadian Real Estate Insights & Reports - Realist.ca",
    description: "Original research, market reports, mortgage commentary, and macro analysis for Canadian real estate investors.",
  },
  "/insights/market-report": {
    title: "Canadian Real Estate Market Report - Live Data | Realist.ca",
    description: "Live Canadian housing market dashboard. Sales, prices, inventory, mortgage rates, yield, distress, and macro indicators across every major Canadian city.",
  },
  "/insights/distress-report": {
    title: "Canadian Distress Real Estate Report - Power of Sale Trends",
    description: "Tracking power of sale, foreclosure, and motivated-seller listings across Canada — by city, province, and time.",
  },
  "/insights/mortgage-rates": {
    title: "Canadian Mortgage Rates Today - Big 6 Banks & Best Rates",
    description: "Live Canadian mortgage rates from the Big 6 banks and top brokers. 5-year fixed, variable, insured vs uninsured, and historical comparisons.",
  },
  "/insights/building-permits": {
    title: "Canadian Building Permits Report - February 2026 | Realist.ca",
    description: "StatCan building permits data analyzed: $12.1B total, residential +1.7%, non-residential -24%. What it means for the Canadian housing pipeline.",
  },
  "/insights/productivity-gap": {
    title: "Canada-US Productivity Gap & Real Estate Implications - Realist.ca",
    description: "Why Canada's productivity gap with the US matters for housing, investment, and long-run real estate returns.",
  },
  "/insights/new-construction-canada": {
    title: "Canada New Construction Market Report - Live CREA DDF Data",
    description: "Live national snapshot of active new construction listings across Canada. Pricing by province and city, property types, pre-construction signals.",
  },
  "/insights/gta-precon-pricing": {
    title: "GTA Pre-Construction Pricing Movement Report - Cuts vs Raises",
    description: "Floorplan-level analysis of 768 active GTA pre-construction units across 83 projects. Cuts outnumber raises 2.9 to 1. Implications for the resale market.",
    ogType: "article",
  },
  "/canada-housing-market": {
    title: "Canada Housing Market 2026 - Live Data & Analysis | Realist.ca",
    description: "Live Canada housing market data. New construction inventory, pre-construction price movement, and what it signals for the resale market across major Canadian cities.",
    ogType: "article",
  },
  "/toronto-housing-market": {
    title: "Toronto Housing Market 2026 - Live Pre-Construction Data | Realist.ca",
    description: "Live Toronto housing market data: pre-construction price cuts vs raises across active developments. Average PSF change, biggest discounts, by city.",
    ogType: "article",
  },
  "/toronto-condo-prices-dropping": {
    title: "Are Toronto Condo Prices Dropping? Live 2026 Data | Realist.ca",
    description: "Yes — Toronto condo prices are dropping. Live floorplan-level data shows hundreds of pre-construction price cuts vs few raises. See the data, by project.",
    ogType: "article",
  },
  "/biggest-price-drops-gta": {
    title: "Biggest GTA Pre-Construction Price Drops 2026 | Realist.ca",
    description: "Live ranking of the biggest pre-construction price drops in the GTA. Top floorplan cuts, projects with the most reductions, deepest discounts. Updated daily.",
    ogType: "article",
  },
  "/insights/podcast": {
    title: "The Canadian Real Estate Investor Podcast - Daniel Foch & Nick Hill",
    description: "Canada's #1 real estate podcast. Weekly episodes on the Canadian housing market, mortgages, investing strategy, and policy.",
  },
  "/insights/blog": {
    title: "Realist Blog - Canadian Real Estate Analysis & Commentary",
    description: "Original Canadian real estate analysis from the Realist.ca team and the Canadian Real Estate Investor Podcast.",
  },
  "/reports": {
    title: "Canadian Real Estate Reports - Realist.ca",
    description: "Crawlable index of Realist market reports, data-driven housing insights, and investor research.",
  },
  "/markets": {
    title: "Canadian Real Estate Markets - Realist.ca",
    description: "Programmatic market pages for major Canadian cities, connected to reports, strategies, and underwriting workflows.",
  },
  "/investing": {
    title: "Canadian Real Estate Investing Strategies - Realist.ca",
    description: "Strategy pages for multiplex, BRRR, buy-and-hold, and distress investing on Realist.ca.",
  },
  "/insights/guides": {
    title: "Canadian Real Estate Guides - Realist.ca",
    description: "Plain-English guides to Canadian real estate investing: BRRR, multiplex, HST, financing, taxes, and strategy.",
  },
  // Join
  "/join/realtors": {
    title: "Realtor Partner Program - Realist.ca",
    description: "Join Canada's most active real estate investor community as a partner agent. Get matched with serious investor buyers in your market.",
  },
  "/join/lenders": {
    title: "Lender Partner Program - Realist.ca",
    description: "Reach Canadian real estate investors actively analyzing deals. Become a featured Realist.ca mortgage and capital partner.",
  },
};

export async function getMetaForPath(rawPath: string): Promise<PageMeta> {
  // Strip query string and hash
  const path = rawPath.split("?")[0].split("#")[0];

  // Static lookup
  if (STATIC_META[path]) return STATIC_META[path];

  // Trim trailing slash
  if (path.endsWith("/") && path.length > 1) {
    const trimmed = path.slice(0, -1);
    if (STATIC_META[trimmed]) return STATIC_META[trimmed];
  }

  // Dynamic blog post
  const blogMatch = path.match(/^\/insights\/blog\/([^\/]+)$/);
  if (blogMatch) {
    try {
      const post = await storage.getBlogPostBySlug(blogMatch[1]);
      if (post) {
        return {
          title: post.metaTitle || `${post.title} | Realist.ca`,
          description: post.metaDescription || post.excerpt,
          ogImage: post.coverImage || undefined,
          ogType: "article",
          canonicalPath: post.category === "market-analysis" ? `/reports/${post.slug}` : `/insights/blog/${post.slug}`,
          structuredData: [
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: "https://realist.ca/" },
                { "@type": "ListItem", position: 2, name: post.category === "market-analysis" ? "Reports" : "Blog", item: `https://realist.ca/${post.category === "market-analysis" ? "reports" : "insights/blog"}` },
                { "@type": "ListItem", position: 3, name: post.title, item: `https://realist.ca/${post.category === "market-analysis" ? `reports/${post.slug}` : `insights/blog/${post.slug}`}` },
              ],
            },
          ],
        };
      }
    } catch { /* fall through */ }
  }

  const reportMatch = path.match(/^\/reports\/([^\/]+)$/);
  if (reportMatch) {
    try {
      const post = await storage.getBlogPostBySlug(reportMatch[1]);
      if (post) {
        return {
          title: post.metaTitle || `${post.title} | Realist.ca`,
          description: post.metaDescription || post.excerpt,
          ogImage: post.coverImage || undefined,
          ogType: "article",
          canonicalPath: `/reports/${post.slug}`,
          structuredData: [
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: "https://realist.ca/" },
                { "@type": "ListItem", position: 2, name: "Reports", item: "https://realist.ca/reports" },
                { "@type": "ListItem", position: 3, name: post.title, item: `https://realist.ca/reports/${post.slug}` },
              ],
            },
          ],
        };
      }
    } catch {}
  }

  // Dynamic project landing
  const projectMatch = path.match(/^\/projects\/([^\/]+)$/);
  if (projectMatch) {
    try {
      const { getProjectDetail } = await import("./preconPricingReport");
      const detail = getProjectDetail(projectMatch[1]);
      if (detail) {
        const s = detail.summary;
        const dir = s.avgDeltaPct < -1 ? "Cuts" : s.avgDeltaPct > 1 ? "Raises" : "Holds";
        return {
          title: `${s.project} ${s.city} - Pre-Construction Prices & ${dir} | Realist.ca`,
          description: `${s.project} by ${s.developer} in ${s.city}. ${s.cuts} price cuts, ${s.raises} raises across ${s.totalFloorplans} active floorplans. Avg PSF change ${s.avgDeltaPct >= 0 ? "+" : ""}${s.avgDeltaPct.toFixed(1)}%.`,
          ogType: "article",
        };
      }
    } catch { /* fall through */ }
  }

  // Dynamic guide
  const guideMatch = path.match(/^\/insights\/guides\/([^\/]+)$/);
  if (guideMatch) {
    try {
      const guide = await storage.getGuideBySlug(guideMatch[1]);
      if (guide) {
        return {
          title: guide.metaTitle || `${guide.title} | Realist.ca`,
          description: guide.metaDescription || guide.excerpt,
          ogImage: guide.coverImage || undefined,
          ogType: "article",
          canonicalPath: `/insights/guides/${guide.slug}`,
          structuredData: [
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: "https://realist.ca/" },
                { "@type": "ListItem", position: 2, name: "Guides", item: "https://realist.ca/insights/guides" },
                { "@type": "ListItem", position: 3, name: guide.title, item: `https://realist.ca/insights/guides/${guide.slug}` },
              ],
            },
          ],
        };
      }
    } catch { /* fall through */ }
  }

  const marketMatch = path.match(/^\/markets\/([^\/]+)$/);
  if (marketMatch) {
    const market = getProgrammaticMarket(marketMatch[1]);
    if (market) {
      return {
        title: `${market.title} | Realist.ca`,
        description: market.description,
        ogType: "article",
        canonicalPath: `/markets/${market.slug}`,
        structuredData: {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://realist.ca/" },
            { "@type": "ListItem", position: 2, name: "Markets", item: "https://realist.ca/markets" },
            { "@type": "ListItem", position: 3, name: market.city, item: `https://realist.ca/markets/${market.slug}` },
          ],
        },
      };
    }
  }

  const strategyMatch = path.match(/^\/investing\/([^\/]+)$/);
  if (strategyMatch) {
    const strategy = getProgrammaticStrategy(strategyMatch[1]);
    if (strategy) {
      return {
        title: `${strategy.title} | Realist.ca`,
        description: strategy.description,
        ogType: "article",
        canonicalPath: `/investing/${strategy.slug}`,
        structuredData: {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://realist.ca/" },
            { "@type": "ListItem", position: 2, name: "Investing", item: "https://realist.ca/investing" },
            { "@type": "ListItem", position: 3, name: strategy.title, item: `https://realist.ca/investing/${strategy.slug}` },
          ],
        },
      };
    }
  }

  return DEFAULT;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeCanonical(url: string): string {
  // Strip trailing slash unless it's the root
  try {
    const u = new URL(url);
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.replace(/\/+$/, "");
    }
    return u.toString();
  } catch {
    return url;
  }
}

export function injectMetaIntoHtml(html: string, meta: PageMeta, canonicalUrlRaw: string, origin: string): string {
  const canonicalUrl = normalizeCanonical(meta.canonicalPath ? `${origin}${meta.canonicalPath}` : canonicalUrlRaw);
  const fullTitle = meta.title.includes("Realist") ? meta.title : `${meta.title} | Realist.ca`;
  const desc = escapeHtml(meta.description);
  const titleEsc = escapeHtml(fullTitle);
  const ogImage = meta.ogImage
    ? (meta.ogImage.startsWith("http") ? meta.ogImage : `${origin}${meta.ogImage.startsWith("/") ? "" : "/"}${meta.ogImage}`)
    : `${origin}/og-image.png`;
  const ogType = meta.ogType || "website";

  let out = html;

  // Replace <title>
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${titleEsc}</title>`);

  // Helper to replace a meta tag by name or property
  function replaceMeta(attr: "name" | "property", key: string, content: string) {
    const re = new RegExp(`<meta\\s+${attr}=["']${key}["'][^>]*>`, "i");
    const tag = `<meta ${attr}="${key}" content="${escapeHtml(content)}" />`;
    if (re.test(out)) out = out.replace(re, tag);
    else out = out.replace("</head>", `    ${tag}\n  </head>`);
  }

  function replaceLink(rel: string, href: string) {
    const re = new RegExp(`<link\\s+rel=["']${rel}["'][^>]*>`, "i");
    const tag = `<link rel="${rel}" href="${escapeHtml(href)}" />`;
    if (re.test(out)) out = out.replace(re, tag);
    else out = out.replace("</head>", `    ${tag}\n  </head>`);
  }

  replaceMeta("name", "description", meta.description);
  if (meta.keywords) replaceMeta("name", "keywords", meta.keywords);
  replaceLink("canonical", canonicalUrl);

  replaceMeta("property", "og:title", fullTitle);
  replaceMeta("property", "og:description", meta.description);
  replaceMeta("property", "og:url", canonicalUrl);
  replaceMeta("property", "og:type", ogType);
  replaceMeta("property", "og:image", ogImage);

  replaceMeta("name", "twitter:title", fullTitle);
  replaceMeta("name", "twitter:description", meta.description);
  replaceMeta("name", "twitter:image", ogImage);

  // JSON-LD structured data
  const ldBlocks: any[] = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Realist.ca",
      url: origin,
      logo: `${origin}/favicon.png`,
      sameAs: [
        "https://www.youtube.com/@CanadianRealEstateInvestor",
        "https://twitter.com/RealistCA",
        "https://www.instagram.com/realist.ca/",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Realist.ca",
      url: origin,
      potentialAction: {
        "@type": "SearchAction",
        target: `${origin}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ];
  if (ogType === "article") {
    ldBlocks.push({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: fullTitle,
      description: meta.description,
      image: ogImage,
      url: canonicalUrl,
      publisher: {
        "@type": "Organization",
        name: "Realist.ca",
        logo: { "@type": "ImageObject", url: `${origin}/favicon.png` },
      },
    });
  }
  if (meta.structuredData) {
    const customBlocks = Array.isArray(meta.structuredData) ? meta.structuredData : [meta.structuredData];
    ldBlocks.push(...customBlocks);
  }
  const ldScript = ldBlocks
    .map((b) => `<script type="application/ld+json">${JSON.stringify(b).replace(/</g, "\\u003c")}</script>`)
    .join("\n    ");
  // Strip any previously-injected ld+json from the template, then add fresh
  out = out.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, "");
  out = out.replace("</head>", `    ${ldScript}\n  </head>`);

  return out;
}
