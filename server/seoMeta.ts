import { storage } from "./storage";
import { encyclopediaGuides, getEncyclopediaGuide } from "@shared/encyclopedia";
import { getProgrammaticMarket, getProgrammaticStrategy } from "@shared/programmaticSeo";
import { SHARED_ROUTE_META } from "@shared/routeMeta";
import {
  ORGANIZATION_SAME_AS,
  PODCAST_NAME,
  PODCAST_RSS_URL,
  PODCAST_SAME_AS,
} from "@shared/brand";
import {
  buildListingSeoDescription,
  buildListingSeoTitle,
  buildListingStructuredData,
  getListingSeoByMls,
  listingCanonicalPath,
} from "./listingSeo";
import { deriveEpisodeKeywords } from "@shared/podcastEpisodes";
import {
  durationToIso8601,
  stripShowNotes,
  type PodcastEpisode as PodcastFeedEpisode,
} from "./podcastFeed";

const BASE_URL = "https://realist.ca";
const RSS_FEED_URL = "https://thecanadianrealestateinvestor.substack.com/feed";

export interface PageMeta {
  title: string;
  description: string;
  ogImage?: string;
  ogType?: "website" | "article" | "product";
  keywords?: string;
  canonicalPath?: string;
  structuredData?: object | object[];
  noindex?: boolean;
}

const DEFAULT: PageMeta = {
  title: "Realist | Canadian Real Estate Deal Finder",
  description: "Use Realist to find, analyze, and compare Canadian real estate deals with AI-powered underwriting, market reports, and investor tools.",
};

/** Exported so the static catch-all can detect "no route matched" (real 404s). */
export const DEFAULT_META = DEFAULT;

const STATIC_META: Record<string, PageMeta> = {
  // Homepage + /tools/* titles and descriptions come from the shared route
  // meta map so the server head tags and the client Helmet layer can never
  // disagree (the client SEO component reads the same module).
  ...SHARED_ROUTE_META,
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
    description: "Live Canadian housing market dashboard. Sales, prices, inventory, mortgage rates, yield, motivated-seller signals, and macro indicators across every major Canadian city.",
  },
  "/insights/motivated-report": {
    title: "Canadian Motivated Real Estate Report - Motivated Seller & Power of Sale Trends",
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
  "/insights/labour-mortgage-stress-april-2026": {
    title: "Canada Labour Market and Mortgage Arrears Watch - April 2026 | Realist.ca",
    description: "StatCan labour and payroll data compared with CBA mortgage arrears context: unemployment as a leading indicator for Canadian mortgage delinquencies.",
    ogType: "article",
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
  "/insights/cpi-march-2026": {
    title: "CREA MLS Home Price Index March 2026 Canada | Realist",
    description: "Read Realist's CREA MLS Home Price Index March 2026 Canada analysis with prices, inflation context, and investor takeaways.",
    ogType: "article",
  },
  "/insights/spring-economic-update-2026": {
    title: "CREA Sales-to-New-Listings Ratio March 2026 | Realist",
    description: "Track Canada's CREA sales-to-new-listings ratio March 2026 with market balance, price pressure, and deal signals from Realist.",
    ogType: "article",
  },
  "/insights/the-spread-that-ate-the-economy": {
    title: "The Spread That Ate the Economy - Credit, Housing, and Capital Allocation | Realist.ca",
    description: "An interactive Realist research report on how Canada’s residential credit system, lower investor yield requirements, and business-credit frictions may have redirected capital toward housing and away from entrepreneurship.",
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
    canonicalPath: "/insights/podcast",
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "PodcastSeries",
        "@id": `${BASE_URL}/insights/podcast#podcast`,
        name: PODCAST_NAME,
        url: `${BASE_URL}/insights/podcast`,
        description: "Canada's #1 real estate podcast. Weekly episodes on the Canadian housing market, mortgages, investing strategy, and policy.",
        webFeed: PODCAST_RSS_URL,
        sameAs: PODCAST_SAME_AS,
        inLanguage: "en-CA",
        author: [
          {
            "@type": "Person",
            "@id": `${BASE_URL}/#danielfoch`,
            name: "Daniel Foch",
            jobTitle: "Chief Real Estate Officer, Realist.ca",
          },
          {
            "@type": "Person",
            "@id": `${BASE_URL}/#nickhill`,
            name: "Nick Hill",
            jobTitle: "Mortgage Expert",
          },
        ],
        publisher: { "@id": `${BASE_URL}/#organization` },
      },
    ],
  },
  "/insights/blog": {
    title: "Realist Blog - Canadian Real Estate Analysis & Commentary",
    description: "Original Canadian real estate analysis from the Realist.ca team and the Canadian Real Estate Investor Podcast.",
  },
  "/reports": {
    title: "Canadian Real Estate Reports | Realist",
    description: "Browse Realist's Canadian real estate reports for housing data, market analysis, and investor research. Read the latest insights.",
  },
  "/markets": {
    title: "Canadian Real Estate Markets | Realist",
    description: "Programmatic market pages for major Canadian cities, connected to reports, strategies, and underwriting workflows.",
  },
  "/investing": {
    title: "AI Real Estate Deal Finder | Realist",
    description: "Use Realist as an AI real estate deal finder for Canadian markets, strategies, and underwriting workflows. Start with investor guides.",
  },
  "/insights/guides": {
    title: "Canadian Real Estate Guides - Realist.ca",
    description: "Plain-English guides to Canadian real estate investing: BRRR, multiplex, HST, financing, taxes, and strategy.",
  },
  "/insights/encyclopedia": {
    title: "Real Estate Investor Encyclopedia - Realist.ca",
    description: "Search Canadian real estate investing definitions, formulas, examples, caveats, and underwriting calculator specs.",
    canonicalPath: "/insights/encyclopedia",
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Realist.ca Investor Encyclopedia",
        description: "Canadian real estate investing definitions, formulas, examples, caveats, and calculator specs.",
        url: "https://realist.ca/insights/encyclopedia",
      },
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Realist.ca Investor Encyclopedia Entries",
        itemListElement: encyclopediaGuides.map((guide, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: guide.title,
          url: `https://realist.ca${guide.canonicalPath}`,
        })),
      },
    ],
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

/** Strip the brand suffix off a meta title to get a clean schema name. */
function toolNameFromTitle(title: string): string {
  return title.split(/\s[-|]\s/)[0].trim();
}

/**
 * Tool schema (audit item 14): every /tools/* page gets WebApplication
 * (FinanceApplication, free) + BreadcrumbList JSON-LD; the /tools hub gets
 * BreadcrumbList.
 */
function withToolsSchema(path: string, meta: PageMeta): PageMeta {
  if (path !== "/tools" && !path.startsWith("/tools/")) return meta;

  const existing = meta.structuredData
    ? (Array.isArray(meta.structuredData) ? meta.structuredData : [meta.structuredData])
    : [];
  const breadcrumbItems = [
    { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Tools", item: `${BASE_URL}/tools` },
  ];
  const blocks: object[] = [...existing];

  if (path !== "/tools") {
    const toolName = toolNameFromTitle(meta.title);
    breadcrumbItems.push({ "@type": "ListItem", position: 3, name: toolName, item: `${BASE_URL}${path}` });
    blocks.push({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "@id": `${BASE_URL}${path}#webapp`,
      name: toolName,
      url: `${BASE_URL}${path}`,
      description: meta.description,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "CAD" },
      publisher: { "@id": `${BASE_URL}/#organization` },
    });
  }

  blocks.push({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  });

  return { ...meta, structuredData: blocks };
}

export async function getMetaForPath(rawPath: string): Promise<PageMeta> {
  // Strip query string and hash
  const path = rawPath.split("?")[0].split("#")[0];

  // Static lookup
  if (STATIC_META[path]) return withToolsSchema(path, STATIC_META[path]);

  // Trim trailing slash
  if (path.endsWith("/") && path.length > 1) {
    const trimmed = path.slice(0, -1);
    if (STATIC_META[trimmed]) return withToolsSchema(trimmed, STATIC_META[trimmed]);
  }

  const listingMatch = path.match(/^\/listings\/([^\/]+)$/);
  if (listingMatch) {
    try {
      const listing = await getListingSeoByMls(decodeURIComponent(listingMatch[1]));
      if (listing) {
        return {
          title: buildListingSeoTitle(listing),
          description: buildListingSeoDescription(listing),
          ogImage: listing.photoUrl || undefined,
          ogType: "product",
          canonicalPath: listingCanonicalPath(listing),
          keywords: [
            listing.addressStreet,
            listing.addressCity,
            listing.addressProvince,
            listing.mlsNumber,
            "MLS listing analysis",
            "real estate investment analysis",
            "Realist.ca",
          ].filter(Boolean).join(", "),
          structuredData: buildListingStructuredData(listing),
        };
      }
    } catch { /* fall through */ }
  }

  // Dynamic blog post
  const blogMatch = path.match(/^\/insights\/blog\/([^\/]+)$/);
  if (blogMatch) {
    try {
      const post = await storage.getBlogPostBySlug(blogMatch[1]);
      if (post) {
        return {
          title: post.metaTitle || `${post.title} | Realist`,
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
        const canonicalPath = `/reports/${post.slug}`;
        return {
          title: post.metaTitle || `${post.title} | Realist`,
          description: post.metaDescription || post.excerpt,
          ogImage: post.coverImage || undefined,
          ogType: "article",
          canonicalPath,
          structuredData: [
            {
              "@context": "https://schema.org",
              "@type": "Report",
              "@id": `${BASE_URL}${canonicalPath}#report`,
              headline: post.title,
              description: post.metaDescription || post.excerpt,
              url: `${BASE_URL}${canonicalPath}`,
              image: post.coverImage ? (post.coverImage.startsWith("http") ? post.coverImage : `${BASE_URL}${post.coverImage}`) : `${BASE_URL}/og-image.png`,
              datePublished: post.publishedAt ? post.publishedAt.toISOString() : undefined,
              dateModified: post.updatedAt ? post.updatedAt.toISOString() : undefined,
              author: {
                "@type": "Organization",
                name: post.authorName || "Realist Research",
              },
              publisher: { "@id": `${BASE_URL}/#organization` },
              mainEntityOfPage: `${BASE_URL}${canonicalPath}`,
            },
            {
              "@context": "https://schema.org",
              "@type": "Dataset",
              "@id": `${BASE_URL}${canonicalPath}#dataset`,
              name: `${post.title} dataset references`,
              description: `Data sources and market observations used in ${post.title}.`,
              creator: { "@id": `${BASE_URL}/#organization` },
              license: `${BASE_URL}/terms`,
            },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
                { "@type": "ListItem", position: 2, name: "Reports", item: `${BASE_URL}/reports` },
                { "@type": "ListItem", position: 3, name: post.title, item: `${BASE_URL}${canonicalPath}` },
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

  const encyclopediaMatch = path.match(/^\/insights\/encyclopedia\/([^\/]+)$/);
  if (encyclopediaMatch) {
    const guide = getEncyclopediaGuide(encyclopediaMatch[1]);
    if (guide) {
      return {
        title: `${guide.title} - Real Estate Investor Encyclopedia | Realist.ca`,
        description: guide.summary,
        ogType: "article",
        canonicalPath: guide.canonicalPath,
        keywords: [guide.title, guide.slug, guide.category, ...(guide.tags ?? []), ...(guide.searchKeywords ?? [])].join(", "),
        structuredData: [
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://realist.ca/" },
              { "@type": "ListItem", position: 2, name: "Encyclopedia", item: "https://realist.ca/insights/encyclopedia" },
              { "@type": "ListItem", position: 3, name: guide.title, item: `https://realist.ca${guide.canonicalPath}` },
            ],
          },
        ],
      };
    }
  }

  const marketMatch = path.match(/^\/markets\/([^\/]+)$/);
  if (marketMatch) {
    const market = getProgrammaticMarket(marketMatch[1]);
    if (market) {
      return {
        title: `${market.title} | Realist`,
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
        title: `${strategy.title} | Realist`,
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

  // Per-episode podcast pages: /insights/podcast/:slug gets real meta,
  // PodcastEpisode JSON-LD linked to the hub's PodcastSeries node, and
  // BreadcrumbList. Unknown slugs fall through to the 404 path.
  const podcastEpisodeMatch = path.match(/^\/insights\/podcast\/([^\/]+)$/);
  if (podcastEpisodeMatch) {
    try {
      const { getEpisodeBySlug } = await import("./podcastFeed");
      const episode = await getEpisodeBySlug(decodeURIComponent(podcastEpisodeMatch[1]));
      if (episode) return buildPodcastEpisodeMeta(episode);
    } catch { /* fall through */ }
  }

  // Dynamic event page (audit item 12): /events/:slug gets real meta, Event
  // JSON-LD with offers, and OG/Twitter tags so shared links unfurl.
  const eventMatch = path.match(/^\/events\/([^\/]+)$/);
  if (eventMatch) {
    try {
      const event = await getPublishedEventForSeo(decodeURIComponent(eventMatch[1]));
      if (event) return buildEventMeta(event);
    } catch { /* fall through */ }
  }

  return DEFAULT;
}

export interface SeoEventRow {
  slug: string;
  title: string;
  shortDescription: string | null;
  longDescription: string | null;
  headerImageUrl: string | null;
  eventType: string;
  startsAt: Date;
  endsAt: Date | null;
  venueName: string | null;
  venueAddress: string | null;
  city: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  minPriceCents: number | null;
  currency: string;
}

export async function getPublishedEventForSeo(slug: string): Promise<SeoEventRow | null> {
  const { db } = await import("./db");
  const { realistEvents, realistEventTicketTypes } = await import("@shared/schema");
  const { and, asc, eq } = await import("drizzle-orm");

  const [event] = await db.select().from(realistEvents)
    .where(and(eq(realistEvents.slug, slug), eq(realistEvents.status, "PUBLISHED")))
    .limit(1);
  if (!event) return null;

  const tickets = await db.select().from(realistEventTicketTypes)
    .where(and(eq(realistEventTicketTypes.eventId, event.id), eq(realistEventTicketTypes.isActive, true)))
    .orderBy(asc(realistEventTicketTypes.priceCents));

  return {
    slug: event.slug,
    title: event.title,
    shortDescription: event.shortDescription,
    longDescription: event.longDescription,
    headerImageUrl: event.headerImageUrl,
    eventType: event.eventType,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    city: event.city,
    seoTitle: event.seoTitle,
    seoDescription: event.seoDescription,
    minPriceCents: tickets.length ? tickets[0].priceCents : null,
    currency: tickets.length ? tickets[0].currency.toUpperCase() : "CAD",
  };
}

export function formatEventDate(value: Date): string {
  return new Date(value).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function buildEventMeta(event: SeoEventRow): PageMeta {
  const url = `${BASE_URL}/events/${event.slug}`;
  const dateLabel = formatEventDate(event.startsAt);
  const title = event.seoTitle
    || `${event.title}${event.city ? ` - ${event.city}` : ""} - ${dateLabel}`;
  const description = event.seoDescription
    || event.shortDescription
    || `${event.title}${event.city ? ` in ${event.city}` : ""} on ${dateLabel}. A Realist.ca event for Canadian real estate investors. Get tickets and details.`;

  return {
    title,
    description,
    ogImage: event.headerImageUrl || undefined,
    ogType: "website",
    canonicalPath: `/events/${event.slug}`,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "Event",
        "@id": `${url}#event`,
        name: event.title,
        description,
        url,
        startDate: new Date(event.startsAt).toISOString(),
        ...(event.endsAt ? { endDate: new Date(event.endsAt).toISOString() } : {}),
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: event.eventType === "ONLINE"
          ? "https://schema.org/OnlineEventAttendanceMode"
          : "https://schema.org/OfflineEventAttendanceMode",
        ...(event.headerImageUrl
          ? { image: event.headerImageUrl.startsWith("http") ? event.headerImageUrl : `${BASE_URL}${event.headerImageUrl}` }
          : {}),
        location: event.eventType === "ONLINE"
          ? { "@type": "VirtualLocation", url }
          : {
              "@type": "Place",
              name: event.venueName || event.city || "Venue to be announced",
              ...(event.venueAddress ? { address: event.venueAddress } : event.city ? { address: event.city } : {}),
            },
        organizer: { "@type": "Organization", "@id": `${BASE_URL}/#organization`, name: "Realist.ca" },
        offers: {
          "@type": "Offer",
          url,
          price: event.minPriceCents != null ? (event.minPriceCents / 100).toFixed(2) : "0",
          priceCurrency: event.currency,
          availability: "https://schema.org/InStock",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Events", item: `${BASE_URL}/community/events` },
          { "@type": "ListItem", position: 3, name: event.title, item: url },
        ],
      },
    ],
  };
}

function buildPodcastEpisodeMeta(episode: PodcastFeedEpisode): PageMeta {
  const canonicalPath = `/insights/podcast/${episode.slug}`;
  const url = `${BASE_URL}${canonicalPath}`;
  const description = stripShowNotes(episode.description, 158)
    || `${episode.title} — an episode of ${PODCAST_NAME} with Daniel Foch and Nick Hill.`;
  const publishedDate = episode.pubDate ? new Date(episode.pubDate) : null;
  const datePublished = publishedDate && !isNaN(publishedDate.getTime())
    ? publishedDate.toISOString()
    : undefined;
  const isoDuration = durationToIso8601(episode.duration);

  return {
    title: `${episode.title} - ${PODCAST_NAME} Podcast`,
    description,
    ogImage: episode.imageUrl || undefined,
    canonicalPath,
    keywords: deriveEpisodeKeywords(episode.title),
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "PodcastEpisode",
        "@id": `${url}#episode`,
        name: episode.title,
        url,
        ...(datePublished ? { datePublished } : {}),
        description: stripShowNotes(episode.description, 500) || description,
        ...(episode.audioUrl
          ? {
              associatedMedia: {
                "@type": "MediaObject",
                contentUrl: episode.audioUrl,
                encodingFormat: "audio/mpeg",
              },
            }
          : {}),
        ...(isoDuration ? { timeRequired: isoDuration } : {}),
        ...(episode.imageUrl ? { image: episode.imageUrl } : {}),
        partOfSeries: {
          "@type": "PodcastSeries",
          "@id": `${BASE_URL}/insights/podcast#podcast`,
          name: PODCAST_NAME,
          url: `${BASE_URL}/insights/podcast`,
        },
        publisher: { "@id": `${BASE_URL}/#organization` },
        inLanguage: "en-CA",
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Podcast", item: `${BASE_URL}/insights/podcast` },
          { "@type": "ListItem", position: 3, name: episode.title, item: url },
        ],
      },
    ],
  };
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
  const canonicalUrl = normalizeCanonical(meta.canonicalPath ? `${BASE_URL}${meta.canonicalPath}` : canonicalUrlRaw.replace(/^https?:\/\/(?:www\.)?[^/]+/i, BASE_URL));
  const fullTitle = meta.title.includes("Realist") ? meta.title.replace(/\s\|\sRealist\.ca$/, " | Realist") : `${meta.title} | Realist`;
  const titleEsc = escapeHtml(fullTitle);
  const ogImage = meta.ogImage
    ? (meta.ogImage.startsWith("http") ? meta.ogImage : `${BASE_URL}${meta.ogImage.startsWith("/") ? "" : "/"}${meta.ogImage}`)
    : `${BASE_URL}/og-image.png`;
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
  if (meta.noindex) {
    // Real 404s: noindex and no canonical (a self-canonical on a junk URL
    // invites junk indexing).
    out = out.replace(/<link\s+rel=["']canonical["'][^>]*>\s*/i, "");
    replaceMeta("name", "robots", "noindex, nofollow");
  } else {
    replaceLink("canonical", canonicalUrl);
  }
  const rssTag = `<link rel="alternate" type="application/rss+xml" title="Realist Blog RSS" href="${RSS_FEED_URL}" />`;
  if (!/<link\s+rel=["']alternate["'][^>]*application\/rss\+xml/i.test(out)) {
    out = out.replace("</head>", `    ${rssTag}\n  </head>`);
  }

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
      "@id": `${BASE_URL}/#organization`,
      name: "Realist.ca",
      url: BASE_URL,
      logo: `${BASE_URL}/logo.png`,
      sameAs: ORGANIZATION_SAME_AS,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${BASE_URL}/#website`,
      name: "Realist.ca",
      url: BASE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: `${BASE_URL}/reports?search={search_term_string}`,
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

// ---------------------------------------------------------------------------
// Known client-route table (audit item 6 — real 404s).
//
// Mirrors the routes declared in client/src/App.tsx. The static catch-all uses
// this to distinguish "valid SPA surface with default meta" from "junk URL
// that should return HTTP 404 + noindex". Dynamic *content* routes
// (/reports/:slug, /listings/:mls, /markets/:city, /events/:slug, ...) are
// intentionally NOT listed: their slugs are validated by getMetaForPath /
// renderSeoFallback lookups, so an unknown slug correctly falls through to a
// 404.
// ---------------------------------------------------------------------------

const KNOWN_APP_ROUTES = new Set<string>([
  "/",
  "/discover",
  "/deal-analyzer",
  "/tools",
  "/tools/analyzer",
  "/tools/buybox",
  "/tools/buybox/agreement",
  "/tools/buybox/checkout",
  "/tools/coinvest",
  "/tools/coinvest/opportunities",
  "/tools/coinvest/checklist",
  "/tools/coinvest/groups/new",
  "/deal-desk",
  "/crm",
  "/community/meetups/new",
  "/admin/sponsors",
  "/tools/deal-desk",
  "/tools/true-cost",
  "/tools/rent-vs-buy",
  "/tools/cap-rates",
  "/listing-intelligence",
  "/tools/listing-intelligence",
  "/listings/us",
  "/tools/investor-os",
  "/deals",
  "/watchlist",
  "/deal-challenge",
  "/professionals",
  "/tools/will-it-plex",
  "/tools/fixed-vs-variable",
  "/tools/hst-rebate",
  "/tools/hst-calculator",
  "/tools/land-claim-screener",
  "/tools/distress-deals",
  "/tools/motivated-deals",
  "/tools/multiplex-feasibility",
  "/multiplex-investor-fit",
  "/masterclass",
  "/course",
  "/insights/distress-report",
  "/insights/motivated-report",
  "/community/leaderboard",
  "/community/leaderboard/full",
  "/my-performance",
  "/account/api-keys",
  "/insights/market-report",
  "/insights/mortgage-rates",
  "/insights/market-report-builder",
  "/insights/building-permits",
  "/insights/productivity-gap",
  "/insights/new-construction-canada",
  "/insights/gta-precon-pricing",
  "/insights/cpi-march-2026",
  "/insights/the-spread-that-ate-the-economy",
  "/insights/spring-economic-update-2026",
  "/insights/precon-vs-resale-1990s",
  "/insights/bank-of-canada-april-2026",
  "/embed/insights/bank-of-canada-april-2026",
  "/insights/statcan-labour-force-survey-may-2026",
  "/insights/statcan-labour-force-survey-april-2026",
  "/insights/statcan-gdp-q1-2026",
  "/insights/housing-correction-locked-out-2026",
  "/insights/labour-mortgage-stress-april-2026",
  "/insights/monthly-market-report-may-2026",
  "/canada-housing-market",
  "/toronto-housing-market",
  "/toronto-condo-prices-dropping",
  "/biggest-price-drops-gta",
  "/premium",
  "/premium/branding",
  "/community",
  "/community/events",
  "/community/events/unpacking-multiplexes-toronto",
  "/community/network",
  "/insights",
  "/insights/podcast",
  "/insights/blog",
  "/insights/guides",
  "/insights/encyclopedia",
  "/insights/guides/capital-stack-canada",
  "/insights/guides/a-vs-b-vs-c-lenders-canada",
  "/reports",
  "/reports/canada-immigration-dashboard-2026",
  "/reports/realbench-ai-realtor-benchmark",
  "/markets",
  "/investing",
  "/about",
  "/about/team",
  "/about/programs",
  "/about/shop",
  "/about/contact",
  "/thank-you/vancouver-multiplex-2026",
  "/edmonton",
  "/yeg",
  "/buybox",
  "/buybox/agreement",
  "/buybox/checkout",
  "/coinvesting",
  "/coinvesting/opportunities",
  "/coinvesting/checklist",
  "/coinvesting/groups/new",
  "/events",
  "/podcast",
  "/blog",
  "/shop",
  "/dashboard",
  "/compare",
  "/admin",
  "/admin/deal-desk",
  "/admin/events",
  "/admin/events/new",
  "/privacy",
  "/terms",
  "/investor",
  "/partner",
  "/professional/dashboard",
  "/signup",
  "/get-started",
  "/login",
  "/create-account",
  "/forgot-password",
  "/reset-password",
  "/set-password",
  "/verify-phone",
  "/realtor/buyboxes",
  "/partner/network",
  "/join/realtors",
  "/join/lenders",
]);

// App-functional parameterized routes (sessions, checkouts, admin) that must
// never 404 at the HTTP layer.
const KNOWN_APP_ROUTE_PATTERNS: RegExp[] = [
  /^\/tools\/buybox\/confirmation\/[^/]+$/,
  /^\/tools\/coinvest\/groups\/[^/]+$/,
  /^\/buybox\/confirmation\/[^/]+$/,
  /^\/coinvesting\/groups\/[^/]+$/,
  /^\/sponsor\/[^/]+$/,
  /^\/crm\/contacts\/[^/]+$/,
  /^\/analyses\/[^/]+\/deck$/,
  /^\/underwriting\/[^/]+$/,
  /^\/admin\/events\/[^/]+\/edit$/,
  /^\/events\/[^/]+\/success$/,
];

export function isKnownAppRoute(rawPath: string): boolean {
  let path = rawPath.split("?")[0].split("#")[0];
  if (path.length > 1 && path.endsWith("/")) path = path.replace(/\/+$/, "");
  if (KNOWN_APP_ROUTES.has(path)) return true;
  return KNOWN_APP_ROUTE_PATTERNS.some((pattern) => pattern.test(path));
}
